// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { useSelector } from 'react-redux';

import { CombinedState } from 'reducers';
import { capabilitiesOf, getRole } from 'utils/access-control/roles';
import PasswordChangeCard from './password-change-card';
import ApiTokensCard from './api-tokens-card';

interface Props {
    isPasswordChangeEnabled: boolean;
}

function SecurityContent({ isPasswordChangeEnabled }: Props): JSX.Element {
    const user = useSelector((state: CombinedState) => state.auth.user);
    // API tokens are a programmatic data path; the server denies them to employees.
    const { transferData } = capabilitiesOf(getRole(user));

    return (
        <div className='cvat-security-content'>
            {isPasswordChangeEnabled && <PasswordChangeCard />}
            {transferData && <ApiTokensCard />}
        </div>
    );
}

export default React.memo(SecurityContent);
