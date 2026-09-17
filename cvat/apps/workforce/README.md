# Workforce app

Turns the CVAT fork into a private internal annotation platform with three business roles:
**Admin**, **Tasker** and **Reviewer**. The app is an isolated extension; upstream CVAT
authorization (OPA rules and `iam_permission_class` scopes) keeps working underneath it.

## Authorization model

```
business role (WorkforceProfile.role, server side)
  └─ RoleSync: Django groups + superuser/staff flags derived from the role
       admin    -> group "admin", is_superuser/is_staff
       tasker   -> group "worker"      (OPA privilege "worker": assigned objects only)
       reviewer -> group "worker"
  └─ WorkforcePolicyEnforcer (REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES)
       1. request.user.is_active must be true
       2. AccessPolicy: deny by default scope matrix per role (policy.py)
          - every "export:*", "import:*", "download:*", "dump:*", "upload:*" scope is Admin only
          - job mutations are bound to the workflow stage (tasker: annotation, reviewer: validation)
          - employees only receive compressed chunks and context images of assigned jobs
            (single frames, original quality and task level data stay administrative)
          - /api/users permission, status and delete paths are closed for every role; the
            workforce account API is the only way to change them
       3. OPA (upstream): organization and object relations (assignee, owner, ...)
       4. access token plugins (upstream)
```

The scope names and resource names come from the upstream permission classes
(`OpenPolicyAgentPermission.url` and `.scope`), so no upstream rego file had to change.
New upstream endpoints are closed for employees until they are listed in `policy.py`.

## Extension points

| Concern | Where |
|---|---|
| Add or change what a role may do | `policy.py` (`_EMPLOYEE_BASE`, `_TASKER_EXTRA`, `_REVIEWER_EXTRA`) |
| Account lifecycle rules (last admin, deletion, token revocation) | `account_service.py` |
| Which operations are audited | `audit.py` (`_AUDITED_SCOPES`, `_TRANSFER_ACTIONS`) |
| Role provisioning for accounts created elsewhere | `signals.py`, `role_sync.py` |
| Admin only endpoints | `views.py`, `rules/workforce.rego` |
| Platform wide security switches | `models.PlatformPolicy`, `rules/workforce_policy.rego` |
| Registration switch | `settings.IAM_PUBLIC_REGISTRATION` (route in `cvat/apps/iam/urls.py`) |
| Role exposed to the client | `workforce_role` on `/api/users/*` (`engine/serializers.py`) |

Frontend counterparts live in `cvat-ui/src/utils/access-control` (role helpers, route policy,
annotation menu policy), `cvat-ui/src/components/access-control` (role aware route table),
`cvat-ui/src/components/administration` (admin dashboard), `cvat-ui/src/components/my-work`
(employee home) and `cvat-ui/src/components/data-protection` (browser deterrence, watermark).

## Fail closed rules

- The business role comes from `WorkforceProfile` only. A missing profile or an unknown value
  resolves to Tasker, whatever the Django superuser flag or group membership says.
- Django groups only feed the OPA privilege. A group change without a matching profile
  narrows access (policy denies), it never widens it.
- Audit records are append only: no API, no Django admin registration, no delete endpoint.
  Administrators can read them; nobody can edit them through the platform.

## Migration of existing accounts

`0002_assign_initial_roles` maps superusers and members of the IAM admin group to Admin and every
other account to Tasker, replacing their groups with the matching IAM group. Nothing is granted
Admin automatically beyond accounts that already were superusers.

## Honest classification of controls

- Server enforced: account management, project and task management, imports, exports, backups,
  downloads, assignment based object access, suspension.
- Browser enforced only (deterrence): hidden navigation, context menu, clipboard, drag out,
  print, watermark. They improve usability and traceability; they are not the security boundary.
- Outside the platform: operating system screenshots, screen recording, capture devices. Those
  need managed endpoints, virtual desktops or DLP tooling.

## Deployment behind a public domain

Django rejects state changing requests whose `Origin` does not match a trusted origin
("CSRF Failed: Origin checking failed"). Set the public URL in the compose environment:

```
CVAT_HOST=annotate.example.com
CVAT_BASE_URL=https://annotate.example.com
CSRF_TRUSTED_ORIGINS=https://annotate.example.com   # optional, comma separated extra origins
```

`CVAT_BASE_URL` is trusted automatically when it is not localhost; `CSRF_TRUSTED_ORIGINS`
adds further origins (a second domain, a plain http staging URL). Both feed
`CSRF_TRUSTED_ORIGINS` and `CORS_ALLOWED_ORIGINS`, so the UI served from that domain can
call the API. If TLS terminates in front of Traefik, that proxy must forward
`X-Forwarded-Proto: https` and Traefik must trust it, otherwise upload URLs (TUS) and
redirects are built for plain http and the browser blocks them as mixed content:

```
TRAEFIK_FORWARDED_HEADERS_TRUSTED_IPS=172.24.0.0/16,127.0.0.1/32   # CIDR the proxy connects from
```

The default (`127.0.0.1/32`) trusts nothing outside the Traefik container. Applying the
variable only requires recreating the `traefik` service, no image rebuild.
