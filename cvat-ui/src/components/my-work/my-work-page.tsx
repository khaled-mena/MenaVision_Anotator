// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Spin from 'antd/lib/spin';
import Empty from 'antd/lib/empty';
import Text from 'antd/lib/typography/Text';
import Title from 'antd/lib/typography/Title';
import Select from 'antd/lib/select';
import { Col, Row } from 'antd/lib/grid';
import Pagination from 'antd/lib/pagination';
import notification from 'antd/lib/notification';

import { Job, getCore } from 'cvat-core-wrapper';
import { CombinedState } from 'reducers';
import { WorkforceRole, getRole } from 'utils/access-control/roles';
import WorkItemCard from './work-item-card';

const core = getCore();
const PAGE_SIZE = 12;

type StateFilter = 'open' | 'completed' | 'all';

const STATE_FILTERS: Record<StateFilter, string | null> = {
    open: JSON.stringify({ and: [{ '!': { '==': [{ var: 'state' }, 'completed'] } }] }),
    completed: JSON.stringify({ and: [{ '==': [{ var: 'state' }, 'completed'] }] }),
    all: null,
};

function pageTitle(role: WorkforceRole | null): string {
    return role === WorkforceRole.REVIEWER ? 'My reviews' : 'My work';
}

function pageHint(role: WorkforceRole | null): string {
    return role === WorkforceRole.REVIEWER ?
        'Jobs waiting for your review. Open a job to inspect annotations and record the outcome.' :
        'Jobs assigned to you. Open a job to continue annotating and finish it when the work is done.';
}

export default function MyWorkPage(): JSX.Element {
    const user = useSelector((state: CombinedState) => state.auth.user);
    const role = getRole(user);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const [stateFilter, setStateFilter] = useState<StateFilter>('open');
    const [fetching, setFetching] = useState(true);

    const fetchJobs = useCallback(async () => {
        setFetching(true);
        try {
            // The server only returns jobs assigned to the current account.
            const filter = STATE_FILTERS[stateFilter];
            const result = await core.jobs.get({
                page,
                pageSize: PAGE_SIZE,
                sort: '-updated_date',
                ...(filter ? { filter } : {}),
            });
            setJobs(result);
            setCount(result.count);
        } catch (error: unknown) {
            notification.error({
                message: 'Could not load your assigned work',
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setFetching(false);
        }
    }, [page, stateFilter]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    return (
        <div className='cvat-my-work-page'>
            <Row justify='center' align='top' className='cvat-my-work-page-top-bar'>
                <Col md={22} lg={18} xl={16} xxl={14}>
                    <Row justify='space-between' align='middle'>
                        <Col>
                            <Title level={4} className='cvat-my-work-page-title'>{pageTitle(role)}</Title>
                            <Text type='secondary'>{pageHint(role)}</Text>
                        </Col>
                        <Col>
                            <Select
                                className='cvat-my-work-page-state-filter'
                                value={stateFilter}
                                onChange={(value: StateFilter) => {
                                    setPage(1);
                                    setStateFilter(value);
                                }}
                                options={[
                                    { value: 'open', label: 'Open' },
                                    { value: 'completed', label: 'Completed' },
                                    { value: 'all', label: 'All' },
                                ]}
                            />
                        </Col>
                    </Row>
                </Col>
            </Row>
            {fetching ? (
                <div className='cvat-my-work-page-spinner'><Spin size='large' /></div>
            ) : (
                <Row justify='center' align='top'>
                    <Col md={22} lg={18} xl={16} xxl={14}>
                        {jobs.length ? (
                            <Row gutter={[16, 16]} className='cvat-my-work-page-list'>
                                {jobs.map((job: Job) => (
                                    <Col key={job.id} xs={24} sm={12} lg={8}>
                                        <WorkItemCard job={job} role={role} />
                                    </Col>
                                ))}
                            </Row>
                        ) : (
                            <Empty
                                className='cvat-my-work-page-empty'
                                description='Nothing is assigned to you right now. New work appears here as soon as an administrator assigns it.'
                            />
                        )}
                    </Col>
                </Row>
            )}
            {count > PAGE_SIZE ? (
                <Row justify='center' align='middle' className='cvat-my-work-page-pagination'>
                    <Col>
                        <Pagination
                            current={page}
                            pageSize={PAGE_SIZE}
                            total={count}
                            showSizeChanger={false}
                            onChange={setPage}
                        />
                    </Col>
                </Row>
            ) : null}
        </div>
    );
}
