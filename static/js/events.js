// static/js/events.js
// Event delegation and listener setup

import * as loaders from "./loaders.js";
import * as modals from "./modals.js";
import * as state from "./state.js";
import * as storage from "./storage.js";
import * as sync from "./sync.js";
import * as helpers from "./helpers.js";
import * as ui from "./ui.js";

export function setupTabEvents(tabs, sections, loadersMap) {
    tabs.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId, tabs, sections, loadersMap);
        });
    });
}

export function switchTab(tabId, tabs, sections, loadersMap) {
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

    if (loadersMap[tabId]) {
        loadersMap[tabId]();
    }
}

export function setupTimeRangeEvents(
    timeRangeSelect,
    customMonthInput,
    prevMonthBtn,
    nextMonthBtn,
    tabs,
    sections,
    loadersMap
) {
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener("change", () => {
            if (timeRangeSelect.value === "custom") {
                if (customMonthInput) {
                    helpers.ensureCustomMonthInitialized(customMonthInput);
                    customMonthInput.style.display = "inline-block";
                }
            } else if (customMonthInput) {
                customMonthInput.style.display = "none";
            }

            const activeTab = helpers.getActiveTabId();
            if (activeTab && loadersMap[activeTab]) {
                loadersMap[activeTab]();
            }
        });
    }

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener("click", () => {
            helpers.shiftCustomMonth(-1, timeRangeSelect, customMonthInput, (tabId) => {
                if (loadersMap[tabId]) loadersMap[tabId]();
            });
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener("click", () => {
            helpers.shiftCustomMonth(1, timeRangeSelect, customMonthInput, (tabId) => {
                if (loadersMap[tabId]) loadersMap[tabId]();
            });
        });
    }
}

export function setupAddButtonEvents(
    addExpenseBtn,
    addAccountBtn,
    addCategoryBtn,
    addBudgetBtn,
    addTripBtn,
    modal,
    modalBody,
    modalClose,
    loadersMap
) {
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener("click", () => {
            modals.openAddTransactionModal(modal, modalBody, modalClose, () => {
                if (loadersMap.records) loadersMap.records();
            });
        });
    }

    if (addAccountBtn) {
        addAccountBtn.addEventListener("click", () => {
            modals.openAddAccountModal(modal, modalBody, modalClose, () => {
                if (loadersMap.accounts) loadersMap.accounts();
            });
        });
    }

    if (addCategoryBtn) {
        addCategoryBtn.addEventListener("click", () => {
            modals.openAddCategoryModal(modal, modalBody, modalClose, () => {
                if (loadersMap.categories) loadersMap.categories();
            });
        });
    }

    if (addBudgetBtn) {
        addBudgetBtn.addEventListener("click", () => {
            modals.openAddBudgetModal(modal, modalBody, modalClose, () => {
                if (loadersMap.budget) loadersMap.budget();
            });
        });
    }

    if (addTripBtn) {
        addTripBtn.addEventListener("click", () => {
            // Trip modal would go here
            console.log("Add trip clicked");
        });
    }
}

export function setupModalCloseEvents(modal, modalBody, modalClose) {
    if (modalClose) {
        modalClose.addEventListener("click", () => {
            modals.closeModal(modal, modalBody);
        });
    }

    if (modal) {
        modal.addEventListener("mousedown", (e) => {
            if (e.target === modal) {
                modals.closeModal(modal, modalBody);
            }
        });
    }
}

