// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { Col, Row } from 'antd/lib/grid';
import Modal from 'antd/lib/modal';
import notification from 'antd/lib/notification';
import Spin from 'antd/lib/spin';
import { DisconnectOutlined } from '@ant-design/icons';
import Space from 'antd/lib/space';
import Text from 'antd/lib/typography/Text';

import ExportDatasetModal from 'components/export-dataset/export-dataset-modal';
import ExportBackupModal from 'components/export-backup/export-backup-modal';
import ImportDatasetModal from 'components/import-dataset/import-dataset-modal';
import ImportBackupModal from 'components/import-backup/import-backup-modal';
import UploadFileStatusModal from 'components/common/upload-file-status-modal';
import SelectCSUpdatingSchemeModal from 'components/update-linked-cs-modal/select-cs-updating-scheme-modal';
import AuthenticatedShell from 'components/application-shell/authenticated-shell';
import UnauthenticatedShell from 'components/application-shell/unauthenticated-shell';
import { presentErrors, presentMessages } from 'components/application-shell/notification-presenter';

import { Organization, getCore, UserGrowthDataModifiableFields } from 'cvat-core-wrapper';
import {
    GrowthState, NotificationsState, PluginsState,
} from 'reducers';
import showPlatformNotification, {
    platformInfo,
    stopNotifications,
    showUnsupportedNotification,
} from 'utils/platform-checker';
import '../styles.scss';
import appConfig from 'config';
import EventRecorder from 'utils/event-recorder';
import { authQuery } from 'utils/auth-query';
import InvitationWatcher from './invitation-watcher/invitation-watcher';
import SelectOrganizationModal from './select-organization-modal/select-organization-modal';
import BulkProgress from './bulk-progress';
import ServerUnavailableComponent from './server-unavailable/server-unavailable';
import GitHubStarModal from './github-star-prompt/github-star-modal';

interface CVATAppProps {
    loadFormats: () => void;
    loadAbout: () => void;
    verifyAuthenticated: () => void;
    loadUserAgreements: () => void;
    initPlugins: () => void;
    initModels: () => void;
    resetErrors: () => void;
    resetMessages: () => void;
    loadOrganization: () => void;
    initInvitations: () => void;
    initRequests: () => void;
    loadServerAPISchema: () => void;
    loadGrowthData: () => void;
    updateGrowthData: (fields: UserGrowthDataModifiableFields) => void;
    onChangeLocation: (from: string, to: string) => void;
    userInitialized: boolean;
    userFetching: boolean;
    organizationFetching: boolean;
    organizationInitialized: boolean;
    pluginsInitialized: boolean;
    pluginsFetching: boolean;
    modelsInitialized: boolean;
    modelsFetching: boolean;
    formatsInitialized: boolean;
    formatsFetching: boolean;
    aboutInitialized: boolean;
    aboutFetching: boolean;
    userAgreementsFetching: boolean;
    userAgreementsInitialized: boolean;
    notifications: NotificationsState;
    user: any;
    growth: GrowthState;
    pluginComponents: PluginsState['components'];
    invitationsFetching: boolean;
    invitationsInitialized: boolean;
    requestsFetching: boolean;
    requestsInitialized: boolean;
    serverAPISchemaFetching: boolean;
    serverAPISchemaInitialized: boolean;
    isPasswordResetEnabled: boolean;
    isRegistrationEnabled: boolean;
}

interface CVATAppState {
    healthIinitialized: boolean;
    backendIsHealthy: boolean;
    healthCheckError: string | null;
    githubStarPromptVisible: boolean;
}
class CVATApplication extends React.PureComponent<CVATAppProps & RouteComponentProps, CVATAppState> {
    constructor(props: CVATAppProps & RouteComponentProps) {
        super(props);

        this.state = {
            healthIinitialized: false,
            backendIsHealthy: false,
            healthCheckError: null,
            githubStarPromptVisible: false,
        };
    }

