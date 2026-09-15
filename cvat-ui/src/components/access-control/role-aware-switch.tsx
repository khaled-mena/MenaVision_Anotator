// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { Redirect, Route, Switch } from 'react-router';

import { WorkforceRole, homePath, isAdmin } from 'utils/access-control/roles';
import { isRouteAllowed } from 'utils/access-control/route-policy';
import AccessDeniedPage from './access-denied-page';

interface Props {
    role: WorkforceRole | null;
    children: React.ReactNode;
}

interface RouteLikeProps {
    path?: string | string[];
    exact?: boolean;
}

// Administrators keep the upstream route table untouched, including its final redirect.
// For employees the administrative routes are replaced by a denial page before anything
// of them renders, and every other location (auth pages, unknown URLs) goes home.
export default function RoleAwareSwitch({ role, children }: Props): JSX.Element {
    const elements = React.Children.toArray(children).filter(React.isValidElement);
    if (isAdmin(role)) {
        return <Switch>{elements}</Switch>;
    }

    const home = homePath(role);
    const routes = elements.filter((child) => child.type !== Redirect);
    const allowed = routes.filter((child) => isRouteAllowed(role, (child.props as RouteLikeProps).path));
    const denied = routes.filter((child) => !isRouteAllowed(role, (child.props as RouteLikeProps).path));

    return (
        <Switch>
            {allowed}
            {denied.map((child, index) => {
                const { path, exact } = child.props as RouteLikeProps;
                return (
                    <Route key={`denied-${index}`} path={path} exact={exact}>
                        <AccessDeniedPage homePath={home} />
                    </Route>
                );
            })}
            <Redirect to={home} />
        </Switch>
    );
}
