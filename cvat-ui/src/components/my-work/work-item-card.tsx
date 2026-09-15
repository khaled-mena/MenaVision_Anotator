// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { useHistory } from 'react-router';
import Card from 'antd/lib/card';
import Tag from 'antd/lib/tag';
import Button from 'antd/lib/button';
import Descriptions from 'antd/lib/descriptions';

import { Job, JobStage, JobState } from 'cvat-core-wrapper';
import Preview from 'components/common/preview';
import { WorkforceRole } from 'utils/access-control/roles';
import dayjs from 'utils/dayjs-wrapper';

interface Props {
    job: Job;
    role: WorkforceRole | null;
}

function stateColor(state: JobState): string {
    switch (state) {
        case JobState.COMPLETED: return 'green';
        case JobState.REJECTED: return 'red';
        case JobState.IN_PROGRESS: return 'blue';
        default: return 'default';
    }
}

function actionLabel(job: Job, role: WorkforceRole | null): string {
    if (job.state === JobState.COMPLETED) return 'Open';
    if (role === WorkforceRole.REVIEWER || job.stage === JobStage.VALIDATION) return 'Review';
    return job.state === JobState.NEW ? 'Start' : 'Continue';
}

export default function WorkItemCard({ job, role }: Props): JSX.Element {
    const history = useHistory();
    const open = (): void => history.push(`/tasks/${job.taskId}/jobs/${job.id}`);

    return (
        <Card
            className='cvat-my-work-item'
            hoverable
            cover={(
                <Preview
                    job={job}
                    onClick={open}
                    loadingClassName='cvat-job-item-loading-preview'
                    emptyPreviewClassName='cvat-job-item-empty-preview'
                    previewWrapperClassName='cvat-my-work-item-preview-wrapper'
                    previewClassName='cvat-my-work-item-preview'
                />
            )}
            onClick={open}
        >
            <Card.Meta
                title={job.taskName ? `${job.taskName} (job #${job.id})` : `Job #${job.id}`}
                description={(
                    <Descriptions column={1} size='small'>
                        <Descriptions.Item label='Status'>
                            <Tag color={stateColor(job.state)}>{job.state}</Tag>
                            <Tag>{job.stage}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label='Frames'>{job.stopFrame - job.startFrame + 1}</Descriptions.Item>
                        <Descriptions.Item label='Updated'>{dayjs(job.updatedDate).fromNow()}</Descriptions.Item>
                    </Descriptions>
                )}
            />
            <Button type='primary' block className='cvat-my-work-item-open-button' onClick={open}>
                {actionLabel(job, role)}
            </Button>
        </Card>
    );
}
