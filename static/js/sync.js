// static/js/sync.js
// Server synchronization functions

import { apiGet, apiPost } from "./api.js";
import * as state from "./state.js";
import * as storage from "./storage.js";
import * as helpers from "./helpers.js";

export function updateLastSync(currentIso, items) {
    let maxTs = currentIso ? new Date(currentIso).getTime() : 0;

    items.forEach((it) => {
        if (!it || !it.updated_at) return;
        const t = new Date(it.updated_at).getTime();
        if (!isNaN(t) && t > maxTs) {
            maxTs = t;
        }
    });

    return maxTs ? new Date(maxTs).toISOString() : currentIso;
}

export function setSelectFromCollection(selectEl, collection, storedVal) {
    if (storedVal == null || storedVal === "") {
        selectEl.value = "";
        return;
    }

    const obj = helpers.findByIdOrUuid(collection, storedVal);
    if (!obj) {
        selectEl.value = "";
        return;
    }

    if (obj.id != null) {
        const idStr = String(obj.id);
        if ([...selectEl.options].some(o => o.value === idStr)) {
            selectEl.value = idStr;
            return;
        }
    }

    if (obj.uuid) {
        const uuidStr = String(obj.uuid);
        if ([...selectEl.options].some(o => o.value === uuidStr)) {
            selectEl.value = uuidStr;
            return;
        }
    }

    selectEl.value = "";
}

export async function syncTransactionsWithServer() {
    if (!helpers.isOnline()) {
        console.log("Offline, skipping transactions sync.");
        return;
    }

    console.log("Starting transactions sync...");

    const dirty = state.localTransactions.filter((t) => t.needs_sync === true);
    if (dirty.length > 0) {
        try {
            const payload = {
                items: dirty.map((t) => ({
                    uuid: t.uuid,
                    type: t.type,
                    amount: t.amount,
                    date: t.date,
                    description: t.description,
                    category_id: t.category_id || null,
                    account_id: t.account_id || null,
                    updated_at: t.updated_at,
                    is_deleted: !!t.is_deleted,
                })),
            };
            await apiPost("/api/sync/transactions", payload);
            dirty.forEach((t) => {
                const idx = state.localTransactions.findIndex((x) => x.uuid === t.uuid);
                if (idx >= 0) {
                    state.localTransactions[idx].needs_sync = false;
                }
            });
        } catch (err) {
            console.error("Failed to upload transactions to server", err);
        }
    }

    try {
        const params = {};
        if (state.lastSyncAt) {
            params.since = state.lastSyncAt;
        }
        const res = await apiGet("/api/sync/transactions", params);
        const items = res.items || [];

        items.forEach((serverTx) => {
            storage.upsertLocalTransaction({
                uuid: serverTx.uuid,
                type: serverTx.type,
                amount: serverTx.amount,
                date: serverTx.date,
                description: serverTx.description,
                category_id: serverTx.category_id,
                account_id: serverTx.account_id,
                updated_at: serverTx.updated_at,
                is_deleted: serverTx.is_deleted,
                needs_sync: false,
            });
        });

        state.lastSyncAt = updateLastSync(state.lastSyncAt, items);
        storage.saveLocalTransactionsToStorage();
        console.log("Transactions sync finished.");
    } catch (err) {
        console.error("Failed to download transactions from server", err);
    }
}

export async function syncAccountsWithServer() {
    if (!helpers.isOnline()) {
        console.log("Offline, skipping accounts sync.");
        return;
    }

    console.log("Starting accounts sync...");

    const dirty = state.localAccounts.filter((a) => a.needs_sync === true);
    if (dirty.length > 0) {
        try {
            const payload = {
                items: dirty.map((a) => ({
                    uuid: a.uuid,
                    name: a.name,
                    type: a.type,
                    initial_balance: a.initial_balance,
                    updated_at: a.updated_at,
                    is_deleted: !!a.is_deleted,
                })),
            };
            await apiPost("/api/sync/accounts", payload);
            dirty.forEach((a) => {
                const idx = state.localAccounts.findIndex((x) => x.uuid === a.uuid);
                if (idx >= 0) {
                    state.localAccounts[idx].needs_sync = false;
                }
            });
        } catch (err) {
            console.error("Failed to upload accounts to server", err);
        }
    }

    try {
        const params = {};
        if (state.lastSyncAccountsAt) {
            params.since = state.lastSyncAccountsAt;
        }
        const res = await apiGet("/api/sync/accounts", params);
        const items = res.items || [];

        items.forEach((serverAcc) => {
            storage.upsertLocalAccount({
                id: serverAcc.id,
                uuid: serverAcc.uuid,
                name: serverAcc.name,
                type: serverAcc.type,
                initial_balance: serverAcc.initial_balance,
                updated_at: serverAcc.updated_at,
                is_deleted: !!serverAcc.is_deleted,
                needs_sync: false,
            });
        });

        state.lastSyncAccountsAt = updateLastSync(state.lastSyncAccountsAt, items);
        storage.saveLocalTransactionsToStorage();
        console.log("Accounts sync finished.");
    } catch (err) {
        console.error("Failed to download accounts from server", err);
    }
}

export async function syncCategoriesWithServer() {
    if (!helpers.isOnline()) {
        console.log("Offline, skipping categories sync.");
        return;
    }

    console.log("Starting categories sync...");

    const dirty = state.localCategories.filter((c) => c.needs_sync === true);
    if (dirty.length > 0) {
        try {
            const payload = {
                items: dirty.map((c) => ({
                    uuid: c.uuid,
                    name: c.name,
                    type: c.type,
                    updated_at: c.updated_at,
                    is_deleted: !!c.is_deleted,
                })),
            };
            await apiPost("/api/sync/categories", payload);
            dirty.forEach((c) => {
                const idx = state.localCategories.findIndex((x) => x.uuid === c.uuid);
                if (idx >= 0) {
                    state.localCategories[idx].needs_sync = false;
                }
            });
        } catch (err) {
            console.error("Failed to upload categories to server", err);
        }
    }

    try {
        const params = {};
        if (state.lastSyncCategoriesAt) {
            params.since = state.lastSyncCategoriesAt;
        }
        const res = await apiGet("/api/sync/categories", params);
        const items = res.items || [];

        items.forEach((serverCat) => {
            storage.upsertLocalCategory({
                id: serverCat.id,
                uuid: serverCat.uuid,
                name: serverCat.name,
                type: serverCat.type,
                updated_at: serverCat.updated_at,
                is_deleted: !!serverCat.is_deleted,
                needs_sync: false,
            });
        });

        state.lastSyncCategoriesAt = updateLastSync(state.lastSyncCategoriesAt, items);
        storage.saveLocalTransactionsToStorage();
        console.log("Categories sync finished.");
    } catch (err) {
        console.error("Failed to download categories from server", err);
    }
}