    public componentDidMount(): void {
        const core = getCore();
        const { history, onChangeLocation } = this.props;
        const {
            HEALTH_CHECK_RETRIES, HEALTH_CHECK_PERIOD, HEALTH_CHECK_REQUEST_TIMEOUT,
            RESET_NOTIFICATIONS_PATHS,
        } = appConfig;

        // Logger configuration
        const listener = (e: MouseEvent | KeyboardEvent): void => {
            if (e instanceof MouseEvent && e.type === 'click') {
                EventRecorder.recordMouseEvent(e);
            }

            EventRecorder.recordUserActivity();
        };

        let listenerRegistered = false;
        const visibilityChangeListener = (): void => {
            if (!window.document.hidden) {
                if (!listenerRegistered) {
                    window.addEventListener('keydown', listener, { capture: true });
                    window.addEventListener('click', listener, { capture: true });
                    listenerRegistered = true;
                }
            } else {
                window.removeEventListener('keydown', listener);
                window.removeEventListener('click', listener);
                listenerRegistered = false;
            }
        };

        visibilityChangeListener(); // initial setup other event listeners
        window.addEventListener('visibilitychange', visibilityChangeListener);

        core.logger.configure(() => window.document.hasFocus());
        core.config.onOrganizationChange = (newOrgId: number | null) => {
            if (newOrgId === null) {
                localStorage.removeItem('currentOrganization');
                window.location.reload();
            } else {
                core.organizations.get({
                    filter: `{"and":[{"==":[{"var":"id"},${newOrgId}]}]}`,
                }).then(([organization]: Organization[]) => {
                    if (organization) {
                        localStorage.setItem('currentOrganization', organization.slug);
                        window.location.reload();
                    }
                });
            }
        };

        history.listen((newLocation) => {
            const { location: prevLocation } = this.props;

            onChangeLocation(prevLocation.pathname, newLocation.pathname);

            const shouldResetNotifications = RESET_NOTIFICATIONS_PATHS.from.some(
                (pathname) => prevLocation.pathname === pathname,
            );
            const pathExcluded = shouldResetNotifications && RESET_NOTIFICATIONS_PATHS.exclude.some(
                (pathname) => newLocation.pathname.includes(pathname),
            );
            if (shouldResetNotifications && !pathExcluded) {
                this.resetNotifications();
            }
        });

        core.server.healthCheck(
            HEALTH_CHECK_RETRIES,
            HEALTH_CHECK_PERIOD,
            HEALTH_CHECK_REQUEST_TIMEOUT,
        ).then(() => {
            this.setState({
                healthIinitialized: true,
                backendIsHealthy: true,
                healthCheckError: null,
            });
        })
            .catch((error: unknown) => {
                const healthCheckError = error instanceof Error ? error.message : 'The CVAT server is not reachable.';

                this.setState({
                    healthIinitialized: true,
                    backendIsHealthy: false,
                    healthCheckError,
                });
            });

        const {
            name, version, engine, os,
        } = platformInfo();

        if (showPlatformNotification()) {
            stopNotifications(false);
            Modal.warning({
                title: 'Unsupported platform detected',
                className: 'cvat-modal-unsupported-platform-warning',
                content: (
                    <>
                        <Row>
                            <Col>
                                <Text>
                                    {`The browser you are using is ${name} ${version} based on ${engine}.` +
                                        ' CVAT was tested in the latest versions of Chrome and Firefox.' +
                                        ' We recommend to use Chrome (or another Chromium based browser)'}
                                </Text>
                            </Col>
                        </Row>
                        <Row>
                            <Col>
                                <Text type='secondary'>{`The operating system is ${os}`}</Text>
                            </Col>
                        </Row>
                    </>
                ),
                onOk: () => stopNotifications(true),
            });
        } else if (showUnsupportedNotification()) {
            stopNotifications(false);
            Modal.warning({
                title: 'Unsupported features detected',
                className: 'cvat-modal-unsupported-features-warning',
                content: (
                    <Text>
                        {`${name} v${version} does not support API, which is used by CVAT. `}
                        It is strongly recommended to update your browser.
                    </Text>
                ),
                onOk: () => stopNotifications(true),
            });
        }
    }

    public componentDidUpdate(prevProps: CVATAppProps): void {
        const {
            verifyAuthenticated,
            loadFormats,
            loadAbout,
            loadUserAgreements,
            initPlugins,
            initModels,
            loadOrganization,
            loadServerAPISchema,
            userInitialized,
            userFetching,
            organizationFetching,
            organizationInitialized,
            formatsInitialized,
            formatsFetching,
            aboutInitialized,
            aboutFetching,
            pluginsInitialized,
            pluginsFetching,
            modelsInitialized,
            modelsFetching,
            user,
            userAgreementsFetching,
            userAgreementsInitialized,
            invitationsInitialized,
            invitationsFetching,
            initInvitations,
            requestsFetching,
            requestsInitialized,
            initRequests,
            history,
            serverAPISchemaFetching,
            serverAPISchemaInitialized,
            growth,
            loadGrowthData,
        } = this.props;

        const { backendIsHealthy } = this.state;

        if (!backendIsHealthy) {
            return;
        }

        this.showErrors();
        this.showMessages();

        if (!userInitialized && !userFetching) {
            verifyAuthenticated();
            return;
        }

        if (user !== prevProps.user) {
            if (user) {
                EventRecorder.initSave();
            } else {
                EventRecorder.cancelSave();
            }
        }

        if (user?.id !== prevProps.user?.id && this.state.githubStarPromptVisible) {
            this.setState({ githubStarPromptVisible: false });
        }

        if (!userAgreementsInitialized && !userAgreementsFetching) {
            loadUserAgreements();
            return;
        }

        if (!serverAPISchemaInitialized && !serverAPISchemaFetching) {
            loadServerAPISchema();
        }

        if (!aboutInitialized && !aboutFetching) {
            loadAbout();
            return;
        }

        if (user == null || !user.isVerified || !user?.id) {
            return;
        }

        if (!organizationInitialized && !organizationFetching) {
            loadOrganization();
            return;
        }

        if (!formatsInitialized && !formatsFetching) {
            loadFormats();
        }

        if (organizationInitialized && !requestsInitialized && !requestsFetching) {
            initRequests();
        }

        if (!modelsInitialized && !modelsFetching) {
            initModels();
        }

        if (!invitationsInitialized && !invitationsFetching && history.location.pathname !== '/invitations') {
            initInvitations();
        }

        if (user && user.isVerified && !growth.initialized && !growth.fetching) {
            loadGrowthData();
            return;
        }

        if (
            growth.data?.githubPromptEnabled &&
            !prevProps.growth.data?.githubPromptEnabled &&
            !this.state.githubStarPromptVisible
        ) {
            this.setState({ githubStarPromptVisible: true });
        }

        if (!pluginsInitialized && !pluginsFetching) {
            initPlugins();
        }
    }

