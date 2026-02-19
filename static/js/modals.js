// static/js/modals.js
// Modal dialog management and functions

import { apiPost, apiPut, apiDelete, formatCurrency, todayISO } from "./api.js";
import * as state from "./state.js";
import * as storage from "./storage.js";
import * as ui from "./ui.js";
import * as sync from "./sync.js";

export function openModal(modalBody, contentNode) {
    modalBody.innerHTML = "";
    modalBody.appendChild(contentNode);
    const modal = modalBody.closest("#modalContainer");
    if (modal) modal.classList.remove("hidden");
}

export function closeModal(modal, modalBody) {
    modal.classList.add("hidden");
    modalBody.innerHTML = "";
}

export function openAddTransactionModal(
    modal,
    modalBody,
    modalClose,
    callback
) {
    const wrapper = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = "Add Transaction";
    wrapper.appendChild(title);

    const form = document.createElement("form");
    form.className = "modal-form";

    const todayVal = todayISO();

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
            <input type="date" name="date" required value="${todayVal}" />
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
            <label>Description</label>
            <textarea name="description" rows="2" placeholder="Optional"></textarea>
        </div>

        <div class="modal-actions">
            <button type="button" class="btn-outline" id="cancelTx">Cancel</button>
            <button type="submit" class="primary-btn">Save</button>
        </div>
    `;

    const categorySelect = form.querySelector('select[name="category_id"]');
    const accountSelect = form.querySelector('select[name="account_id"]');
    const cancelBtn = form.querySelector("#cancelTx");

    ui.createSelectOptions(categorySelect, state.localCategories.filter(c => !c.is_deleted), true);
    ui.createSelectOptions(accountSelect, state.localAccounts.filter(a => !a.is_deleted), true);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const tx = {
            uuid: `local-${Date.now()}-${Math.random()}`,
            type: formData.get("type"),
            amount: Number(formData.get("amount")),
            date: formData.get("date"),
            category_id: formData.get("category_id") || null,
            account_id: formData.get("account_id") || null,
            description: formData.get("description") || null,
            updated_at: new Date().toISOString(),
            is_deleted: false,
            needs_sync: true,
        };

        storage.upsertLocalTransaction(tx);
        storage.saveLocalTransactionsToStorage();
        closeModal(modal, modalBody);

        if (callback) callback();
    });

    cancelBtn.addEventListener("click", () => {
        closeModal(modal, modalBody);
    });

    wrapper.appendChild(form);
    openModal(modalBody, wrapper);
}

export function openAddAccountModal(modal, modalBody, modalClose, callback) {
    const wrapper = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = "Add Account";
    wrapper.appendChild(title);

    const form = document.createElement("form");
    form.className = "modal-form";

    form.innerHTML = `
        <div>
            <label>Name</label>
            <input type="text" name="name" required />
        </div>

        <div>
            <label>Type</label>
            <select name="type">
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="credit">Credit Card</option>
            </select>
        </div>

        <div>
            <label>Initial Balance</label>
            <input type="number" name="initial_balance" step="0.01" min="0" value="0" />
        </div>

        <div class="modal-actions">
            <button type="button" class="btn-outline" id="cancelAcc">Cancel</button>
            <button type="submit" class="primary-btn">Save</button>
        </div>
    `;

    const cancelBtn = form.querySelector("#cancelAcc");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const acc = {
            uuid: `acc-${Date.now()}-${Math.random()}`,
            name: formData.get("name"),
            type: formData.get("type"),
            initial_balance: Number(formData.get("initial_balance")),
            updated_at: new Date().toISOString(),
            is_deleted: false,
            needs_sync: true,
        };

        storage.upsertLocalAccount(acc);
        storage.saveLocalTransactionsToStorage();
        closeModal(modal, modalBody);

        if (callback) callback();
    });

    cancelBtn.addEventListener("click", () => {
        closeModal(modal, modalBody);
    });

    wrapper.appendChild(form);
    openModal(modalBody, wrapper);
}

export function openAddCategoryModal(modal, modalBody, modalClose, callback) {
    const wrapper = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = "Add Category";
    wrapper.appendChild(title);

    const form = document.createElement("form");
    form.className = "modal-form";

    form.innerHTML = `
        <div>
            <label>Name</label>
            <input type="text" name="name" required />
        </div>

        <div>
            <label>Type</label>
            <select name="type">
                <option value="expense" selected>Expense</option>
                <option value="income">Income</option>
            </select>
        </div>

        <div class="modal-actions">
            <button type="button" class="btn-outline" id="cancelCat">Cancel</button>
            <button type="submit" class="primary-btn">Save</button>
        </div>
    `;

    const cancelBtn = form.querySelector("#cancelCat");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const cat = {
            uuid: `cat-${Date.now()}-${Math.random()}`,
            name: formData.get("name"),
            type: formData.get("type"),
            updated_at: new Date().toISOString(),
            is_deleted: false,
            needs_sync: true,
        };

        storage.upsertLocalCategory(cat);
        storage.saveLocalTransactionsToStorage();
        closeModal(modal, modalBody);

        if (callback) callback();
    });

    cancelBtn.addEventListener("click", () => {
        closeModal(modal, modalBody);
    });

    wrapper.appendChild(form);
    openModal(modalBody, wrapper);
}

export function openAddBudgetModal(modal, modalBody, modalClose, callback) {
    const wrapper = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = "Add Budget";
    wrapper.appendChild(title);

    const form = document.createElement("form");
    form.className = "modal-form";

    form.innerHTML = `
        <div>
            <label>Category</label>
            <select name="category_id" required></select>
        </div>

        <div>
            <label>Budget Amount</label>
            <input type="number" name="amount" step="0.01" min="0" required />
        </div>

        <div class="modal-actions">
            <button type="button" class="btn-outline" id="cancelBudget">Cancel</button>
            <button type="submit" class="primary-btn">Save</button>
        </div>
    `;

    const categorySelect = form.querySelector('select[name="category_id"]');
    const cancelBtn = form.querySelector("#cancelBudget");

    ui.createSelectOptions(
        categorySelect,
        state.localCategories.filter(c => !c.is_deleted && c.type === "expense"),
        false
    );

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        try {
            await apiPost("/api/budgets", {
                category_id: Number(formData.get("category_id")),
                amount: Number(formData.get("amount")),
            });
            closeModal(modal, modalBody);
            if (callback) callback();
        } catch (err) {
            alert("Failed to save budget: " + err.message);
        }
    });

    cancelBtn.addEventListener("click", () => {
        closeModal(modal, modalBody);
    });

    wrapper.appendChild(form);
    openModal(modalBody, wrapper);
}

export function openEditTransactionModal(
    tx,
    modal,
    modalBody,
    modalClose,
    callback
) {
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
            <input type="number" name="amount" step="0.01" min="0" value="${tx.amount}" required />
        </div>

        <div>
            <label>Date</label>
            <input type="date" name="date" value="${tx.date}" required />
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
            <label>Description</label>
            <textarea name="description" rows="2" placeholder="Optional">${tx.description || ""}</textarea>
        </div>

        <div class="modal-actions">
            <button type="button" class="btn-outline" id="cancelEditTx">Cancel</button>
            <button type="submit" class="primary-btn">Update</button>
        </div>
    `;

    const categorySelect = form.querySelector('select[name="category_id"]');
    const accountSelect = form.querySelector('select[name="account_id"]');
    const cancelBtn = form.querySelector("#cancelEditTx");

    ui.createSelectOptions(categorySelect, state.localCategories.filter(c => !c.is_deleted), true);
    ui.createSelectOptions(accountSelect, state.localAccounts.filter(a => !a.is_deleted), true);

    sync.setSelectFromCollection(categorySelect, state.localCategories, tx.category_id);
    sync.setSelectFromCollection(accountSelect, state.localAccounts, tx.account_id);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const updated = {
            ...tx,
            type: formData.get("type"),
            amount: Number(formData.get("amount")),
            date: formData.get("date"),
            category_id: formData.get("category_id") || null,
            account_id: formData.get("account_id") || null,
            description: formData.get("description") || null,
            updated_at: new Date().toISOString(),
            needs_sync: true,
        };

        storage.upsertLocalTransaction(updated);
        storage.saveLocalTransactionsToStorage();
        closeModal(modal, modalBody);

        if (callback) callback();
    });

    cancelBtn.addEventListener("click", () => {
        closeModal(modal, modalBody);
    });

    wrapper.appendChild(form);
    openModal(modalBody, wrapper);
}
