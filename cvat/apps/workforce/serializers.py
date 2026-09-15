# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .account_service import AccountService
from .models import AuditRecord, PlatformPolicy
from .roles import WorkforceRole

User = get_user_model()


class AccountReadSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "is_active",
            "last_login",
            "date_joined",
        )
        read_only_fields = fields

    def get_role(self, user) -> str:
        return AccountService.role_of(user).value


class AccountWriteSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=WorkforceRole.choices)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("username", "first_name", "last_name", "email", "role", "password", "is_active")
        extra_kwargs = {
            "email": {"required": False, "allow_blank": True},
            "is_active": {"required": False},
        }


class AccountUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("first_name", "last_name", "email")
        extra_kwargs = {name: {"required": False} for name in fields}


class AccountCreatedSerializer(AccountReadSerializer):
    """Only response that ever carries a password: the generated one, shown once."""

    generated_password = serializers.CharField(read_only=True, allow_null=True)

    class Meta(AccountReadSerializer.Meta):
        fields = AccountReadSerializer.Meta.fields + ("generated_password",)
        read_only_fields = fields


class ChangeRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=WorkforceRole.choices)


class ResetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)


class ResetPasswordResponseSerializer(serializers.Serializer):
    generated_password = serializers.CharField(read_only=True, allow_null=True)


class AssignmentSummarySerializer(serializers.Serializer):
    assigned_tasks = serializers.IntegerField()
    assigned_jobs = serializers.IntegerField()
    active_jobs = serializers.IntegerField()
    owned_projects = serializers.IntegerField()
    owned_tasks = serializers.IntegerField()
    issues = serializers.IntegerField()
    comments = serializers.IntegerField()


class AuditRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditRecord
        fields = (
            "id",
            "created_date",
            "actor",
            "actor_username",
            "action",
            "target_type",
            "target_id",
            "target_repr",
            "result",
            "details",
        )
        read_only_fields = fields


class PlatformPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformPolicy
        fields = ("watermark_enabled", "updated_date")
        read_only_fields = ("updated_date",)
