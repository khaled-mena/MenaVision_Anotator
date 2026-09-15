# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

"""
Business level access policy for the internal annotation platform.

The policy is evaluated before OPA for every API request. It answers the coarse
question "may this role ever use this scope on this resource?", while OPA keeps
answering the object level question "is this user related to this object?"
(assignee, organization member, ...). Anything not listed here is denied for
employee roles, so new upstream endpoints are closed until explicitly reviewed.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

from cvat.apps.iam.permissions import OpenPolicyAgentPermission

from .roles import WorkforceRole

# Scopes that move data into or out of the platform. Admin only, on every resource.
DATA_TRANSFER_SCOPE_PREFIXES = ("export:", "import:", "download:", "dump:", "upload:")

# Frame delivery an employee may receive for an assigned job: compressed chunks and context
# images, which is exactly what the annotation client requests. Single frame downloads and
# original quality retrieval stay administrative.
EMPLOYEE_DATA_TYPES = frozenset({"chunk", "context_image"})
EMPLOYEE_DATA_QUALITY = "compressed"

# Upstream user endpoints that would bypass the account service (role sync, last admin
# protection, two step deletion, token revocation). Closed for every role; the workforce
# API is the only way to change permissions, status or existence of an account.
SUPERSEDED_SCOPES = frozenset({("users", "update:permissions"), ("users", "delete")})

ScopeMatrix = Mapping[str, frozenset[str]]


def _matrix(entries: Mapping[str, Iterable[str]]) -> ScopeMatrix:
    return {resource: frozenset(scopes) for resource, scopes in entries.items()}


# Read only surface every employee needs to open the workspace of an assigned job.
_EMPLOYEE_BASE: ScopeMatrix = _matrix(
    {
        "server": {"view"},
        "users": {"list", "view", "update:personal_data"},
        "projects": {"list", "view"},
        "tasks": {"list", "view", "view:data"},
        "jobs": {
            "list",
            "view",
            "view:data",
            "view:metadata",
            "view:annotations",
            "view:validation_layout",
            "update:state",
        },
        "labels": {"list", "view"},
        "issues": {"list", "view"},
        "comments": {"list", "view", "create@issue"},
        "annotationguides": {"view"},
        "events": {"send:events"},
        "requests": {"list", "view"},
        "organizations": {"list"},
        "memberships": {"list"},
        "invitations": {"list"},
        "growth": {"list", "view", "update"},
        # Interactive AI tools return shapes to the client, which saves them through the
        # job annotation path where the stage rule applies. Offline auto annotation
        # (lambda requests) writes annotations directly and stays administrative.
        "lambda": {"list", "view", "call:online"},
        "workforce_policy": {"view"},
    }
)

_TASKER_EXTRA: ScopeMatrix = _matrix(
    {
        "jobs": {"update:annotations", "delete:annotations", "update:metadata"},
        "issues": {"update"},
    }
)

_REVIEWER_EXTRA: ScopeMatrix = _matrix(
    {
        "jobs": {"update:annotations"},
        "issues": {"create@job", "update", "delete"},
        "comments": {"update", "delete"},
        "conflicts": {"list", "view"},
        "quality_reports": {"list", "view"},
    }
)


def _merge(*matrices: ScopeMatrix) -> ScopeMatrix:
    merged: dict[str, frozenset[str]] = {}
    for matrix in matrices:
        for resource, scopes in matrix.items():
            merged[resource] = merged.get(resource, frozenset()) | scopes
    return merged


ROLE_SCOPES: Mapping[WorkforceRole, ScopeMatrix] = {
    WorkforceRole.TASKER: _merge(_EMPLOYEE_BASE, _TASKER_EXTRA),
    WorkforceRole.REVIEWER: _merge(_EMPLOYEE_BASE, _REVIEWER_EXTRA),
}

# Job mutations are additionally bound to the workflow stage the role is responsible for,
# so a Tasker cannot touch a job that is already under review and a Reviewer cannot
# edit a job that has not reached validation yet.
JOB_MUTATION_SCOPES = frozenset(
    {"update:annotations", "delete:annotations", "update:metadata", "update:state"}
)
ROLE_JOB_STAGES: Mapping[WorkforceRole, frozenset[str]] = {
    WorkforceRole.TASKER: frozenset({"annotation"}),
    WorkforceRole.REVIEWER: frozenset({"validation"}),
}


@dataclass(frozen=True)
class ScopeRequest:
    resource: str
    scope: str
    obj: Any = None
    query: Mapping[str, str] = field(default_factory=dict)

    @classmethod
    def from_permission(
        cls, permission: OpenPolicyAgentPermission, query: Mapping[str, str] | None = None
    ) -> ScopeRequest:
        # Permission URLs look like ".../v1/data/<resource>/allow".
        resource = permission.url.rstrip("/").rsplit("/", 2)[-2]
        return cls(
            resource=resource,
            scope=str(permission.scope),
            obj=permission.obj,
            # QueryDict.items() yields the last value per key, so multi valued parameters
            # cannot smuggle a second "quality" or "type".
            query=dict((query or {}).items()),
        )

    @property
    def transfers_data(self) -> bool:
        return self.scope.startswith(DATA_TRANSFER_SCOPE_PREFIXES)


@dataclass(frozen=True)
class PolicyDecision:
    allow: bool
    reason: str = ""
    denied_request: ScopeRequest | None = field(default=None)


class AccessPolicy:
    """Deny by default role policy. Admin is unrestricted at this layer."""

    @classmethod
    def evaluate(
        cls,
        role: WorkforceRole,
        permissions: Iterable[OpenPolicyAgentPermission],
        query: Mapping[str, str] | None = None,
    ) -> PolicyDecision:
        for permission in permissions:
            decision = cls.evaluate_scope(role, ScopeRequest.from_permission(permission, query))
            if not decision.allow:
                return decision

        return PolicyDecision(allow=True)

    @classmethod
    def evaluate_scope(cls, role: WorkforceRole, request: ScopeRequest) -> PolicyDecision:
        if (request.resource, request.scope) in SUPERSEDED_SCOPES:
            return cls._deny(request, "use the workforce account API for this operation")

        if role is WorkforceRole.ADMIN:
            return PolicyDecision(allow=True)

        if request.transfers_data:
            return cls._deny(request, "data transfer is restricted to administrators")

        allowed_scopes = ROLE_SCOPES[role].get(request.resource, frozenset())
        if request.scope not in allowed_scopes:
            return cls._deny(request, f"scope is not available to the {role.label} role")

        if request.resource == "jobs" and request.scope in JOB_MUTATION_SCOPES:
            stage = getattr(request.obj, "stage", None)
            if stage is not None and stage not in ROLE_JOB_STAGES[role]:
                return cls._deny(request, f"job is not in a stage handled by the {role.label} role")

        if request.scope == "view:data" and not cls._is_employee_frame_delivery(request):
            return cls._deny(request, "only compressed chunks of assigned jobs are delivered")

        return PolicyDecision(allow=True)

    @staticmethod
    def _is_employee_frame_delivery(request: ScopeRequest) -> bool:
        data_type = request.query.get("type", "chunk")
        quality = request.query.get("quality", EMPLOYEE_DATA_QUALITY)
        return data_type in EMPLOYEE_DATA_TYPES and quality == EMPLOYEE_DATA_QUALITY

    @staticmethod
    def _deny(request: ScopeRequest, reason: str) -> PolicyDecision:
        return PolicyDecision(allow=False, reason=reason, denied_request=request)
