// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState } from 'react';
import Card from 'antd/lib/card';
import Switch from 'antd/lib/switch';
import Alert from 'antd/lib/alert';
import Title from 'antd/lib/typography/Title';
import Text from 'antd/lib/typography/Text';
import Paragraph from 'antd/lib/typography/Paragraph';
import notification from 'antd/lib/notification';
import { Col, Row } from 'antd/lib/grid';

import { PlatformPolicy, policyClient } from 'utils/administration/workforce-client';
import { describeError } from './use-accounts';

export default function SecuritySection(): JSX.Element {
    const [policy, setPolicy] = useState<PlatformPolicy | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        policyClient.get().then(setPolicy).catch((reason: unknown) => {
            notification.error({ message: 'Could not load the security policy', description: describeError(reason) });
        });
    }, []);

    const toggleWatermark = async (enabled: boolean): Promise<void> => {
        setSaving(true);
        try {
            setPolicy(await policyClient.update({ watermark_enabled: enabled }));
        } catch (reason: unknown) {
            notification.error({ message: 'Could not update the security policy', description: describeError(reason) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className='cvat-administration-security'>
            <Row className='cvat-administration-section-header'>
                <Col>
                    <Title level={4}>Security</Title>
                    <Text type='secondary'>Platform wide controls applied to Tasker and Reviewer accounts.</Text>
                </Col>
            </Row>
            <Card className='cvat-administration-security-card' loading={policy === null}>
                <Row justify='space-between' align='middle'>
                    <Col>
                        <Text strong>Security watermark in the annotation workspace</Text>
                        <Paragraph type='secondary' className='cvat-administration-security-hint'>
                            Overlays the username, account id, date and a confidentiality notice across the
                            workspace of employees. It is a traceability measure only and never becomes part
                            of the image or annotations.
                        </Paragraph>
                    </Col>
                    <Col>
                        <Switch
                            checked={!!policy?.watermark_enabled}
                            loading={saving}
                            onChange={toggleWatermark}
                            className='cvat-administration-watermark-switch'
                        />
                    </Col>
                </Row>
            </Card>
            <Alert
                type='info'
                showIcon
                className='cvat-administration-security-limits'
                message='What the browser can and cannot enforce'
                description={(
                    <ul className='cvat-administration-security-limits-list'>
                        <li>
                            Server enforced: exports, imports, backups, downloads, project and task management,
                            account management.
                        </li>
                        <li>
                            Browser deterrence for employees: context menu, clipboard, drag out of the workspace,
                            print, watermark.
                        </li>
                        <li>
                            Not preventable by a web application: operating system screenshots, screen recording,
                            capture software or photographing the screen. Those require managed devices, virtual
                            desktops or endpoint policies outside this platform.
                        </li>
                    </ul>
                )}
            />
        </div>
    );
}