    private showMessages(): void {
        const { notifications, resetMessages, history } = this.props;
        if (presentMessages(history, notifications)) {
            resetMessages();
        }
    }

    private showErrors(): void {
        const { notifications, resetErrors, history } = this.props;
        if (presentErrors(history, notifications)) {
            resetErrors();
        }
    }

    private resetNotifications(): void {
        const { resetErrors, resetMessages } = this.props;

        notification.destroy();
        resetErrors();
        resetMessages();
    }

    private markGitHubStarPromptShown = (): void => {
        const { updateGrowthData } = this.props;
        updateGrowthData({ githubPromptShown: true });
    };

    private supportCVAT = (): void => {
        const { updateGrowthData } = this.props;
        updateGrowthData({ githubPromptSupportClicked: true });
        window.open(appConfig.GITHUB_URL, '_blank', 'noopener,noreferrer');
    };

    // Where you go depends on your URL
    public render(): JSX.Element {
        const {
            userInitialized,
            aboutInitialized,
            pluginsInitialized,
            formatsInitialized,
            modelsInitialized,
            organizationInitialized,
            userAgreementsInitialized,
            serverAPISchemaInitialized,
            pluginComponents,
            user,
            growth,
            location,
            isPasswordResetEnabled,
            isRegistrationEnabled,
        } = this.props;

        const { healthIinitialized, backendIsHealthy, healthCheckError } = this.state;

        const notRegisteredUserInitialized = (userInitialized && (user == null || !user.isVerified));
        let readyForRender = userAgreementsInitialized && serverAPISchemaInitialized && aboutInitialized;
        readyForRender = readyForRender && (notRegisteredUserInitialized ||
            (
                userInitialized &&
                formatsInitialized &&
                pluginsInitialized &&
                organizationInitialized &&
                modelsInitialized
            )
        );

        const routesToRender = pluginComponents.router
            .filter(({ data: { shouldBeRendered } }) => shouldBeRendered(this.props, this.state))
            .map(({ component: Component }) => Component());

        const queryParams = new URLSearchParams(location.search);
        const authParams = authQuery(queryParams);

        if (readyForRender) {
            if (user && user.isVerified) {
                return (
                    <AuthenticatedShell
                        user={user}
                        pluginRoutes={routesToRender}
                        nextPath={queryParams.get('next') ?? '/tasks'}
                        nextSearch={authParams ? new URLSearchParams(authParams).toString() : ''}
                    >
                        <ExportDatasetModal />
                        <ExportBackupModal />
                        <ImportDatasetModal />
                        <ImportBackupModal />
                        <InvitationWatcher />
                        <UploadFileStatusModal />
                        <SelectCSUpdatingSchemeModal />
                        <SelectOrganizationModal />
                        <BulkProgress />
                        {this.state.githubStarPromptVisible &&
                            growth.data ? (
                                <GitHubStarModal
                                    open
                                    onShown={this.markGitHubStarPromptShown}
                                    onSupport={this.supportCVAT}
                                    onClose={() => this.setState({ githubStarPromptVisible: false })}
                                />
                            ) : null}
                    </AuthenticatedShell>
                );
            }

            return (
                <UnauthenticatedShell
                    isRegistrationEnabled={isRegistrationEnabled}
                    isPasswordResetEnabled={isPasswordResetEnabled}
                    pluginRoutes={routesToRender}
                    pathname={location.pathname}
                />
            );
        }

        if (healthIinitialized && !backendIsHealthy) {
            return (
                <Space align='center' direction='vertical' className='cvat-spinner cvat-server-unavailable'>
                    <DisconnectOutlined className='cvat-disconnected' />
                    <Text className='cvat-server-unavailable-title' strong>
                        Cannot connect to the server
                    </Text>
                    <ServerUnavailableComponent details={healthCheckError} />
                </Space>
            );
        }

        return (
            <Spin size='large' fullscreen className='cvat-spinner' tip='Connecting...' />
        );
    }
}

export default withRouter(CVATApplication);
