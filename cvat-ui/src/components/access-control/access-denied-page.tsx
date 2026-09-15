// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { useHistory } from 'react-router';
import Result from 'antd/lib/result';
import Button from 'antd/lib/button';

interface Props {
    homePath: string;
}

export default function AccessDeniedPage({ homePath }: Props): JSX.Element {
    const history = useHistory();
    return (
        <div className='cvat-access-denied-page'>
            <Result
                status='403'
                title='This area is not available for your account'
                subTitle='Only platform administrators can open this page. Your assigned work is available from the home page.'
                extra={(
                    <Button type='primary' onClick={() => history.push(homePath)}>
                        Go to my work
                    </Button>
                )}
            />
        </div>
    );
}
