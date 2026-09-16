### Added

- Internal workforce platform: server side Admin, Tasker and Reviewer roles, an administrator
  account management dashboard, audit log, assignment based access for employees, browser side
  data leakage deterrence and a security watermark for annotation workspaces.

### Changed

- Public account registration is disabled (`IAM_PUBLIC_REGISTRATION`); accounts are created by
  administrators only.
- Data exports, imports, backups and downloads are restricted to administrators on the server.
- `CVAT_BASE_URL` and the new `CSRF_TRUSTED_ORIGINS` environment variable feed Django
  `CSRF_TRUSTED_ORIGINS`/`CORS_ALLOWED_ORIGINS`, so deployments on a public domain no longer
  fail with "CSRF Failed: Origin checking failed".
