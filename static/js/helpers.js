// static/js/helpers.js
// Utility and helper functions

import { formatCurrency } from "./api.js";
import * as state from "./state.js";

// Online/UI Helpers
export const isOnline = () => navigator.onLine;
export const getActiveTabId = () => document.querySelector(".tab-btn.active")?.dataset.tab || null;

// Filter transactions by date range
export function filterByDateRange(items, { start_date, end_date }, getDate = (x) => x.date) {
    let filtered = [...items];

    if (start_date) {
        const s = new Date(start_date);
        filtered = filtered.filter((item) => new Date(getDate(item)) >= s);
    }
    if (end_date) {
        const e = new Date(end_date);
        filtered = filtered.filter((item) => new Date(getDate(item)) <= e);
    }

    return filtered;
}

// Find item by numeric ID or UUID
export function findByIdOrUuid(collection, val) {
    if (val === null || val === undefined || val === "") return null;
    const sval = String(val);
    // If value looks like an integer number, try numeric id first
    if (/^-?\d+$/.test(sval)) {
        const num = Number(sval);
        const byId = collection.find((c) => c.id === num);
        if (byId) return byId;
    }
    // Try matching uuid or stringified id fallback
    const byUuid = collection.find((c) => String(c.uuid) === sval);
    if (byUuid) return byUuid;
    return collection.find((c) => String(c.id) === sval) || null;
}

// Resolve category select value from transaction
export function resolveSelectValueForCategory(tx) {
    if (!tx) return "";

    const byIdOrUuid = tx.category_id != null ? findByIdOrUuid(state.localCategories, tx.category_id) : null;
    if (byIdOrUuid) return String(byIdOrUuid.id != null ? byIdOrUuid.id : byIdOrUuid.uuid);

    const name = (tx.category_name || "").trim();
    if (name) {
        const byName = state.localCategories.find((c) => !c.is_deleted && (c.name || "").trim() === name);
        if (byName) return String(byName.id != null ? byName.id : byName.uuid);
    }

    return "";
}

// Resolve account select value from transaction
export function resolveSelectValueForAccount(tx) {
    if (!tx) return "";

    const byIdOrUuid = tx.account_id != null ? findByIdOrUuid(state.localAccounts, tx.account_id) : null;
    if (byIdOrUuid) return String(byIdOrUuid.id != null ? byIdOrUuid.id : byIdOrUuid.uuid);

    const name = (tx.account_name || "").trim();
    if (name) {
        const byName = state.localAccounts.find((a) => !a.is_deleted && (a.name || "").trim() === name);
        if (byName) return String(byName.id != null ? byName.id : byName.uuid);
    }

    return "";
}

// Check if server item is newer
export function isServerNewer(localItem, serverItem) {
    const l = new Date(localItem?.updated_at || 0).getTime();
    const s = new Date(serverItem?.updated_at || 0).getTime();
    return s > l;
}

