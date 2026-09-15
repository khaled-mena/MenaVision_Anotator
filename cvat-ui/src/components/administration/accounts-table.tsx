// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import Table from 'antd/lib/table';
import Tag from 'antd/lib/tag';
import Dropdown from 'antd/lib/dropdown';
import Button from 'antd/lib/button';
import Text from 'antd/lib/typography/Text';
import { MoreOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/lib/table';

import { WorkforceRole, roleLabel } from 'utils/access-control/roles';
import { Account } from 'utils/administration/workforce-client';
import dayjs from 'utils/dayjs-wrapper';

export type AccountAction =
    | 'edit' | 'role' | 'activate' | 'deactivate' | 'password' | 'assignments' | 'delete';

interface Props {
    accounts: Account[];
    loading: boolean;
    currentUserId: number | null;
    page: number;
    pageSize: number;
    total: number;
    onPageChange(page: number): void;
    onAction(action: AccountAction, account: Account): void;
}

const ROLE_COLORS: Record<WorkforceRole, string> = {
    [WorkforceRole.ADMIN]: 'gold',
    [WorkforceRole.REVIEWER]: 'purple',
    [WorkforceRole.TASKER]: 'blue',
};

function formatDate(value: string | null): string {
    return value ? dayjs(value).format('MMM D, YYYY HH:mm') : 'Never';
}

function displayName(account: Account): string {
    return [account.first_name, account.last_name].filter(Boolean).join(' ');
}

export default function AccountsTable(props: Props): JSX.Element {
    const {
        accounts, loading, currentUserId, page, pageSize, total, onPageChange, onAction,
    } = props;

    const columns: ColumnsType<Account> = [
        {
            title: 'Name',
            key: 'name',
            ellipsis: true,
            render: (_, account) => (
                <div className='cvat-administration-account-name'>
                    <Text strong ellipsis={{ tooltip: account.username }}>{account.username}</Text>
                    {displayName(account) ? (
                        <Text type='secondary' ellipsis={{ tooltip: displayName(account) }}>{displayName(account)}</Text>
                    ) : null}
                </div>
            ),
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            ellipsis: true,
            render: (email: string) => (email ? <Text ellipsis={{ tooltip: email }}>{email}</Text> : <Text type='secondary'>—</Text>),
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            width: 110,
            render: (role: WorkforceRole) => <Tag color={ROLE_COLORS[role]}>{roleLabel(role)}</Tag>,
        },
        {
            title: 'Status',
            dataIndex: 'is_active',
            key: 'status',
            width: 110,
            render: (isActive: boolean) => (
                isActive ? <Tag color='green'>Active</Tag> : <Tag color='red'>Suspended</Tag>
            ),
        },
        {
            title: 'Last login',
            dataIndex: 'last_login',
            key: 'last_login',
            width: 170,
            render: formatDate,
        },
        {
            title: 'Created',
            dataIndex: 'date_joined',
            key: 'date_joined',
            width: 170,
            render: formatDate,
        },
        {
            title: '',
            key: 'actions',
            width: 56,
            render: (_, account) => {
                const self = account.id === currentUserId;
                const items = [
                    { key: 'edit', label: 'Edit details' },
                    { key: 'role', label: 'Change role', disabled: self },
                    { key: 'password', label: 'Reset password' },
                    { key: 'assignments', label: 'View assignments' },
                    { type: 'divider' as const },
                    account.is_active ?
                        {
                            key: 'deactivate', label: 'Suspend access', danger: true, disabled: self,
                        } :
                        { key: 'activate', label: 'Restore access' },
                    {
                        key: 'delete', label: 'Delete account', danger: true, disabled: self || account.is_active,
                    },
                ];
                return (
                    <Dropdown
                        trigger={['click']}
                        placement='bottomRight'
                        menu={{
                            items,
                            className: 'cvat-administration-account-actions',
                            onClick: ({ key }) => onAction(key as AccountAction, account),
                        }}
                    >
                        <Button type='text' icon={<MoreOutlined />} className='cvat-administration-account-actions-button' />
                    </Dropdown>
                );
            },
        },
    ];

    return (
        <Table<Account>
            className='cvat-administration-accounts-table'
            rowKey='id'
            size='middle'
            columns={columns}
            dataSource={accounts}
            loading={loading}
            rowClassName={(account) => (account.is_active ? '' : 'cvat-administration-account-suspended')}
            pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: false,
                onChange: onPageChange,
                showTotal: (count) => `${count} accounts`,
            }}
        />
    );
}
