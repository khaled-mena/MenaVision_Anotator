# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.urls import path
from rest_framework import routers

from .views import AccountViewSet, AuditRecordViewSet, PlatformPolicyViewSet

router = routers.DefaultRouter(trailing_slash=False)
router.register("workforce/accounts", AccountViewSet, basename="workforce_account")
router.register("workforce/audit", AuditRecordViewSet, basename="workforce_audit")

urlpatterns = router.urls + [
    path(
        "workforce/policy",
        PlatformPolicyViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update"},
            basename="workforce_policy",
            detail=True,
        ),
        name="workforce_policy",
    ),
]
