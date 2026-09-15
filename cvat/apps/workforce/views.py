# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .account_service import AccountService
from .models import AuditRecord, PlatformPolicy
from .permissions import PlatformPolicyPermission, WorkforcePermission
from .roles import WorkforceRole
from .serializers import (
    AccountCreatedSerializer,
    AccountReadSerializer,
    AccountUpdateSerializer,
    AccountWriteSerializer,
    AssignmentSummarySerializer,
    AuditRecordSerializer,
    ChangeRoleSerializer,
    PlatformPolicySerializer,
    ResetPasswordResponseSerializer,
    ResetPasswordSerializer,
)


@extend_schema(tags=["workforce"])
@extend_schema_view(
    list=extend_schema(
        summary="List platform accounts", responses=AccountReadSerializer(many=True)
    ),
    retrieve=extend_schema(summary="Get a platform account", responses=AccountReadSerializer),
    create=extend_schema(
        summary="Create a platform account",
        request=AccountWriteSerializer,
        responses={201: AccountCreatedSerializer},
    ),
    partial_update=extend_schema(
        summary="Update account details",
        request=AccountUpdateSerializer,
        responses=AccountReadSerializer,
    ),
    destroy=extend_schema(
        summary="Delete a suspended account",
        responses={204: OpenApiResponse(description="Deleted")},
    ),
)
class AccountViewSet(
    viewsets.GenericViewSet,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
):
    iam_permission_class = WorkforcePermission
    iam_supports_organization_params = False
    search_fields = ("username", "first_name", "last_name", "email")
    simple_filters = ("username", "email", "is_active", "workforce_profile__role")
    filter_fields = (*simple_filters, "id", "first_name", "last_name")
    ordering_fields = ("id", "username", "email", "last_login", "date_joined", "is_active")
    ordering = "-date_joined"
    lookup_url_kwarg = "pk"

    def get_queryset(self):
        return AccountService.accounts()

    def get_serializer_class(self):
        if self.action == "create":
            return AccountWriteSerializer
        if self.action == "partial_update":
            return AccountUpdateSerializer
        return AccountReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = AccountWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user, generated_password = AccountService.create(
            actor=request.user,
            username=data["username"],
            role=WorkforceRole(data["role"]),
            password=data.get("password") or None,
            email=data.get("email", ""),
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            is_active=data.get("is_active", True),
        )
        payload = AccountReadSerializer(user).data | {"generated_password": generated_password}
        return Response(payload, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = AccountUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        AccountService.update_details(actor=request.user, user=user, **serializer.validated_data)
        return Response(AccountReadSerializer(user).data)

    def perform_destroy(self, instance):
        AccountService.delete(actor=self.request.user, user=instance)

    @extend_schema(
        summary="Change the role of an account",
        request=ChangeRoleSerializer,
        responses=AccountReadSerializer,
    )
    @action(detail=True, methods=["POST"], url_path="role")
    def change_role(self, request, pk=None):
        user = self.get_object()
        serializer = ChangeRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        AccountService.change_role(
            actor=request.user, user=user, role=WorkforceRole(serializer.validated_data["role"])
        )
        return Response(AccountReadSerializer(user).data)

    @extend_schema(
        summary="Restore access for a suspended account",
        request=None,
        responses=AccountReadSerializer,
    )
    @action(detail=True, methods=["POST"])
    def activate(self, request, pk=None):
        user = self.get_object()
        AccountService.set_active(actor=request.user, user=user, is_active=True)
        return Response(AccountReadSerializer(user).data)

    @extend_schema(
        summary="Suspend an account immediately", request=None, responses=AccountReadSerializer
    )
    @action(detail=True, methods=["POST"])
    def deactivate(self, request, pk=None):
        user = self.get_object()
        AccountService.set_active(actor=request.user, user=user, is_active=False)
        return Response(AccountReadSerializer(user).data)

    @extend_schema(
        summary="Set a new password for an account",
        request=ResetPasswordSerializer,
        responses=ResetPasswordResponseSerializer,
    )
    @action(detail=True, methods=["POST"], url_path="password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        generated_password = AccountService.reset_password(
            actor=request.user,
            user=user,
            password=serializer.validated_data.get("password") or None,
        )
        return Response({"generated_password": generated_password})

    @extend_schema(
        summary="Summarize the work linked to an account", responses=AssignmentSummarySerializer
    )
    @action(detail=True, methods=["GET"])
    def assignments(self, request, pk=None):
        user = self.get_object()
        return Response(
            AssignmentSummarySerializer(AccountService.assignments(user).as_dict()).data
        )


@extend_schema(tags=["workforce"])
@extend_schema_view(
    list=extend_schema(summary="List audit records", responses=AuditRecordSerializer(many=True)),
    retrieve=extend_schema(summary="Get an audit record", responses=AuditRecordSerializer),
)
class AuditRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditRecord.objects.select_related("actor")
    serializer_class = AuditRecordSerializer
    iam_permission_class = WorkforcePermission
    iam_supports_organization_params = False
    search_fields = ("actor_username", "target_repr", "target_id")
    simple_filters = ("action", "result", "actor_username", "target_type", "target_id")
    filter_fields = (*simple_filters, "id")
    ordering_fields = ("id", "created_date", "action", "result")
    ordering = "-created_date"


@extend_schema(tags=["workforce"])
@extend_schema_view(
    retrieve=extend_schema(
        summary="Get platform security policy", responses=PlatformPolicySerializer
    ),
    partial_update=extend_schema(
        summary="Update platform security policy",
        request=PlatformPolicySerializer(partial=True),
        responses=PlatformPolicySerializer,
    ),
)
class PlatformPolicyViewSet(viewsets.GenericViewSet):
    serializer_class = PlatformPolicySerializer
    iam_permission_class = PlatformPolicyPermission
    iam_supports_organization_params = False

    def get_object(self):
        policy = PlatformPolicy.load()
        self.check_object_permissions(self.request, policy)
        return policy

    def retrieve(self, request, *args, **kwargs):
        return Response(self.get_serializer(self.get_object()).data)

    def partial_update(self, request, *args, **kwargs):
        policy = self.get_object()
        serializer = self.get_serializer(policy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)
