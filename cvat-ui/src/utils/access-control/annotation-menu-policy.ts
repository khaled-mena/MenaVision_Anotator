// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import type React from 'react';

import { WorkforceRole, capabilitiesOf } from './roles';

// Menu keys mirror the Actions enum of the annotation menu component.
const DATA_TRANSFER_KEYS = new Set(['load_job_anno', 'export_job_dataset']);
const MANAGEMENT_KEYS = new Set(['open_task']);
const BULK_ANNOTATION_KEYS = new Set(['remove_annotations', 'run_actions']);

export function isAnnotationMenuItemVisible(role: WorkforceRole | null, key: React.Key | null | undefined): boolean {
    if (key === null || key === undefined) return true;
    const capabilities = capabilitiesOf(role);
    const itemKey = String(key);
    if (DATA_TRANSFER_KEYS.has(itemKey)) return capabilities.transferData;
    if (MANAGEMENT_KEYS.has(itemKey)) return capabilities.managePlatform;
    if (BULK_ANNOTATION_KEYS.has(itemKey)) return capabilities.manageAnnotationsInBulk;
    return true;
}
