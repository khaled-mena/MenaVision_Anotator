# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING, Any

from django.conf import settings

from cvat.apps.access_tokens.permissions import PolicyEnforcer as AccessTokenPolicyEnforcer
from cvat.apps.iam.permissions import OpenPolicyAgentPermission, get_iam_context

from .audit import AuditLogger
from .context import get_request_role
from .policy import AccessPolicy, ScopeRequest
from .roles import WorkforceRole

if TYPE_CHECKING:
    from rest_framework.viewsets import ViewSet

    from cvat.apps.engine.types import ExtendedRequest


class WorkforcePolicyEnforcer(AccessTokenPolicyEnforcer):
    """
    Drop in replacement for the upstream enforcer that evaluates the business role
    policy first and only then asks OPA. Both layers must allow a request.
    """

    def _check_permission(self, request: ExtendedRequest, view: ViewSet, obj):
        checked_permissions: list[OpenPolicyAgentPermission] = []

        if self.is_metadata_request(request, view):
            return True, checked_permissions

        if not request.user.is_active:
            return False, checked_permissions

        assert hasattr(
            view, "iam_permission_class"
        ), f"View {view} has no 'iam_permission_class' attribute"

        role = get_request_role(request)
        iam_context = get_iam_context(request, obj)
        permissions = view.iam_permission_class.create(request, view, obj, iam_context=iam_context)

        decision = AccessPolicy.evaluate(role, permissions, request.query_params)
        if not decision.allow:
            AuditLogger.record_denied_scope(request.user, decision.denied_request, decision.reason)
            return False, checked_permissions

        for perm in permissions:
            checked_permissions.append(perm)
            if not perm.check_access().allow:
                return False, checked_permissions

        if role is WorkforceRole.ADMIN:
            for perm in permissions:
                AuditLogger.record_authorized_scope(
                    request.user, ScopeRequest.from_permission(perm)
                )

        allow = self._check_permission_plugins(
            request=request, view=view, obj=obj, checked_permissions=checked_permissions
        )
        return allow, checked_permissions


class WorkforcePermission(OpenPolicyAgentPermission):
    """Account and audit management endpoints. Administrators only, decided by OPA."""

    class Scopes(StrEnum):
        LIST = "list"
        VIEW = "view"
        CREATE = "create"
        UPDATE = "update"
        DELETE = "delete"

    @classmethod
    def create(cls, request, view, obj, iam_context):
        return [
            cls.create_base_perm(request, view, scope, iam_context, obj)
            for scope in cls.get_scopes(request, view, obj)
        ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.url = settings.IAM_OPA_DATA_URL + "/workforce/allow"

    @classmethod
    def _get_scopes(cls, request, view, obj):
        Scopes = cls.Scopes
        return [
            {
                "list": Scopes.LIST,
                "retrieve": Scopes.VIEW,
                "assignments": Scopes.VIEW,
                "create": Scopes.CREATE,
                "partial_update": Scopes.UPDATE,
                "activate": Scopes.UPDATE,
                "deactivate": Scopes.UPDATE,
                "change_role": Scopes.UPDATE,
                "reset_password": Scopes.UPDATE,
                "destroy": Scopes.DELETE,
            }[view.action]
        ]

    def get_resource(self) -> dict[str, Any] | None:
        if self.obj is not None:
            return {"id": self.obj.pk}
        return None


class PlatformPolicyPermission(OpenPolicyAgentPermission):
    """Security switches: readable by every authenticated account, changed by administrators."""

    class Scopes(StrEnum):
        VIEW = "view"
        UPDATE = "update"

    @classmethod
    def create(cls, request, view, obj, iam_context):
        return [
            cls.create_base_perm(request, view, scope, iam_context, obj)
            for scope in cls.get_scopes(request, view, obj)
        ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.url = settings.IAM_OPA_DATA_URL + "/workforce_policy/allow"

    @classmethod
    def _get_scopes(cls, request, view, obj):
        return [{"retrieve": cls.Scopes.VIEW, "partial_update": cls.Scopes.UPDATE}[view.action]]

    def get_resource(self):
        return None
