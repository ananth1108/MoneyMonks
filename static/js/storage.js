// static/js/storage.js
// localStorage operations for persisting and loading data

import * as constants from "./constants.js";
import * as state from "./state.js";

export function loadLocalTransactionsFromStorage() {
    try {
        const raw = localStorage.getItem(constants.LOCAL_TX_KEY);
        state.setLocalTransactions(raw ? JSON.parse(raw) : []);
    } catch (e) {
        console.warn("Failed to parse local transactions", e);
        state.setLocalTransactions([]);
    }

    try {
        const rawA = localStorage.getItem(constants.LOCAL_ACC_KEY);
        state.setLocalAccounts(rawA ? JSON.parse(rawA) : []);
    } catch (e) {
        console.warn("Failed to parse local accounts", e);
        state.setLocalAccounts([]);
    }

    try {
        const rawC = localStorage.getItem(constants.LOCAL_CAT_KEY);
        state.setLocalCategories(rawC ? JSON.parse(rawC) : []);
    } catch (e) {
        console.warn("Failed to parse local categories", e);
        state.setLocalCategories([]);
    }

    try {
        const rawT = localStorage.getItem(constants.LOCAL_TRIP_KEY);
        state.setLocalTrips(rawT ? JSON.parse(rawT) : []);
    } catch (e) {
        console.warn("Failed to parse local trips", e);
        state.setLocalTrips([]);
    }

    state.setLastSyncAt(localStorage.getItem(constants.LOCAL_TX_LAST_SYNC_KEY));
    state.setLastSyncAccountsAt(localStorage.getItem(constants.LOCAL_ACC_LAST_SYNC_KEY));
    state.setLastSyncCategoriesAt(localStorage.getItem(constants.LOCAL_CAT_LAST_SYNC_KEY));
    state.setLastSyncTripsAt(localStorage.getItem(constants.LOCAL_TRIP_LAST_SYNC_KEY));

    // Load trips UI state
    try {
        const raw = localStorage.getItem(constants.LOCAL_TRIPS_UI_STATE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            state.setTripsSectionState({
                openCollapsed: !!parsed.openCollapsed,
                closedCollapsed: !!parsed.closedCollapsed,
            });
        }
    } catch (e) {
        console.warn("Failed to load trips UI state", e);
    }
}

export function saveLocalTransactionsToStorage() {
    try {
        localStorage.setItem(constants.LOCAL_TX_KEY, JSON.stringify(state.localTransactions));
        localStorage.setItem(constants.LOCAL_ACC_KEY, JSON.stringify(state.localAccounts));
        localStorage.setItem(constants.LOCAL_CAT_KEY, JSON.stringify(state.localCategories));
        localStorage.setItem(constants.LOCAL_TRIP_KEY, JSON.stringify(state.localTrips));

        if (state.lastSyncAt) {
            localStorage.setItem(constants.LOCAL_TX_LAST_SYNC_KEY, state.lastSyncAt);
        }
        if (state.lastSyncAccountsAt) {
            localStorage.setItem(constants.LOCAL_ACC_LAST_SYNC_KEY, state.lastSyncAccountsAt);
        }
        if (state.lastSyncCategoriesAt) {
            localStorage.setItem(constants.LOCAL_CAT_LAST_SYNC_KEY, state.lastSyncCategoriesAt);
        }
        if (state.lastSyncTripsAt) {
            localStorage.setItem(constants.LOCAL_TRIP_LAST_SYNC_KEY, state.lastSyncTripsAt);
        }
    } catch (e) {
        console.warn("Failed to save local state", e);
    }
}

export function saveTripUIState() {
    try {
        localStorage.setItem(
            constants.LOCAL_TRIPS_UI_STATE_KEY,
            JSON.stringify(state.tripsSectionState)
        );
    } catch (e) {
        console.warn("Failed to persist trips UI state", e);
    }
}

export function upsertLocalTransaction(tx) {
    if (!tx.uuid) {
        tx.uuid = crypto.randomUUID
            ? crypto.randomUUID()
            : `local-${Date.now()}-${Math.random()}`;
    }
    tx.updated_at = tx.updated_at || new Date().toISOString();
    tx.is_deleted = !!tx.is_deleted;

    const idx = state.localTransactions.findIndex((t) => t.uuid === tx.uuid);
    if (idx >= 0) {
        state.localTransactions[idx] = { ...state.localTransactions[idx], ...tx };
    } else {
        state.localTransactions.push(tx);
    }
}

export function upsertLocalAccount(acc) {
    if (!acc.uuid) {
        acc.uuid = crypto.randomUUID
            ? crypto.randomUUID()
            : `acc-${Date.now()}-${Math.random()}`;
    }
    acc.updated_at = acc.updated_at || new Date().toISOString();
    acc.is_deleted = !!acc.is_deleted;

    const idx = state.localAccounts.findIndex((a) => a.uuid === acc.uuid);
    if (idx >= 0) {
        state.localAccounts[idx] = { ...state.localAccounts[idx], ...acc };
    } else {
        state.localAccounts.push(acc);
    }
}

export function upsertLocalCategory(cat) {
    if (!cat.uuid) {
        cat.uuid = crypto.randomUUID
            ? crypto.randomUUID()
            : `cat-${Date.now()}-${Math.random()}`;
    }
    cat.updated_at = cat.updated_at || new Date().toISOString();
    cat.is_deleted = !!cat.is_deleted;

    const idx = state.localCategories.findIndex((c) => c.uuid === cat.uuid);
    if (idx >= 0) {
        state.localCategories[idx] = { ...state.localCategories[idx], ...cat };
    } else {
        state.localCategories.push(cat);
    }
}

export function upsertLocalTrip(trip) {
    if (!trip.uuid) {
        trip.uuid = crypto.randomUUID
            ? crypto.randomUUID()
            : `trip-${Date.now()}-${Math.random()}`;
    }

    trip.updated_at = trip.updated_at || new Date().toISOString();
    trip.is_deleted = !!trip.is_deleted;
    trip.is_closed = !!trip.is_closed;

    const idx = state.localTrips.findIndex((t) => t.uuid === trip.uuid);
    if (idx >= 0) {
        state.localTrips[idx] = { ...state.localTrips[idx], ...trip };
    } else {
        state.localTrips.push(trip);
    }
}
