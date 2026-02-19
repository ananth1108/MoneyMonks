// static/js/state.js
// Central state management for transactions, accounts, categories, and trips

// In-memory caches
export let localTransactions = [];
export let localAccounts = [];
export let localCategories = [];
export let localTrips = [];

// Last sync timestamps
export let lastSyncAt = null;
export let lastSyncAccountsAt = null;
export let lastSyncCategoriesAt = null;
export let lastSyncTripsAt = null;

// Trip UI collapse state
export let tripsSectionState = {
    openCollapsed: false,
    closedCollapsed: true,
};

// Update state functions
export function setLocalTransactions(txs) {
    localTransactions = txs;
}

export function setLocalAccounts(accs) {
    localAccounts = accs;
}

export function setLocalCategories(cats) {
    localCategories = cats;
}

export function setLocalTrips(trips) {
    localTrips = trips;
}

export function setLastSyncAt(timestamp) {
    lastSyncAt = timestamp;
}

export function setLastSyncAccountsAt(timestamp) {
    lastSyncAccountsAt = timestamp;
}

export function setLastSyncCategoriesAt(timestamp) {
    lastSyncCategoriesAt = timestamp;
}

export function setLastSyncTripsAt(timestamp) {
    lastSyncTripsAt = timestamp;
}

export function setTripsSectionState(state) {
    tripsSectionState = state;
}
