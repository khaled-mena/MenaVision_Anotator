// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

/// <reference types="cypress" />

context('Workforce roles: administrator provisions accounts, employees see only assigned work.', () => {
    const suffix = Date.now().toString().slice(-6);
    const tasker = { username: `wf_tasker_${suffix}`, password: 'Tasker-Cypress-Pass-2026' };
    const reviewer = { username: `wf_reviewer_${suffix}`, password: 'Reviewer-Cypress-Pass-2026' };

    function expectForbidden(method, url, body) {
        cy.window().then((win) => {
            cy.wrap(null).then(() => win.cvat.server.request(
                `${win.cvat.config.backendAPI}${url}`, { method, data: body },
            ).then(
                () => { throw new Error(`${method} ${url} unexpectedly succeeded`); },
                (error) => expect(error.code).to.eq(403),
            ));
        });
    }

    before(() => {
        cy.visit('auth/login');
        cy.login();
    });

    describe('Administrator', () => {
        it('Public registration is unavailable.', () => {
            cy.request({
                url: '/api/auth/register', method: 'POST', failOnStatusCode: false, body: {},
            })
                .its('status').should('eq', 404);
            cy.visit('auth/register');
            cy.url().should('not.include', '/auth/register');
        });

        it('Creates a Tasker and a Reviewer from the administration dashboard.', () => {
            cy.visit('management/users');
            cy.get('.cvat-administration-accounts-table').should('exist');
            for (const [account, role] of [[tasker, 'Tasker'], [reviewer, 'Reviewer']]) {
                cy.get('.cvat-administration-create-user-button').click();
                cy.get('.cvat-administration-account-form-modal').within(() => {
                    cy.get('#username').type(account.username);
                    cy.get('#password').type(account.password);
                    cy.get('.ant-select-selector').click();
                });
                cy.get('.ant-select-dropdown:visible').contains('.ant-select-item-option-content', role).click();
                cy.get('.cvat-administration-account-form-modal').contains('button', 'Create').click();
                cy.get('.cvat-administration-accounts-table').contains(account.username).should('exist');
            }
        });
    });

    describe('Tasker', () => {
        before(() => {
            cy.logout();
            cy.login(tasker.username, tasker.password, 'jobs');
        });

        it('Sees the employee navigation and only assigned work.', () => {
            cy.get('.cvat-my-work-page').should('exist');
            cy.get('.cvat-header-projects-button').should('not.exist');
            cy.get('.cvat-header-administration-button').should('not.exist');
        });

        it('Administrative URLs are denied without rendering their content.', () => {
            for (const url of ['management/users', 'projects', 'tasks', 'projects/create', 'cloudstorages']) {
                cy.visit(url);
                cy.get('.cvat-access-denied-page').should('exist');
            }
        });

        it('Direct API requests for administrative and data transfer operations are rejected.', () => {
            expectForbidden('POST', '/projects', { name: 'forbidden' });
            expectForbidden('POST', '/tasks', { name: 'forbidden', labels: [{ name: 'x' }] });
            expectForbidden('GET', '/workforce/accounts');
            expectForbidden('POST', '/workforce/accounts/1/role', { role: 'tasker' });
            expectForbidden('GET', '/events?from=2020-01-01T00:00:00Z');
        });
    });

    describe('Reviewer', () => {
        before(() => {
            cy.logout();
            cy.login(reviewer.username, reviewer.password, 'jobs');
        });

        it('Sees the review view and cannot reach account management.', () => {
            cy.get('.cvat-my-work-page').contains('My reviews').should('exist');
            expectForbidden('POST', '/workforce/accounts', { username: 'x', role: 'admin', password: 'Whatever-Pass-2026' });
            cy.visit('management/users');
            cy.get('.cvat-access-denied-page').should('exist');
        });
    });

    after(() => {
        cy.logout();
        cy.login();
        cy.window().its('cvat', { timeout: 25000 }).should('not.be.undefined');
        cy.window().then(async (win) => {
            const api = win.cvat.config.backendAPI;
            const request = (method, url) => win.cvat.server.request(`${api}${url}`, { method });
            const { data } = await request('GET', '/workforce/accounts?search=wf_');
            for (const account of data.results) {
                await request('POST', `/workforce/accounts/${account.id}/deactivate`);
                await request('DELETE', `/workforce/accounts/${account.id}`);
            }
        });
    });
});
