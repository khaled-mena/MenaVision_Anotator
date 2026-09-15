// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { Redirect, Route, Switch } from 'react-router';
import Layout from 'antd/lib/layout';

import Header from 'components/header/header';
import GlobalErrorBoundary from 'components/global-error-boundary/global-error-boundary';
import ShortcutsDialog from 'components/shortcuts-dialog/shortcuts-dialog';
import { ShortcutsContextProvider } from 'components/shortcuts.context';
import LogoutComponent from 'components/logout-component';

import JobsPageComponent from 'components/jobs-page/jobs-page';
import ModelsPageComponent from 'components/models-page/models-page';
import TasksPageContainer from 'containers/tasks-page/tasks-page';
import CreateTaskPageContainer from 'containers/create-task-page/create-task-page';
import TaskPageComponent from 'components/task-page/task-page';
import ProjectsPageComponent from 'components/projects-page/projects-page';
import CreateProjectPageComponent from 'components/create-project-page/create-project-page';
import ProjectPageComponent from 'components/project-page/project-page';
import CloudStoragesPageComponent from 'components/cloud-storages-page/cloud-storages-page';
import CreateCloudStoragePageComponent from 'components/create-cloud-storage-page/create-cloud-storage-page';
import UpdateCloudStoragePageComponent from 'components/update-cloud-storage-page/update-cloud-storage-page';
import OrganizationPage from 'components/organization-page/organization-page';
import CreateOrganizationComponent from 'components/create-organization-page/create-organization-page';
import WebhooksPage from 'components/webhooks-page/webhooks-page';
import CreateWebhookPage from 'components/setup-webhook-pages/create-webhook-page';
import UpdateWebhookPage from 'components/setup-webhook-pages/update-webhook-page';
import AnnotationGuidePage from 'components/md-guide/annotation-guide-page';
import InvitationsPage from 'components/invitations-page/invitations-page';
import RequestsPage from 'components/requests-page/requests-page';
import AnnotationPageContainer from 'containers/annotation-page/annotation-page';
import CreateJobPage from 'components/create-job-page/create-job-page';
import QualityControlPage from 'components/quality-control/quality-control-page';
import AnalyticsReportPage from 'components/analytics-report/analytics-report-page';
import ConsensusManagementPage from 'components/consensus-management-page/consensus-management-page';
import ProfilePageComponent from 'components/profile-page/profile-page';

import RoleAwareSwitch from 'components/access-control/role-aware-switch';
import AdministrationPage from 'components/administration/administration-page';
import MyWorkPage from 'components/my-work/my-work-page';
import { User } from 'cvat-core-wrapper';
import { getRole, isAdmin } from 'utils/access-control/roles';

interface Props {
    user: User;
    pluginRoutes: JSX.Element[];
    nextPath: string;
    nextSearch: string;
    children: React.ReactNode;
}

// Layout and route table for a signed in account. Routes are declared once for every
// role; RoleAwareSwitch keeps only what the server decided role may open.
export default function AuthenticatedShell(props: Props): JSX.Element {
    const {
        user, pluginRoutes, nextPath, nextSearch, children,
    } = props;
    const role = getRole(user);

    return (
        <GlobalErrorBoundary>
            <ShortcutsContextProvider>
                <Layout>
                    <Header />
                    <Layout.Content style={{ height: '100%', position: 'relative' }}>
                        <ShortcutsDialog />
                        <RoleAwareSwitch role={role}>
                            <Route exact path='/auth/logout' component={LogoutComponent} />
                            <Route exact path='/projects' component={ProjectsPageComponent} />
                            <Route exact path='/projects/create' component={CreateProjectPageComponent} />
                            <Route exact path='/projects/:id' component={ProjectPageComponent} />
                            <Route exact path='/projects/:id/webhooks' component={WebhooksPage} />
                            <Route exact path='/projects/:id/guide' component={AnnotationGuidePage} />
                            <Route exact path='/projects/:pid/quality-control' component={QualityControlPage} />
                            <Route exact path='/projects/:pid/analytics' component={AnalyticsReportPage} />
                            <Route exact path='/tasks' component={TasksPageContainer} />
                            <Route exact path='/tasks/create' component={CreateTaskPageContainer} />
                            <Route exact path='/tasks/:id' component={TaskPageComponent} />
                            <Route exact path='/tasks/:tid/quality-control' component={QualityControlPage} />
                            <Route exact path='/tasks/:tid/analytics' component={AnalyticsReportPage} />
                            <Route exact path='/tasks/:tid/consensus' component={ConsensusManagementPage} />
                            <Route exact path='/tasks/:id/jobs/create' component={CreateJobPage} />
                            <Route exact path='/tasks/:id/guide' component={AnnotationGuidePage} />
                            <Route exact path='/tasks/:tid/jobs/:jid' component={AnnotationPageContainer} />
                            <Route exact path='/tasks/:tid/jobs/:jid/analytics' component={AnalyticsReportPage} />
                            <Route exact path='/jobs' component={isAdmin(role) ? JobsPageComponent : MyWorkPage} />
                            <Route exact path='/management/:section' component={AdministrationPage} />
                            <Route exact path='/cloudstorages' component={CloudStoragesPageComponent} />
                            <Route exact path='/cloudstorages/create' component={CreateCloudStoragePageComponent} />
                            <Route exact path='/cloudstorages/update/:id' component={UpdateCloudStoragePageComponent} />
                            <Route exact path='/organizations/create' component={CreateOrganizationComponent} />
                            <Route exact path='/organization/webhooks' component={WebhooksPage} />
                            <Route exact path='/webhooks/create' component={CreateWebhookPage} />
                            <Route exact path='/webhooks/update/:id' component={UpdateWebhookPage} />
                            <Route exact path='/invitations' component={InvitationsPage} />
                            <Route exact path='/organization' component={OrganizationPage} />
                            <Route exact path='/requests' component={RequestsPage} />
                            <Route exact path='/profile' component={ProfilePageComponent} />
                            { pluginRoutes }
                            <Route path='/models'>
                                <Switch>
                                    <Route exact path='/models' component={ModelsPageComponent} />
                                </Switch>
                            </Route>
                            <Redirect push to={{ pathname: nextPath, search: nextSearch }} />
                        </RoleAwareSwitch>
                        {children}
                        {/* eslint-disable-next-line */}
                        <a id='downloadAnchor' target='_blank' style={{ display: 'none' }} download />
                    </Layout.Content>
                </Layout>
            </ShortcutsContextProvider>
        </GlobalErrorBoundary>
    );
}
