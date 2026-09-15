# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import QuerySet
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import PermissionDenied, ValidationError

from cvat.apps.engine.models import Comment, Issue, Job, Project, Task

from .audit import AuditLogger
from .context import resolve_role
from .models import AuditAction, AuditResult
from .role_sync import RoleSync
from .roles import DEFAULT_ROLE, WorkforceRole

User = get_user_model()

PERSONAL_FIELDS = ("first_name", "last_name", "email")


@dataclass(frozen=True)
class AssignmentSummary:
    assigned_tasks: int
    assigned_jobs: int
    active_jobs: int
    owned_projects: int
    owned_tasks: int
    issues: int
    comments: int

    def as_dict(self) -> dict[str, int]:
        return self.__dict__.copy()

    @property
    def has_history(self) -> bool:
        return any(self.as_dict().values())


class LastAdminGuard:
    """There must always remain at least one active administrator."""

    @staticmethod
    def active_admins() -> QuerySet:
        return User.objects.filter(is_active=True, workforce_profile__role=WorkforceRole.ADMIN)

    @classmethod
    def ensure_not_last(cls, user) -> None:
        is_active_admin = user.is_active and AccountService.role_of(user) is WorkforceRole.ADMIN
        if is_active_admin and not cls.active_admins().exclude(pk=user.pk).exists():
            raise ValidationError(
                "This is the last active administrator account and cannot be removed, "
                "suspended or demoted."
            )


class AccountService:
    """
    Administrator driven account lifecycle. Every mutation is audited without
    recording credentials.
    """

    @staticmethod
    def role_of(user) -> WorkforceRole:
        return resolve_role(user) or DEFAULT_ROLE

    @staticmethod
    def accounts() -> QuerySet:
        return User.objects.select_related("workforce_profile").order_by("-date_joined", "-id")

    @staticmethod
    def generate_password() -> str:
        return secrets.token_urlsafe(12)

    @staticmethod
    def _validate_password(password: str, user) -> None:
        try:
            validate_password(password, user)
        except DjangoValidationError as ex:
            raise ValidationError({"password": ex.messages}) from ex

    @classmethod
    @transaction.atomic
    def create(
        cls,
        *,
        actor,
        username: str,
        role: WorkforceRole,
        password: str | None,
        email: str = "",
        first_name: str = "",
        last_name: str = "",
        is_active: bool = True,
    ) -> tuple[Any, str | None]:
        generated_password = None
        if not password:
            password = generated_password = cls.generate_password()

        user = User(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_active=is_active,
        )
        cls._validate_password(password, user)
        user.set_password(password)
        user.skip_workforce_profile = True
        user.save()

        profile = RoleSync.apply(user, role)
        profile.created_by = actor
        profile.save(update_fields=["created_by"])

        AuditLogger.record(
            actor=actor,
            action=AuditAction.USER_CREATED,
            result=AuditResult.SUCCESS,
            target=user,
            target_type="user",
            details={"role": role.value, "is_active": is_active},
        )
        return user, generated_password

    @classmethod
    @transaction.atomic
    def update_details(cls, *, actor, user, **fields) -> Any:
        changed = {}
        for name in PERSONAL_FIELDS:
            if name in fields and getattr(user, name) != fields[name]:
                setattr(user, name, fields[name])
                changed[name] = fields[name]

        if changed:
            user.save(update_fields=list(changed))
            AuditLogger.record(
                actor=actor,
                action=AuditAction.USER_UPDATED,
                result=AuditResult.SUCCESS,
                target=user,
                target_type="user",
                details={"fields": sorted(changed)},
            )
        return user

    @classmethod
    @transaction.atomic
    def change_role(cls, *, actor, user, role: WorkforceRole) -> Any:
        previous = cls.role_of(user)
        if previous is role:
            return user

        if previous is WorkforceRole.ADMIN:
            LastAdminGuard.ensure_not_last(user)

        RoleSync.apply(user, role)
        cls._revoke_tokens(user)

        AuditLogger.record(
            actor=actor,
            action=AuditAction.USER_ROLE_CHANGED,
            result=AuditResult.SUCCESS,
            target=user,
            target_type="user",
            details={"from": previous.value, "to": role.value},
        )
        return user

    @classmethod
    @transaction.atomic
    def set_active(cls, *, actor, user, is_active: bool) -> Any:
        if user.is_active == is_active:
            return user

        if not is_active:
            if user.pk == actor.pk:
                raise PermissionDenied("You cannot suspend your own account.")
            LastAdminGuard.ensure_not_last(user)

        user.is_active = is_active
        user.save(update_fields=["is_active"])

        if not is_active:
            cls._revoke_tokens(user)

        AuditLogger.record(
            actor=actor,
            action=AuditAction.USER_ACTIVATED if is_active else AuditAction.USER_SUSPENDED,
            result=AuditResult.SUCCESS,
            target=user,
            target_type="user",
        )
        return user

    @classmethod
    @transaction.atomic
    def reset_password(cls, *, actor, user, password: str | None) -> str | None:
        generated_password = None
        if not password:
            password = generated_password = cls.generate_password()

        cls._validate_password(password, user)
        user.set_password(password)
        user.save(update_fields=["password"])
        cls._revoke_tokens(user)

        AuditLogger.record(
            actor=actor,
            action=AuditAction.PASSWORD_RESET,
            result=AuditResult.SUCCESS,
            target=user,
            target_type="user",
            details={"generated": generated_password is not None},
        )
        return generated_password

    @classmethod
    @transaction.atomic
    def delete(cls, *, actor, user) -> None:
        if user.pk == actor.pk:
            raise PermissionDenied("You cannot delete your own account.")
        if user.is_active:
            raise ValidationError(
                "Suspend the account before deleting it. Deletion is a two step operation."
            )
        LastAdminGuard.ensure_not_last(user)

        summary = cls.assignments(user)
        details = {"username": user.username, "history": summary.as_dict()}
        cls._revoke_tokens(user)
        # Upstream CVAT models reference users with SET_NULL, so historical projects, tasks,
        # issues and comments survive deletion with their author cleared. The audit record
        # keeps the username for traceability.
        user.delete()

        AuditLogger.record(
            actor=actor,
            action=AuditAction.USER_DELETED,
            result=AuditResult.SUCCESS,
            target_type="user",
            details=details,
        )

    @staticmethod
    def assignments(user) -> AssignmentSummary:
        assigned_jobs = Job.objects.filter(assignee=user)
        return AssignmentSummary(
            assigned_tasks=Task.objects.filter(assignee=user).count(),
            assigned_jobs=assigned_jobs.count(),
            active_jobs=assigned_jobs.exclude(state="completed").count(),
            owned_projects=Project.objects.filter(owner=user).count(),
            owned_tasks=Task.objects.filter(owner=user).count(),
            issues=Issue.objects.filter(owner=user).count(),
            comments=Comment.objects.filter(owner=user).count(),
        )

    @staticmethod
    def _revoke_tokens(user) -> None:
        # Session cookies stop working on their own: the Django auth backend refuses
        # inactive users and a password change rotates the session hash.
        Token.objects.filter(user=user).delete()
        access_tokens = getattr(user, "access_tokens", None)
        if access_tokens is not None:
            access_tokens.all().delete()
