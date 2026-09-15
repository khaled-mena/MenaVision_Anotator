// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { User } from 'cvat-core-wrapper';

export enum WorkforceRole {
    ADMIN = 'admin',
    TASKER = 'tasker',
    REVIEWER = 'reviewer',
}

// The role is decided by the server and only mirrored here to shape the interface.
// Every action it unlocks is enforced again by the backend.
export function getRole(user: User | null): WorkforceRole | null {
    if (!user) return null;
    const { role } = user;
    return Object.values(WorkforceRole).includes(role as WorkforceRole) ?
        (role as WorkforceRole) : WorkforceRole.TASKER;
}

export function isAdmin(role: WorkforceRole | null): boolean {
    return role === WorkforceRole.ADMIN;
}

export function isEmployee(role: WorkforceRole | null): boolean {
    return role === WorkforceRole.TASKER || role === WorkforceRole.REVIEWER;
}

export function roleLabel(role: WorkforceRole | string): string {
    switch (role) {
        case WorkforceRole.ADMIN: return 'Admin';
        case WorkforceRole.REVIEWER: return 'Reviewer';
        case WorkforceRole.TASKER: return 'Tasker';
        default: return String(role);
    }
}

export function homePath(role: WorkforceRole | null): string {
    return isAdmin(role) ? '/tasks' : '/jobs';
}

export interface Capabilities {
    managePlatform: boolean;
    transferData: boolean;
    manageAnnotationsInBulk: boolean;
    protectWorkspace: boolean;
}

export function capabilitiesOf(role: WorkforceRole | null): Capabilities {
    const admin = isAdmin(role);
    return {
        managePlatform: admin,
        transferData: admin,
        manageAnnotationsInBulk: admin || role === WorkforceRole.TASKER,
        protectWorkspace: isEmployee(role),
    };
}
