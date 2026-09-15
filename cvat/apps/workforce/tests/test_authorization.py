# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import status

from cvat.apps.engine.models import StageChoice
from cvat.apps.workforce.models import AuditAction, AuditRecord

from .utils import WorkforceApiTestBase

EXPORT_FORMAT = "CVAT for images 1.1"


class RegistrationTests(WorkforceApiTestBase):
    def test_public_registration_endpoint_is_not_routed(self):
        response = self.client.post(
            "/api/auth/register",
            data={
                "username": "intruder",
                "email": "intruder@example.com",
                "password1": "Some-Strong-Pass-2026",
                "password2": "Some-Strong-Pass-2026",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_registration_is_absent_from_api_schema(self):
        response = self._get_request("/api/schema/", self.admin)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(b"/api/auth/register", response.content)


class AccountCreationTests(WorkforceApiTestBase):
    ENDPOINT = "/api/workforce/accounts"

    def _payload(self, username="newcomer", role="tasker"):
        return {"username": username, "role": role, "password": "Another-Strong-Pass-2026"}

    def test_tasker_cannot_create_account(self):
        response = self._post_request(self.ENDPOINT, self.tasker, data=self._payload())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reviewer_cannot_create_account(self):
        response = self._post_request(self.ENDPOINT, self.reviewer, data=self._payload())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_account_with_role(self):
        response = self._post_request(
            self.ENDPOINT, self.admin, data=self._payload(role="reviewer")
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        self.assertEqual(response.json()["role"], "reviewer")
        self.assertTrue(
            AuditRecord.objects.filter(action=AuditAction.USER_CREATED, actor=self.admin).exists()
        )

    def test_employees_cannot_list_accounts(self):
        for user in (self.tasker, self.reviewer):
            response = self._get_request(self.ENDPOINT, user)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_requests_are_rejected(self):
        response = self.client.get(self.ENDPOINT)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ProjectAndTaskCreationTests(WorkforceApiTestBase):
    def test_only_admin_can_create_projects(self):
        payload = {"name": "restricted project", "labels": [{"name": "x"}]}
        for user, expected in (
            (self.tasker, status.HTTP_403_FORBIDDEN),
            (self.reviewer, status.HTTP_403_FORBIDDEN),
            (self.admin, status.HTTP_201_CREATED),
        ):
            response = self._post_request("/api/projects", user, data=payload)
            self.assertEqual(response.status_code, expected, user.username)

    def test_only_admin_can_create_tasks(self):
        payload = {"name": "restricted task", "labels": [{"name": "x"}]}
        for user, expected in (
            (self.tasker, status.HTTP_403_FORBIDDEN),
            (self.reviewer, status.HTTP_403_FORBIDDEN),
            (self.admin, status.HTTP_201_CREATED),
        ):
            response = self._post_request("/api/tasks", user, data=payload)
            self.assertEqual(response.status_code, expected, user.username)

    def test_employees_cannot_delete_tasks(self):
        for user in (self.tasker, self.reviewer):
            response = self._delete_request(f"/api/tasks/{self.task.id}", user)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class DataTransferTests(WorkforceApiTestBase):
    def test_employees_cannot_export_or_download(self):
        job = self.assigned_job
        self.reviewer_job = job
        for user in (self.tasker, self.reviewer):
            job.assignee = user
            job.stage = StageChoice.ANNOTATION if user == self.tasker else StageChoice.VALIDATION
            job.save()

            checks = [
                ("post", f"/api/jobs/{job.id}/dataset/export", {"format": EXPORT_FORMAT}),
                ("post", f"/api/tasks/{self.task.id}/dataset/export", {"format": EXPORT_FORMAT}),
                ("get", f"/api/tasks/{self.task.id}/annotations", {"format": EXPORT_FORMAT}),
                ("post", f"/api/tasks/{self.task.id}/backup/export", None),
                ("get", f"/api/tasks/{self.task.id}/data", {"type": "chunk", "number": 0}),
                ("post", f"/api/jobs/{job.id}/annotations", {"format": EXPORT_FORMAT}),
                ("get", "/api/events", {"from": "2020-01-01T00:00:00Z"}),
            ]
            for method, path, params in checks:
                if method == "get":
                    response = self._get_request(path, user, query_params=params)
                else:
                    response = self._post_request(path, user, query_params=params)
                self.assertEqual(
                    response.status_code, status.HTTP_403_FORBIDDEN, f"{user.username} {path}"
                )

    def test_admin_can_start_export(self):
        response = self._post_request(
            f"/api/tasks/{self.task.id}/dataset/export",
            self.admin,
            query_params={"format": EXPORT_FORMAT, "save_images": "false"},
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED, response.content)
        self.assertTrue(
            AuditRecord.objects.filter(action=AuditAction.DATA_EXPORTED, actor=self.admin).exists()
        )


class AssignmentAccessTests(WorkforceApiTestBase):
    def test_tasker_can_view_and_annotate_assigned_job(self):
        job = self.assigned_job
        response = self._get_request(f"/api/jobs/{job.id}", self.tasker)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self._patch_request(
            f"/api/jobs/{job.id}/annotations?action=create",
            self.tasker,
            data=self.shape_payload(self.label.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)

        response = self._patch_request(
            f"/api/jobs/{job.id}", self.tasker, data={"state": "completed"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_tasker_cannot_access_unassigned_job(self):
        job = self.unassigned_job
        self.assertEqual(
            self._get_request(f"/api/jobs/{job.id}", self.tasker).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self._get_request(f"/api/jobs/{job.id}/annotations", self.tasker).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        response = self._get_request("/api/jobs", self.tasker)
        self.assertEqual([j["id"] for j in response.json()["results"]], [self.assigned_job.id])

    def test_tasker_cannot_reassign_or_change_stage(self):
        job = self.assigned_job
        for payload in ({"assignee": self.other_tasker.id}, {"stage": "validation"}):
            response = self._patch_request(f"/api/jobs/{job.id}", self.tasker, data=payload)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, payload)

    def test_tasker_cannot_edit_job_under_review(self):
        job = self.assigned_job
        job.stage = StageChoice.VALIDATION
        job.save()
        response = self._patch_request(
            f"/api/jobs/{job.id}/annotations?action=create",
            self.tasker,
            data=self.shape_payload(self.label.id),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self._get_request(f"/api/jobs/{job.id}", self.tasker).status_code, status.HTTP_200_OK
        )

    def test_reviewer_can_review_assigned_job(self):
        job = self.assigned_job
        job.assignee = self.reviewer
        job.stage = StageChoice.VALIDATION
        job.save()

        self.assertEqual(
            self._get_request(f"/api/jobs/{job.id}/annotations", self.reviewer).status_code,
            status.HTTP_200_OK,
        )
        response = self._post_request(
            "/api/issues",
            self.reviewer,
            data={"frame": 0, "position": [1, 1, 5, 5], "job": job.id, "message": "fix it"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        response = self._patch_request(
            f"/api/jobs/{job.id}", self.reviewer, data={"state": "rejected"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_reviewer_cannot_access_unassigned_review(self):
        for job in (self.assigned_job, self.unassigned_job):
            response = self._get_request(f"/api/jobs/{job.id}", self.reviewer)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reviewer_cannot_edit_job_still_in_annotation(self):
        job = self.assigned_job
        job.assignee = self.reviewer
        job.save()
        response = self._patch_request(
            f"/api/jobs/{job.id}/annotations?action=create",
            self.reviewer,
            data=self.shape_payload(self.label.id),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_employees_cannot_read_other_users(self):
        for user in (self.tasker, self.reviewer):
            response = self._get_request(f"/api/users/{self.admin.id}", user)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
            response = self._get_request("/api/users", user)
            self.assertEqual([u["id"] for u in response.json()["results"]], [user.id])
