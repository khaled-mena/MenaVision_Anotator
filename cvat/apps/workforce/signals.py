# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.conf import settings
from django.db.models.signals import post_save

from .role_sync import RoleSync
from .roles import DEFAULT_ROLE, WorkforceRole


def ensure_profile(sender, instance, created: bool, raw: bool, **kwargs):
    # Accounts created outside the account service (createsuperuser, invitations,
    # tests) still get a server side role: superusers become administrators,
    # everyone else starts with the least privileged role.
    if raw or not created or getattr(instance, "skip_workforce_profile", False):
        return

    RoleSync.apply(instance, WorkforceRole.ADMIN if instance.is_superuser else DEFAULT_ROLE)


def register_signals(app_config):
    post_save.connect(
        ensure_profile,
        sender=settings.AUTH_USER_MODEL,
        dispatch_uid=__name__ + ".ensure_profile",
    )
