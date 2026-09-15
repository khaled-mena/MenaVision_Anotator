// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// Browser side deterrence for employee accounts. None of this is a security boundary:
// the server refuses every export and download for these roles regardless of what the
// browser does. These handlers only remove the convenient paths (context menu image
// saving, clipboard, drag out, print) without touching the annotation shortcuts.

export const PROTECTED_BODY_CLASS = 'cvat-protected-workspace';

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
const MEDIA_SELECTOR = 'img, canvas, svg, video, .cvat-canvas-container';

// Keyboard shortcuts CVAT itself does not use and that open browser data exits.
// Ctrl+S, Ctrl+C, Ctrl+V and Ctrl+A are annotation shortcuts and are intentionally untouched.
const BLOCKED_KEYS = new Set(['p', 'u']);

function isEditable(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest(EDITABLE_SELECTOR);
}

function isMedia(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest(MEDIA_SELECTOR);
}

function onContextMenu(event: MouseEvent): void {
    // Only the native menu is suppressed; CVAT's own context menu handlers still run.
    if (!isEditable(event.target)) {
        event.preventDefault();
    }
}

function onClipboard(event: ClipboardEvent): void {
    if (isEditable(event.target)) return;
    event.preventDefault();
    event.clipboardData?.clearData();
}

function onDragStart(event: DragEvent): void {
    if (isMedia(event.target)) {
        event.preventDefault();
    }
}

function onKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && BLOCKED_KEYS.has(event.key.toLowerCase())) {
        event.preventDefault();
        event.stopPropagation();
    }
}

export function installLeakageGuard(): () => void {
    const options: AddEventListenerOptions = { capture: true };
    document.body.classList.add(PROTECTED_BODY_CLASS);
    document.addEventListener('contextmenu', onContextMenu, options);
    document.addEventListener('copy', onClipboard, options);
    document.addEventListener('cut', onClipboard, options);
    document.addEventListener('dragstart', onDragStart, options);
    document.addEventListener('keydown', onKeyDown, options);

    return () => {
        document.body.classList.remove(PROTECTED_BODY_CLASS);
        document.removeEventListener('contextmenu', onContextMenu, options);
        document.removeEventListener('copy', onClipboard, options);
        document.removeEventListener('cut', onClipboard, options);
        document.removeEventListener('dragstart', onDragStart, options);
        document.removeEventListener('keydown', onKeyDown, options);
    };
}

export interface WatermarkContent {
    username: string;
    userId: number | null;
    timestamp: string;
}

export function buildWatermarkTile(content: WatermarkContent): string {
    const line1 = `${content.username}${content.userId ? ` #${content.userId}` : ''}`;
    const line2 = `${content.timestamp} MENADEVS CONFIDENTIAL`;
    const escape = (text: string): string => text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220">
        <g transform="rotate(-28 180 110)" fill="#000" font-family="Arial, sans-serif"
            font-size="15" text-anchor="middle">
            <text x="180" y="100">${escape(line1)}</text>
            <text x="180" y="124">${escape(line2)}</text>
        </g>
    </svg>`;
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
