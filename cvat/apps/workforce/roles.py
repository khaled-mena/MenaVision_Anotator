# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from __future__ import annotations

from django.conf import settings
from django.db import models

# OPA privilege used for every employee role. It maps onto the upstream "worker"
# rules, which already restrict object access to assigned tasks and jobs.
EMPLOYEE_IAM_GROUP = "worker"


class WorkforceRole(models.TextChoices):
    ADMIN = "admin", "Admin"
    TASKER = "tasker", "Tasker"
    REVIEWER = "reviewer", "Reviewer"

    @property
    def iam_group(self) -> str:
        return settings.IAM_ADMIN_ROLE if self is WorkforceRole.ADMIN else EMPLOYEE_IAM_GROUP

    @property
    def is_employee(self) -> bool:
        return self is not WorkforceRole.ADMIN


# New accounts that were not explicitly assigned a role by an Admin receive the
# least privileged role.
DEFAULT_ROLE = WorkforceRole.TASKER
