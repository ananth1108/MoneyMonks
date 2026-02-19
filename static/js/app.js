// static/js/app.js
// Main application orchestrator - imports and initializes all modules

import {
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    formatCurrency,
    todayISO,
} from "./api.js";

import * as constants from "./constants.js";
import * as state from "./state.js";
import * as storage from "./storage.js";
import * as sync from "./sync.js";
import * as helpers from "./helpers.js";
import * as ui from "./ui.js";
import * as modals from "./modals.js";
import * as loaders from "./loaders.js";
import * as events from "./events.js";

document.addEventListener("DOMContentLoaded", async () => {
    // =====================================================================
    // DOM ELEMENTS SETUP
    // =====================================================================
    const tabs = document.querySelectorAll(constants.DOM_SELECTORS.tabs);
    const sections = document.querySelectorAll(constants.DOM_SELECTORS.sections);

    const prevMonthBtn = document.getElementById(constants.DOM_SELECTORS.prevMonthBtn);
    const nextMonthBtn = document.getElementById(constants.DOM_SELECTORS.nextMonthBtn);

    const timeRangeSelect = document.getElementById(constants.DOM_SELECTORS.timeRangeSelect);
    const customMonthInput = document.getElementById(constants.DOM_SELECTORS.customMonthInput);

    const recordsList = document.getElementById(constants.DOM_SELECTORS.recordsList);
    const budgetList = document.getElementById(constants.DOM_SELECTORS.budgetList);
    const accountsList = document.getElementById(constants.DOM_SELECTORS.accountsList);
    const categoriesList = document.getElementById(constants.DOM_SELECTORS.categoriesList);
    const categoryBreakdown = document.getElementById(constants.DOM_SELECTORS.categoryBreakdown);
    const accountBreakdown = document.getElementById(constants.DOM_SELECTORS.accountBreakdown);
    const recordsStats = document.getElementById(constants.DOM_SELECTORS.recordsStats);

    const sumIncomeEl = document.getElementById(constants.DOM_SELECTORS.sumIncomeEl);
    const sumExpenseEl = document.getElementById(constants.DOM_SELECTORS.sumExpenseEl);
    const sumNetEl = document.getElementById(constants.DOM_SELECTORS.sumNetEl);

    const modal = document.getElementById(constants.DOM_SELECTORS.modal);
    const modalBody = document.getElementById(constants.DOM_SELECTORS.modalBody);
    const modalClose = document.getElementById(constants.DOM_SELECTORS.modalClose);

    const addExpenseBtn = document.getElementById(constants.DOM_SELECTORS.addExpenseBtn);
    const addBudgetBtn = document.getElementById(constants.DOM_SELECTORS.addBudgetBtn);
    const addAccountBtn = document.getElementById(constants.DOM_SELECTORS.addAccountBtn);
    const addCategoryBtn = document.getElementById(constants.DOM_SELECTORS.addCategoryBtn);

    const quickTemplates = document.getElementById(constants.DOM_SELECTORS.quickTemplates);

    const tripsList = document.getElementById(constants.DOM_SELECTORS.tripsList);
    const addTripBtn = document.getElementById(constants.DOM_SELECTORS.addTripBtn);
    const tripsListView = document.getElementById(constants.DOM_SELECTORS.tripsListView);
    const tripDetailsView = document.getElementById(constants.DOM_SELECTORS.tripDetailsView);

    // =====================================================================
    // INITIALIZE LOCAL DATA
    // =====================================================================
    await storage.loadLocalTransactionsFromStorage();

    // =====================================================================
    // LOADER MAP - Maps tab IDs to their loading functions
    // =====================================================================
    const loadersMap = {
        records: () => {
            loaders.loadRecords(recordsList, timeRangeSelect, customMonthInput);
            ui.renderQuickTemplates(quickTemplates);
            ui.renderRecordsStats(recordsStats, timeRangeSelect, customMonthInput);
        },
        analysis: () => {
            loaders.loadAnalysis(
                sumIncomeEl,
                sumExpenseEl,
                sumNetEl,
                categoryBreakdown,
                accountBreakdown,
                timeRangeSelect,
                customMonthInput
            );
        },
        budget: () => loaders.loadBudgets(budgetList),
        accounts: () => loaders.loadAccounts(accountsList, timeRangeSelect, customMonthInput),
        categories: () => loaders.loadCategories(categoriesList, timeRangeSelect, customMonthInput),
        trips: () => loaders.loadTrips(tripsList, tripsListView, tripDetailsView),
    };

    // =====================================================================
    // EVENT SETUP
    // =====================================================================

    // Tab switching
    events.setupTabEvents(tabs, sections, loadersMap);

    // Time range filtering
    events.setupTimeRangeEvents(
        timeRangeSelect,
        customMonthInput,
        prevMonthBtn,
        nextMonthBtn,
        tabs,
        sections,
        loadersMap
    );

    // Add buttons
    events.setupAddButtonEvents(
        addExpenseBtn,
        addAccountBtn,
        addCategoryBtn,
        addBudgetBtn,
        addTripBtn,
        modal,
        modalBody,
        modalClose,
        loadersMap
    );

    // Modal close
    events.setupModalCloseEvents(modal, modalBody, modalClose);

    // Transaction list interactions
    events.setupTransactionListEvents(recordsList, loadersMap);

    // Account list interactions
    events.setupAccountListEvents(accountsList, loadersMap);

    // Category list interactions
    events.setupCategoryListEvents(categoriesList, loadersMap);

    // Quick templates
    events.setupQuickTemplateEvents(loadersMap);

    // =====================================================================
    // INITIAL LOAD
    // =====================================================================

    // Load the default "records" tab
    if (loadersMap.records) {
        loadersMap.records();
    }

    // Setup periodic sync
    events.setupSyncInterval();

    // Initial sync if online
    if (helpers.isOnline()) {
        await sync.syncTransactionsWithServer();
        await sync.syncAccountsWithServer();
        await sync.syncCategoriesWithServer();
    }

    console.log("MoneyMonks app initialized successfully!");
});
