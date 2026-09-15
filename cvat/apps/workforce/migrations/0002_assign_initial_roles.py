# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.conf import settings
from django.db import migrations

ADMIN = "admin"
TASKER = "tasker"
EMPLOYEE_GROUP = "worker"


def assign_roles(apps, schema_editor):
    """
    Accounts that predate the platform get a role from the evidence available:
    superusers and members of the IAM admin group become administrators, every
    other account starts as a Tasker and loses the upstream "user" privilege so
    that it can no longer create projects or tasks.
    """
    User = apps.get_model(settings.AUTH_USER_MODEL)
    Group = apps.get_model("auth", "Group")
    WorkforceProfile = apps.get_model("workforce", "WorkforceProfile")

    admin_group, _ = Group.objects.get_or_create(name=settings.IAM_ADMIN_ROLE)
    employee_group, _ = Group.objects.get_or_create(name=EMPLOYEE_GROUP)

    for user in User.objects.all().iterator():
        if WorkforceProfile.objects.filter(user=user).exists():
            continue

        is_admin = user.is_superuser or user.groups.filter(pk=admin_group.pk).exists()
        WorkforceProfile.objects.create(user=user, role=ADMIN if is_admin else TASKER)

        if is_admin:
            if not (user.is_superuser and user.is_staff):
                user.is_superuser = user.is_staff = True
                user.save(update_fields=["is_superuser", "is_staff"])
            user.groups.set([admin_group])
        else:
            user.groups.set([employee_group])


class Migration(migrations.Migration):

    dependencies = [
        ("workforce", "0001_initial"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(assign_roles, migrations.RunPython.noop),
    ]
