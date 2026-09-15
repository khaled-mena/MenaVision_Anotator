# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.apps import AppConfig


class WorkforceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "cvat.apps.workforce"

    def ready(self) -> None:
        from cvat.apps.iam.permissions import load_app_iam_rules

        from .signals import register_signals

        load_app_iam_rules(self)
        register_signals(self)
