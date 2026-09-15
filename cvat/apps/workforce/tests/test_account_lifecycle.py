# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.authtoken.models import Token

from cvat.apps.workforce.account_service import AccountService
from cvat.apps.workforce.models import AuditAction, AuditRecord, WorkforceProfile
from cvat.apps.workforce.roles import WorkforceRole

from .utils import PASSWORD, WorkforceApiTestBase

User = get_user_model()


class RoleChangeTests(WorkforceApiTestBase):
    def _role_url(self, user):
        return f"/api/workforce/accounts/{user.id}/role"

    def test_employees_cannot_change_roles(self):
        for actor in (self.tasker, self.reviewer):
            for target in (actor, self.reviewer):
                response = self._post_request(self._role_url(target), actor, data={"role": "admin"})
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.tasker.workforce_profile.role, WorkforceRole.TASKER)

    def test_employee_cannot_escalate_through_users_endpoint(self):
        for payload in ({"groups": ["admin"]}, {"is_superuser": True}, {"is_staff": True}):
            response = self._patch_request(
                f"/api/users/{self.tasker.id}", self.tasker, data=payload
            )
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, payload)
        self.tasker.refresh_from_db()
        self.assertFalse(self.tasker.is_superuser)
        self.assertEqual([g.name for g in self.tasker.groups.all()], ["worker"])

    def test_upstream_user_permission_endpoints_are_closed_even_for_admin(self):
        for payload in ({"groups": ["admin"]}, {"is_superuser": True}, {"is_active": False}):
            response = self._patch_request(f"/api/users/{self.tasker.id}", self.admin, data=payload)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, payload)
        response = self._delete_request(f"/api/users/{self.tasker.id}", self.admin)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.tasker.refresh_from_db()
        self.assertTrue(self.tasker.is_active)
        self.assertFalse(self.tasker.is_superuser)

    def test_admin_can_still_edit_personal_data_through_users_endpoint(self):
        response = self._patch_request(
            f"/api/users/{self.tasker.id}", self.admin, data={"first_name": "Renamed"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)

    def test_admin_can_change_role_and_groups_follow(self):
        response = self._post_request(
            self._role_url(self.tasker), self.admin, data={"role": "reviewer"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.tasker.refresh_from_db()
        self.assertEqual(self.tasker.workforce_profile.role, WorkforceRole.REVIEWER)

        response = self._post_request(
            self._role_url(self.tasker), self.admin, data={"role": "admin"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.tasker.refresh_from_db()
        self.assertTrue(self.tasker.is_superuser)
        self.assertEqual([g.name for g in self.tasker.groups.all()], ["admin"])
        self.assertTrue(
            AuditRecord.objects.filter(
                action=AuditAction.USER_ROLE_CHANGED, target_id=str(self.tasker.id)
            ).exists()
        )

    def test_last_admin_cannot_be_demoted_suspended_or_deleted(self):
        url = f"/api/workforce/accounts/{self.admin.id}"
        response = self._post_request(f"{url}/role", self.admin, data={"role": "tasker"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self._post_request(f"{url}/deactivate", self.admin)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        second_admin = User.objects.create_superuser(username="admin2", password=PASSWORD)
        response = self._post_request(f"{url}/deactivate", second_admin)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self._post_request(
            f"/api/workforce/accounts/{second_admin.id}/deactivate", second_admin
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.admin.refresh_from_db()
        self.assertFalse(self.admin.is_active)
        response = self._delete_request(f"/api/workforce/accounts/{second_admin.id}", self.admin)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SuspensionTests(WorkforceApiTestBase):
    def test_suspended_account_loses_access_immediately(self):
        token = Token.objects.create(user=self.tasker)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(self.client.get("/api/users/self").status_code, status.HTTP_200_OK)
        self.client.credentials()

        response = self._post_request(
            f"/api/workforce/accounts/{self.tasker.id}/deactivate", self.admin
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(
            self.client.get("/api/users/self").status_code, status.HTTP_401_UNAUTHORIZED
        )
        self.client.credentials()

        response = self.client.post(
            "/api/auth/login", data={"username": "tasker", "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self._get_request(f"/api/jobs/{self.assigned_job.id}", self.tasker)
        self.assertIn(
            response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
        )

    def test_admin_can_restore_access(self):
        self._post_request(f"/api/workforce/accounts/{self.tasker.id}/deactivate", self.admin)
        response = self._post_request(
            f"/api/workforce/accounts/{self.tasker.id}/activate", self.admin
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self._get_request(f"/api/jobs/{self.assigned_job.id}", self.tasker).status_code,
            status.HTTP_200_OK,
        )


class DeletionTests(WorkforceApiTestBase):
    def test_active_account_must_be_suspended_before_deletion(self):
        url = f"/api/workforce/accounts/{self.other_tasker.id}"
        self.assertEqual(
            self._delete_request(url, self.admin).status_code, status.HTTP_400_BAD_REQUEST
        )
        self._post_request(f"{url}/deactivate", self.admin)
        self.assertEqual(
            self._delete_request(url, self.admin).status_code, status.HTTP_204_NO_CONTENT
        )
        self.assertFalse(User.objects.filter(pk=self.other_tasker.pk).exists())
        record = AuditRecord.objects.get(action=AuditAction.USER_DELETED)
        self.assertEqual(record.details["username"], "tasker2")

    def test_employees_cannot_delete_accounts(self):
        url = f"/api/workforce/accounts/{self.other_tasker.id}"
        for user in (self.tasker, self.reviewer):
            self.assertEqual(self._delete_request(url, user).status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(
                self._delete_request(f"/api/users/{user.id}", user).status_code,
                status.HTTP_403_FORBIDDEN,
            )


class ProvisioningDefaultsTests(WorkforceApiTestBase):
    def test_new_superuser_becomes_admin_and_plain_user_becomes_tasker(self):
        superuser = User.objects.create_superuser(username="boss", password=PASSWORD)
        plain = User.objects.create_user(username="plain", password=PASSWORD)
        self.assertEqual(superuser.workforce_profile.role, WorkforceRole.ADMIN)
        self.assertEqual(plain.workforce_profile.role, WorkforceRole.TASKER)
        self.assertEqual([g.name for g in plain.groups.all()], ["worker"])

    def test_password_is_never_written_to_audit(self):
        AuditRecord.objects.all().delete()
        response = self._post_request(
            f"/api/workforce/accounts/{self.tasker.id}/password",
            self.admin,
            data={"password": "Rotated-Pass-Phrase-2026"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for record in AuditRecord.objects.all():
            self.assertNotIn("Rotated", str(record.details))
        self.assertTrue(WorkforceProfile.objects.filter(user=self.tasker).exists())


class FailClosedRoleTests(WorkforceApiTestBase):
    def test_missing_profile_resolves_to_tasker_even_for_superuser(self):
        WorkforceProfile.objects.filter(user=self.admin).delete()
        self.admin.refresh_from_db()
        self.assertEqual(AccountService.role_of(self.admin), WorkforceRole.TASKER)
        response = self._get_request("/api/workforce/accounts", self.admin)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_role_value_resolves_to_tasker(self):
        WorkforceProfile.objects.filter(user=self.reviewer).update(role="manager")
        self.reviewer.refresh_from_db()
        self.assertEqual(AccountService.role_of(self.reviewer), WorkforceRole.TASKER)

    def test_django_group_alone_grants_nothing(self):
        self.tasker.groups.set([Group.objects.get(name="admin")])
        response = self._post_request(
            "/api/projects", self.tasker, data={"name": "escalated", "labels": [{"name": "x"}]}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class FrameDeliveryTests(WorkforceApiTestBase):
    def test_employee_only_receives_compressed_chunks(self):
        job = self.assigned_job
        base = f"/api/jobs/{job.id}/data"
        for params in (
            {"type": "frame", "number": 0},
            {"type": "chunk", "number": 0, "quality": "original"},
            {"type": "frame", "number": 0, "quality": "original"},
        ):
            response = self._get_request(base, self.tasker, query_params=params)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, params)

    def test_task_level_data_is_closed_for_employees(self):
        response = self._get_request(
            f"/api/tasks/{self.task.id}/data",
            self.tasker,
            query_params={"type": "chunk", "number": 0, "quality": "compressed"},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
