/**
 * The limited Free plan, as the portal sees it (founder, 2026-11-02).
 *
 * Free = 3 health policy checks + 20 policy scans. Customers, Leads and Renewals stay readable
 * (an account that paid and lapsed loses nothing it built) but cannot be changed; every other
 * paid screen shows the upgrade screen. The server enforces the paid-only routes itself
 * (backend lib/entitlement.ts); CRM tables are written by the browser under RLS, so this guard
 * is what stops a limited account changing them from the portal.
 *
 * Set once the advisor profile loads (EntitlementSync in AgentLayout). Module state rather
 * than React context because the write helpers in lib/customers.ts, lib/leads.ts and
 * lib/leadPolicies.ts are plain functions, and the Sach widget lives outside AgentProvider.
 */

let limited = false
let message = 'This is part of the paid plan. Upgrade to make changes.'
const EVENT = 'indsure:entitlement'

export function setLimitedFree(value: boolean, upgradeMessage?: string): void {
    if (upgradeMessage) message = upgradeMessage
    if (limited === value) return
    limited = value
    try { window.dispatchEvent(new Event(EVENT)) } catch { /* no window in SSR */ }
}

export function isLimitedFreeSession(): boolean {
    return limited
}

export function onEntitlementChange(fn: () => void): () => void {
    window.addEventListener(EVENT, fn)
    return () => window.removeEventListener(EVENT, fn)
}

export class NeedsUpgradeError extends Error {
    readonly code = 'NEEDS_UPGRADE'
    constructor() {
        super(message)
        this.name = 'NeedsUpgradeError'
    }
}

/** First line of every CRM write helper. Throws, so each page's existing error handling shows it. */
export function assertCrmWritable(): void {
    if (limited) throw new NeedsUpgradeError()
}
