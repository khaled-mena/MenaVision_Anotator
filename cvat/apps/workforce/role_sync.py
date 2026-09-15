# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, Group

from .models import WorkforceProfile
from .roles import WorkforceRole


class RoleSync:
    """
    Keeps the Django level authorization state (groups, staff and superuser flags)
    derived from the business role, so OPA and the Django admin site see the same
    picture as the platform. The business role is the single source of truth.
    """

    @classmethod
    def apply(cls, user: AbstractBaseUser, role: WorkforceRole) -> WorkforceProfile:
        profile, _ = WorkforceProfile.objects.get_or_create(user=user, defaults={"role": role})
        if profile.role != role:
            profile.role = role
            profile.save(update_fields=["role", "updated_date"])

        cls._sync_django_state(user, role)
        return profile

    @staticmethod
    def _sync_django_state(user: AbstractBaseUser, role: WorkforceRole) -> None:
        is_admin = role is WorkforceRole.ADMIN
        if user.is_superuser != is_admin or user.is_staff != is_admin:
            user.is_superuser = is_admin
            user.is_staff = is_admin
            user.save(update_fields=["is_superuser", "is_staff"])

        group, _ = Group.objects.get_or_create(name=role.iam_group)
        user.groups.set([group])
