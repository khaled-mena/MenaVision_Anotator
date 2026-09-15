// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect } from 'react';
import Modal from 'antd/lib/modal';
import Form from 'antd/lib/form';
import Input from 'antd/lib/input';
import Select from 'antd/lib/select';
import Switch from 'antd/lib/switch';

import { WorkforceRole, roleLabel } from 'utils/access-control/roles';
import { Account, AccountInput } from 'utils/administration/workforce-client';

interface Props {
    open: boolean;
    account: Account | null;
    submitting: boolean;
    onSubmit(values: AccountInput): Promise<void>;
    onCancel(): void;
}

export const ROLE_OPTIONS = Object.values(WorkforceRole).map((role) => ({ value: role, label: roleLabel(role) }));

export default function AccountFormModal({
    open, account, submitting, onSubmit, onCancel,
}: Props): JSX.Element {
    const [form] = Form.useForm<AccountInput>();
    const editing = account !== null;

    useEffect(() => {
        if (!open) return;
        form.resetFields();
        if (account) {
            form.setFieldsValue({
                username: account.username,
                first_name: account.first_name,
                last_name: account.last_name,
                email: account.email,
                role: account.role,
                is_active: account.is_active,
            });
        } else {
            form.setFieldsValue({ role: WorkforceRole.TASKER, is_active: true });
        }
    }, [open, account, form]);

    return (
        <Modal
            className='cvat-administration-account-form-modal'
            title={editing ? `Edit ${account.username}` : 'Create user'}
            open={open}
            okText={editing ? 'Save' : 'Create'}
            confirmLoading={submitting}
            onCancel={onCancel}
            onOk={() => form.validateFields().then(onSubmit)}
            destroyOnClose
        >
            <Form form={form} layout='vertical' autoComplete='off'>
                <Form.Item
                    name='username'
                    label='Username'
                    rules={[
                        { required: true, message: 'Username is required' },
                        { pattern: /^[\w.@+-]+$/, message: 'Only letters, digits and @ . + - _ are allowed' },
                        { max: 150, message: 'Username is too long' },
                    ]}
                >
                    <Input disabled={editing} autoFocus={!editing} />
                </Form.Item>
                <Form.Item name='first_name' label='First name' rules={[{ max: 150 }]}>
                    <Input />
                </Form.Item>
                <Form.Item name='last_name' label='Last name' rules={[{ max: 150 }]}>
                    <Input />
                </Form.Item>
                <Form.Item name='email' label='Email' rules={[{ type: 'email', message: 'Enter a valid email address' }]}>
                    <Input />
                </Form.Item>
                {editing ? null : (
                    <>
                        <Form.Item name='role' label='Role' rules={[{ required: true }]}>
                            <Select options={ROLE_OPTIONS} />
                        </Form.Item>
                        <Form.Item
                            name='password'
                            label='Initial password'
                            extra='Leave empty to generate a strong password that is shown once after creation.'
                            rules={[{ min: 8, message: 'Use at least 8 characters' }]}
                        >
                            <Input.Password autoComplete='new-password' />
                        </Form.Item>
                        <Form.Item name='is_active' label='Account enabled' valuePropName='checked'>
                            <Switch />
                        </Form.Item>
                    </>
                )}
            </Form>
        </Modal>
    );
}
