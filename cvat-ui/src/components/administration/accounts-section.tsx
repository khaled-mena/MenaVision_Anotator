// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import { PlusOutlined } from '@ant-design/icons';
import Button from 'antd/lib/button';
import Input from 'antd/lib/input';
import Select from 'antd/lib/select';
import Modal from 'antd/lib/modal';
import Alert from 'antd/lib/alert';
import Title from 'antd/lib/typography/Title';
import Text from 'antd/lib/typography/Text';
import { Col, Row } from 'antd/lib/grid';

import { CombinedState } from 'reducers';
import { WorkforceRole } from 'utils/access-control/roles';
import { Account, AccountInput, accountsClient } from 'utils/administration/workforce-client';
import AccountsTable, { AccountAction } from './accounts-table';
import AccountFormModal, { ROLE_OPTIONS } from './account-form-modal';
import {
    AssignmentsModal, ChangeRoleModal, GeneratedPasswordModal, ResetPasswordModal,
} from './account-dialogs';
import { useAccounts } from './use-accounts';

interface GeneratedCredentials {
    username: string;
    password: string;
}

export default function AccountsSection(): JSX.Element {
    const currentUser = useSelector((state: CombinedState) => state.auth.user);
    const {
        accounts, count, page, pageSize, fetching, error, filters, setPage, setFilters, run, reload,
    } = useAccounts();

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Account | null>(null);
    const [changingRole, setChangingRole] = useState<Account | null>(null);
    const [resettingPassword, setResettingPassword] = useState<Account | null>(null);
    const [viewingAssignments, setViewingAssignments] = useState<Account | null>(null);
    const [generated, setGenerated] = useState<GeneratedCredentials | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const submit = useCallback(async (operation: () => Promise<unknown>, message: string): Promise<boolean> => {
        setSubmitting(true);
        try {
            return await run(operation, message);
        } finally {
            setSubmitting(false);
        }
    }, [run]);

    const onSubmitForm = useCallback(async (values: AccountInput): Promise<void> => {
        if (editing) {
            const done = await submit(
                () => accountsClient.update(editing.id, {
                    first_name: values.first_name ?? '',
                    last_name: values.last_name ?? '',
                    email: values.email ?? '',
                }),
                'Account details updated',
            );
            if (done) setFormOpen(false);
            return;
        }

        let credentials: GeneratedCredentials | null = null;
        const done = await submit(async () => {
            const created = await accountsClient.create(values);
            if (created.generated_password) {
                credentials = { username: created.username, password: created.generated_password };
            }
        }, 'Account created');
        if (done) {
            setFormOpen(false);
            setGenerated(credentials);
        }
    }, [editing, submit]);

    const confirm = useCallback((
        title: string, content: string, okText: string, action: () => Promise<unknown>, message: string,
    ): void => {
        Modal.confirm({
            title,
            content,
            okText,
            cancelText: 'Cancel',
            okButtonProps: { type: 'primary', danger: true },
            className: 'cvat-modal-confirm-account-action',
            onOk: () => submit(action, message),
        });
    }, [submit]);

    const onAction = useCallback((action: AccountAction, account: Account): void => {
        switch (action) {
            case 'edit':
                setEditing(account);
                setFormOpen(true);
                break;
            case 'role':
                setChangingRole(account);
                break;
            case 'password':
                setResettingPassword(account);
                break;
            case 'assignments':
                setViewingAssignments(account);
                break;
            case 'activate':
                submit(() => accountsClient.activate(account.id), `Access restored for ${account.username}`);
                break;
            case 'deactivate':
                confirm(
                    `Suspend ${account.username}?`,
                    'The account is signed out immediately and cannot log in until access is restored.',
                    'Suspend',
                    () => accountsClient.deactivate(account.id),
                    `${account.username} suspended`,
                );
                break;
            case 'delete':
                confirm(
                    `Delete ${account.username}?`,
                    'Projects, tasks, issues and comments created by this account stay in place with the author cleared. This cannot be undone.',
                    'Delete',
                    () => accountsClient.remove(account.id),
                    `${account.username} deleted`,
                );
                break;
            default:
        }
    }, [confirm, submit]);

    return (
        <div className='cvat-administration-accounts'>
            <Row justify='space-between' align='middle' className='cvat-administration-section-header'>
                <Col>
                    <Title level={4}>Users</Title>
                    <Text type='secondary'>Accounts are created here by administrators. Public sign up is disabled.</Text>
                </Col>
                <Col>
                    <Button
                        type='primary'
                        icon={<PlusOutlined />}
                        className='cvat-administration-create-user-button'
                        onClick={() => { setEditing(null); setFormOpen(true); }}
                    >
                        Create user
                    </Button>
                </Col>
            </Row>
            <Row gutter={8} className='cvat-administration-accounts-toolbar'>
                <Col flex='auto'>
                    <Input.Search
                        allowClear
                        placeholder='Search by username, name or email'
                        defaultValue={filters.search}
                        onSearch={(search) => setFilters({ search })}
                    />
                </Col>
                <Col>
                    <Select
                        allowClear
                        placeholder='Role'
                        className='cvat-administration-role-filter'
                        value={filters.role ?? undefined}
                        options={ROLE_OPTIONS}
                        onChange={(role?: WorkforceRole) => setFilters({ role: role ?? null })}
                    />
                </Col>
                <Col>
                    <Select
                        allowClear
                        placeholder='Status'
                        className='cvat-administration-status-filter'
                        value={filters.isActive === null ? undefined : String(filters.isActive)}
                        options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Suspended' }]}
                        onChange={(value?: string) => setFilters({ isActive: value === undefined ? null : value === 'true' })}
                    />
                </Col>
            </Row>
            {error ? (
                <Alert
                    type='error'
                    showIcon
                    message='Could not load accounts'
                    description={error}
                    action={<Button size='small' onClick={reload}>Retry</Button>}
                    className='cvat-administration-accounts-error'
                />
            ) : null}
            <AccountsTable
                accounts={accounts}
                loading={fetching}
                currentUserId={currentUser?.id ?? null}
                page={page}
                pageSize={pageSize}
                total={count}
                onPageChange={setPage}
                onAction={onAction}
            />
            <AccountFormModal
                open={formOpen}
                account={editing}
                submitting={submitting}
                onSubmit={onSubmitForm}
                onCancel={() => setFormOpen(false)}
            />
            <ChangeRoleModal
                account={changingRole}
                submitting={submitting}
                onCancel={() => setChangingRole(null)}
                onSubmit={async (role) => {
                    if (!changingRole) return;
                    const done = await submit(
                        () => accountsClient.changeRole(changingRole.id, role),
                        `Role of ${changingRole.username} changed`,
                    );
                    if (done) setChangingRole(null);
                }}
            />
            <ResetPasswordModal
                account={resettingPassword}
                submitting={submitting}
                onCancel={() => setResettingPassword(null)}
                onSubmit={async (password) => {
                    if (!resettingPassword) return;
                    let credentials: GeneratedCredentials | null = null;
                    const done = await submit(async () => {
                        const result = await accountsClient.resetPassword(resettingPassword.id, password);
                        if (result.generated_password) {
                            credentials = { username: resettingPassword.username, password: result.generated_password };
                        }
                    }, `Password of ${resettingPassword.username} reset`);
                    if (done) {
                        setResettingPassword(null);
                        setGenerated(credentials);
                    }
                }}
            />
            <GeneratedPasswordModal
                username={generated?.username ?? null}
                password={generated?.password ?? null}
                onClose={() => setGenerated(null)}
            />
            <AssignmentsModal account={viewingAssignments} onClose={() => setViewingAssignments(null)} />
        </div>
    );
}
