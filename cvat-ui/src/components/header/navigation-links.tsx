// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { useHistory, useLocation } from 'react-router';
import Button from 'antd/lib/button';

import { WorkforceRole, isAdmin } from 'utils/access-control/roles';

interface NavigationLink {
    key: string;
    label: string;
    path: string;
    href: string;
}

const ADMIN_LINKS: NavigationLink[] = [
    {
        key: 'projects', label: 'Projects', path: '/projects', href: '/projects?page=1',
    },
    {
        key: 'tasks', label: 'Tasks', path: '/tasks', href: '/tasks?page=1',
    },
    {
        key: 'jobs', label: 'Jobs', path: '/jobs', href: '/jobs?page=1',
    },
    {
        key: 'cloudstorages', label: 'Cloud Storages', path: '/cloudstorages', href: '/cloudstorages?page=1',
    },
    {
        key: 'requests', label: 'Requests', path: '/requests', href: '/requests?page=1',
    },
    {
        key: 'models', label: 'Models', path: '/models', href: '/models',
    },
    {
        key: 'administration', label: 'Administration', path: '/management/users', href: '/management/users',
    },
];

const EMPLOYEE_LINKS: NavigationLink[] = [
    {
        key: 'jobs', label: 'My work', path: '/jobs', href: '/jobs?page=1',
    },
];

interface Props {
    role: WorkforceRole | null;
    analyticsAvailable: boolean;
}

export default function NavigationLinks({ role, analyticsAvailable }: Props): JSX.Element {
    const history = useHistory();
    const location = useLocation();
    const links = isAdmin(role) ? ADMIN_LINKS : EMPLOYEE_LINKS;

    const isActive = (link: NavigationLink): boolean => {
        if (link.key === 'administration') return location.pathname.startsWith('/management');
        // eslint-disable-next-line security/detect-non-literal-regexp
        return !!location.pathname.match(new RegExp(`${link.key}$`));
    };

    const className = (key: string, active: boolean): string => {
        const baseClass = `cvat-header-${key}-button cvat-header-button`;
        return active ? `${baseClass} cvat-active-header-button` : baseClass;
    };

    return (
        <>
            {links.map((link) => (
                <Button
                    key={link.key}
                    className={className(link.key, isActive(link))}
                    type='link'
                    value={link.key}
                    href={link.href}
                    onClick={(event: React.MouseEvent): void => {
                        event.preventDefault();
                        history.push(link.path);
                    }}
                >
                    {link.label}
                </Button>
            ))}
            {isAdmin(role) && analyticsAvailable ? (
                <Button
                    className={className('analytics', false)}
                    type='link'
                    href='/analytics'
                    onClick={(event: React.MouseEvent): void => {
                        event.preventDefault();
                        window.open('/analytics', '_blank');
                    }}
                >
                    Analytics
                </Button>
            ) : null}
        </>
    );
}
