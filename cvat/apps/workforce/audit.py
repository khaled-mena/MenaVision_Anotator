# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django.contrib.auth.models import AbstractBaseUser

from .models import AuditAction, AuditRecord, AuditResult
from .policy import ScopeRequest

# Sensitive CVAT operations recorded when an administrator is authorized to run them.
# Keyed by (OPA resource, scope). Data transfer scopes are matched by prefix below.
_AUDITED_SCOPES: Mapping[tuple[str, str], AuditAction] = {
    ("projects", "create"): AuditAction.PROJECT_CREATED,
    ("projects", "delete"): AuditAction.PROJECT_DELETED,
    ("projects", "update:assignee"): AuditAction.ASSIGNMENT_CHANGED,
    ("tasks", "create"): AuditAction.TASK_CREATED,
    ("tasks", "create@project"): AuditAction.TASK_CREATED,
    ("tasks", "delete"): AuditAction.TASK_DELETED,
    ("tasks", "update:assignee"): AuditAction.ASSIGNMENT_CHANGED,
    ("jobs", "delete"): AuditAction.JOB_DELETED,
    ("jobs", "update:assignee"): AuditAction.ASSIGNMENT_CHANGED,
}

_TRANSFER_ACTIONS: Mapping[str, AuditAction] = {
    "export:backup": AuditAction.BACKUP_CREATED,
    "import:backup": AuditAction.BACKUP_RESTORED,
    "export:": AuditAction.DATA_EXPORTED,
    "download:": AuditAction.DATA_EXPORTED,
    "dump:": AuditAction.DATA_EXPORTED,
    "import:": AuditAction.DATA_IMPORTED,
    "upload:": AuditAction.DATA_IMPORTED,
}


def _transfer_action(scope: str) -> AuditAction | None:
    for prefix, action in _TRANSFER_ACTIONS.items():
        if scope.startswith(prefix):
            return action
    return None


class AuditLogger:
    """Single writer for audit records. Never receives credentials or file content."""

    @staticmethod
    def record(
        *,
        actor: AbstractBaseUser | None,
        action: AuditAction,
        result: AuditResult,
        target: Any = None,
        target_type: str = "",
        details: Mapping[str, Any] | None = None,
    ) -> AuditRecord:
        target_id = ""
        target_repr = ""
        if target is not None:
            target_type = target_type or type(target).__name__.lower()
            target_id = str(getattr(target, "pk", "") or "")
            target_repr = str(target)[:256]

        return AuditRecord.objects.create(
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            actor_username=getattr(actor, "username", "") or "",
            action=action,
            target_type=target_type,
            target_id=target_id,
            target_repr=target_repr,
            result=result,
            details=dict(details or {}),
        )

    @classmethod
    def record_authorized_scope(cls, actor: AbstractBaseUser, request: ScopeRequest) -> None:
        action = _AUDITED_SCOPES.get((request.resource, request.scope))
        if action is None and request.transfers_data:
            action = _transfer_action(request.scope)
        if action is None:
            return

        cls.record(
            actor=actor,
            action=action,
            result=AuditResult.AUTHORIZED,
            target=request.obj,
            target_type=request.resource,
            details={"scope": request.scope},
        )

    @classmethod
    def record_denied_scope(
        cls, actor: AbstractBaseUser, request: ScopeRequest, reason: str
    ) -> None:
        cls.record(
            actor=actor,
            action=AuditAction.ACCESS_DENIED,
            result=AuditResult.DENIED,
            target=request.obj,
            target_type=request.resource,
            details={"scope": request.scope, "reason": reason},
        )