// Prettify description for display (hashtag handling)
export function prettifyDescriptionForDisplay(desc) {
    if (!desc) return "";
    const hashCount = (desc.match(/#/g) || []).length;
    if (hashCount >= 2) {
        const parts = desc
            .split(/\s+/)
            .filter(Boolean)
            .map((p) => p.replace(/^#/, "").trim())
            .filter(Boolean);

        const short = parts.slice(0, 4).join(" • ");
        return short || desc;
    }
    return desc;
}

// Get recent transaction templates
export function getRecentTransactionTemplates(limit = 5, opts = {}) {
    const { type = null } = opts || {};

    const txs = state.localTransactions.filter((t) => !t.is_deleted && (!type || t.type === type));
    if (!txs.length) return [];

    const sorted = [...txs].sort((a, b) => {
        const aTs = new Date(a.updated_at || a.date);
        const bTs = new Date(b.updated_at || b.date);
        return bTs - aTs;
    });

    const seen = new Set();
    const result = [];

    for (const t of sorted) {
        const key = [
            t.type,
            t.amount,
            t.category_id || "",
            t.account_id || "",
            (t.description || "").trim(),
        ].join("|");

        if (!seen.has(key)) {
            seen.add(key);
            result.push(t);
            if (result.length >= limit) break;
        }
    }

    return result;
}

// Get date filters for current time range
export function getDateFilters(timeRangeSelect, customMonthInput) {
    const range = timeRangeSelect ? (timeRangeSelect.value || "month") : "month";
    const filters = { range };

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);

    if (range === "custom" && customMonthInput && customMonthInput.value) {
        const [yearStr, monthStr] = customMonthInput.value.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr);

        if (year && month) {
            const start = `${yearStr}-${monthStr}-01`;
            const lastDay = new Date(year, month, 0);
            const end = lastDay.toISOString().slice(0, 10);

            filters.start_date = start;
            filters.end_date = end;
        }
        return filters;
    }

    if (range === "day") {
        filters.start_date = todayISO;
        filters.end_date = todayISO;
    } else if (range === "week") {
        const start = new Date(today);
        start.setDate(start.getDate() - 6);
        filters.start_date = start.toISOString().slice(0, 10);
        filters.end_date = todayISO;
    } else if (range === "month") {
        const start = new Date(today);
        start.setDate(start.getDate() - 29);
        filters.start_date = start.toISOString().slice(0, 10);
        filters.end_date = todayISO;
    } else if (range === "3months") {
        const start = new Date(today);
        start.setDate(start.getDate() - 89);
        filters.start_date = start.toISOString().slice(0, 10);
        filters.end_date = todayISO;
    } else if (range === "6months") {
        const start = new Date(today);
        start.setDate(start.getDate() - 179);
        filters.start_date = start.toISOString().slice(0, 10);
        filters.end_date = todayISO;
    }

    return filters;
}

// Ensure custom month is initialized
export function ensureCustomMonthInitialized(customMonthInput) {
    if (!customMonthInput) return;

    if (!customMonthInput.value) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        customMonthInput.value = `${y}-${m}`;
    }
}

// Shift custom month by delta
export function shiftCustomMonth(delta, timeRangeSelect, customMonthInput, switchTabFn) {
    if (!customMonthInput) return;

    if (timeRangeSelect && timeRangeSelect.value !== "custom") {
        timeRangeSelect.value = "custom";
        customMonthInput.style.display = "inline-block";
    }

    ensureCustomMonthInitialized(customMonthInput);

    const [yearStr, monthStr] = customMonthInput.value.split("-");
    let year = Number(yearStr);
    let month = Number(monthStr);

    month += delta;
    if (month < 1) {
        month += 12;
        year -= 1;
    } else if (month > 12) {
        month -= 12;
        year += 1;
    }

    const mm = String(month).padStart(2, "0");
    customMonthInput.value = `${year}-${mm}`;

    const activeTab = getActiveTabId();
    if (activeTab) switchTabFn(activeTab);
}

// Get visible transactions for current range
export function getVisibleTransactionsForCurrentRange(timeRangeSelect, customMonthInput) {
    const filters = getDateFilters(timeRangeSelect, customMonthInput);
    const visible = filterByDateRange(
        state.localTransactions.filter((t) => !t.is_deleted),
        filters,
        (t) => t.date
    );

    visible.sort((a, b) => {
        const da = new Date(a.date);
        const db = new Date(b.date);
        if (da.getTime() !== db.getTime()) {
            return db - da;
        }
        const ua = new Date(a.updated_at || a.date);
        const ub = new Date(b.updated_at || b.date);
        return ub - ua;
    });

    return visible;
}

// Get period range dates  
export function getPeriodRange(periodKey) {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);

    const ranges = {
        today: { start_date: todayISO, end_date: todayISO },
        week: {
            start_date: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            end_date: todayISO,
        },
        month: {
            start_date: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            end_date: todayISO,
        },
    };

    return ranges[periodKey] || { start_date: todayISO, end_date: todayISO };
}
