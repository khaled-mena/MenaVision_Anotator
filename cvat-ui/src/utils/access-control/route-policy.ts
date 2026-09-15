// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { WorkforceRole, isAdmin } from './roles';

// Route patterns (react-router path templates) that employees may open. Everything
// else in the application route table is administrative and stays hidden and
// unreachable for them; the backend rejects the underlying requests anyway.
const EMPLOYEE_ROUTES = new Set<string>([
    '/jobs',
    '/tasks/:tid/jobs/:jid',
    '/profile',
    '/auth/logout',
]);

export function isRouteAllowed(role: WorkforceRole | null, routePath: string | string[] | undefined): boolean {
    if (isAdmin(role)) return true;
    if (!routePath) return false;
    const paths = Array.isArray(routePath) ? routePath : [routePath];
    return paths.every((path) => EMPLOYEE_ROUTES.has(path));
}
