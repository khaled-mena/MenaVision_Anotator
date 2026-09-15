// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useCallback, useEffect, useState } from 'react';
import Table from 'antd/lib/table';
import Tag from 'antd/lib/tag';
import Input from 'antd/lib/input';
import Alert from 'antd/lib/alert';
import Title from 'antd/lib/typography/Title';
import Text from 'antd/lib/typography/Text';
import { Col, Row } from 'antd/lib/grid';
import type { ColumnsType } from 'antd/lib/table';

import { AuditRecord, auditClient } from 'utils/administration/workforce-client';
import dayjs from 'utils/dayjs-wrapper';
import { describeError } from './use-accounts';

const PAGE_SIZE = 20;

const RESULT_COLORS: Record<string, string> = {
    success: 'green',
    authorized: 'blue',
    denied: 'red',
    failed: 'orange',
};

function summarizeDetails(details: Record<string, unknown>): string {
    return Object.entries(details)
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
        .join(', ');
}

export default function AuditSection(): JSX.Element {
    const [records, setRecords] = useState<AuditRecord[]>([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setFetching(true);
        setError(null);
        try {
            const result = await auditClient.list(page, PAGE_SIZE, search || undefined);
            setRecords(result.results);
            setCount(result.count);
        } catch (reason: unknown) {
            setError(describeError(reason));
        } finally {
            setFetching(false);
        }
    }, [page, search]);

    useEffect(() => {
        load();
    }, [load]);

    const columns: ColumnsType<AuditRecord> = [
        {
            title: 'When',
            dataIndex: 'created_date',
            key: 'created_date',
            width: 170,
            render: (value: string) => dayjs(value).format('MMM D, YYYY HH:mm:ss'),
        },
        {
            title: 'Actor',
            dataIndex: 'actor_username',
            key: 'actor',
            width: 140,
            ellipsis: true,
        },
        {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            width: 170,
            render: (action: string) => <Text code>{action}</Text>,
        },
        {
            title: 'Target',
            key: 'target',
            ellipsis: true,
            render: (_, record) => (
                record.target_type ? `${record.target_type} ${record.target_repr || record.target_id}` : '—'
            ),
        },
        {
            title: 'Result',
            dataIndex: 'result',
            key: 'result',
            width: 110,
            render: (result: string) => <Tag color={RESULT_COLORS[result] ?? 'default'}>{result}</Tag>,
        },
        {
            title: 'Details',
            dataIndex: 'details',
            key: 'details',
            ellipsis: true,
            render: (details: Record<string, unknown>) => {
                const text = summarizeDetails(details);
                return <Text type='secondary' ellipsis={{ tooltip: text }}>{text}</Text>;
            },
        },
    ];

    return (
        <div className='cvat-administration-audit'>
            <Row justify='space-between' align='middle' className='cvat-administration-section-header'>
                <Col>
                    <Title level={4}>Audit log</Title>
                    <Text type='secondary'>
                        Account lifecycle, data movement, destructive operations and denied privileged requests.
                    </Text>
                </Col>
                <Col>
                    <Input.Search
                        allowClear
                        placeholder='Search actor or target'
                        className='cvat-administration-audit-search'
                        onSearch={(value) => { setPage(1); setSearch(value); }}
                    />
                </Col>
            </Row>
            {error ? <Alert type='error' showIcon message='Could not load the audit log' description={error} /> : null}
            <Table<AuditRecord>
                className='cvat-administration-audit-table'
                rowKey='id'
                size='small'
                columns={columns}
                dataSource={records}
                loading={fetching}
                pagination={{
                    current: page,
                    pageSize: PAGE_SIZE,
                    total: count,
                    showSizeChanger: false,
                    onChange: setPage,
                    showTotal: (total) => `${total} records`,
                }}
            />
        </div>
    );
}
