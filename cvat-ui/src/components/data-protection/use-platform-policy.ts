// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';

import { PlatformPolicy, policyClient } from 'utils/administration/workforce-client';

// Deterrence stays on when the policy cannot be read, so a transient API failure
// never silently removes the watermark.
const FALLBACK_POLICY: PlatformPolicy = { watermark_enabled: true, updated_date: '' };

export default function usePlatformPolicy(): PlatformPolicy {
    const [policy, setPolicy] = useState<PlatformPolicy>(FALLBACK_POLICY);

    useEffect(() => {
        let cancelled = false;
        policyClient.get()
            .then((loaded) => {
                if (!cancelled) setPolicy(loaded);
            })
            .catch(() => {
                if (!cancelled) setPolicy(FALLBACK_POLICY);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return policy;
}
