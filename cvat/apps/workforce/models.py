# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from __future__ import annotations

from django.conf import settings
from django.db import models

from .roles import DEFAULT_ROLE, WorkforceRole


class WorkforceProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workforce_profile",
    )
    role = models.CharField(max_length=16, choices=WorkforceRole.choices, default=DEFAULT_ROLE)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_date = models.DateTimeField(auto_now=True)

    @property
    def workforce_role(self) -> WorkforceRole:
        # A value outside the enum (manual database edit, downgrade) must never widen access.
        try:
            return WorkforceRole(self.role)
        except ValueError:
            return DEFAULT_ROLE


class AuditAction(models.TextChoices):
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_ACTIVATED = "user.activated"
    USER_SUSPENDED = "user.suspended"
    USER_ROLE_CHANGED = "user.role_changed"
    USER_DELETED = "user.deleted"
    PASSWORD_RESET = "user.password_reset"
    PROJECT_CREATED = "project.created"
    PROJECT_DELETED = "project.deleted"
    TASK_CREATED = "task.created"
    TASK_DELETED = "task.deleted"
    JOB_DELETED = "job.deleted"
    ASSIGNMENT_CHANGED = "assignment.changed"
    DATA_IMPORTED = "data.imported"
    DATA_EXPORTED = "data.exported"
    BACKUP_CREATED = "backup.created"
    BACKUP_RESTORED = "backup.restored"
    ACCESS_DENIED = "access.denied"


class AuditResult(models.TextChoices):
    SUCCESS = "success"
    AUTHORIZED = "authorized"
    DENIED = "denied"
    FAILED = "failed"


class AuditRecord(models.Model):
    created_date = models.DateTimeField(auto_now_add=True, db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="audit_records",
    )
    actor_username = models.CharField(max_length=150, blank=True, default="")
    action = models.CharField(max_length=64, choices=AuditAction.choices, db_index=True)
    target_type = models.CharField(max_length=64, blank=True, default="")
    target_id = models.CharField(max_length=64, blank=True, default="")
    target_repr = models.CharField(max_length=256, blank=True, default="")
    result = models.CharField(max_length=16, choices=AuditResult.choices)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_date", "-id"]


class PlatformPolicy(models.Model):
    """Single row of platform wide security switches, editable by administrators."""

    SINGLETON_ID = 1

    watermark_enabled = models.BooleanField(default=True)
    updated_date = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    @classmethod
    def load(cls) -> PlatformPolicy:
        policy, _ = cls.objects.get_or_create(pk=cls.SINGLETON_ID)
        return policy
