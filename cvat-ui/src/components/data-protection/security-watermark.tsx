// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React, { useEffect, useMemo, useState } from 'react';

import { buildWatermarkTile } from 'utils/data-protection/leakage-guard';
import dayjs from 'utils/dayjs-wrapper';

interface Props {
    username: string;
    userId: number | null;
}

const REFRESH_INTERVAL_MS = 60 * 1000;

// Repeated, low opacity, non interactive overlay. It is drawn above the workspace only
// in the browser; nothing is written into frames or annotations.
export default function SecurityWatermark({ username, userId }: Props): JSX.Element {
    const [timestamp, setTimestamp] = useState(() => dayjs().format('YYYY-MM-DD HH:mm'));

    useEffect(() => {
        const timer = window.setInterval(() => {
            setTimestamp(dayjs().format('YYYY-MM-DD HH:mm'));
        }, REFRESH_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, []);

    const backgroundImage = useMemo(
        () => buildWatermarkTile({ username, userId, timestamp }),
        [username, userId, timestamp],
    );

    return <div className='cvat-security-watermark' aria-hidden='true' style={{ backgroundImage }} />;
}
