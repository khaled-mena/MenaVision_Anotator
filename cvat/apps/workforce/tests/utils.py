# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from __future__ import annotations

from django.contrib.auth import get_user_model

from cvat.apps.engine.models import Job, Label, Task
from cvat.apps.engine.tests.test_rest_api import create_db_task
from cvat.apps.engine.tests.utils import ApiTestBase
from cvat.apps.workforce.account_service import AccountService
from cvat.apps.workforce.roles import WorkforceRole

User = get_user_model()

PASSWORD = "Strong-Test-Passphrase-2026"


class WorkforceApiTestBase(ApiTestBase):
    """
    Creates one administrator, one Tasker, one Reviewer and a two job task owned by
    the administrator. Job 1 is assigned to the Tasker, job 2 stays unassigned.
    """

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser(
            username="admin", email="admin@example.com", password=PASSWORD
        )
        cls.tasker, _ = AccountService.create(
            actor=cls.admin,
            username="tasker",
            email="tasker@example.com",
            role=WorkforceRole.TASKER,
            password=PASSWORD,
        )
        cls.reviewer, _ = AccountService.create(
            actor=cls.admin,
            username="reviewer",
            email="reviewer@example.com",
            role=WorkforceRole.REVIEWER,
            password=PASSWORD,
        )
        cls.other_tasker, _ = AccountService.create(
            actor=cls.admin,
            username="tasker2",
            email="tasker2@example.com",
            role=WorkforceRole.TASKER,
            password=PASSWORD,
        )

        cls.task: Task = create_db_task(
            {
                "name": "workforce task",
                "owner": cls.admin,
                "overlap": 0,
                "segment_size": 5,
                "image_quality": 75,
                "size": 10,
                "labels": [{"name": "car"}],
            }
        )
        cls.label = Label.objects.get(task=cls.task)
        cls.assigned_job, cls.unassigned_job = list(
            Job.objects.filter(segment__task=cls.task).order_by("id")
        )
        cls.assigned_job.assignee = cls.tasker
        cls.assigned_job.save()

    @staticmethod
    def shape_payload(label_id: int) -> dict:
        return {
            "version": 0,
            "tags": [],
            "tracks": [],
            "shapes": [
                {
                    "type": "rectangle",
                    "occluded": False,
                    "z_order": 0,
                    "points": [1, 1, 20, 20],
                    "frame": 0,
                    "label_id": label_id,
                    "group": 0,
                    "source": "manual",
                    "attributes": [],
                    "elements": [],
                }
            ],
        }
