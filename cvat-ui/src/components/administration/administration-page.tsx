// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React from 'react';
import { useHistory, useParams } from 'react-router';
import { AuditOutlined, SafetyOutlined, TeamOutlined } from '@ant-design/icons';
import { Col, Row } from 'antd/lib/grid';
import Menu from 'antd/lib/menu';
import Text from 'antd/lib/typography/Text';
import Title from 'antd/lib/typography/Title';

import dimensions from 'utils/dimensions';
import AccountsSection from './accounts-section';
import AuditSection from './audit-section';
import SecuritySection from './security-section';

export type AdministrationSection = 'users' | 'audit' | 'security';

const SECTIONS: AdministrationSection[] = ['users', 'audit', 'security'];

export default function AdministrationPage(): JSX.Element {
    const history = useHistory();
    const { section } = useParams<{ section?: string }>();
    const activeSection: AdministrationSection = SECTIONS.includes(section as AdministrationSection) ?
        (section as AdministrationSection) : 'users';

    const menuItems = [
        {
            key: 'users',
            icon: <TeamOutlined />,
            label: <Text className='cvat-administration-menu-item-users'>Users</Text>,
        },
        {
            key: 'audit',
            icon: <AuditOutlined />,
            label: <Text className='cvat-administration-menu-item-audit'>Audit log</Text>,
        },
        {
            key: 'security',
            icon: <SafetyOutlined />,
            label: <Text className='cvat-administration-menu-item-security'>Security</Text>,
        },
    ];

    const renderContent = (): JSX.Element => {
        switch (activeSection) {
            case 'audit':
                return <AuditSection />;
            case 'security':
                return <SecuritySection />;
            case 'users':
            default:
                return <AccountsSection />;
        }
    };

    return (
        <div className='cvat-administration-page'>
            <Row justify='center' align='middle'>
                <Col {...dimensions}>
                    <Title level={2} className='cvat-administration-page-title'>Administration</Title>
                </Col>
            </Row>
            <Row justify='center' align='middle' className='cvat-administration-page-wrapper'>
                <Col {...dimensions}>
                    <Row>
                        <Col span={5}>
                            <Menu
                                className='cvat-administration-navigation-menu'
                                selectedKeys={[activeSection]}
                                mode='inline'
                                items={menuItems}
                                onClick={({ key }) => history.push(`/management/${key}`)}
                            />
                        </Col>
                        <Col span={19} className='cvat-administration-page-content'>
                            {renderContent()}
                        </Col>
                    </Row>
                </Col>
            </Row>
        </div>
    );
}