export function setupTransactionListEvents(recordsList, loadersMap) {
    if (!recordsList) return;

    recordsList.addEventListener("click", (e) => {
        const editBtn = e.target.closest(".edit-tx-btn");
        if (editBtn) {
            const uuid = editBtn.dataset.uuid;
            const tx = state.localTransactions.find((t) => t.uuid === uuid);
            if (tx) {
                // Get modal elements from DOM
                const modal = document.getElementById("modalContainer");
                const modalBody = document.getElementById("modalBody");
                const modalClose = document.getElementById("modalClose");
                modals.openEditTransactionModal(tx, modal, modalBody, modalClose, () => {
                    if (loadersMap.records) loadersMap.records();
                });
            }
            return;
        }

        const delBtn = e.target.closest(".delete-tx-btn");
        if (delBtn) {
            const uuid = delBtn.dataset.uuid;
            if (confirm("Delete this transaction?")) {
                const tx = state.localTransactions.find((t) => t.uuid === uuid);
                if (tx) {
                    tx.is_deleted = true;
                    tx.updated_at = new Date().toISOString();
                    tx.needs_sync = true;
                    storage.upsertLocalTransaction(tx);
                    storage.saveLocalTransactionsToStorage();
                    if (loadersMap.records) loadersMap.records();
                }
            }
            return;
        }
    });
}

export function setupAccountListEvents(accountsList, loadersMap) {
    if (!accountsList) return;

    accountsList.addEventListener("click", (e) => {
        const editBtn = e.target.closest(".edit-account-btn");
        if (editBtn) {
            const uuid = editBtn.dataset.uuid;
            const acc = state.localAccounts.find((a) => a.uuid === uuid);
            if (acc) {
                const modal = document.getElementById("modalContainer");
                const modalBody = document.getElementById("modalBody");
                const modalClose = document.getElementById("modalClose");
                // Edit account modal would go here
                console.log("Edit account", acc);
            }
            return;
        }

        const delBtn = e.target.closest(".delete-account-btn");
        if (delBtn) {
            const uuid = delBtn.dataset.uuid;
            if (confirm("Delete this account?")) {
                const acc = state.localAccounts.find((a) => a.uuid === uuid);
                if (acc) {
                    acc.is_deleted = true;
                    acc.updated_at = new Date().toISOString();
                    acc.needs_sync = true;
                    storage.upsertLocalAccount(acc);
                    storage.saveLocalTransactionsToStorage();
                    if (loadersMap.accounts) loadersMap.accounts();
                }
            }
            return;
        }
    });
}

export function setupCategoryListEvents(categoriesList, loadersMap) {
    if (!categoriesList) return;

    categoriesList.addEventListener("click", (e) => {
        const editBtn = e.target.closest(".edit-category-btn");
        if (editBtn) {
            const uuid = editBtn.dataset.uuid;
            const cat = state.localCategories.find((c) => c.uuid === uuid);
            if (cat) {
                // Edit category modal would go here
                console.log("Edit category", cat);
            }
            return;
        }

        const delBtn = e.target.closest(".delete-category-btn");
        if (delBtn) {
            const uuid = delBtn.dataset.uuid;
            if (confirm("Delete this category?")) {
                const cat = state.localCategories.find((c) => c.uuid === uuid);
                if (cat) {
                    cat.is_deleted = true;
                    cat.updated_at = new Date().toISOString();
                    cat.needs_sync = true;
                    storage.upsertLocalCategory(cat);
                    storage.saveLocalTransactionsToStorage();
                    if (loadersMap.categories) loadersMap.categories();
                }
            }
            return;
        }
    });
}

export function setupQuickTemplateEvents(loadersMap) {
    document.addEventListener("quickTemplateClick", (e) => {
        const template = e.detail.template;
        const modal = document.getElementById("modalContainer");
        const modalBody = document.getElementById("modalBody");
        const modalClose = document.getElementById("modalClose");
        modals.openAddTransactionModal(modal, modalBody, modalClose, () => {
            if (loadersMap.records) loadersMap.records();
        });
    });
}

export function setupSyncInterval() {
    // Sync every 30 seconds if online
    setInterval(async () => {
        if (helpers.isOnline()) {
            await sync.syncTransactionsWithServer();
            await sync.syncAccountsWithServer();
            await sync.syncCategoriesWithServer();
        }
    }, 30000);
}
