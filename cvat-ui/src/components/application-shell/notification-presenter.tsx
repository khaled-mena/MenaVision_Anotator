// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import notification from 'antd/lib/notification';

import CVATMarkdown, { UseHistoryType } from 'components/common/cvat-markdown';
import { ErrorState, NotificationState, NotificationsState } from 'reducers';
import appConfig from 'config';

function showMessage(history: UseHistoryType, notificationState: NotificationState): void {
    notification.info({
        message: (
            <CVATMarkdown history={history}>{notificationState.message}</CVATMarkdown>
        ),
        description: notificationState?.description && (
            <CVATMarkdown history={history}>{notificationState?.description}</CVATMarkdown>
        ),
        duration: notificationState.duration ?? null,
        className: notificationState.className,
    });
}

function showError(
    history: UseHistoryType, title: string, _error: Error, shouldLog?: boolean, className?: string,
): void {
    const error = _error?.message || _error.toString();
    const dynamicProps = typeof className === 'undefined' ? {} : { className };

    let errorLength = error.length;
    // Do not count the length of the link in the Markdown error message
    if (/]\(.+\)/.test(error)) {
        errorLength = error.replace(/]\(.+\)/, ']').length;
    }

    notification.error({
        ...dynamicProps,
        message: (
            <CVATMarkdown history={history}>{title}</CVATMarkdown>
        ),
        duration: null,
        description: errorLength > appConfig.MAXIMUM_NOTIFICATION_MESSAGE_LENGTH ?
            'Open the Browser Console to get details' : <CVATMarkdown history={history}>{error}</CVATMarkdown>,
    });

    if (shouldLog) {
        setTimeout(() => {
            // throw the error to be caught by global listener
            throw _error;
        });
    } else {
        console.error(error);
    }
}

// Presents every pending message of the notifications store and returns whether
// anything was shown, so the caller can reset the store.
export function presentMessages(history: UseHistoryType, notifications: NotificationsState): boolean {
    let shown = false;
    for (const where of Object.keys(notifications.messages)) {
        for (const what of Object.keys((notifications as any).messages[where])) {
            const notificationState = (notifications as any).messages[where][what] as NotificationState;
            shown = shown || !!notificationState;
            if (notificationState) {
                showMessage(history, notificationState);
            }
        }
    }
    return shown;
}

export function presentErrors(history: UseHistoryType, notifications: NotificationsState): boolean {
    let shown = false;
    for (const where of Object.keys(notifications.errors)) {
        for (const what of Object.keys((notifications as any).errors[where])) {
            const error = (notifications as any).errors[where][what] as ErrorState;
            shown = shown || !!error;
            if (error && !error.ignore) {
                showError(history, error.message, error.reason, error.shouldLog, error.className);
            }
        }
    }
    return shown;
}
