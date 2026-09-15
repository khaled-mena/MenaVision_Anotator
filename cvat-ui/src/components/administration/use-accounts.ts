// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useState } from 'react';
import notification from 'antd/lib/notification';

import { WorkforceRole } from 'utils/access-control/roles';
import { Account, AccountsQuery, accountsClient } from 'utils/administration/workforce-client';

export interface AccountFilters {
    search: string;
    role: WorkforceRole | null;
    isActive: boolean | null;
}

export const DEFAULT_FILTERS: AccountFilters = { search: '', role: null, isActive: null };

export interface AccountsState {
    accounts: Account[];
    count: number;
    page: number;
    pageSize: number;
    fetching: boolean;
    error: string | null;
    filters: AccountFilters;
}

export function describeError(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: unknown }).message);
    }
    return String(error);
}

export interface AccountsController extends AccountsState {
    reload(): Promise<void>;
    setPage(page: number): void;
    setFilters(filters: Partial<AccountFilters>): void;
    run(operation: () => Promise<unknown>, successMessage: string): Promise<boolean>;
}

export function useAccounts(pageSize = 15): AccountsController {
    const [state, setState] = useState<AccountsState>({
        accounts: [],
        count: 0,
        page: 1,
        pageSize,
        fetching: true,
        error: null,
        filters: DEFAULT_FILTERS,
    });

    const reload = useCallback(async () => {
        setState((previous) => ({ ...previous, fetching: true, error: null }));
        const query: AccountsQuery = {
            page: state.page,
            pageSize: state.pageSize,
            search: state.filters.search || undefined,
            role: state.filters.role,
            isActive: state.filters.isActive,
            sort: '-date_joined',
        };
        try {
            const result = await accountsClient.list(query);
            setState((previous) => ({
                ...previous, accounts: result.results, count: result.count, fetching: false,
            }));
        } catch (error: unknown) {
            setState((previous) => ({ ...previous, fetching: false, error: describeError(error) }));
        }
    }, [state.page, state.pageSize, state.filters]);

    useEffect(() => {
        reload();
    }, [reload]);

    const setPage = useCallback((page: number): void => {
        setState((previous) => ({ ...previous, page }));
    }, []);

    const setFilters = useCallback((filters: Partial<AccountFilters>): void => {
        setState((previous) => ({ ...previous, page: 1, filters: { ...previous.filters, ...filters } }));
    }, []);

    const run = useCallback(async (
        operation: () => Promise<unknown>, successMessage: string,
    ): Promise<boolean> => {
        try {
            await operation();
            notification.success({ message: successMessage });
            await reload();
            return true;
        } catch (error: unknown) {
            notification.error({ message: 'The operation was rejected', description: describeError(error) });
            return false;
        }
    }, [reload]);

    return {
        ...state, reload, setPage, setFilters, run,
    };
}
