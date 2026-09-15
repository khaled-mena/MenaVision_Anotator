// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { Redirect, Route, Switch } from 'react-router';

import GlobalErrorBoundary from 'components/global-error-boundary/global-error-boundary';
import LoginPageContainer from 'containers/login-page/login-page';
import RegisterPageContainer from 'containers/register-page/register-page';
import ResetPasswordPageConfirmComponent from 'components/reset-password-confirm-page/reset-password-confirm-page';
import ResetPasswordPageComponent from 'components/reset-password-page/reset-password-page';
import EmailConfirmationPage from 'components/email-confirmation-pages/email-confirmed';
import EmailVerificationSentPage from 'components/email-confirmation-pages/email-verification-sent';
import IncorrectEmailConfirmationPage from 'components/email-confirmation-pages/incorrect-email-confirmation';
import InvitationWatcher from 'components/invitation-watcher/invitation-watcher';

interface Props {
    isRegistrationEnabled: boolean;
    isPasswordResetEnabled: boolean;
    pluginRoutes: JSX.Element[];
    pathname: string;
}

// Route table for visitors. The registration route only exists when the server
// exposes the registration endpoint, which the internal platform does not.
export default function UnauthenticatedShell(props: Props): JSX.Element {
    const {
        isRegistrationEnabled, isPasswordResetEnabled, pluginRoutes, pathname,
    } = props;

    return (
        <GlobalErrorBoundary>
            <>
                <Switch>
                    {isRegistrationEnabled && (
                        <Route exact path='/auth/register' component={RegisterPageContainer} />
                    )}
                    <Route exact path='/auth/email-verification-sent' component={EmailVerificationSentPage} />
                    <Route exact path='/auth/incorrect-email-confirmation' component={IncorrectEmailConfirmationPage} />
                    <Route exact path='/auth/login' component={LoginPageContainer} />
                    {isPasswordResetEnabled && (
                        <Route exact path='/auth/password/reset' component={ResetPasswordPageComponent} />
                    )}
                    {isPasswordResetEnabled && (
                        <Route
                            exact
                            path='/auth/password/reset/confirm'
                            component={ResetPasswordPageConfirmComponent}
                        />
                    )}
                    <Route exact path='/auth/email-confirmation' component={EmailConfirmationPage} />
                    { pluginRoutes }
                    <Redirect to={pathname.length > 1 ? `/auth/login?next=${pathname}` : '/auth/login'} />
                </Switch>
                <InvitationWatcher />
            </>
        </GlobalErrorBoundary>
    );
}
