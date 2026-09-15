// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useState } from 'react';
import Modal from 'antd/lib/modal';
import Form from 'antd/lib/form';
import Input from 'antd/lib/input';
import Select from 'antd/lib/select';
import Alert from 'antd/lib/alert';
import Descriptions from 'antd/lib/descriptions';
import Spin from 'antd/lib/spin';
import Text from 'antd/lib/typography/Text';

import { WorkforceRole, roleLabel } from 'utils/access-control/roles';
import { Account, AssignmentSummary, accountsClient } from 'utils/administration/workforce-client';
import { ROLE_OPTIONS } from './account-form-modal';

interface ChangeRoleProps {
    account: Account | null;
    submitting: boolean;
    onSubmit(role: WorkforceRole): Promise<void>;
    onCancel(): void;
}

export function ChangeRoleModal({
    account, submitting, onSubmit, onCancel,
}: ChangeRoleProps): JSX.Element {
    const [role, setRole] = useState<WorkforceRole>(account?.role ?? WorkforceRole.TASKER);
    useEffect(() => {
        if (account) setRole(account.role);
    }, [account]);

    return (
        <Modal
            className='cvat-administration-change-role-modal'
            title={account ? `Change role of ${account.username}` : 'Change role'}
            open={account !== null}
            okText='Change role'
            confirmLoading={submitting}
            okButtonProps={{ disabled: !account || role === account.role }}
            onOk={() => onSubmit(role)}
            onCancel={onCancel}
            destroyOnClose
        >
            <Form layout='vertical'>
                <Form.Item label='New role'>
                    <Select value={role} options={ROLE_OPTIONS} onChange={setRole} />
                </Form.Item>
            </Form>
            {role === WorkforceRole.ADMIN ? (
                <Alert
                    type='warning'
                    showIcon
                    message='Administrators own the platform: accounts, projects, data import and export.'
                />
            ) : (
                <Alert
                    type='info'
                    showIcon
                    message={
                        `${roleLabel(role)} accounts only see the work assigned to them ` +
                        'and cannot move data in or out of the platform.'
                    }
                />
            )}
            <Text type='secondary' className='cvat-administration-dialog-note'>
                Active sessions of this account are signed out after the change.
            </Text>
        </Modal>
    );
}

interface ResetPasswordProps {
    account: Account | null;
    submitting: boolean;
    onSubmit(password: string | undefined): Promise<void>;
    onCancel(): void;
}

export function ResetPasswordModal({
    account, submitting, onSubmit, onCancel,
}: ResetPasswordProps): JSX.Element {
    const [form] = Form.useForm<{ password?: string }>();
    useEffect(() => {
        form.resetFields();
    }, [account, form]);

    return (
        <Modal
            className='cvat-administration-reset-password-modal'
            title={account ? `Reset password of ${account.username}` : 'Reset password'}
            open={account !== null}
            okText='Reset password'
            confirmLoading={submitting}
            onOk={() => form.validateFields().then((values) => onSubmit(values.password || undefined))}
            onCancel={onCancel}
            destroyOnClose
        >
            <Form form={form} layout='vertical' autoComplete='off'>
                <Form.Item
                    name='password'
                    label='New password'
                    extra='Leave empty to generate a strong password that is shown once.'
                    rules={[{ min: 8, message: 'Use at least 8 characters' }]}
                >
                    <Input.Password autoComplete='new-password' />
                </Form.Item>
            </Form>
            <Text type='secondary' className='cvat-administration-dialog-note'>
                The user is signed out everywhere and must log in with the new password.
            </Text>
        </Modal>
    );
}

interface GeneratedPasswordProps {
    username: string | null;
    password: string | null;
    onClose(): void;
}

export function GeneratedPasswordModal({ username, password, onClose }: GeneratedPasswordProps): JSX.Element {
    return (
        <Modal
            className='cvat-administration-generated-password-modal'
            title='Temporary password'
            open={password !== null}
            onOk={onClose}
            onCancel={onClose}
            cancelButtonProps={{ style: { display: 'none' } }}
            okText='I have shared it'
            destroyOnClose
        >
            <Alert
                type='warning'
                showIcon
                message='This password is shown only once and is not stored anywhere else.'
            />
            <Descriptions column={1} size='small' className='cvat-administration-generated-password'>
                <Descriptions.Item label='Username'>{username}</Descriptions.Item>
                <Descriptions.Item label='Password'>
                    <Text code copyable>{password}</Text>
                </Descriptions.Item>
            </Descriptions>
        </Modal>
    );
}

interface AssignmentsProps {
    account: Account | null;
    onClose(): void;
}

export function AssignmentsModal({ account, onClose }: AssignmentsProps): JSX.Element {
    const [summary, setSummary] = useState<AssignmentSummary | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setSummary(null);
        setError(null);
        if (!account) return undefined;
        let cancelled = false;
        accountsClient.assignments(account.id)
            .then((result) => { if (!cancelled) setSummary(result); })
            .catch((reason: unknown) => { if (!cancelled) setError(String(reason)); });
        return () => {
            cancelled = true;
        };
    }, [account]);

    return (
        <Modal
            className='cvat-administration-assignments-modal'
            title={account ? `Work linked to ${account.username}` : 'Assignments'}
            open={account !== null}
            onOk={onClose}
            onCancel={onClose}
            cancelButtonProps={{ style: { display: 'none' } }}
            destroyOnClose
        >
            {error ? <Alert type='error' showIcon message={error} /> : null}
            {!summary && !error ? <Spin /> : null}
            {summary ? (
                <Descriptions column={2} size='small' bordered>
                    <Descriptions.Item label='Assigned jobs'>{summary.assigned_jobs}</Descriptions.Item>
                    <Descriptions.Item label='Open jobs'>{summary.active_jobs}</Descriptions.Item>
                    <Descriptions.Item label='Assigned tasks'>{summary.assigned_tasks}</Descriptions.Item>
                    <Descriptions.Item label='Owned tasks'>{summary.owned_tasks}</Descriptions.Item>
                    <Descriptions.Item label='Owned projects'>{summary.owned_projects}</Descriptions.Item>
                    <Descriptions.Item label='Issues'>{summary.issues}</Descriptions.Item>
                    <Descriptions.Item label='Comments'>{summary.comments}</Descriptions.Item>
                </Descriptions>
            ) : null}
        </Modal>
    );
}
