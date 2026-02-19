// static/js/app.js

import {
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    formatCurrency,
    todayISO,
} from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
    // ---------------------------------------------------------------------
    // DOM ELEMENTS
    // ---------------------------------------------------------------------
    const tabs = document.querySelectorAll(".tab-btn");
    const sections = document.querySelectorAll(".tab-section");

    const prevMonthBtn = document.getElementById("prevMonthBtn");
    const nextMonthBtn = document.getElementById("nextMonthBtn");

    const timeRangeSelect = document.getElementById("timeRange");
    const customMonthInput = document.getElementById("customMonth");

    const recordsList = document.getElementById("recordsList");
    const budgetList = document.getElementById("budgetList");
    const accountsList = document.getElementById("accountsList");
    const categoriesList = document.getElementById("categoriesList");
    const categoryBreakdown = document.getElementById("categoryBreakdown");
    const accountBreakdown = document.getElementById("accountBreakdown");
    const recordsStats = document.getElementById("recordsStats");


    const sumIncomeEl = document.getElementById("sumIncome");
    const sumExpenseEl = document.getElementById("sumExpense");
    const sumNetEl = document.getElementById("sumNet");

    const modal = document.getElementById("modalContainer");
    const modalBody = document.getElementById("modalBody");
    const modalClose = document.getElementById("modalClose");

    const addExpenseBtn = document.getElementById("addExpenseBtn");
    const addBudgetBtn = document.getElementById("addBudgetBtn");
    const addAccountBtn = document.getElementById("addAccountBtn");
    const addCategoryBtn = document.getElementById("addCategoryBtn");


    const quickTemplates = document.getElementById("quickTemplates");

    const tripsList = document.getElementById("tripsList");
    const addTripBtn = document.getElementById("addTripBtn");
    const tripsListView = document.getElementById("tripsListView");
    const tripDetailsView = document.getElementById("tripDetailsView");
    const backToTripsBtn = document.getElementById("backToTripsBtn");

    const tripDetailsTitle = document.getElementById("tripDetailsTitle");
    const tripDetailsMeta = document.getElementById("tripDetailsMeta");

    const tripBalancesBox = document.getElementById("tripBalancesBox");
    const tripSettlementsBox = document.getElementById("tripSettlementsBox");
    const tripTxBox = document.getElementById("tripTxBox");



    // Click on Stats cards -> change time range
    if (recordsStats && timeRangeSelect) {
        recordsStats.addEventListener("click", (e) => {
            const card = e.target.closest(".clickable-summary");
            if (!card) return;

            const period = card.dataset.period;
            if (!period) return;

            if (period === "today") {
                timeRangeSelect.value = "day";
            } else if (period === "week") {
                timeRangeSelect.value = "week";
            } else if (period === "month") {
                timeRangeSelect.value = "month";
            } else {
                return;
            }

            // Trigger existing change logic
            timeRangeSelect.dispatchEvent(new Event("change"));
        });
    }


    // ---------------------------------------------------------------------
    // QUICK REPEAT: LAST 5 UNIQUE TRANSACTIONS
    // ---------------------------------------------------------------------
    function getRecentTransactionTemplates(limit = 5, opts = {}) {
    const { type = null } = opts || {};

    const txs = localTransactions.filter((t) => !t.is_deleted && (!type || t.type === type));
    if (!txs.length) return [];

    // Sort newest first by updated_at or date
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


    function renderQuickTemplates() {
        if (!quickTemplates) return;

        const templates = getRecentTransactionTemplates(5, { type: "expense" });
        if (!templates.length) {
            quickTemplates.innerHTML = "";
            quickTemplates.classList.add("hidden");
            return;
        }

        quickTemplates.classList.remove("hidden");
        quickTemplates.innerHTML = "";

        const row = document.createElement("div");
        row.className = "quick-templates-row";
        quickTemplates.appendChild(row);

        templates.forEach((t) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "quick-template-card";

            const desc = t.description || "(No description)";
            const shortDesc =
                desc.length > 28 ? desc.slice(0, 25).trimEnd() + "…" : desc;

            const sign = t.type === "income" ? "+" : "-";
            const typeClass =
                t.type === "income" ? "amount-income" : "amount-expense";

            btn.innerHTML = `
                <div class="qt-main">
                    <span class="qt-desc">${shortDesc}</span>
                    <span class="qt-amount ${typeClass}">
                        ${sign}${formatCurrency(t.amount)}
                    </span>
                </div>
                <div class="qt-meta text-sm text-muted">
                    ${t.category_name || "Uncategorized"}
                    ${t.account_name ? " • " + t.account_name : ""}
                </div>
            `;

            btn.addEventListener("click", () => {
                const template = {
                    type: t.type,
                    amount: t.amount,
                    description: t.description,
                    category_id: t.category_id,
                    account_id: t.account_id,
                };
                openAddTransactionModal(template);
            });

            row.appendChild(btn);
        });
    }


    // ---------------------------------------------------------------------
    // SMALL HELPERS
    // ---------------------------------------------------------------------
    const isOnline = () => navigator.onLine;
    const getActiveTabId = () =>
        document.querySelector(".tab-btn.active")?.dataset.tab || null;

    function filterByDateRange(items, { start_date, end_date }, getDate = (x) => x.date) {
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
    
    // Resolve an item from a collection by numeric id or uuid string.
    function findByIdOrUuid(collection, val) {
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

    function renderTripTransactions(txs) {
    if (!tripTxBox) return;

    if (!txs.length) {
        tripTxBox.innerHTML = `<div class="text-muted">No transactions for this trip.</div>`;
        return;
    }

    tripTxBox.innerHTML = "";
    txs.forEach((tx) => {
        // reuse your existing renderer
        tripTxBox.appendChild(renderTransactionCard(tx, { prettify: true }));
    });
    }

    function renderTripBalances(trip, txs) {
    if (!tripBalancesBox) return;

    // Placeholder: show totals only (until split details are fully stored)
    let totalExpense = 0;
    txs.forEach((t) => {
        if (t.type === "expense") totalExpense += Number(t.amount || 0);
    });

    const perPerson =
        trip.total_people && trip.total_people > 0 ? totalExpense / trip.total_people : 0;

    tripBalancesBox.innerHTML = `
        <div class="card">
        <div class="card-header-row">
            <div>
            <div class="card-title">Trip Summary</div>
            <div class="card-subtitle">Balances will appear here once splits are stored</div>
            </div>
            <div class="text-right">
            <div class="text-sm text-muted">Total expense</div>
            <div>${formatCurrency(totalExpense)}</div>
            <div class="text-sm text-muted">Avg / person</div>
            <div>${formatCurrency(perPerson)}</div>
            </div>
        </div>
        </div>
    `;
    }

    function renderTripSettlements(trip, txs) {
    if (!tripSettlementsBox) return;

    // Placeholder (until we compute who owes whom)
    tripSettlementsBox.innerHTML = `
        <div class="card">
        <div class="card-title">Settlements</div>
        <div class="text-sm text-muted mt-8">
            Once splits are tracked per participant, we’ll compute “A pays B ₹X”.
        </div>
        </div>
    `;
    }


    function deleteTrip(trip) {
        trip.is_deleted = true;
        trip.updated_at = new Date().toISOString();
        trip.needs_sync = true;

        upsertLocalTrip(trip);
        saveLocalTripsToStorage();

        loadTrips();

        // Optional: also refresh transaction lists / trip dropdowns
        // loadRecordsFromLocal();
        }

    
    function resolveSelectValueForCategory(tx) {
        if (!tx) return "";

        // 1) try by id/uuid value directly
        const byIdOrUuid = tx.category_id != null ? findByIdOrUuid(localCategories, tx.category_id) : null;
        if (byIdOrUuid) return String(byIdOrUuid.id != null ? byIdOrUuid.id : byIdOrUuid.uuid);

        // 2) fallback: match by name
        const name = (tx.category_name || "").trim();
        if (name) {
            const byName = localCategories.find((c) => !c.is_deleted && (c.name || "").trim() === name);
            if (byName) return String(byName.id != null ? byName.id : byName.uuid);
        }

        return "";
        }

    function resolveSelectValueForAccount(tx) {
        if (!tx) return "";

        const byIdOrUuid = tx.account_id != null ? findByIdOrUuid(localAccounts, tx.account_id) : null;
        if (byIdOrUuid) return String(byIdOrUuid.id != null ? byIdOrUuid.id : byIdOrUuid.uuid);

        const name = (tx.account_name || "").trim();
        if (name) {
            const byName = localAccounts.find((a) => !a.is_deleted && (a.name || "").trim() === name);
            if (byName) return String(byName.id != null ? byName.id : byName.uuid);
        }

        return "";
        }


    


    function closeTripDetails() {
    if (tripDetailsView) tripDetailsView.classList.add("hidden");
    if (tripsListView) tripsListView.classList.remove("hidden");
    }
    if (backToTripsBtn) {
    backToTripsBtn.addEventListener("click", closeTripDetails);
    }

    function openTripDetails(tripUuid) {
    const trip = localTrips.find((t) => t.uuid === tripUuid && !t.is_deleted);
    if (!trip) return;

    // toggle views
    if (tripsListView) tripsListView.classList.add("hidden");
    if (tripDetailsView) tripDetailsView.classList.remove("hidden");

    // header
    if (tripDetailsTitle) tripDetailsTitle.textContent = trip.name || "Trip";
    if (tripDetailsMeta) {
        tripDetailsMeta.textContent = `People: ${trip.total_people || 0}`;
    }

    // all tx for this trip
    const txs = localTransactions
        .filter((t) => !t.is_deleted && t.trip_uuid === trip.uuid)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    renderTripTransactions(txs);
    renderTripBalances(trip, txs);
    renderTripSettlements(trip, txs);
    }


    function renderTransactionCard(tx, opts = {}) {
    const { prettify = true } = opts;

    const card = document.createElement("div");
    card.className = "card tx-card collapsed";
    card.dataset.uuid = tx.uuid;

    const header = document.createElement("div");
    header.className = "tx-row tx-row-top";

    const left = document.createElement("div");
    left.className = "tx-left";

    const title = document.createElement("div");
    title.className = "card-title tx-desc";

    // Display-only prettify for hashtag-heavy descriptions
    const rawDesc = (tx.description || "").trim();
    const displayDesc = prettify ? prettifyDescriptionForDisplay(rawDesc) : rawDesc;
    title.textContent = displayDesc || "(No description)";

    const date = document.createElement("div");
    date.className = "tx-date";
    date.textContent = tx.date || "";

    left.appendChild(title);
    left.appendChild(date);

    const right = document.createElement("div");
    right.className = "tx-right";

    const amount = document.createElement("div");
    amount.className = "tx-amount";
    const isIncome = tx.type === "income";
    amount.classList.add(isIncome ? "amount-income" : "amount-expense");

    const sign = isIncome ? "+" : "-";
    amount.textContent = `${sign}${formatCurrency(tx.amount || 0)}`;

    const actions = document.createElement("div");
    actions.className = "tx-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-small edit-tx-btn";
    editBtn.type = "button";
    editBtn.title = "Edit";
    editBtn.dataset.uuid = tx.uuid;
    editBtn.textContent = "✏️";

    const delBtn = document.createElement("button");
    delBtn.className = "icon-small delete-tx-btn";
    delBtn.type = "button";
    delBtn.title = "Delete";
    delBtn.dataset.uuid = tx.uuid;
    delBtn.textContent = "🗑️";

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    right.appendChild(amount);
    right.appendChild(actions);

    header.appendChild(left);
    header.appendChild(right);

    // Meta row: Category • Account (compact)
    const meta = document.createElement("div");
    meta.className = "tx-meta text-sm text-muted";

    const cat = (tx.category_name || "Uncategorized").trim();
    const acc = (tx.account_name || "").trim();

    meta.textContent = acc ? `${cat} • ${acc}` : cat;

    // Optional sync status (subtle)
    if (tx.needs_sync) {
        const sync = document.createElement("span");
        sync.className = "tx-sync-badge";
        sync.textContent = " • pending sync";
        meta.appendChild(sync);
    }

    card.appendChild(header);
    card.appendChild(meta);

    // Tap card to expand/collapse description (ignore button taps)
    card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        card.classList.toggle("expanded");
        card.classList.toggle("collapsed");
    });

    return card;
    }

    function isServerNewer(localItem, serverItem) {
    const l = new Date(localItem?.updated_at || 0).getTime();
    const s = new Date(serverItem?.updated_at || 0).getTime();
    return s > l;
    }


    // Display-only prettifier (keeps storage unchanged)
    function prettifyDescriptionForDisplay(desc) {
    if (!desc) return "";
    // If it's hashtag-heavy, make it more readable
    const hashCount = (desc.match(/#/g) || []).length;
    if (hashCount >= 2) {
        const parts = desc
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p.replace(/^#/, "").trim())
        .filter(Boolean);

        // Limit to a few tokens for display
        const short = parts.slice(0, 4).join(" • ");
        return short || desc;
    }
    return desc;
    }


    

    // ---------------------------------------------------------------------
    // OFFLINE / LOCAL STATE (TRANSACTIONS + ACCOUNTS + CATEGORIES)
    // ---------------------------------------------------------------------
    const LOCAL_TX_KEY = "cfc_transactions";
    const LOCAL_ACC_KEY = "cfc_accounts";
    const LOCAL_CAT_KEY = "cfc_categories";

    const LOCAL_TX_LAST_SYNC_KEY = "cfc_last_sync_at";
    const LOCAL_ACC_LAST_SYNC_KEY = "cfc_accounts_last_sync_at";
    const LOCAL_CAT_LAST_SYNC_KEY = "cfc_categories_last_sync_at";
    const LOCAL_TRIP_KEY = "cfc_trips";
    const LOCAL_TRIP_LAST_SYNC_KEY = "cfc_trips_last_sync_at";
    const LOCAL_TRIPS_UI_STATE_KEY = "cfc_trips_ui_state";



    // In-memory caches
    let localTransactions = [];
    let localAccounts = [];
    let localCategories = [];
    let localTrips = [];

    // Last sync timestamps
    let lastSyncAt = null; // transactions
    let lastSyncAccountsAt = null; // accounts
    let lastSyncCategoriesAt = null; // categories
    let lastSyncTripsAt = null;



    function loadLocalTransactionsFromStorage() {
        // Transactions
        try {
            const raw = localStorage.getItem(LOCAL_TX_KEY);
            localTransactions = raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.warn("Failed to parse local transactions", e);
            localTransactions = [];
        }

        // Accounts
        try {
            const rawA = localStorage.getItem(LOCAL_ACC_KEY);
            localAccounts = rawA ? JSON.parse(rawA) : [];
        } catch (e) {
            console.warn("Failed to parse local accounts", e);
            localAccounts = [];
        }

        // Categories
        try {
            const rawC = localStorage.getItem(LOCAL_CAT_KEY);
            localCategories = rawC ? JSON.parse(rawC) : [];
        } catch (e) {
            console.warn("Failed to parse local categories", e);
            localCategories = [];
        }

        // Trips
        try {
        const rawT = localStorage.getItem(LOCAL_TRIP_KEY);
        localTrips = rawT ? JSON.parse(rawT) : [];
        } catch (e) {
        console.warn("Failed to parse local trips", e);
        localTrips = [];
        }


        // Sync timestamps
        lastSyncAt = localStorage.getItem(LOCAL_TX_LAST_SYNC_KEY);
        lastSyncAccountsAt = localStorage.getItem(LOCAL_ACC_LAST_SYNC_KEY);
        lastSyncCategoriesAt = localStorage.getItem(LOCAL_CAT_LAST_SYNC_KEY);
        lastSyncTripsAt = localStorage.getItem(LOCAL_TRIP_LAST_SYNC_KEY);

        
    }

    function saveLocalTransactionsToStorage() {
        // This function saves ALL local state (tx + acc + cat)
        try {
            localStorage.setItem(LOCAL_TX_KEY, JSON.stringify(localTransactions));
            localStorage.setItem(LOCAL_ACC_KEY, JSON.stringify(localAccounts));
            localStorage.setItem(LOCAL_CAT_KEY, JSON.stringify(localCategories));
            localStorage.setItem(LOCAL_TRIP_KEY, JSON.stringify(localTrips));


            if (lastSyncAt) {
                localStorage.setItem(LOCAL_TX_LAST_SYNC_KEY, lastSyncAt);
            }
            if (lastSyncAccountsAt) {
                localStorage.setItem(LOCAL_ACC_LAST_SYNC_KEY, lastSyncAccountsAt);
            }
            if (lastSyncCategoriesAt) {
                localStorage.setItem(LOCAL_CAT_LAST_SYNC_KEY, lastSyncCategoriesAt);
            }
            if (lastSyncTripsAt) localStorage.setItem(LOCAL_TRIP_LAST_SYNC_KEY, lastSyncTripsAt);

        } catch (e) {
            console.warn("Failed to save local state", e);
        }
    }

    function upsertLocalTransaction(tx) {
        if (!tx.uuid) {
            tx.uuid = crypto.randomUUID
                ? crypto.randomUUID()
                : `local-${Date.now()}-${Math.random()}`;
        }
        tx.updated_at = tx.updated_at || new Date().toISOString();
        tx.is_deleted = !!tx.is_deleted;

        const idx = localTransactions.findIndex((t) => t.uuid === tx.uuid);
        if (idx >= 0) {
            localTransactions[idx] = { ...localTransactions[idx], ...tx };
        } else {
            localTransactions.push(tx);
        }
    }

    function saveLocalTripsToStorage() {
        saveLocalTransactionsToStorage();
        }


    function upsertLocalTrip(trip) {
    if (!trip.uuid) {
        trip.uuid = crypto.randomUUID
        ? crypto.randomUUID()
        : `trip-${Date.now()}-${Math.random()}`;
    }

    trip.updated_at = trip.updated_at || new Date().toISOString();
    trip.is_deleted = !!trip.is_deleted;

    // ✅ default: open trip
    trip.is_closed = !!trip.is_closed;

    const idx = localTrips.findIndex((t) => t.uuid === trip.uuid);
    if (idx >= 0) {
        localTrips[idx] = { ...localTrips[idx], ...trip };
    } else {
        localTrips.push(trip);
    }
    }



    function upsertLocalAccount(acc) {
        if (!acc.uuid) {
            acc.uuid = crypto.randomUUID
                ? crypto.randomUUID()
                : `acc-${Date.now()}-${Math.random()}`;
        }
        acc.updated_at = acc.updated_at || new Date().toISOString();
        acc.is_deleted = !!acc.is_deleted;

        const idx = localAccounts.findIndex((a) => a.uuid === acc.uuid);
        if (idx >= 0) {
            localAccounts[idx] = { ...localAccounts[idx], ...acc };
        } else {
            localAccounts.push(acc);
        }
    }

    function upsertLocalCategory(cat) {
        if (!cat.uuid) {
            cat.uuid = crypto.randomUUID
                ? crypto.randomUUID()
                : `cat-${Date.now()}-${Math.random()}`;
        }
        cat.updated_at = cat.updated_at || new Date().toISOString();
        cat.is_deleted = !!cat.is_deleted;

        const idx = localCategories.findIndex((c) => c.uuid === cat.uuid);
        if (idx >= 0) {
            localCategories[idx] = { ...localCategories[idx], ...cat };
        } else {
            localCategories.push(cat);
        }
    }

    function getDateFilters() {
    // range: day/week/month/3months/6months/all/custom
    const range = timeRangeSelect ? (timeRangeSelect.value || "month") : "month";
    const filters = { range };

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);

    // ----- Custom month -----
    if (range === "custom" && customMonthInput && customMonthInput.value) {
        const [yearStr, monthStr] = customMonthInput.value.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr); // 1–12

        if (year && month) {
            const start = `${yearStr}-${monthStr}-01`;
            const lastDay = new Date(year, month, 0); // month is 1-based here
            const end = lastDay.toISOString().slice(0, 10);

            filters.start_date = start;
            filters.end_date = end;
        }
        return filters;
    }

    // ----- Predefined ranges (mirror backend get_time_range) -----
    if (range === "day") {
        filters.start_date = todayISO;
        filters.end_date = todayISO;
    } else if (range === "week") {
        const start = new Date(today);
        start.setDate(start.getDate() - 6); // last 7 days including today
        filters.start_date = start.toISOString().slice(0, 10);
        filters.end_date = todayISO;
    } else if (range === "month") {
        const start = new Date(today);
        start.setDate(start.getDate() - 29); // last 30 days
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
    } else if (range === "all") {
        // No filters
    }

    return filters;
    }


    function ensureCustomMonthInitialized() {
        if (!customMonthInput) return;

        if (!customMonthInput.value) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, "0");
            customMonthInput.value = `${y}-${m}`;
        }
    }

    function shiftCustomMonth(delta) {
        if (!customMonthInput) return;

        if (timeRangeSelect && timeRangeSelect.value !== "custom") {
            timeRangeSelect.value = "custom";
            customMonthInput.style.display = "inline-block";
        }

        ensureCustomMonthInitialized();

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
        if (activeTab) switchTab(activeTab);
    }

    function getVisibleTransactionsForCurrentRange() {
        const filters = getDateFilters();
        const visible = filterByDateRange(
            localTransactions.filter((t) => !t.is_deleted),
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

    // ---------------------------------------------------------------------
    // PERIOD STATS HELPERS (TODAY / WEEK / MONTH)
    // ---------------------------------------------------------------------
    function getPeriodRange(periodKey) {
        const today = new Date();
        const todayISO = today.toISOString().slice(0, 10);

        if (periodKey === "today") {
            return { start: todayISO, end: todayISO };
        }

        if (periodKey === "week") {
            const start = new Date(today);
            start.setDate(start.getDate() - 6); // last 7 days incl today
            return {
                start: start.toISOString().slice(0, 10),
                end: todayISO,
            };
        }

        if (periodKey === "month") {
            const start = new Date(today);
            start.setDate(start.getDate() - 29); // last 30 days incl today
            return {
                start: start.toISOString().slice(0, 10),
                end: todayISO,
            };
        }

        return { start: null, end: null };
    }

    function renderRecordsStats() {
        if (!recordsStats) return;

        const anyTx = localTransactions.some((t) => !t.is_deleted);
        if (!anyTx) {
            recordsStats.innerHTML = "";
            recordsStats.classList.add("hidden");
            return;
        }

        const todayRange = getPeriodRange("today");
        const weekRange = getPeriodRange("week");
        const monthRange = getPeriodRange("month");

        const todayTotal = computeExpenseTotalForRange(
            todayRange.start,
            todayRange.end
        );
        const weekTotal = computeExpenseTotalForRange(
            weekRange.start,
            weekRange.end
        );
        const monthTotal = computeExpenseTotalForRange(
            monthRange.start,
            monthRange.end
        );

        recordsStats.classList.remove("hidden");
        recordsStats.innerHTML = `
            <div class="summary-card clickable-summary" data-period="today">
                <span>Today (expense)</span>
                <h3 class="amount-expense">${formatCurrency(todayTotal)}</h3>
            </div>
            <div class="summary-card clickable-summary" data-period="week">
                <span>This week</span>
                <h3 class="amount-expense">${formatCurrency(weekTotal)}</h3>
            </div>
            <div class="summary-card clickable-summary" data-period="month">
                <span>This month</span>
                <h3 class="amount-expense">${formatCurrency(monthTotal)}</h3>
            </div>
        `;
    }



    function computeExpenseTotalForRange(startISO, endISO) {
        if (!startISO || !endISO) return 0;

        const start = new Date(startISO);
        const end = new Date(endISO);

        let total = 0;

        localTransactions.forEach((t) => {
            if (t.is_deleted) return;
            if (t.type !== "expense") return;

            const d = new Date(t.date);
            if (d >= start && d <= end) {
                total += Number(t.amount || 0);
            }
        });

        return total;
    }

    // ---------------------------------------------------------------------
    // DESCRIPTION SUGGESTIONS (RECENT / POPULAR)
    // ---------------------------------------------------------------------
    function getDescriptionSuggestions(options = {}) {
        const { mode = "recent", limit = 5 } = options;

        // Take all non-deleted tx with a non-empty description
        const txs = localTransactions.filter(
            (t) =>
                !t.is_deleted &&
                t.description &&
                String(t.description).trim().length > 0
        );

        if (!txs.length) return [];

        if (mode === "popular") {
            // Most frequently used descriptions
            const counts = new Map();
            txs.forEach((t) => {
                const key = String(t.description).trim();
                counts.set(key, (counts.get(key) || 0) + 1);
            });

            return [...counts.entries()]
                .sort((a, b) => b[1] - a[1]) // sort by frequency desc
                .slice(0, limit)
                .map(([desc]) => desc);
        }

        // Default: "recent" – last used descriptions
        const sorted = [...txs].sort((a, b) => {
            const aTs = new Date(a.updated_at || a.date);
            const bTs = new Date(b.updated_at || b.date);
            return bTs - aTs; // newest first
        });

        const seen = new Set();
        const result = [];

        for (const t of sorted) {
            const desc = String(t.description).trim();
            if (!seen.has(desc)) {
                seen.add(desc);
                result.push(desc);
                if (result.length >= limit) break;
            }
        }

        return result;
    }


    // ---------------------------------------------------------------------
    // SYNC HELPERS
    // ---------------------------------------------------------------------
    function updateLastSync(currentIso, items) {
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

    function setSelectFromCollection(selectEl, collection, storedVal) {
        if (storedVal == null || storedVal === "") {
            selectEl.value = "";
            return;
        }

        // Resolve the real object
        const obj = findByIdOrUuid(collection, storedVal);
        if (!obj) {
            selectEl.value = "";
            return;
        }

        // Try matching by id first
        if (obj.id != null) {
            const idStr = String(obj.id);
            if ([...selectEl.options].some(o => o.value === idStr)) {
            selectEl.value = idStr;
            return;
            }
        }

        // Fallback to uuid
        if (obj.uuid) {
            const uuidStr = String(obj.uuid);
            if ([...selectEl.options].some(o => o.value === uuidStr)) {
            selectEl.value = uuidStr;
            return;
            }
        }

        selectEl.value = "";
        }


    // ---------------------------------------------------------------------
    // SYNC WITH SERVER (TRANSACTIONS)
    // ---------------------------------------------------------------------
    async function syncTransactionsWithServer() {
        if (!isOnline()) {
            console.log("Offline, skipping transactions sync.");
            return;
        }

        console.log("Starting transactions sync...");

        // 1) Upload local changes
        const dirty = localTransactions.filter((t) => t.needs_sync === true);
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
                    const idx = localTransactions.findIndex((x) => x.uuid === t.uuid);
                    if (idx >= 0) {
                        localTransactions[idx].needs_sync = false;
                    }
                });
            } catch (err) {
                console.error("Failed to upload transactions to server", err);
            }
        }

        // 2) Download server changes since lastSyncAt
        try {
            const params = {};
            if (lastSyncAt) {
                params.since = lastSyncAt;
            }
            const res = await apiGet("/api/sync/transactions", params);
            const items = res.items || [];

            items.forEach((serverTx) => {
                upsertLocalTransaction({
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

            lastSyncAt = updateLastSync(lastSyncAt, items);
            saveLocalTransactionsToStorage();
            console.log("Transactions sync finished.");

            const activeTab = getActiveTabId();
            if (activeTab === "records") {
                loadRecordsFromLocal();
            }
        } catch (err) {
            console.error("Failed to download transactions from server", err);
        }
    }

    // ---------------------------------------------------------------------
    // SYNC WITH SERVER (ACCOUNTS)
    // ---------------------------------------------------------------------
    async function syncAccountsWithServer() {
        if (!isOnline()) {
            console.log("Offline, skipping accounts sync.");
            return;
        }

        console.log("Starting accounts sync...");

        const dirty = localAccounts.filter((a) => a.needs_sync === true);
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
                    const idx = localAccounts.findIndex((x) => x.uuid === a.uuid);
                    if (idx >= 0) {
                        localAccounts[idx].needs_sync = false;
                    }
                });
            } catch (err) {
                console.error("Failed to upload accounts to server", err);
            }
        }

        try {
            const params = {};
            if (lastSyncAccountsAt) {
                params.since = lastSyncAccountsAt;
            }
            const res = await apiGet("/api/sync/accounts", params);
            const items = res.items || [];

            items.forEach((serverAcc) => {
            const existing = localAccounts.find((a) => a.uuid === serverAcc.uuid);

            // If local has a pending change, keep it unless server is newer
            if (existing && existing.needs_sync && !isServerNewer(existing, serverAcc)) {
                return;
            }

            // Apply server state INCLUDING deletions
            upsertLocalAccount({
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


            lastSyncAccountsAt = updateLastSync(lastSyncAccountsAt, items);
            saveLocalTransactionsToStorage();
            console.log("Accounts sync finished.");
        } catch (err) {
            console.error("Failed to download accounts from server", err);
        }
    }

    // ---------------------------------------------------------------------
    // SYNC WITH SERVER (CATEGORIES)
    // ---------------------------------------------------------------------
    async function syncCategoriesWithServer() {
        if (!isOnline()) {
            console.log("Offline, skipping categories sync.");
            return;
        }

        console.log("Starting categories sync...");

        const dirty = localCategories.filter((c) => c.needs_sync === true);
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
                    const idx = localCategories.findIndex((x) => x.uuid === c.uuid);
                    if (idx >= 0) {
                        localCategories[idx].needs_sync = false;
                    }
                });
            } catch (err) {
                console.error("Failed to upload categories to server", err);
            }
        }

        try {
            const params = {};
            if (lastSyncCategoriesAt) {
                params.since = lastSyncCategoriesAt;
            }
            const res = await apiGet("/api/sync/categories", params);
            const items = res.items || [];

            items.forEach((serverCat) => {
            const existing = localCategories.find((c) => c.uuid === serverCat.uuid);

            if (existing && existing.needs_sync && !isServerNewer(existing, serverCat)) {
                return;
            }

            upsertLocalCategory({
                id: serverCat.id,
                uuid: serverCat.uuid,
                name: serverCat.name,
                type: serverCat.type,
                updated_at: serverCat.updated_at,
                is_deleted: !!serverCat.is_deleted,
                needs_sync: false,
            });
        });


            lastSyncCategoriesAt = updateLastSync(lastSyncCategoriesAt, items);
            saveLocalTransactionsToStorage();
            console.log("Categories sync finished.");
        } catch (err) {
            console.error("Failed to download categories from server", err);
        }
    }

    // ---------------------------------------------------------------------
    // MODAL HELPERS
    // ---------------------------------------------------------------------
    function openModal(contentNode) {
        modalBody.innerHTML = "";
        modalBody.appendChild(contentNode);
        modal.classList.remove("hidden");
    }

    function closeModal() {
        modal.classList.add("hidden");
        modalBody.innerHTML = "";
    }

    if (modalClose) {
        modalClose.addEventListener("click", closeModal);
    }

    if (modal) {
        modal.addEventListener("mousedown", (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }


    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------


    function getTripByUuid(tripUuid) {
        return localTrips.find((t) => t.uuid === tripUuid && !t.is_deleted) || null;
        }

    function computeEqualSplits(amount, participantUuids) {
        const n = participantUuids.length || 0;
        if (!n) return {};
        const per = amount / n;

        const splits = {};
        participantUuids.forEach((pu) => (splits[pu] = per));
        return splits;
        }

    function sumSplits(splitsObj) {
        return Object.values(splitsObj || {}).reduce((a, b) => a + Number(b || 0), 0);
        }


    // ---------------------------------------------------------------------
    // TABS
    // ---------------------------------------------------------------------
    function switchTab(tabId) {
        tabs.forEach((btn) => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-selected", String(isActive));
        });

        sections.forEach((sec) => {
            const isActive = sec.id === tabId;
            sec.classList.toggle("active", isActive);
            sec.hidden = !isActive;
        });

        if (tabId === "records") {
            loadRecords();
        } else if (tabId === "analysis") {
            loadAnalysis();
        } else if (tabId === "budget") {
            loadBudgets();
        } else if (tabId === "accounts") {
            loadAccounts();
        } else if (tabId === "categories") {
            loadCategories();
        } else if (tabId === "trips") {
            loadTrips();
        }
    }

    tabs.forEach((btn) => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // ---------------------------------------------------------------------
    // TIME RANGE CHANGE + CUSTOM MONTH
    // ---------------------------------------------------------------------
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener("change", () => {
            const activeTab = getActiveTabId();

            if (timeRangeSelect.value === "custom") {
                if (customMonthInput) {
                    customMonthInput.style.display = "inline-block";
                    ensureCustomMonthInitialized();
                }
            } else if (customMonthInput) {
                customMonthInput.style.display = "none";
            }

            if (activeTab) switchTab(activeTab);
        });
    }

    if (customMonthInput) {
        customMonthInput.addEventListener("change", () => {
            const activeTab = getActiveTabId();
            if (activeTab) switchTab(activeTab);
        });
    }

    // ---------------------------------------------------------------------
    // LOAD & RENDER RECORDS (TRANSACTIONS)
    // ---------------------------------------------------------------------
    async function loadRecords() {
        try {
            recordsList.innerHTML = `<div class="text-muted">Loading...</div>`;

            // 🔹 NEW: update badges from all local transactions
            renderRecordsStats();

            // 🔹 Always re-render quick templates from full history
            renderQuickTemplates();
            
            const visible = getVisibleTransactionsForCurrentRange();
            if (!visible.length) {
                recordsList.innerHTML = `<div class="text-muted">No transactions yet for this period.</div>`;
                return;
            }

            recordsList.innerHTML = "";
            visible.forEach((tx) => {
            recordsList.appendChild(renderTransactionCard(tx, { prettify: true }));
            });
        } catch (err) {
            console.error(err);
            recordsList.innerHTML = `<div class="text-muted">Failed to render records.</div>`;
        }
    }

    function loadRecordsFromLocal() {
        loadRecords();
    }

    // ---------------------------------------------------------------------
    // LOAD & RENDER ANALYSIS (OFFLINE FROM localTransactions)
    // ---------------------------------------------------------------------
    function loadAnalysis() {
        try {
            const filters = getDateFilters();
            let txs = localTransactions.filter((t) => !t.is_deleted);

            txs = filterByDateRange(txs, filters, (t) => t.date);

            let totalIncome = 0;
            let totalExpense = 0;

            txs.forEach((t) => {
                const amt = Number(t.amount || 0);
                if (t.type === "income") totalIncome += amt;
                else if (t.type === "expense") totalExpense += amt;
            });

            const net = totalIncome - totalExpense;

            sumIncomeEl.textContent = formatCurrency(totalIncome);
            sumExpenseEl.textContent = formatCurrency(totalExpense);
            sumNetEl.textContent = formatCurrency(net);

            sumNetEl.classList.remove("text-positive", "text-negative");
            if (net > 0) sumNetEl.classList.add("text-positive");
            else if (net < 0) sumNetEl.classList.add("text-negative");

            // ----- Spend by Category -----
            const categoryMap = new Map();
            txs.forEach((t) => {
                const key = t.category_name || "Uncategorized";
                if (!categoryMap.has(key)) {
                    categoryMap.set(key, {
                        category_name: key,
                        income: 0,
                        expense: 0,
                    });
                }
                const bucket = categoryMap.get(key);
                const amt = Number(t.amount || 0);
                if (t.type === "income") bucket.income += amt;
                else if (t.type === "expense") bucket.expense += amt;
            });

            const categoriesArr = Array.from(categoryMap.values());

            if (!categoriesArr.length) {
                categoryBreakdown.innerHTML = `<div class="text-muted">No data for this period.</div>`;
            } else {
                categoryBreakdown.innerHTML = "";
                const maxExpense = Math.max(1, ...categoriesArr.map((c) => c.expense));

                categoriesArr.forEach((c) => {
                    const exp = c.expense;
                    const inc = c.income;
                    const pct = Math.round((exp / maxExpense) * 100);

                    const card = document.createElement("div");
                    card.className = "card";

                    card.innerHTML = `
                        <div class="card-header-row">
                            <div class="card-title">${c.category_name}</div>
                            <div class="text-sm text-muted">Category</div>
                        </div>
                        <div class="card-meta-row">
                            <div class="text-sm">
                                <span class="amount-expense">${formatCurrency(exp)}</span> spent
                            </div>
                            <div class="text-sm">
                                <span class="amount-income">${formatCurrency(inc)}</span> income
                            </div>
                        </div>
                        <div class="progress-container mt-8">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width:${pct}%;"></div>
                            </div>
                        </div>
                    `;
                    categoryBreakdown.appendChild(card);
                });
            }

            // ----- Spend by Account -----
            const accountMap = new Map();
            txs.forEach((t) => {
                const key = t.account_name || "Unassigned";
                if (!accountMap.has(key)) {
                    accountMap.set(key, {
                        account_name: key,
                        income: 0,
                        expense: 0,
                    });
                }
                const bucket = accountMap.get(key);
                const amt = Number(t.amount || 0);
                if (t.type === "income") bucket.income += amt;
                else if (t.type === "expense") bucket.expense += amt;
            });

            const accountsArr = Array.from(accountMap.values());

            if (!accountsArr.length) {
                accountBreakdown.innerHTML = `<div class="text-muted">No data for this period.</div>`;
            } else {
                accountBreakdown.innerHTML = "";
                const maxExpenseAcc = Math.max(1, ...accountsArr.map((a) => a.expense));

                accountsArr.forEach((a) => {
                    const exp = a.expense;
                    const inc = a.income;
                    const pct = Math.round((exp / maxExpenseAcc) * 100);

                    const card = document.createElement("div");
                    card.className = "card";

                    card.innerHTML = `
                        <div class="card-header-row">
                            <div class="card-title">${a.account_name}</div>
                            <div class="text-sm text-muted">Account</div>
                        </div>
                        <div class="card-meta-row">
                            <div class="text-sm">
                                <span class="amount-expense">${formatCurrency(exp)}</span> spent
                            </div>
                            <div class="text-sm">
                                <span class="amount-income">${formatCurrency(inc)}</span> income
                            </div>
                        </div>
                        <div class="progress-container mt-8">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width:${pct}%;"></div>
                            </div>
                        </div>
                    `;
                    accountBreakdown.appendChild(card);
                });
            }
        } catch (err) {
            console.error(err);
            categoryBreakdown.innerHTML = `<div class="text-muted">Failed to compute analysis.</div>`;
            accountBreakdown.innerHTML = `<div class="text-muted">Failed to compute analysis.</div>`;
        }
    }

    // ---------------------------------------------------------------------
    // LOAD & RENDER BUDGETS
    // ---------------------------------------------------------------------
    async function loadBudgets() {
        try {
            budgetList.innerHTML = `<div class="text-muted">Loading...</div>`;
            const data = await apiGet("/api/budgets");
            const items = data.items || [];
            if (!items.length) {
                budgetList.innerHTML = `<div class="text-muted">No budgets defined yet.</div>`;
                return;
            }
            budgetList.innerHTML = "";
            items.forEach((b) => {
                const card = document.createElement("div");
                card.className = "card";

                const progressPct = Math.round((b.progress || 0) * 100);
                const over = b.spent > b.amount;

                card.innerHTML = `
                    <div class="card-header-row">
                        <div>
                            <div class="card-title">${b.name}</div>
                            <div class="card-subtitle">
                                ${b.period || ""}${
                                    b.category_name ? " • " + b.category_name : ""
                                }
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-sm text-muted">Budget</div>
                            <div>${formatCurrency(b.amount)}</div>
                        </div>
                    </div>
                    <div class="progress-container mt-8">
                        <div class="progress-bar">
                            <div class="progress-fill ${
                                over ? "over-budget" : ""
                            }" style="width:${Math.min(progressPct, 100)}%;"></div>
                        </div>
                        <div class="budget-meta">
                            <span>Spent: ${formatCurrency(b.spent)}</span>
                            <span>Remaining: ${formatCurrency(b.remaining)}</span>
                        </div>
                    </div>
                `;
                budgetList.appendChild(card);
            });
        } catch (err) {
            console.error(err);
            budgetList.innerHTML = `<div class="text-muted">Failed to load budgets.</div>`;
        }
    }

    // ---------------------------------------------------------------------
    // LOAD & RENDER ACCOUNTS
    // ---------------------------------------------------------------------
    async function loadAccounts() {
        try {
            accountsList.innerHTML = `<div class="text-muted">Loading...</div>`;

            if (!localAccounts.length && isOnline()) {
                await syncAccountsWithServer();
            }

            const accounts = localAccounts.filter((a) => !a.is_deleted).sort((a, b) => a.name.localeCompare(b.name));
            if (!accounts.length) {
                accountsList.innerHTML = `<div class="text-muted">No accounts yet.</div>`;
                return;
            }

            const filters = getDateFilters();
            let txs = localTransactions.filter((t) => !t.is_deleted);
            txs = filterByDateRange(txs, filters, (t) => t.date);

            // Build totals keyed by stable string key: id (if present) or uuid
            const totals = new Map();
            accounts.forEach((a) => {
                const key = String(a.uuid);
                totals.set(key, { expense: 0, income: 0 });
            });

            txs.forEach((t) => {
                if (!t.account_id) return;
                const tKey = String(t.account_id);
                if (!totals.has(tKey)) return;
                const bucket = totals.get(tKey);
                const amt = Number(t.amount || 0);
                if (t.type === "expense") bucket.expense += amt;
                else if (t.type === "income") bucket.income += amt;
            });

            accountsList.innerHTML = "";
            accounts.forEach((a) => {
                const key = String(a.id != null ? a.id : a.uuid);
                const bucket = totals.get(key) || { expense: 0, income: 0 };
                const card = document.createElement("div");
                card.className = "card";

                card.innerHTML = `
                    <div class="card-header-row">
                        <div>
                            <div class="card-title">${a.name}</div>
                            <div class="card-subtitle">${a.type}</div>
                        </div>
                        <div class="card-actions">
                            <button class="icon-small edit-account-btn" data-uuid="${a.uuid}" title="Edit">✏️</button>
                            <button class="icon-small delete-account-btn" data-uuid="${a.uuid}" title="Delete">🗑️</button>
                        </div>
                    </div>

                    <div class="card-meta-row">
                        <div class="text-sm">
                            Initial: <strong>${formatCurrency(a.initial_balance)}</strong>
                        </div>
                        <div class="text-sm">
                            Expense: <span class="amount-expense">${formatCurrency(bucket.expense)}</span>
                            • Income: <span class="amount-income">${formatCurrency(bucket.income)}</span>
                        </div>
                    </div>
                `;

                accountsList.appendChild(card);
            });

        } catch (err) {
            console.error(err);
            accountsList.innerHTML = `<div class="text-muted">Failed to load accounts.</div>`;
        }
    }

    // ---------------------------------------------------------------------
    // LOAD & RENDER CATEGORIES
    // ---------------------------------------------------------------------
    async function loadCategories() {
        try {
            categoriesList.innerHTML = `<div class="text-muted">Loading...</div>`;

            if (!localCategories.length && isOnline()) {
                await syncCategoriesWithServer();
            }

            const categories = localCategories.filter((c) => !c.is_deleted).sort((a, b) => a.name.localeCompare(b.name));
            if (!categories.length) {
                categoriesList.innerHTML = `<div class="text-muted">No categories yet.</div>`;
                return;
            }

            const filters = getDateFilters();
            let txs = localTransactions.filter((t) => !t.is_deleted);
            txs = filterByDateRange(txs, filters, (t) => t.date);

            // Build totals keyed by stable string key: id (if present) or uuid
            const totals = new Map();
            categories.forEach((c) => {
                const key = String(c.uuid);
                totals.set(key, { expense: 0, income: 0 });
            });

            txs.forEach((t) => {
                if (t.category_id == null) return;
                const tKey = String(t.category_id);
                if (!totals.has(tKey)) return;
                const bucket = totals.get(tKey);
                const amt = Number(t.amount || 0);
                if (t.type === "expense") bucket.expense += amt;
                else if (t.type === "income") bucket.income += amt;
            });

            categoriesList.innerHTML = "";
            categories.forEach((c) => {
                const key = String(c.id != null ? c.id : c.uuid);
                const bucket = totals.get(key) || { expense: 0, income: 0 };
                const card = document.createElement("div");
                card.className = "card";

                card.innerHTML = `
                    <div class="card-header-row">
                        <div>
                            <div class="card-title">${c.name}</div>
                            <div class="card-subtitle">${c.type}</div>
                        </div>
                        <div class="card-actions">
                            <button class="icon-small edit-category-btn" data-uuid="${c.uuid}" title="Edit">✏️</button>
                            <button class="icon-small delete-category-btn" data-uuid="${c.uuid}" title="Delete">🗑️</button>
                        </div>
                    </div>

                    <div class="card-meta-row">
                        <div class="text-sm">
                            Expense: <span class="amount-expense">${formatCurrency(bucket.expense)}</span>
                        </div>
                        <div class="text-sm">
                            Income: <span class="amount-income">${formatCurrency(bucket.income)}</span>
                        </div>
                    </div>
                `;

                categoriesList.appendChild(card);
            });

        } catch (err) {
            console.error(err);
            categoriesList.innerHTML = `<div class="text-muted">Failed to load categories.</div>`;
        }
    }


    // ---------------------------------------------------------------------
    // LOAD & RENDER Trips
    // ---------------------------------------------------------------------
    // Keep collapse state in-memory 
    let tripsSectionState = (() => {
    try {
        const raw = localStorage.getItem(LOCAL_TRIPS_UI_STATE_KEY);
        if (!raw) {
        return {
            openCollapsed: false,   // default
            closedCollapsed: true,  // default
        };
        }
        const parsed = JSON.parse(raw);
        return {
        openCollapsed: !!parsed.openCollapsed,
        closedCollapsed: !!parsed.closedCollapsed,
        };
    } catch (e) {
        console.warn("Failed to load trips UI state", e);
        return {
        openCollapsed: false,
        closedCollapsed: true,
        };
    }
    })();


    async function loadTrips() {
    if (!tripsList) return;

    const allTrips = localTrips.filter((t) => !t.is_deleted);

    if (!allTrips.length) {
        tripsList.innerHTML = `<div class="text-muted">No trips yet.</div>`;
        return;
    }

    const openTrips = allTrips
        .filter((t) => !t.is_closed)
        .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
        );

    const closedTrips = allTrips
        .filter((t) => t.is_closed)
        .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
        );

    const txs = localTransactions.filter((t) => !t.is_deleted);

    tripsList.innerHTML = "";

    // ---- Open section (expanded by default) ----
    if (openTrips.length) {
        const { sectionEl, bodyEl } = buildTripsSection({
        title: "Open Trips",
        count: openTrips.length,
        collapsed: tripsSectionState.openCollapsed,
        sectionKey: "open",
        });

        if (!tripsSectionState.openCollapsed) {
        openTrips.forEach((trip) => renderTripCard(trip, txs, bodyEl));
        }

        tripsList.appendChild(sectionEl);
    }

    // ---- Closed section (collapsed by default) ----
    if (closedTrips.length) {
        const { sectionEl, bodyEl } = buildTripsSection({
        title: "Closed Trips",
        count: closedTrips.length,
        collapsed: tripsSectionState.closedCollapsed,
        sectionKey: "closed",
        });

        // Initially collapsed => do not render cards until expanded
        if (!tripsSectionState.closedCollapsed) {
        closedTrips.forEach((trip) => renderTripCard(trip, txs, bodyEl));
        }

        tripsList.appendChild(sectionEl);
    }
    }


    
    function renderTripCard(trip, txs, containerEl) {
    const tripTx = txs.filter((t) => t.trip_uuid === trip.uuid);

    let total = 0;
    tripTx.forEach((t) => {
        if (t.type === "expense") total += Number(t.amount || 0);
        if (t.type === "income") total -= Number(t.amount || 0);
    });

    const perPerson =
        trip.total_people && trip.total_people > 0 ? total / trip.total_people : 0;

    const card = document.createElement("div");
    card.className = "card";
    if (trip.is_closed) card.classList.add("trip-closed");

    card.innerHTML = `
        <div class="card-header-row">
        <div>
            <div class="card-title">${trip.name}</div>
            <div class="card-subtitle">
            People: ${trip.total_people} • ${trip.is_closed ? "Closed" : "Open"}
            </div>
            <div class="text-sm text-muted">
            Total: ${formatCurrency(total)} • Per person: ${formatCurrency(perPerson)}
            </div>
        </div>

        <div class="card-actions">
            <button
            class="btn-outline toggle-trip-btn"
            type="button"
            data-uuid="${trip.uuid}"
            title="${trip.is_closed ? "Reopen trip" : "Close trip"}"
            >
            ${trip.is_closed ? "Reopen" : "Close"}
            </button>

            <button
            class="icon-small edit-trip-btn"
            type="button"
            data-uuid="${trip.uuid}"
            title="Edit"
            >✏️</button>

            <button
            class="icon-small delete-trip-btn"
            type="button"
            data-uuid="${trip.uuid}"
            title="Delete"
            >🗑️</button>
        </div>
        </div>
    `;

    // Only open details when clicking card body (not buttons)
    card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        openTripDetails(trip.uuid);
    });

    containerEl.appendChild(card);
    }


    function buildTripsSection({ title, count, collapsed, sectionKey }) {
    const sectionEl = document.createElement("div");
    sectionEl.className = "trips-section";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "trips-section-header";
    header.setAttribute("aria-expanded", String(!collapsed));

    const caret = collapsed ? "▶" : "▼";

    header.innerHTML = `
        <div class="tsh-left">
        <span class="tsh-caret">${caret}</span>
        <span class="tsh-title">${title}</span>
        <span class="tsh-count">(${count})</span>
        </div>
    `;

    const bodyEl = document.createElement("div");
    bodyEl.className = "trips-section-body";
    bodyEl.style.display = collapsed ? "none" : "block";

    header.addEventListener("click", () => {
        const isCollapsed = bodyEl.style.display === "none";
        const newCollapsed = !isCollapsed;

        bodyEl.style.display = newCollapsed ? "none" : "block";
        header.setAttribute("aria-expanded", String(!newCollapsed));
        header.querySelector(".tsh-caret").textContent = newCollapsed ? "▶" : "▼";

        // Save state
        if (sectionKey === "open") tripsSectionState.openCollapsed = newCollapsed;
        if (sectionKey === "closed") tripsSectionState.closedCollapsed = newCollapsed;

        try {
        localStorage.setItem(
            LOCAL_TRIPS_UI_STATE_KEY,
            JSON.stringify(tripsSectionState)
        );
        } catch (e) {
        console.warn("Failed to persist trips UI state", e);
        }


        // Lazy render cards only when expanding (fast UI)
        if (!newCollapsed && bodyEl.childElementCount === 0) {
        const txs = localTransactions.filter((t) => !t.is_deleted);
        const allTrips = localTrips.filter((t) => !t.is_deleted);

        const list =
            sectionKey === "open"
            ? allTrips.filter((t) => !t.is_closed)
            : allTrips.filter((t) => t.is_closed);

        list
            .sort((a, b) =>
            (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
            )
            .forEach((trip) => renderTripCard(trip, txs, bodyEl));
        }
    });

    sectionEl.appendChild(header);
    sectionEl.appendChild(bodyEl);

    return { sectionEl, bodyEl };
    }



    // ---------------------------------------------------------------------
    // DELETE Trips
    // ---------------------------------------------------------------------

    function deleteTrip(trip) {
        trip.is_deleted = true;
        trip.updated_at = new Date().toISOString();
        trip.needs_sync = true;

        upsertLocalTrip(trip);
        saveLocalTransactionsToStorage(); // ✅ saves trips too

        loadTrips();

        // Optional: if you show trips in transaction dropdown, refresh it too
        // loadRecordsFromLocal();
        }



    // ---------------------------------------------------------------------
    // OPTIONS HELPERS FOR FORMS
    // ---------------------------------------------------------------------
    async function fetchAccountsOptions() {
        if (isOnline() && (!localAccounts.length || localAccounts.some(a => a.id == null))) {
            await syncAccountsWithServer().catch((err) =>
            console.error("Accounts sync for options failed", err)
            );
        }
        return localAccounts.filter((a) => !a.is_deleted).sort((a, b) => a.name.localeCompare(b.name));
        }


    async function fetchTripsOptions({ includeClosed = false } = {}) {
        return localTrips
            .filter((t) => !t.is_deleted)
            .filter((t) => includeClosed || !t.is_closed) // 👈 KEY LINE
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        }



    async function fetchCategoriesOptions() {
        if (isOnline() && (!localCategories.length || localCategories.some(c => c.id == null))) {
            await syncCategoriesWithServer().catch((err) =>
            console.error("Categories sync for options failed", err)
            );
        }
        return localCategories.filter((c) => !c.is_deleted).sort((a, b) => a.name.localeCompare(b.name));
        }


    function createSelectOptions(selectEl, items, includeEmpty, emptyLabel) {
        selectEl.innerHTML = "";

        if (includeEmpty) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = emptyLabel || "None";
            selectEl.appendChild(opt);
        }

        items.forEach((item) => {
            const opt = document.createElement("option");

            // ✅ Always use uuid for UI value
            opt.value = item.uuid ? String(item.uuid) : "";

            opt.textContent = item.name;
            selectEl.appendChild(opt);
        });
    }



    // ---------------------------------------------------------------------
    // MODAL: ADD EXPENSE / INCOME
    // ---------------------------------------------------------------------
    // ---------------------------------------------------------------------
    // MODAL: ADD EXPENSE / INCOME  (UPDATED FOR TRIPS + PARTICIPANTS + CUSTOM SPLITS)
    // ---------------------------------------------------------------------
    async function openAddTransactionModal(templateTx = null) {
    const wrapper = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = "Add Transaction";
    wrapper.appendChild(title);

    const form = document.createElement("form");
    form.className = "modal-form";

    form.innerHTML = `
        <div>
        <label>Type</label>
        <select name="type" required>
            <option value="expense" selected>Expense</option>
            <option value="income">Income</option>
        </select>
        </div>

        <div>
        <label>Amount</label>
        <input type="number" name="amount" step="0.01" min="0" required />
        </div>

        <div>
        <label>Date</label>
        <input type="date" name="date" required />
        </div>

        <div>
        <label>Category</label>
        <select name="category_id" size="1"></select>
        </div>

        <div>
        <label>Account</label>
        <select name="account_id" size="1"></select>
        </div>

        <div>
        <label>Trip (optional)</label>
        <select name="trip_uuid" size="1"></select>
        </div>

        <div id="tripSplitWrap" style="display:none;">
        <div class="mt-8">
            <label>Participants for this expense</label>
            <div id="tripParticipantsBox" class="mt-4"></div>
        </div>

        <div class="mt-8">
            <label>Split type</label>
            <select name="split_type">
            <option value="equal" selected>Equal</option>
            <option value="custom">Custom amounts</option>
            </select>
        </div>

        <div id="customSplitBox" class="mt-8" style="display:none;"></div>
        <div class="text-sm text-muted mt-8" id="splitSummary"></div>
        </div>

        <div>
        <label>Description</label>
        <textarea name="description" rows="2" placeholder="Optional"></textarea>
        </div>

        <div class="modal-actions">
        <button type="button" class="btn-outline" id="cancelTx">Cancel</button>
        <button type="submit" class="primary-btn">Save</button>
        </div>
    `;

    wrapper.appendChild(form);

    const dateInput = form.querySelector('input[name="date"]');
    const typeSelect = form.querySelector('select[name="type"]');
    const amountInput = form.querySelector('input[name="amount"]');
    const descField = form.querySelector('textarea[name="description"]');

    const categorySelect = form.querySelector('select[name="category_id"]');
    const accountSelect = form.querySelector('select[name="account_id"]');

    const tripSelect = form.querySelector('select[name="trip_uuid"]');
    const splitWrap = form.querySelector("#tripSplitWrap");
    const participantsBox = form.querySelector("#tripParticipantsBox");
    const splitTypeSelect = form.querySelector('select[name="split_type"]');
    const customSplitBox = form.querySelector("#customSplitBox");
    const splitSummary = form.querySelector("#splitSummary");

    // ----------------------------
    // Description suggestions
    // ----------------------------
    if (descField) {
        const suggestions = getDescriptionSuggestions({ mode: "recent", limit: 5 });

        if (suggestions.length) {
        const container = document.createElement("div");
        container.className = "description-suggestions mt-8";

        const label = document.createElement("div");
        label.className = "text-sm text-muted";
        label.textContent = "Suggestions:";
        container.appendChild(label);

        const chipsRow = document.createElement("div");
        chipsRow.className = "description-suggestions-row";
        container.appendChild(chipsRow);

        suggestions.forEach((desc) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "suggestion-pill";
            btn.textContent = desc.length > 30 ? desc.slice(0, 27) + "..." : desc;

            btn.addEventListener("click", () => {
            descField.value = desc;
            descField.focus();
            });

            chipsRow.appendChild(btn);
        });

        const descWrapper = descField.closest("div") || descField;
        descWrapper.insertAdjacentElement("afterend", container);
        }
    }

    // Default date to today
    dateInput.value = todayISO();

    // Prefill from template (basic fields)
    if (templateTx) {
        typeSelect.value = templateTx.type || "expense";
        amountInput.value =
        templateTx.amount !== undefined && templateTx.amount !== null
            ? templateTx.amount
            : "";
        descField.value = templateTx.description || "";
    }

    // ----------------------------
    // Trip Split: local state
    // ----------------------------
    let selectedParticipantUuids = [];
    let customSplits = {}; // participantUuid -> amount

    function getTripByUuid(tripUuid) {
        if (!tripUuid) return null;
        return (localTrips || []).find((t) => t.uuid === tripUuid && !t.is_deleted) || null;
    }

    function computeEqualSplits(amount, participantUuids) {
        const n = participantUuids.length || 0;
        if (!n) return {};
        const per = amount / n;
        const splits = {};
        participantUuids.forEach((pu) => (splits[pu] = per));
        return splits;
    }

    function sumSplits(splitsObj) {
        return Object.values(splitsObj || {}).reduce((a, b) => a + Number(b || 0), 0);
    }

    function renderParticipantsForTrip(trip) {
        participantsBox.innerHTML = "";
        customSplits = {};

        if (!trip?.participants?.length) {
        participantsBox.innerHTML = `<div class="text-muted">No participants in this trip.</div>`;
        selectedParticipantUuids = [];
        return;
        }

        // default: all selected OR use template selection (if template has participants)
        if (templateTx?.participants?.length) {
        const set = new Set(templateTx.participants);
        selectedParticipantUuids = trip.participants
            .map((p) => p.uuid)
            .filter((u) => set.has(u));
        // if template list doesn’t match current trip participants, fallback to all
        if (!selectedParticipantUuids.length) selectedParticipantUuids = trip.participants.map((p) => p.uuid);
        } else {
        selectedParticipantUuids = trip.participants.map((p) => p.uuid);
        }

        trip.participants.forEach((p) => {
        const row = document.createElement("label");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "8px";
        row.style.marginBottom = "6px";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = p.uuid;
        cb.checked = selectedParticipantUuids.includes(p.uuid);

        cb.addEventListener("change", () => {
            const checked = [...participantsBox.querySelectorAll('input[type="checkbox"]:checked')].map(
            (x) => x.value
            );

            selectedParticipantUuids = checked;

            // remove removed participants from custom splits
            Object.keys(customSplits).forEach((k) => {
            if (!selectedParticipantUuids.includes(k)) delete customSplits[k];
            });

            renderSplitEditor(trip);
            updateSplitSummary(trip);
        });

        const span = document.createElement("span");
        span.textContent = p.name;

        row.appendChild(cb);
        row.appendChild(span);
        participantsBox.appendChild(row);
        });
    }

    function renderSplitEditor(trip) {
        if (!trip?.uuid) return;

        const splitType = splitTypeSelect.value;

        if (splitType === "custom") {
        customSplitBox.style.display = "block";
        customSplitBox.innerHTML = "";

        const participants = trip.participants.filter((p) =>
            selectedParticipantUuids.includes(p.uuid)
        );

        participants.forEach((p) => {
            const wrap = document.createElement("div");
            wrap.style.display = "flex";
            wrap.style.justifyContent = "space-between";
            wrap.style.alignItems = "center";
            wrap.style.gap = "10px";
            wrap.style.marginBottom = "8px";

            const name = document.createElement("div");
            name.textContent = p.name;

            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.step = "0.01";
            input.placeholder = "0";

            // prefill from template splits if available
            const templateVal =
            templateTx?.splits && templateTx.splits[p.uuid] != null
                ? Number(templateTx.splits[p.uuid] || 0)
                : null;

            if (customSplits[p.uuid] == null && templateVal != null) {
            customSplits[p.uuid] = templateVal;
            }

            input.value = customSplits[p.uuid] != null ? customSplits[p.uuid] : "";

            input.addEventListener("input", () => {
            customSplits[p.uuid] = Number(input.value || 0);
            updateSplitSummary(trip);
            });

            wrap.appendChild(name);
            wrap.appendChild(input);
            customSplitBox.appendChild(wrap);
        });
        } else {
        customSplitBox.style.display = "none";
        customSplitBox.innerHTML = "";
        }
    }

    function updateSplitSummary(trip) {
        const amount = Number(amountInput.value || 0);

        if (!trip?.uuid) {
        splitSummary.textContent = "";
        return;
        }

        if (!selectedParticipantUuids.length) {
        splitSummary.textContent = "Select at least 1 participant.";
        return;
        }

        if (splitTypeSelect.value === "equal") {
        const per = amount / selectedParticipantUuids.length;
        splitSummary.textContent = `Equal split: ${formatCurrency(per)} × ${selectedParticipantUuids.length} people`;
        } else {
        const total = sumSplits(customSplits);
        const diff = amount - total;

        const ok = Math.abs(diff) < 0.01;
        const diffText = ok ? "✅ Splits match amount" : `⚠️ Splits differ by ${formatCurrency(diff)}`;

        splitSummary.textContent = `Custom split total: ${formatCurrency(total)}. ${diffText}`;
        }
    }

    function updateTripUI() {
        const tripUuid = tripSelect.value || "";
        if (!tripUuid) {
        splitWrap.style.display = "none";
        selectedParticipantUuids = [];
        customSplits = {};
        customSplitBox.innerHTML = "";
        splitSummary.textContent = "";
        return;
        }

        const trip = getTripByUuid(tripUuid);
        splitWrap.style.display = "block";

        // prefill split type from template if matches trip
        if (templateTx?.trip_uuid && templateTx.trip_uuid === tripUuid && templateTx?.split_type) {
        splitTypeSelect.value = templateTx.split_type;
        } else {
        splitTypeSelect.value = "equal";
        }

        renderParticipantsForTrip(trip);
        renderSplitEditor(trip);
        updateSplitSummary(trip);
    }

    // Listeners
    splitTypeSelect.addEventListener("change", () => {
        const trip = getTripByUuid(tripSelect.value);
        renderSplitEditor(trip);
        updateSplitSummary(trip);
    });

    amountInput.addEventListener("input", () => {
        const trip = getTripByUuid(tripSelect.value);
        updateSplitSummary(trip);
    });

    tripSelect.addEventListener("change", () => {
        // once user manually changes trip, don’t keep using template defaults
        templateTx = null;
        updateTripUI();
    });

    // ----------------------------
    // Load dropdown options
    // ----------------------------
    try {
        // IMPORTANT: make sure your fetch*Options sync when online (recommended)
        const [cats, accs] = await Promise.all([fetchCategoriesOptions(), fetchAccountsOptions()]);

        createSelectOptions(categorySelect, cats, true, "Uncategorized");
        createSelectOptions(accountSelect, accs, true, "Unassigned");

        // preselect category/account ONCE (stable)
        if (templateTx) {
        categorySelect.value = resolveSelectValueForCategory(templateTx);
        accountSelect.value = resolveSelectValueForAccount(templateTx);
        }

        // Trips dropdown (ONLY OPEN trips)
        const trips = (localTrips || [])
        .filter((t) => !t.is_deleted && !t.is_closed)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        tripSelect.innerHTML = "";
        const optNone = document.createElement("option");
        optNone.value = "";
        optNone.textContent = "No trip";
        tripSelect.appendChild(optNone);

        trips.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.uuid; // trips are always uuid-based
        opt.textContent = t.name;
        tripSelect.appendChild(opt);
        });

        // preselect trip if template has it (only if it's open; otherwise it will stay "No trip")
        if (templateTx?.trip_uuid) {
        tripSelect.value = String(templateTx.trip_uuid);
        }

        updateTripUI();
    } catch (err) {
        console.error("Failed to load options", err);
    }

    // Cancel
    form.querySelector("#cancelTx").addEventListener("click", closeModal);

    // ----------------------------
    // Submit
    // ----------------------------
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = new FormData(form);

        const type = formData.get("type") || "expense";
        const amount = parseFloat(formData.get("amount") || "0");
        const date = formData.get("date") || todayISO();
        const description = formData.get("description") || "";

        const rawCategoryId = formData.get("category_id") || null;
        const rawAccountId = formData.get("account_id") || null;

        const categoryId =
        rawCategoryId && /^-?\d+$/.test(String(rawCategoryId)) ? Number(rawCategoryId) : (rawCategoryId || null);

        const accountId =
        rawAccountId && /^-?\d+$/.test(String(rawAccountId)) ? Number(rawAccountId) : (rawAccountId || null);

        const categoryObj = categoryId != null ? findByIdOrUuid(localCategories, categoryId) : null;
        const accountObj = accountId != null ? findByIdOrUuid(localAccounts, accountId) : null;

        // Trip + splits
        const tripUuid = (formData.get("trip_uuid") || "").toString() || null;
        let splitTypeValue = (formData.get("split_type") || "equal").toString();

        let txParticipants = null;
        let txSplits = null;

        if (tripUuid) {
        const trip = getTripByUuid(tripUuid);
        txParticipants = [...selectedParticipantUuids];

        if (!txParticipants.length) {
            alert("Please select at least 1 participant for this trip expense.");
            return;
        }

        if (splitTypeValue === "equal") {
            txSplits = computeEqualSplits(amount, txParticipants);
        } else {
            txSplits = {};
            txParticipants.forEach((pu) => {
            txSplits[pu] = Number(customSplits[pu] || 0);
            });

            const total = sumSplits(txSplits);
            if (Math.abs(total - amount) > 0.01) {
            alert(
                `Custom split must match amount.\nSplit total = ${formatCurrency(total)}\nAmount = ${formatCurrency(amount)}`
            );
            return;
            }
        }
        } else {
        splitTypeValue = null;
        }

        try {
        const nowIso = new Date().toISOString();

        const localTx = {
            uuid: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `local-${Date.now()}-${Math.random()}`,
            type,
            amount,
            date,
            description,

            category_id: categoryId,
            account_id: accountId,
            category_name: categoryObj ? categoryObj.name : null,
            account_name: accountObj ? accountObj.name : null,

            // Trip fields (optional)
            trip_uuid: tripUuid,
            split_type: splitTypeValue,
            participants: txParticipants,
            splits: txSplits,

            updated_at: nowIso,
            is_deleted: false,
            needs_sync: true,
        };

        upsertLocalTransaction(localTx);
        saveLocalTransactionsToStorage();

        syncTransactionsWithServer().catch((err) => {
            console.error("Sync after add failed (will retry later)", err);
        });

        closeModal();

        loadRecordsFromLocal();
        renderRecordsStats();
        loadAnalysis();
        } catch (err) {
        console.error(err);
        alert("Failed to save transaction locally.");
        }
    });

    openModal(wrapper);
    }



    // ---------------------------------------------------------------------
    // MODAL: EDIT EXPENSE / INCOME  (UPDATED FOR TRIPS + PARTICIPANTS + CUSTOM SPLITS)
    // ---------------------------------------------------------------------
    async function openEditTransactionModal(tx) {
    const wrapper = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = "Edit Transaction";
    wrapper.appendChild(title);

    const form = document.createElement("form");
    form.className = "modal-form";

    form.innerHTML = `
        <div>
        <label>Type</label>
        <select name="type" required>
            <option value="expense" ${tx.type === "expense" ? "selected" : ""}>Expense</option>
            <option value="income" ${tx.type === "income" ? "selected" : ""}>Income</option>
        </select>
        </div>

        <div>
        <label>Amount</label>
        <input type="number" name="amount" step="0.01" min="0" value="${Number(tx.amount || 0)}" required />
        </div>

        <div>
        <label>Date</label>
        <input type="date" name="date" value="${tx.date || todayISO()}" required />
        </div>

        <div>
        <label>Category</label>
        <select name="category_id" size="1"></select>
        </div>

        <div>
        <label>Account</label>
        <select name="account_id" size="1"></select>
        </div>

        <div>
        <label>Trip (optional)</label>
        <select name="trip_uuid" size="1"></select>
        </div>

        <div id="tripSplitWrap" style="display:none;">
        <div class="mt-8">
            <label>Participants for this expense</label>
            <div id="tripParticipantsBox" class="mt-4"></div>
        </div>

        <div class="mt-8">
            <label>Split type</label>
            <select name="split_type">
            <option value="equal">Equal</option>
            <option value="custom">Custom amounts</option>
            </select>
        </div>

        <div id="customSplitBox" class="mt-8" style="display:none;"></div>
        <div class="text-sm text-muted mt-8" id="splitSummary"></div>
        </div>

        <div>
        <label>Description</label>
        <textarea name="description" rows="2">${tx.description || ""}</textarea>
        </div>

        <div class="modal-actions">
        <button type="button" class="btn-outline" id="cancelTxEdit">Cancel</button>
        <button type="submit" class="primary-btn">Save</button>
        </div>
    `;

    wrapper.appendChild(form);

    const amountInput = form.querySelector('input[name="amount"]');
    const tripSelect = form.querySelector('select[name="trip_uuid"]');
    const splitWrap = form.querySelector("#tripSplitWrap");
    const participantsBox = form.querySelector("#tripParticipantsBox");
    const splitTypeSelect = form.querySelector('select[name="split_type"]');
    const customSplitBox = form.querySelector("#customSplitBox");
    const splitSummary = form.querySelector("#splitSummary");

    const catSelect = form.querySelector('select[name="category_id"]');
    const accSelect = form.querySelector('select[name="account_id"]');

    // Trip-split local state initialized from tx if present
    let selectedParticipantUuids = Array.isArray(tx.participants) ? [...tx.participants] : [];
    let customSplits = tx.splits && typeof tx.splits === "object" ? { ...tx.splits } : {};

    // helpers
    function getTripByUuid(tripUuid) {
        if (!tripUuid) return null;
        return (localTrips || []).find((t) => t.uuid === tripUuid && !t.is_deleted) || null;
    }
    function computeEqualSplits(amount, participantUuids) {
        const n = participantUuids.length || 0;
        if (!n) return {};
        const per = amount / n;
        const splits = {};
        participantUuids.forEach((pu) => (splits[pu] = per));
        return splits;
    }
    function sumSplits(splitsObj) {
        return Object.values(splitsObj || {}).reduce((a, b) => a + Number(b || 0), 0);
    }

    // Build <select> options with stable values and dataset fields
    function populateSelect(select, items, includeBlank = true, blankLabel = "Unassigned") {
        select.innerHTML = "";

        if (includeBlank) {
        const o = document.createElement("option");
        o.value = "";
        o.textContent = blankLabel;
        select.appendChild(o);
        }

        (items || []).forEach((it) => {
        const o = document.createElement("option");
        // prefer uuid as the option value when available; fallback to id
        o.value = String(it.uuid ?? it.id ?? "");
        o.textContent = it.name ?? "(Unnamed)";
        if (it.id != null) o.dataset.id = String(it.id);
        if (it.uuid) o.dataset.uuid = String(it.uuid);
        select.appendChild(o);
        });
    }

    // Resolve selection by id or uuid (or exact value). Always sets select.value to the actual option.value.
    function setSelectByIdOrUuid(select, idOrUuid) {
        const key = idOrUuid == null ? "" : String(idOrUuid);

        const opt = [...select.options].find(
        (o) => o.value === key || o.dataset.id === key || o.dataset.uuid === key
        );

        select.value = opt ? opt.value : "";
    }

    function renderParticipantsForTrip(trip) {
        participantsBox.innerHTML = "";

        if (!trip?.participants?.length) {
        participantsBox.innerHTML = `<div class="text-muted">No participants in this trip.</div>`;
        selectedParticipantUuids = [];
        customSplits = {};
        return;
        }

        // If tx had no participants stored, default to all
        if (!selectedParticipantUuids.length) {
        selectedParticipantUuids = trip.participants.map((p) => p.uuid);
        }

        // keep selected participants only if still present in trip
        const valid = new Set(trip.participants.map((p) => p.uuid));
        selectedParticipantUuids = selectedParticipantUuids.filter((u) => valid.has(u));
        Object.keys(customSplits).forEach((k) => {
        if (!valid.has(k)) delete customSplits[k];
        });

        trip.participants.forEach((p) => {
        const row = document.createElement("label");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "8px";
        row.style.marginBottom = "6px";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = selectedParticipantUuids.includes(p.uuid);
        cb.value = p.uuid;

        cb.addEventListener("change", () => {
            const checked = [...participantsBox.querySelectorAll('input[type="checkbox"]:checked')].map((x) => x.value);
            selectedParticipantUuids = checked;
            Object.keys(customSplits).forEach((k) => {
            if (!selectedParticipantUuids.includes(k)) delete customSplits[k];
            });
            renderSplitEditor(trip);
            updateSplitSummary(trip);
        });

        const span = document.createElement("span");
        span.textContent = p.name;

        row.appendChild(cb);
        row.appendChild(span);
        participantsBox.appendChild(row);
        });
    }

    function renderSplitEditor(trip) {
        if (!trip?.uuid) return;

        const splitType = splitTypeSelect.value;

        if (splitType === "custom") {
        customSplitBox.style.display = "block";
        customSplitBox.innerHTML = "";

        const participants = trip.participants.filter((p) => selectedParticipantUuids.includes(p.uuid));

        participants.forEach((p) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.gap = "10px";
            row.style.marginBottom = "8px";

            const name = document.createElement("div");
            name.textContent = p.name;

            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.step = "0.01";
            input.placeholder = "0";
            input.value = customSplits[p.uuid] != null ? customSplits[p.uuid] : "";

            input.addEventListener("input", () => {
            customSplits[p.uuid] = Number(input.value || 0);
            updateSplitSummary(trip);
            });

            row.appendChild(name);
            row.appendChild(input);
            customSplitBox.appendChild(row);
        });
        } else {
        customSplitBox.style.display = "none";
        customSplitBox.innerHTML = "";
        }
    }

    function updateSplitSummary(trip) {
        const amount = Number(amountInput.value || 0);

        if (!trip?.uuid) {
        splitSummary.textContent = "";
        return;
        }

        if (!selectedParticipantUuids.length) {
        splitSummary.textContent = "Select at least 1 participant.";
        return;
        }

        if (splitTypeSelect.value === "equal") {
        const per = amount / selectedParticipantUuids.length;
        splitSummary.textContent = `Equal split: ${formatCurrency(per)} × ${selectedParticipantUuids.length} people`;
        } else {
        const total = sumSplits(customSplits);
        const diff = amount - total;
        const ok = Math.abs(diff) < 0.01;
        const diffText = ok ? "✅ Splits match amount" : `⚠️ Splits differ by ${formatCurrency(diff)}`;
        splitSummary.textContent = `Custom split total: ${formatCurrency(total)}. ${diffText}`;
        }
    }

    function updateTripUI() {
        const tripUuid = tripSelect.value || "";
        if (!tripUuid) {
        splitWrap.style.display = "none";
        selectedParticipantUuids = [];
        customSplits = {};
        customSplitBox.innerHTML = "";
        splitSummary.textContent = "";
        return;
        }

        const trip = getTripByUuid(tripUuid);
        splitWrap.style.display = "block";

        // preselect split type from tx if editing same trip
        if (tx.trip_uuid && tx.trip_uuid === tripUuid && tx.split_type) {
        splitTypeSelect.value = tx.split_type === "custom" ? "custom" : "equal";
        }

        renderParticipantsForTrip(trip);
        renderSplitEditor(trip);
        updateSplitSummary(trip);
    }

    // listeners
    splitTypeSelect.addEventListener("change", () => {
        const trip = getTripByUuid(tripSelect.value);
        renderSplitEditor(trip);
        updateSplitSummary(trip);
    });

    amountInput.addEventListener("input", () => {
        const trip = getTripByUuid(tripSelect.value);
        updateSplitSummary(trip);
    });

    tripSelect.addEventListener("change", () => {
        // user changed trip: reset participant selection/splits if needed
        selectedParticipantUuids = [];
        customSplits = {};
        updateTripUI();
    });

    // ----------------------------
    // Load and populate selects (categories, accounts, trips)
    // ----------------------------
    try {
        const [cats, accs] = await Promise.all([fetchCategoriesOptions(), fetchAccountsOptions()]);

        // populate selects (these functions create options with stable values and dataset props)
        populateSelect(catSelect, cats, true, "Uncategorized");
        populateSelect(accSelect, accs, true, "Unassigned");

        // set selection based on tx (id or uuid). This resolves to the option's actual value.
        setSelectByIdOrUuid(catSelect, tx.category_id);
        setSelectByIdOrUuid(accSelect, tx.account_id);

        // Build trips list (include closed so user can edit trip on an old tx)
        const trips = (localTrips || [])
        .filter((t) => !t.is_deleted)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        tripSelect.innerHTML = "";
        const optNone = document.createElement("option");
        optNone.value = "";
        optNone.textContent = "No trip";
        tripSelect.appendChild(optNone);

        trips.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.uuid;
        opt.textContent = t.name + (t.is_closed ? " • Closed" : "");
        tripSelect.appendChild(opt);
        });

        // set trip selection and split type from tx
        if (tx.trip_uuid) {
        tripSelect.value = String(tx.trip_uuid);
        splitTypeSelect.value = tx.split_type === "custom" ? "custom" : "equal";
        } else {
        tripSelect.value = "";
        splitTypeSelect.value = "equal";
        }

        updateTripUI();
    } catch (err) {
        console.error("Failed to load options for edit", err);
    }

    // cancel
    form.querySelector("#cancelTxEdit").addEventListener("click", closeModal);

    // save handler
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);

        tx.type = fd.get("type") || "expense";
        tx.amount = parseFloat(fd.get("amount") || "0");
        tx.date = fd.get("date") || todayISO();
        tx.description = fd.get("description") || "";

        const rawCat = fd.get("category_id") || null;
        const rawAcc = fd.get("account_id") || null;

        // resolve category/account using findByIdOrUuid (assumes it exists elsewhere)
        const catObj = rawCat != null ? findByIdOrUuid(localCategories, rawCat) : null;
        const accObj = rawAcc != null ? findByIdOrUuid(localAccounts, rawAcc) : null;

        tx.category_id = catObj ? (catObj.id != null ? catObj.id : catObj.uuid) : null;
        tx.category_name = catObj ? catObj.name : null;

        tx.account_id = accObj ? (accObj.id != null ? accObj.id : accObj.uuid) : null;
        tx.account_name = accObj ? accObj.name : null;

        // Trip + splits
        const tripUuid = (fd.get("trip_uuid") || "").toString() || null;
        let splitTypeValue = (fd.get("split_type") || "equal").toString();

        if (tripUuid) {
        const trip = getTripByUuid(tripUuid);
        const participants = [...selectedParticipantUuids];
        if (!participants.length) {
            alert("Please select at least 1 participant for this trip expense.");
            return;
        }

        let splits = null;
        if (splitTypeValue === "equal") {
            splits = computeEqualSplits(tx.amount, participants);
        } else {
            splits = {};
            participants.forEach((pu) => (splits[pu] = Number(customSplits[pu] || 0)));

            const total = sumSplits(splits);
            if (Math.abs(total - tx.amount) > 0.01) {
            alert(
                `Custom split must match amount.\nSplit total = ${formatCurrency(total)}\nAmount = ${formatCurrency(tx.amount)}`
            );
            return;
            }
        }

        tx.trip_uuid = tripUuid;
        tx.split_type = splitTypeValue;
        tx.participants = participants;
        tx.splits = splits;
        tx.trip_name = trip?.name || tx.trip_name || null;
        } else {
        // clear trip fields
        tx.trip_uuid = null;
        tx.split_type = null;
        tx.participants = null;
        tx.splits = null;
        tx.trip_name = null;
        }

        // finalize
        tx.updated_at = new Date().toISOString();
        tx.needs_sync = true;

        upsertLocalTransaction(tx);
        saveLocalTransactionsToStorage();

        syncTransactionsWithServer().catch((err) => {
        console.error("Sync after edit failed (will retry later)", err);
        });

        closeModal();
        loadRecordsFromLocal();
        loadAnalysis();
    });

    openModal(wrapper);
    }




    // ---------------------------------------------------------------------
    // MODAL: EDIT TRIP  
    // ---------------------------------------------------------------------

    function openEditTripModal(trip) {
        const wrapper = document.createElement("div");

        const title = document.createElement("h3");
        title.textContent = "Edit Trip";
        wrapper.appendChild(title);

        const form = document.createElement("form");
        form.className = "modal-form";

        // participants is [{uuid,name}] — convert to textarea text
        const participantsText = Array.isArray(trip.participants)
            ? trip.participants.map((p) => (p?.name || "").trim()).filter(Boolean).join("\n")
            : "";

        form.innerHTML = `
            <div>
            <label>Trip Name</label>
            <input name="name" type="text" value="${trip.name || ""}" required />
            </div>

            <div>
            <label>Participants (one per line)</label>
            <textarea name="participants" rows="6" placeholder="Ananth&#10;Rahul&#10;Sita">${participantsText}</textarea>
            <div class="text-sm text-muted mt-4">
                Total people will be auto-calculated from the list.
            </div>
            </div>

            <div class="modal-actions">
            <button type="button" class="btn-outline" id="cancelTripEdit">Cancel</button>
            <button type="submit" class="primary-btn">Save</button>
            </div>
        `;

        wrapper.appendChild(form);

        form.querySelector("#cancelTripEdit").addEventListener("click", closeModal);

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const fd = new FormData(form);

            const name = String(fd.get("name") || "").trim();
            const rawParticipants = String(fd.get("participants") || "");

            const lines = rawParticipants
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean);

            if (!name) {
            alert("Trip name is required.");
            return;
            }
            if (!lines.length) {
            alert("Please add at least 1 participant.");
            return;
            }

            // Preserve participant UUIDs for same names (so transactions referencing participants can stay stable later)
            const old = Array.isArray(trip.participants) ? trip.participants : [];
            const oldByName = new Map(old.map((p) => [String(p.name || "").trim(), p]));

            const participants = lines.map((personName) => {
            const existing = oldByName.get(personName);
            return {
                uuid:
                existing?.uuid ||
                (typeof crypto.randomUUID === "function"
                    ? crypto.randomUUID()
                    : `p-${Date.now()}-${Math.random()}`),
                name: personName,
            };
            });

            trip.name = name;
            trip.participants = participants;
            trip.total_people = participants.length; // ✅ keep in sync
            trip.updated_at = new Date().toISOString();
            trip.needs_sync = true;

            upsertLocalTrip(trip);
            saveLocalTransactionsToStorage();

            closeModal();
            loadTrips();
        });

        openModal(wrapper);
        }





    // ---------------------------------------------------------------------
    // MODAL: ADD BUDGET
    // ---------------------------------------------------------------------
    async function openAddBudgetModal() {
        const wrapper = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = "Add Budget";
        wrapper.appendChild(title);

        const form = document.createElement("form");
        form.className = "modal-form";

        form.innerHTML = `
            <div>
                <label>Name</label>
                <input name="name" type="text" required />
            </div>
            <div>
                <label>Amount</label>
                <input name="amount" type="number" step="0.01" min="0" required />
            </div>
            <div>
                <label>Period</label>
                <select name="period">
                    <option value="monthly" selected>Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
            <div>
                <label>Start Date</label>
                <input name="start_date" type="date" />
            </div>
            <div>
                <label>End Date</label>
                <input name="end_date" type="date" />
            </div>
            <div>
                <label>Category (optional)</label>
                <select name="category_id"></select>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-outline" id="cancelBudget">Cancel</button>
                <button type="submit" class="primary-btn">Save</button>
            </div>
        `;
        wrapper.appendChild(form);

        try {
            const cats = await fetchCategoriesOptions();
            createSelectOptions(
                form.querySelector('select[name="category_id"]'),
                cats,
                true,
                "All categories"
            );
        } catch (err) {
            console.error("Failed to load categories for budget", err);
        }

        form.querySelector("#cancelBudget").addEventListener("click", closeModal);

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(form);

            const payload = {
                name: fd.get("name") || "",
                amount: parseFloat(fd.get("amount") || "0"),
                period: fd.get("period") || "monthly",
                start_date: fd.get("start_date") || null,
                end_date: fd.get("end_date") || null,
                category_id: fd.get("category_id") || null,
            };

            if (!payload.start_date) delete payload.start_date;
            if (!payload.end_date) delete payload.end_date;
            if (!payload.category_id) delete payload.category_id;

            try {
                await apiPost("/api/budgets", payload);
                closeModal();
                loadBudgets();
            } catch (err) {
                console.error(err);
                alert("Failed to save budget.");
            }
        });

        openModal(wrapper);
    }

    // ---------------------------------------------------------------------
    // MODAL: ADD ACCOUNT
    // ---------------------------------------------------------------------
    function openAddAccountModal() {
        const wrapper = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = "Add Account";
        wrapper.appendChild(title);

        const form = document.createElement("form");
        form.className = "modal-form";

        form.innerHTML = `
            <div>
                <label>Name</label>
                <input name="name" type="text" required />
            </div>
            <div>
                <label>Type</label>
                <select name="type">
                    <option value="cash" selected>Cash</option>
                    <option value="credit">Credit Card</option>
                    <option value="debit">Debit Card</option>
                    <option value="prepaid">Prepaid / Meal Card</option>
                    <option value="bank">Bank Account</option>
                </select>
            </div>
            <div>
                <label>Initial Balance</label>
                <input name="initial_balance" type="number" step="0.01" />
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-outline" id="cancelAccount">Cancel</button>
                <button type="submit" class="primary-btn">Save</button>
            </div>
        `;
        wrapper.appendChild(form);

        form.querySelector("#cancelAccount").addEventListener("click", closeModal);

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(form);

            const payload = {
                name: fd.get("name") || "",
                type: fd.get("type") || "cash",
                initial_balance: parseFloat(fd.get("initial_balance") || "0"),
            };

            try {
                await apiPost("/api/accounts", payload);
                await syncAccountsWithServer();
                closeModal();
                loadAccounts();
            } catch (err) {
                console.error(err);
                alert("Failed to save account.");
            }
        });

        openModal(wrapper);
    }

    // ---------------------------------------------------------------------
    // MODAL: EDIT ACCOUNT
    // ---------------------------------------------------------------------
    function openEditAccountModal(acc) {
        const wrapper = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = "Edit Account";
        wrapper.appendChild(title);

        const form = document.createElement("form");
        form.className = "modal-form";

        form.innerHTML = `
            <div>
                <label>Name</label>
                <input name="name" type="text" value="${acc.name}" required />
            </div>
            <div>
                <label>Type</label>
                <select name="type">
                    <option value="cash" ${acc.type === "cash" ? "selected" : ""}>Cash</option>
                    <option value="credit" ${acc.type === "credit" ? "selected" : ""}>Credit Card</option>
                    <option value="debit" ${acc.type === "debit" ? "selected" : ""}>Debit Card</option>
                    <option value="prepaid" ${acc.type === "prepaid" ? "selected" : ""}>Prepaid / Meal Card</option>
                    <option value="bank" ${acc.type === "bank" ? "selected" : ""}>Bank Account</option>
                </select>
            </div>
            <div>
                <label>Initial Balance</label>
                <input name="initial_balance" type="number" step="0.01" value="${acc.initial_balance}" />
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-outline" id="cancelAccountEdit">Cancel</button>
                <button type="submit" class="primary-btn">Save</button>
            </div>
        `;
        wrapper.appendChild(form);

        form.querySelector("#cancelAccountEdit").addEventListener("click", closeModal);

        form.addEventListener("submit", (e) => {
            e.preventDefault();

            const fd = new FormData(form);
            acc.name = fd.get("name") || "";
            acc.type = fd.get("type") || "cash";
            acc.initial_balance = parseFloat(fd.get("initial_balance") || "0");
            acc.updated_at = new Date().toISOString();
            acc.needs_sync = true;

            upsertLocalAccount(acc);
            saveLocalTransactionsToStorage();

            syncAccountsWithServer().catch((err) =>
                console.error("Sync after account edit failed", err)
            );

            closeModal();
            loadAccounts();
        });

        openModal(wrapper);
    }


    // ---------------------------------------------------------------------
    // MODAL: ADD CATEGORY
    // ---------------------------------------------------------------------
    function openAddCategoryModal() {
        const wrapper = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = "Add Category";
        wrapper.appendChild(title);

        const form = document.createElement("form");
        form.className = "modal-form";

        form.innerHTML = `
            <div>
                <label>Name</label>
                <input name="name" type="text" required />
            </div>
            <div>
                <label>Type</label>
                <select name="type">
                    <option value="expense" selected>Expense</option>
                    <option value="income">Income</option>
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-outline" id="cancelCategory">Cancel</button>
                <button type="submit" class="primary-btn">Save</button>
            </div>
        `;
        wrapper.appendChild(form);

        form.querySelector("#cancelCategory").addEventListener("click", closeModal);

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(form);

            const payload = {
                name: fd.get("name") || "",
                type: fd.get("type") || "expense",
            };

            try {
                await apiPost("/api/categories", payload);
                await syncCategoriesWithServer();
                closeModal();
                loadCategories();
            } catch (err) {
                console.error(err);
                alert("Failed to save category.");
            }
        });

        openModal(wrapper);
    }

    // ---------------------------------------------------------------------
    // MODAL: EDIT CATEGORY
    // ---------------------------------------------------------------------
    function openEditCategoryModal(cat) {
        const wrapper = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = "Edit Category";
        wrapper.appendChild(title);

        const form = document.createElement("form");
        form.className = "modal-form";

        form.innerHTML = `
            <div>
                <label>Name</label>
                <input name="name" type="text" value="${cat.name}" required />
            </div>
            <div>
                <label>Type</label>
                <select name="type">
                    <option value="expense" ${cat.type === "expense" ? "selected" : ""}>Expense</option>
                    <option value="income" ${cat.type === "income" ? "selected" : ""}>Income</option>
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-outline" id="cancelCategoryEdit">Cancel</button>
                <button type="submit" class="primary-btn">Save</button>
            </div>
        `;
        wrapper.appendChild(form);

        form.querySelector("#cancelCategoryEdit").addEventListener("click", closeModal);

        form.addEventListener("submit", (e) => {
            e.preventDefault();

            const fd = new FormData(form);
            cat.name = fd.get("name") || "";
            cat.type = fd.get("type") || "expense";
            cat.updated_at = new Date().toISOString();
            cat.needs_sync = true;

            upsertLocalCategory(cat);
            saveLocalTransactionsToStorage();

            syncCategoriesWithServer().catch((err) =>
                console.error("Sync after category edit failed", err)
            );

            closeModal();
            loadCategories();
        });

        openModal(wrapper);
    }

    // ---------------------------------------------------------------------
    // MODAL: ADD Trip
    // ---------------------------------------------------------------------
    function openAddTripModal() {
        const wrapper = document.createElement("div");

        const title = document.createElement("h3");
        title.textContent = "Add Trip";
        wrapper.appendChild(title);

        const form = document.createElement("form");
        form.className = "modal-form";

        form.innerHTML = `
            <div>
            <label>Trip Name</label>
            <input name="name" type="text" required />
            </div>

            <div>
            <label>Participants (one per line)</label>
            <textarea name="participants" rows="5" placeholder="Ananth&#10;Rahul&#10;Sita"></textarea>
            <div class="text-sm text-muted mt-4">
                Tip: You can edit participants later.
            </div>
            </div>

            <div class="modal-actions">
            <button type="button" class="btn-outline" id="cancelTrip">Cancel</button>
            <button type="submit" class="primary-btn">Save</button>
            </div>
        `;

        wrapper.appendChild(form);

        form.querySelector("#cancelTrip").addEventListener("click", closeModal);

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const fd = new FormData(form);

            const name = String(fd.get("name") || "").trim();
            const rawParticipants = String(fd.get("participants") || "");

            const lines = rawParticipants
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean);

            const participants = lines.map((p) => ({
            uuid:
                typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `p-${Date.now()}-${Math.random()}`,
            name: p,
            }));

            if (!name) {
            alert("Trip name is required.");
            return;
            }
            if (!participants.length) {
            alert("Please add at least 1 participant.");
            return;
            }

            const trip = {
            uuid:
                typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `trip-${Date.now()}-${Math.random()}`,
            name,
            participants,                 // ✅ array of {uuid,name}
            total_people: participants.length, // ✅ keep this in sync
            is_closed: false,             // ✅ default open
            updated_at: new Date().toISOString(),
            is_deleted: false,
            needs_sync: true,             // ✅ for future server sync
            };

            upsertLocalTrip(trip);
            saveLocalTransactionsToStorage();
            closeModal();
            loadTrips();
        });

        openModal(wrapper);
        }





    // ---------------------------------------------------------------------
    // HOOK BUTTONS
    // ---------------------------------------------------------------------
    if (addExpenseBtn) addExpenseBtn.addEventListener("click", openAddTransactionModal);
    if (addBudgetBtn) addBudgetBtn.addEventListener("click", openAddBudgetModal);
    if (addAccountBtn) addAccountBtn.addEventListener("click", openAddAccountModal);
    if (addCategoryBtn) addCategoryBtn.addEventListener("click", openAddCategoryModal);
    if (addTripBtn) addTripBtn.addEventListener("click", openAddTripModal);


    if (prevMonthBtn) {
        prevMonthBtn.addEventListener("click", () => shiftCustomMonth(-1));
    }
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener("click", () => shiftCustomMonth(1));
    }

    // ---------------------------------------------------------------------
    // CARD EDIT / DELETE HANDLERS (EVENT DELEGATION)
    // ---------------------------------------------------------------------
    document.body.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        // ---------------- Transactions ----------------
        if (btn.classList.contains("edit-tx-btn")) {
            const uuid = btn.dataset.uuid;
            const tx = localTransactions.find((t) => t.uuid === uuid);
            if (tx) openEditTransactionModal(tx);
            return;
        }

        if (btn.classList.contains("delete-tx-btn")) {
            const uuid = btn.dataset.uuid;
            const tx = localTransactions.find((t) => t.uuid === uuid);
            if (tx && confirm("Delete this transaction?")) {
                tx.is_deleted = true;
                tx.updated_at = new Date().toISOString();
                tx.needs_sync = true;
                saveLocalTransactionsToStorage();
                syncTransactionsWithServer().catch((err) =>
                    console.error("Sync after tx delete failed", err)
                );
                loadRecordsFromLocal();
                loadAnalysis();
            }
            return;
        }

        // ---------------- Accounts ----------------
        if (btn.classList.contains("edit-account-btn")) {
            const uuid = btn.dataset.uuid;
            const acc = localAccounts.find((a) => a.uuid === uuid);
            if (acc) openEditAccountModal(acc);
            return;
        }

        if (btn.classList.contains("delete-account-btn")) {
            const uuid = btn.dataset.uuid;
            const acc = localAccounts.find((a) => a.uuid === uuid);
            if (acc && confirm("Delete this account?")) {
                acc.is_deleted = true;
                acc.updated_at = new Date().toISOString();
                acc.needs_sync = true;
                saveLocalTransactionsToStorage();
                syncAccountsWithServer().catch((err) =>
                    console.error("Sync after account delete failed", err)
                );
                loadAccounts();
            }
            return;
        }

        // ---------------- Categories ----------------
        if (btn.classList.contains("edit-category-btn")) {
            const uuid = btn.dataset.uuid;
            const cat = localCategories.find((c) => c.uuid === uuid);
            if (cat) openEditCategoryModal(cat);
            return;
        }

        if (btn.classList.contains("delete-category-btn")) {
            const uuid = btn.dataset.uuid;
            const cat = localCategories.find((c) => c.uuid === uuid);
            if (cat && confirm("Delete this category?")) {
                cat.is_deleted = true;
                cat.updated_at = new Date().toISOString();
                cat.needs_sync = true;
                saveLocalTransactionsToStorage();
                syncCategoriesWithServer().catch((err) =>
                    console.error("Sync after category delete failed", err)
                );
                loadCategories();
            }
        }

        // ---------------- Trips ----------------
        if (btn.classList.contains("edit-trip-btn")) {
        const uuid = btn.dataset.uuid;
        const trip = localTrips.find((t) => t.uuid === uuid);
        if (trip) openEditTripModal(trip);
        return;
        }

        if (btn.classList.contains("delete-trip-btn")) {
        const uuid = btn.dataset.uuid;
        const trip = localTrips.find((t) => t.uuid === uuid);
        if (trip && confirm("Delete this trip?")) {
            deleteTrip(trip);
        }
        return;
        }

        if (btn.classList.contains("toggle-trip-btn")) {
        const uuid = btn.dataset.uuid;
        const trip = localTrips.find((t) => t.uuid === uuid);
        if (!trip) return;

        trip.is_closed = !trip.is_closed;
        trip.updated_at = new Date().toISOString();
        trip.needs_sync = true;

        upsertLocalTrip(trip);
        saveLocalTransactionsToStorage();

        loadTrips();

        // ✅ Important: if trip dropdown exists in transaction modal, refresh options source
        // loadRecordsFromLocal();
        return;
        }
    });

    document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".trip-toggle-btn");
    if (!btn) return;

    const uuid = btn.dataset.uuid;
    const trip = localTrips.find((t) => t.uuid === uuid);
    if (!trip) return;

    const confirmMsg = trip.is_closed
        ? "Reopen this trip?"
        : "Close this trip? You won’t be able to add new expenses.";

    if (!confirm(confirmMsg)) return;

    trip.is_closed = !trip.is_closed;
    trip.updated_at = new Date().toISOString();

    upsertLocalTrip(trip);
    saveLocalTransactionsToStorage();
    loadTrips();
    });



    // ---------------------------------------------------------------------
    // INITIAL LOAD
    // ---------------------------------------------------------------------
    loadLocalTransactionsFromStorage();

    loadRecordsFromLocal();
    loadAnalysis();
    loadAccounts();
    loadCategories();
    loadBudgets();
    loadTrips();


    (async () => {
        try {
            await syncTransactionsWithServer();
            await syncAccountsWithServer();
            await syncCategoriesWithServer();
        } catch (err) {
            console.error("Initial sync failed", err);
        }
        loadRecordsFromLocal();
        loadAnalysis();
        loadAccounts();
        loadCategories();
        loadTrips();
        renderRecordsStats();
    })();

    // Service worker registration (PWA)
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker
                .register("/static/js/sw.js")
                .then((reg) => console.log("Service worker registered", reg.scope))
                .catch((err) =>
                    console.error("Service worker registration failed", err)
                );
        });
    }

    // Sync when we come back online
    window.addEventListener("online", () => {
        console.log("Back online, syncing all...");
        (async () => {
            try {
                await syncTransactionsWithServer();
                await syncAccountsWithServer();
                await syncCategoriesWithServer();
                loadRecordsFromLocal();
                loadAnalysis();
                loadAccounts();
                loadCategories();
                loadTrips();
            } catch (err) {
                console.error("Sync on online event failed", err);
            }
        })();
    });
});
