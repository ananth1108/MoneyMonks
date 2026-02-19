// static/js/ui.js
// UI rendering functions for cards, stats, and lists

import { formatCurrency } from "./api.js";
import * as state from "./state.js";
import * as helpers from "./helpers.js";
import * as storage from "./storage.js";

export function renderTransactionCard(tx, opts = {}) {
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

    const rawDesc = (tx.description || "").trim();
    const displayDesc = prettify ? helpers.prettifyDescriptionForDisplay(rawDesc) : rawDesc;
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

    const meta = document.createElement("div");
    meta.className = "tx-meta text-sm text-muted";

    const cat = (tx.category_name || "Uncategorized").trim();
    const acc = (tx.account_name || "").trim();

    meta.textContent = acc ? `${cat} • ${acc}` : cat;

    if (tx.needs_sync) {
        const sync = document.createElement("span");
        sync.className = "tx-sync-badge";
        sync.textContent = " • pending sync";
        meta.appendChild(sync);
    }

    card.appendChild(header);
    card.appendChild(meta);

    card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        card.classList.toggle("expanded");
        card.classList.toggle("collapsed");
    });

    return card;
}

export function renderQuickTemplates(quickTemplates) {
    if (!quickTemplates) return;

    const templates = helpers.getRecentTransactionTemplates(5, { type: "expense" });
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
        const shortDesc = desc.length > 28 ? desc.slice(0, 25).trimEnd() + "…" : desc;

        const sign = t.type === "income" ? "+" : "-";
        const typeClass = t.type === "income" ? "amount-income" : "amount-expense";

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
            const evt = new CustomEvent("quickTemplateClick", { 
                detail: { template: t }
            });
            document.dispatchEvent(evt);
        });

        row.appendChild(btn);
    });
}

export function renderRecordsStats(recordsStats, timeRangeSelect, customMonthInput) {
    if (!recordsStats) return;

    const periods = ["today", "week", "month"];
    let html = "";

    periods.forEach((period) => {
        const range = helpers.getPeriodRange(period);
        const filtered = helpers.filterByDateRange(
            state.localTransactions.filter((t) => !t.is_deleted),
            range,
            (t) => t.date
        );

        let income = 0, expense = 0;
        filtered.forEach((t) => {
            const amt = Number(t.amount || 0);
            if (t.type === "income") income += amt;
            else if (t.type === "expense") expense += amt;
        });

        const net = income - expense;
        const netClass = net > 0 ? "text-positive" : net < 0 ? "text-negative" : "";

        html += `
            <div class="card clickable-summary" data-period="${period}">
                <div class="card-header-row">
                    <div class="card-title">${period.charAt(0).toUpperCase() + period.slice(1)}</div>
                    <div class="text-right">
                        <div class="text-sm text-muted">Net</div>
                        <div class="text-sm ${netClass}">${formatCurrency(net)}</div>
                    </div>
                </div>
                <div class="space-y">
                    <div class="text-sm"><span class="amount-income">+${formatCurrency(income)}</span> income</div>
                    <div class="text-sm"><span class="amount-expense">-${formatCurrency(expense)}</span> expense</div>
                </div>
            </div>
        `;
    });

    recordsStats.innerHTML = html;

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

        timeRangeSelect.dispatchEvent(new Event("change"));
    });
}

export function renderTripTransactions(tripTxBox, txs) {
    if (!tripTxBox) return;

    if (!txs.length) {
        tripTxBox.innerHTML = `<div class="text-muted">No transactions for this trip.</div>`;
        return;
    }

    tripTxBox.innerHTML = "";
    txs.forEach((tx) => {
        tripTxBox.appendChild(renderTransactionCard(tx, { prettify: true }));
    });
}

export function renderTripBalances(tripBalancesBox, trip, txs) {
    if (!tripBalancesBox) return;

    let totalExpense = 0;
    txs.forEach((t) => {
        if (t.type === "expense") totalExpense += Number(t.amount || 0);
    });

    const perPerson = trip.total_people && trip.total_people > 0 ? totalExpense / trip.total_people : 0;

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

export function renderTripSettlements(tripSettlementsBox) {
    if (!tripSettlementsBox) return;

    tripSettlementsBox.innerHTML = `
        <div class="card">
            <div class="card-title">Settlements</div>
            <div class="text-sm text-muted mt-8">
                Once splits are tracked per participant, we'll compute "A pays B ₹X".
            </div>
        </div>
    `;
}

export function createSelectOptions(selectEl, items, includeEmpty, emptyLabel) {
    selectEl.innerHTML = "";

    if (includeEmpty) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = emptyLabel || "None";
        selectEl.appendChild(opt);
    }

    items.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.uuid ? String(item.uuid) : "";
        opt.textContent = item.name;
        selectEl.appendChild(opt);
    });
}

export function getTripByUuid(tripUuid) {
    return state.localTrips.find((t) => t.uuid === tripUuid && !t.is_deleted) || null;
}

export function computeEqualSplits(amount, participantUuids) {
    const n = participantUuids.length || 0;
    if (!n) return {};
    const per = amount / n;

    const splits = {};
    participantUuids.forEach((pu) => (splits[pu] = per));
    return splits;
}

export function sumSplits(splitsObj) {
    return Object.values(splitsObj || {}).reduce((a, b) => a + Number(b || 0), 0);
}
