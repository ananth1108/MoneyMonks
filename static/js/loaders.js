// static/js/loaders.js
// Data loader functions for all tabs

import { formatCurrency, apiGet } from "./api.js";
import * as state from "./state.js";
import * as storage from "./storage.js";
import * as sync from "./sync.js";
import * as helpers from "./helpers.js";
import * as ui from "./ui.js";

// Loading transactions/records  
export async function loadRecords(
    recordsList, 
    timeRangeSelect, 
    customMonthInput
) {
    try {
        recordsList.innerHTML = `<div class="text-muted">Loading...</div>`;

        const visible = helpers.getVisibleTransactionsForCurrentRange(timeRangeSelect, customMonthInput);
        if (!visible.length) {
            recordsList.innerHTML = `<div class="text-muted">No transactions yet for this period.</div>`;
            return;
        }

        recordsList.innerHTML = "";
        visible.forEach((tx) => {
            recordsList.appendChild(ui.renderTransactionCard(tx, { prettify: true }));
        });
    } catch (err) {
        console.error(err);
        recordsList.innerHTML = `<div class="text-muted">Failed to render records.</div>`;
    }
}

// Load analysis with category and account breakdowns
export function loadAnalysis(
    sumIncomeEl,
    sumExpenseEl,
    sumNetEl,
    categoryBreakdown,
    accountBreakdown,
    timeRangeSelect,
    customMonthInput
) {
    try {
        const filters = helpers.getDateFilters(timeRangeSelect, customMonthInput);
        let txs = state.localTransactions.filter((t) => !t.is_deleted);

        txs = helpers.filterByDateRange(txs, filters, (t) => t.date);

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

        // Category breakdown
        const categoryMap = new Map();
        txs.forEach((t) => {
            const key = t.category_name || "Uncategorized";
            if (!categoryMap.has(key)) {
                categoryMap.set(key, { category_name: key, income: 0, expense: 0 });
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
                        <div class="text-sm"><span class="amount-expense">${formatCurrency(exp)}</span> spent</div>
                        <div class="text-sm"><span class="amount-income">${formatCurrency(inc)}</span> income</div>
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

        // Account breakdown
        const accountMap = new Map();
        txs.forEach((t) => {
            const key = t.account_name || "Unassigned";
            if (!accountMap.has(key)) {
                accountMap.set(key, { account_name: key, income: 0, expense: 0 });
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
                        <div class="text-sm"><span class="amount-expense">${formatCurrency(exp)}</span> spent</div>
                        <div class="text-sm"><span class="amount-income">${formatCurrency(inc)}</span> income</div>
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
    }
}

// Load budgets
export async function loadBudgets(budgetList) {
    try {
        budgetList.innerHTML = `<div class="text-muted">Loading...</div>`;

        if (!helpers.isOnline()) {
            budgetList.innerHTML = `<div class="text-muted">Offline mode - budgets not available.</div>`;
            return;
        }

        const res = await apiGet("/api/budgets");
        const budgets = res.results || [];
        if (!budgets.length) {
            budgetList.innerHTML = `<div class="text-muted">No budgets yet.</div>`;
            return;
        }

        const filters = helpers.getDateFilters();
        let txs = state.localTransactions.filter((t) => !t.is_deleted && t.type === "expense");
        txs = helpers.filterByDateRange(txs, filters, (t) => t.date);

        budgetList.innerHTML = "";
        budgets.forEach((b) => {
            const spent = txs
                .filter((t) => t.category_id === b.category_id)
                .reduce((sum, t) => sum + Number(t.amount || 0), 0);

            const budget = Number(b.amount || 0);
            const remaining = Math.max(0, budget - spent);
            const over = spent > budget;
            const progressPct = budget > 0 ? (spent / budget) * 100 : 0;

            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <div class="card-header-row">
                    <div>
                        <div class="card-title">${b.category_name || "Budget"}</div>
                        <div class="card-subtitle">${formatCurrency(budget)} limit</div>
                    </div>
                    <div class="card-actions">
                        <button class="icon-small edit-budget-btn" data-id="${b.id}" title="Edit">✏️</button>
                        <button class="icon-small delete-budget-btn" data-id="${b.id}" title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="progress-container mt-8">
                    <div class="progress-bar">
                        <div class="progress-fill ${over ? "over-budget" : ""}" style="width:${Math.min(progressPct, 100)}%;"></div>
                    </div>
                    <div class="budget-meta">
                        <span>Spent: ${formatCurrency(spent)}</span>
                        <span>Remaining: ${formatCurrency(remaining)}</span>
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

// Load accounts
export async function loadAccounts(accountsList, timeRangeSelect, customMonthInput) {
    try {
        accountsList.innerHTML = `<div class="text-muted">Loading...</div>`;

        if (!state.localAccounts.length && helpers.isOnline()) {
            await sync.syncAccountsWithServer();
        }

        const accounts = state.localAccounts.filter((a) => !a.is_deleted).sort((a, b) => a.name.localeCompare(b.name));
        if (!accounts.length) {
            accountsList.innerHTML = `<div class="text-muted">No accounts yet.</div>`;
            return;
        }

        const filters = helpers.getDateFilters(timeRangeSelect, customMonthInput);
        let txs = state.localTransactions.filter((t) => !t.is_deleted);
        txs = helpers.filterByDateRange(txs, filters, (t) => t.date);

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
                    <div class="text-sm">Initial: <strong>${formatCurrency(a.initial_balance)}</strong></div>
                    <div class="text-sm">Expense: <span class="amount-expense">${formatCurrency(bucket.expense)}</span> • Income: <span class="amount-income">${formatCurrency(bucket.income)}</span></div>
                </div>
            `;

            accountsList.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        accountsList.innerHTML = `<div class="text-muted">Failed to load accounts.</div>`;
    }
}

// Load categories
export async function loadCategories(categoriesList, timeRangeSelect, customMonthInput) {
    try {
        categoriesList.innerHTML = `<div class="text-muted">Loading...</div>`;

        if (!state.localCategories.length && helpers.isOnline()) {
            await sync.syncCategoriesWithServer();
        }

        const categories = state.localCategories.filter((c) => !c.is_deleted).sort((a, b) => a.name.localeCompare(b.name));
        if (!categories.length) {
            categoriesList.innerHTML = `<div class="text-muted">No categories yet.</div>`;
            return;
        }

        const filters = helpers.getDateFilters(timeRangeSelect, customMonthInput);
        let txs = state.localTransactions.filter((t) => !t.is_deleted);
        txs = helpers.filterByDateRange(txs, filters, (t) => t.date);

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
                    <div class="text-sm">Expense: <span class="amount-expense">${formatCurrency(bucket.expense)}</span></div>
                    <div class="text-sm">Income: <span class="amount-income">${formatCurrency(bucket.income)}</span></div>
                </div>
            `;

            categoriesList.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        categoriesList.innerHTML = `<div class="text-muted">Failed to load categories.</div>`;
    }
}

// Load trips
export async function loadTrips(tripsList, tripsListView, tripDetailsView) {
    try {
        tripsList.innerHTML = `<div class="text-muted">Loading...</div>`;

        if (!state.localTrips.length && helpers.isOnline()) {
            const res = await apiGet("/api/trips");
            const serverTrips = res.results || [];
            serverTrips.forEach((t) => {
                storage.upsertLocalTrip(t);
            });
            storage.saveLocalTransactionsToStorage();
        }

        const allTrips = state.localTrips.filter((t) => !t.is_deleted);
        const openTrips = allTrips.filter((t) => !t.is_closed);
        const closedTrips = allTrips.filter((t) => t.is_closed);

        tripsList.innerHTML = "";

        if (!allTrips.length) {
            tripsList.innerHTML = `<div class="text-muted">No trips yet.</div>`;
            return;
        }

        const buildTripCards = (trips, title) => {
            if (!trips.length) return;

            const section = document.createElement("div");
            section.className = "trips-section";

            const heading = document.createElement("h4");
            heading.textContent = title;
            section.appendChild(heading);

            const cardsContainer = document.createElement("div");
            cardsContainer.className = "trips-cards";

            trips.forEach((trip) => {
                const card = document.createElement("div");
                card.className = "card trip-card";
                card.dataset.uuid = trip.uuid;

                card.innerHTML = `
                    <div class="card-header-row">
                        <div>
                            <div class="card-title">${trip.name || "Unnamed"}</div>
                            <div class="card-subtitle">${trip.total_people || 0} people</div>
                        </div>
                        <div class="card-actions">
                            <button class="icon-small view-trip-btn" data-uuid="${trip.uuid}" title="View">👁️</button>
                            <button class="icon-small edit-trip-btn" data-uuid="${trip.uuid}" title="Edit">✏️</button>
                            <button class="icon-small delete-trip-btn" data-uuid="${trip.uuid}" title="Delete">🗑️</button>
                        </div>
                    </div>
                `;

                cardsContainer.appendChild(card);
            });

            section.appendChild(cardsContainer);
            tripsList.appendChild(section);
        };

        buildTripCards(openTrips, "Open Trips");
        buildTripCards(closedTrips, "Closed Trips");

    } catch (err) {
        console.error(err);
        tripsList.innerHTML = `<div class="text-muted">Failed to load trips.</div>`;
    }
}
