# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from django.http import HttpRequest

from .models import WorkforceProfile
from .roles import DEFAULT_ROLE, WorkforceRole

_REQUEST_CACHE_ATTR = "_workforce_role"


def resolve_role(user: AbstractBaseUser | AnonymousUser | None) -> WorkforceRole | None:
    """
    Returns the business role of a user as stored server side.

    Accounts without a profile (created before the platform was introduced, or by
    code paths that bypass the signals) fall back to the least privileged role.
    Superuser and group flags are deliberately ignored here: the profile is the only
    source of the business role, so a missing profile fails closed.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return None

    try:
        return user.workforce_profile.workforce_role
    except WorkforceProfile.DoesNotExist:
        return DEFAULT_ROLE


def get_request_role(request: HttpRequest) -> WorkforceRole | None:
    role = getattr(request, _REQUEST_CACHE_ATTR, None)
    if role is None:
        role = resolve_role(getattr(request, "user", None))
        setattr(request, _REQUEST_CACHE_ATTR, role)
    return role
