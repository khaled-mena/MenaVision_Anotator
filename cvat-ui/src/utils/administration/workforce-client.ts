// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { getCore } from 'cvat-core-wrapper';
import { WorkforceRole } from 'utils/access-control/roles';

const core = getCore();

export interface Account {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    role: WorkforceRole;
    is_active: boolean;
    last_login: string | null;
    date_joined: string;
}

export interface CreatedAccount extends Account {
    generated_password: string | null;
}

export interface AccountsQuery {
    page: number;
    pageSize: number;
    search?: string;
    role?: WorkforceRole | null;
    isActive?: boolean | null;
    sort?: string;
}

export interface Page<T> {
    count: number;
    results: T[];
}

export interface AccountInput {
    username: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    role: WorkforceRole;
    password?: string;
    is_active?: boolean;
}

export interface AssignmentSummary {
    assigned_tasks: number;
    assigned_jobs: number;
    active_jobs: number;
    owned_projects: number;
    owned_tasks: number;
    issues: number;
    comments: number;
}

export interface AuditRecord {
    id: number;
    created_date: string;
    actor: number | null;
    actor_username: string;
    action: string;
    target_type: string;
    target_id: string;
    target_repr: string;
    result: string;
    details: Record<string, unknown>;
}

export interface PlatformPolicy {
    watermark_enabled: boolean;
    updated_date: string;
}

const ACCOUNTS = `${core.config.backendAPI}/workforce/accounts`;
const AUDIT = `${core.config.backendAPI}/workforce/audit`;
const POLICY = `${core.config.backendAPI}/workforce/policy`;

async function request<T>(url: string, method: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    const response = await core.server.request(url, { method, data, params }) as { data: T };
    return response.data;
}

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    );
}

export const accountsClient = {
    list(query: AccountsQuery): Promise<Page<Account>> {
        return request(ACCOUNTS, 'GET', undefined, cleanParams({
            page: query.page,
            page_size: query.pageSize,
            search: query.search,
            workforce_profile__role: query.role,
            is_active: query.isActive,
            sort: query.sort,
        }));
    },
    create(input: AccountInput): Promise<CreatedAccount> {
        return request(ACCOUNTS, 'POST', input);
    },
    update(id: number, input: Pick<AccountInput, 'first_name' | 'last_name' | 'email'>): Promise<Account> {
        return request(`${ACCOUNTS}/${id}`, 'PATCH', input);
    },
    changeRole(id: number, role: WorkforceRole): Promise<Account> {
        return request(`${ACCOUNTS}/${id}/role`, 'POST', { role });
    },
    activate(id: number): Promise<Account> {
        return request(`${ACCOUNTS}/${id}/activate`, 'POST');
    },
    deactivate(id: number): Promise<Account> {
        return request(`${ACCOUNTS}/${id}/deactivate`, 'POST');
    },
    resetPassword(id: number, password?: string): Promise<{ generated_password: string | null }> {
        return request(`${ACCOUNTS}/${id}/password`, 'POST', password ? { password } : {});
    },
    remove(id: number): Promise<void> {
        return request(`${ACCOUNTS}/${id}`, 'DELETE');
    },
    assignments(id: number): Promise<AssignmentSummary> {
        return request(`${ACCOUNTS}/${id}/assignments`, 'GET');
    },
};

export const auditClient = {
    list(page: number, pageSize: number, search?: string): Promise<Page<AuditRecord>> {
        return request(AUDIT, 'GET', undefined, cleanParams({ page, page_size: pageSize, search }));
    },
};

export const policyClient = {
    get(): Promise<PlatformPolicy> {
        return request(POLICY, 'GET');
    },
    update(input: Partial<PlatformPolicy>): Promise<PlatformPolicy> {
        return request(POLICY, 'PATCH', input);
    },
};
