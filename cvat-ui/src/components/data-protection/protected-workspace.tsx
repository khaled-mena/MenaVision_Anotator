// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { CombinedState } from 'reducers';
import { capabilitiesOf, getRole } from 'utils/access-control/roles';
import { installLeakageGuard } from 'utils/data-protection/leakage-guard';
import SecurityWatermark from './security-watermark';

interface Props {
    watermarkEnabled: boolean;
}

export default function ProtectedWorkspace({ watermarkEnabled }: Props): JSX.Element | null {
    const user = useSelector((state: CombinedState) => state.auth.user);
    const { protectWorkspace } = capabilitiesOf(getRole(user));

    useEffect(() => {
        if (!protectWorkspace) return undefined;
        return installLeakageGuard();
    }, [protectWorkspace]);

    if (!protectWorkspace || !user) return null;

    return watermarkEnabled ? <SecurityWatermark username={user.username} userId={user.id} /> : null;
}
