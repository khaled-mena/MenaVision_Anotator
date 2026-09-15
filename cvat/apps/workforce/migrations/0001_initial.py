# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditRecord",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("created_date", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("actor_username", models.CharField(blank=True, default="", max_length=150)),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("user.created", "User Created"),
                            ("user.updated", "User Updated"),
                            ("user.activated", "User Activated"),
                            ("user.suspended", "User Suspended"),
                            ("user.role_changed", "User Role Changed"),
                            ("user.deleted", "User Deleted"),
                            ("user.password_reset", "Password Reset"),
                            ("project.created", "Project Created"),
                            ("project.deleted", "Project Deleted"),
                            ("task.created", "Task Created"),
                            ("task.deleted", "Task Deleted"),
                            ("job.deleted", "Job Deleted"),
                            ("assignment.changed", "Assignment Changed"),
                            ("data.imported", "Data Imported"),
                            ("data.exported", "Data Exported"),
                            ("backup.created", "Backup Created"),
                            ("backup.restored", "Backup Restored"),
                            ("access.denied", "Access Denied"),
                        ],
                        db_index=True,
                        max_length=64,
                    ),
                ),
                ("target_type", models.CharField(blank=True, default="", max_length=64)),
                ("target_id", models.CharField(blank=True, default="", max_length=64)),
                ("target_repr", models.CharField(blank=True, default="", max_length=256)),
                (
                    "result",
                    models.CharField(
                        choices=[
                            ("success", "Success"),
                            ("authorized", "Authorized"),
                            ("denied", "Denied"),
                            ("failed", "Failed"),
                        ],
                        max_length=16,
                    ),
                ),
                ("details", models.JSONField(blank=True, default=dict)),
                (
                    "actor",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_records",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_date", "-id"],
            },
        ),
        migrations.CreateModel(
            name="WorkforceProfile",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("admin", "Admin"),
                            ("tasker", "Tasker"),
                            ("reviewer", "Reviewer"),
                        ],
                        default="tasker",
                        max_length=16,
                    ),
                ),
                ("updated_date", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="workforce_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
