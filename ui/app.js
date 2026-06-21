import {
    SETTINGS_PANEL_ID,
    PROFILE_SELECT_ID,
    PROFILE_STATUS_ID,
    DASHBOARD_ID,
    CONNECTION_PROFILE_EVENTS,
    STAGES,
    MODULE_NAME,
    state,
    DEFAULT_SCENARIOS,
} from '../lib/constants.js';

import {
    getContextSafely,
    getSettings,
    saveSettings,
    getDynamicsData,
    getCharProfile,
    getAllCharProfiles,
    updateCharProfile,
    removeCharProfile,
    addGoal,
    updateGoal,
    deleteGoal,
    getPresets,
    savePreset,
    deletePreset,
    applyPreset,
    exportConfig,
    importConfig,
    setEdge,
    getEdges,
    getActiveCharName,
    saveDynamicsData,
} from '../lib/data.js';

import {
    getConnectionManagerState,
    getSortedProfilesByGroup,
    showToast,
    injectDynamicsContext,
    removeDynamicsContext,
    generateHiddenThoughts,
    generateMigrationPreset,
} from '../lib/services.js';

import {
    processMessage,
    forceAffectionBoost,
    triggerIntimateScene,
    triggerRandomEvent,
} from '../lib/dynamics-engine.js';

import { createSettingsPanel } from './panel.js';
import { createDashboard, renderDashboard, renderCharContent } from './dashboard.js';

// ==================== Status ====================

export function setStatus(text) {
    const el = document.getElementById(PROFILE_STATUS_ID);
    if (el) el.textContent = text;
}

// ==================== Profile Rendering ====================

export function renderConnectionProfileOptions(context, settings) {
    const select = document.getElementById(PROFILE_SELECT_ID);
    if (!select) return;

    const { available, isDisabled, profiles } = getConnectionManagerState(context);
    select.innerHTML = '';

    const def = document.createElement('option');
    def.value = '';
    def.textContent = 'Select a Connection Profile';
    select.append(def);

    if (!available) {
        select.disabled = true;
        setStatus(isDisabled ? 'Connection Manager is disabled.' : 'Connection Manager is unavailable.');
        return;
    }
    select.disabled = false;

    const savedExists = !settings.connectionProfileId || profiles.some(p => p.id === settings.connectionProfileId);
    if (!savedExists) {
        settings.connectionProfileId = '';
        saveSettings(context);
    }

    const grouped = getSortedProfilesByGroup(context, profiles);
    for (const [label, groupProfiles] of grouped.entries()) {
        const group = document.createElement('optgroup');
        group.label = label;
        for (const profile of groupProfiles) {
            const opt = document.createElement('option');
            opt.value = profile.id;
            opt.textContent = profile.name;
            group.append(opt);
        }
        select.append(group);
    }

    select.value = settings.connectionProfileId || '';
    setStatus(profiles.length ? 'Required for AI-powered features (thoughts, migration).' : 'No connection profiles found.');
}

// ==================== Tab Switching ====================

function switchTab(tabId) {
    const container = document.getElementById(SETTINGS_PANEL_ID);
    if (!container) return;

    container.querySelectorAll('.oe-ext__tab').forEach(t => {
        t.classList.toggle('oe-ext__tab--active', t.dataset.tab === tabId);
    });

    container.querySelectorAll('.oe-ext__section').forEach(s => {
        const active = s.dataset.section === tabId;
        if (active) s.classList.remove('oe-ext__section--hidden');
        else s.classList.add('oe-ext__section--hidden');
    });

    if (tabId === 'chars') renderCharacterList();
    if (tabId === 'scenarios') renderScenarioList();
    if (tabId === 'presets') renderPresetList();
}

// ==================== Character List ====================

function renderCharacterList() {
    const context = getContextSafely();
    if (!context) return;

    const list = document.getElementById('obsession_engine_char_list');
    const empty = document.getElementById(SETTINGS_PANEL_ID)?.querySelector('.oe-ext__empty');
    if (!list) return;

    const profiles = getAllCharProfiles(context);

    if (profiles.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = '';
        return;
    }

    if (empty) empty.style.display = 'none';
    list.innerHTML = '';

    for (const profile of profiles) {
        const card = document.createElement('div');
        card.className = 'oe-ext__char-card';

        const header = document.createElement('div');
        header.className = 'oe-ext__char-card-header';

        const name = document.createElement('span');
        name.className = 'oe-ext__char-card-name';
        name.textContent = profile.name || 'Unknown';

        const enabledToggle = document.createElement('input');
        enabledToggle.type = 'checkbox';
        enabledToggle.className = 'oe-ext__char-card-toggle';
        enabledToggle.checked = profile.enabled;
        enabledToggle.title = 'Enable dynamics for this character';
        enabledToggle.addEventListener('change', () => {
            updateCharProfile(context, profile.name, { enabled: enabledToggle.checked });
            const ctx = getContextSafely();
            if (ctx) injectDynamicsContext(ctx);
        });

        header.append(name, enabledToggle);

        const statsPreview = document.createElement('div');
        statsPreview.className = 'oe-ext__char-card-stats';
        const stage = getStageForLove(profile.stats.love);
        statsPreview.textContent = (stage ? stage.label : 'Stranger') +
            ' \u00B7 Love ' + Math.round(profile.stats.love) +
            ' \u00B7 Lust ' + Math.round(profile.stats.lust);

        const actions = document.createElement('div');
        actions.className = 'oe-ext__char-card-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'menu_button oe-ext__btn--small';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCharEditor(context, profile.name);
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'menu_button oe-ext__btn--small oe-ext__btn--danger';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Remove ' + profile.name + '\'s dynamics profile? This cannot be undone.')) {
                removeCharProfile(context, profile.name);
                renderCharacterList();
                showToast('Removed', profile.name + '\'s profile deleted.', 'info');
            }
        });

        actions.append(editBtn, removeBtn);
        card.append(header, statsPreview, actions);
        list.append(card);
    }
}

// ==================== Character Editor ====================

let charEditorModal = null;

function closeCharEditor() {
    if (charEditorModal) {
        charEditorModal.remove();
        charEditorModal = null;
    }
}

function openCharEditor(context, charName) {
    closeCharEditor();
    const profile = getCharProfile(context, charName);
    if (!profile) return;

    const overlay = document.createElement('div');
    overlay.className = 'oe-ext__modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'oe-ext__modal';

    const title = document.createElement('h3');
    title.className = 'oe-ext__modal-title';
    title.textContent = 'Edit: ' + charName;

    modal.append(title);

    const tabsRow = document.createElement('div');
    tabsRow.className = 'oe-ext__tabs oe-ext__tabs--small';

    const tabStats = document.createElement('button');
    tabStats.className = 'oe-ext__tab oe-ext__tab--active';
    tabStats.dataset.tab = 'stats';
    tabStats.textContent = 'Stats';

    const tabPersonality = document.createElement('button');
    tabPersonality.className = 'oe-ext__tab';
    tabPersonality.dataset.tab = 'personality';
    tabPersonality.textContent = 'Personality';

    const tabGoals = document.createElement('button');
    tabGoals.className = 'oe-ext__tab';
    tabGoals.dataset.tab = 'goals';
    tabGoals.textContent = 'Goals';

    const tabScenarios = document.createElement('button');
    tabScenarios.className = 'oe-ext__tab';
    tabScenarios.dataset.tab = 'scenarios';
    tabScenarios.textContent = 'Scenarios';

    tabsRow.append(tabStats, tabPersonality, tabGoals, tabScenarios);
    modal.append(tabsRow);

    const sectionsWrap = document.createElement('div');
    sectionsWrap.className = 'oe-ext__modal-sections';

    function makeSlider(label, id, value, min, max, step, section) {
        const row = document.createElement('div');
        row.className = 'oe-ext__slider-row';

        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.className = 'oe-ext__slider-label';

        const input = document.createElement('input');
        input.type = 'range';
        input.id = id;
        input.min = min;
        input.max = max;
        input.step = step || 1;
        input.value = value;
        input.className = 'oe-ext__slider';

        const valDisplay = document.createElement('span');
        valDisplay.className = 'oe-ext__slider-value';
        valDisplay.textContent = value;

        input.addEventListener('input', () => {
            valDisplay.textContent = input.value;
        });

        row.append(lbl, input, valDisplay);
        section.append(row);
        return { input, valDisplay };
    }

    // ---- Stats Tab ----
    const statsSection = document.createElement('div');
    statsSection.className = 'oe-ext__section';
    statsSection.dataset.section = 'stats';

    const statFields = {};
    statFields.love = makeSlider('Love', 'oe_edit_love', profile.stats.love, 0, 100, 1, statsSection);
    statFields.lust = makeSlider('Lust/Desire', 'oe_edit_lust', profile.stats.lust, 0, 100, 1, statsSection);
    statFields.hate = makeSlider('Hate/Rivalry', 'oe_edit_hate', profile.stats.hate, 0, 100, 1, statsSection);
    statFields.trust = makeSlider('Trust', 'oe_edit_trust', profile.stats.trust, 0, 100, 1, statsSection);
    statFields.jealousy = makeSlider('Jealousy', 'oe_edit_jealousy', profile.stats.jealousy, 0, 100, 1, statsSection);
    statFields.sanity = makeSlider('Sanity', 'oe_edit_sanity', profile.stats.sanity, 1, 10, 1, statsSection);

    const growthSlider = makeSlider('Growth Rate', 'oe_edit_growth', profile.growthRate, 0, 5, 0.1, statsSection);
    const toneSlider = makeSlider('Tone (Dark/Good)', 'oe_edit_tone', profile.tone, -5, 5, 1, statsSection);

    // ---- Personality Tab ----
    const personalitySection = document.createElement('div');
    personalitySection.className = 'oe-ext__section oe-ext__section--hidden';
    personalitySection.dataset.section = 'personality';

    const persFields = {};
    persFields.craziness = makeSlider('Craziness', 'oe_edit_craziness', profile.personality.craziness, 0, 10, 1, personalitySection);
    persFields.manipulation = makeSlider('Manipulation', 'oe_edit_manipulation', profile.personality.manipulation, 0, 10, 1, personalitySection);
    persFields.assertiveness = makeSlider('Assertiveness', 'oe_edit_assertiveness', profile.personality.assertiveness, 0, 10, 1, personalitySection);
    persFields.submissiveness = makeSlider('Submissiveness', 'oe_edit_submissiveness', profile.personality.submissiveness, 0, 10, 1, personalitySection);
    persFields.jealousy = makeSlider('Jealousy (personality)', 'oe_edit_pers_jealousy', profile.personality.jealousy, 0, 10, 1, personalitySection);
    persFields.possessiveness = makeSlider('Possessiveness', 'oe_edit_possessiveness', profile.personality.possessiveness, 0, 10, 1, personalitySection);

    // ---- Goals Tab ----
    const goalsSection = document.createElement('div');
    goalsSection.className = 'oe-ext__section oe-ext__section--hidden';
    goalsSection.dataset.section = 'goals';

    const goalsList = document.createElement('div');
    goalsList.className = 'oe-ext__goals-list';
    goalsSection.append(goalsList);

    function renderGoalsEditor() {
        const p = getCharProfile(context, charName);
        if (!p) return;
        goalsList.innerHTML = '';

        for (const goal of (p.goals || [])) {
            const row = document.createElement('div');
            row.className = 'oe-ext__goal-editor-row';

            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'text_pole oe-ext__goal-title-input';
            titleInput.value = goal.title;
            titleInput.addEventListener('change', () => {
                updateGoal(context, charName, goal.id, { title: titleInput.value });
            });

            const progressInput = document.createElement('input');
            progressInput.type = 'number';
            progressInput.className = 'text_pole oe-ext__goal-pct-input';
            progressInput.value = goal.progress;
            progressInput.min = 0;
            progressInput.max = 100;
            progressInput.addEventListener('change', () => {
                updateGoal(context, charName, goal.id, { progress: parseInt(progressInput.value) || 0 });
            });

            const hiddenCb = document.createElement('input');
            hiddenCb.type = 'checkbox';
            hiddenCb.className = 'oe-ext__checkbox';
            hiddenCb.checked = goal.hidden;
            hiddenCb.title = 'Hidden goal';
            hiddenCb.addEventListener('change', () => {
                updateGoal(context, charName, goal.id, { hidden: hiddenCb.checked });
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'menu_button oe-ext__btn--small oe-ext__btn--danger';
            delBtn.textContent = 'X';
            delBtn.addEventListener('click', () => {
                deleteGoal(context, charName, goal.id);
                renderGoalsEditor();
            });

            row.append(titleInput, progressInput, hiddenCb, delBtn);
            goalsList.append(row);
        }

        const addRow = document.createElement('div');
        addRow.className = 'oe-ext__goal-editor-row';

        const newTitleInput = document.createElement('input');
        newTitleInput.type = 'text';
        newTitleInput.className = 'text_pole oe-ext__goal-title-input';
        newTitleInput.placeholder = 'New goal...';

        const newDescInput = document.createElement('input');
        newDescInput.type = 'text';
        newDescInput.className = 'text_pole oe-ext__goal-title-input';
        newDescInput.placeholder = 'Description...';

        const addBtn = document.createElement('button');
        addBtn.className = 'menu_button oe-ext__btn--small';
        addBtn.textContent = 'Add Goal';
        addBtn.addEventListener('click', () => {
            if (newTitleInput.value.trim()) {
                addGoal(context, charName, {
                    title: newTitleInput.value.trim(),
                    description: newDescInput.value.trim(),
                    progress: 0,
                    hidden: false,
                });
                newTitleInput.value = '';
                newDescInput.value = '';
                renderGoalsEditor();
            }
        });

        addRow.append(newTitleInput, newDescInput, addBtn);
        goalsList.append(addRow);
    }

    renderGoalsEditor();

    // ---- Scenarios Tab ----
    const scenariosSection = document.createElement('div');
    scenariosSection.className = 'oe-ext__section oe-ext__section--hidden';
    scenariosSection.dataset.section = 'scenarios';

    function renderCharScenarios() {
        scenariosSection.innerHTML = '';
        const p = getCharProfile(context, charName);
        if (!p) return;

        const settings = getSettings(context);
        const allScenarios = settings.scenarios || [];

        for (const scenario of allScenarios) {
            const row = document.createElement('div');
            row.className = 'oe-ext__scenario-row';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'oe-ext__checkbox';
            cb.checked = p.scenarios[scenario.id]?.enabled || false;
            cb.addEventListener('change', () => {
                updateCharProfile(context, charName, {
                    scenarios: {
                        ...p.scenarios,
                        [scenario.id]: { enabled: cb.checked, intensity: p.scenarios[scenario.id]?.intensity || 5 },
                    },
                });
            });

            const lbl = document.createElement('label');
            lbl.textContent = scenario.name;
            lbl.className = 'oe-ext__scenario-label';

            const intensitySlider = document.createElement('input');
            intensitySlider.type = 'range';
            intensitySlider.className = 'oe-ext__slider oe-ext__slider--small';
            intensitySlider.min = 1;
            intensitySlider.max = 10;
            intensitySlider.value = p.scenarios[scenario.id]?.intensity || 5;
            intensitySlider.addEventListener('input', () => {
                updateCharProfile(context, charName, {
                    scenarios: {
                        ...p.scenarios,
                        [scenario.id]: { enabled: p.scenarios[scenario.id]?.enabled || true, intensity: parseInt(intensitySlider.value) },
                    },
                });
            });

            row.append(cb, lbl, intensitySlider);
            scenariosSection.append(row);
        }
    }

    renderCharScenarios();

    sectionsWrap.append(statsSection, personalitySection, goalsSection, scenariosSection);
    modal.append(sectionsWrap);

    modal.querySelectorAll('.oe-ext__tab').forEach(tab => {
        tab.addEventListener('click', () => {
            modal.querySelectorAll('.oe-ext__tab').forEach(t => t.classList.remove('oe-ext__tab--active'));
            tab.classList.add('oe-ext__tab--active');
            modal.querySelectorAll('.oe-ext__section').forEach(s => {
                s.classList.toggle('oe-ext__section--hidden', s.dataset.section !== tab.dataset.tab);
            });
        });
    });

    const btnRow = document.createElement('div');
    btnRow.className = 'oe-ext__modal-btn-row';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'menu_button';
    cancelBtn.textContent = 'Close';
    cancelBtn.addEventListener('click', closeCharEditor);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'menu_button oe-ext__btn--save';
    saveBtn.textContent = 'Save Changes';
    saveBtn.addEventListener('click', () => {
        const s = profile.stats;
        s.love = parseInt(statFields.love.input.value);
        s.lust = parseInt(statFields.lust.input.value);
        s.hate = parseInt(statFields.hate.input.value);
        s.trust = parseInt(statFields.trust.input.value);
        s.jealousy = parseInt(statFields.jealousy.input.value);
        s.sanity = parseInt(statFields.sanity.input.value);

        profile.growthRate = parseFloat(growthSlider.input.value);
        profile.tone = parseInt(toneSlider.input.value);

        const pe = profile.personality;
        pe.craziness = parseInt(persFields.craziness.input.value);
        pe.manipulation = parseInt(persFields.manipulation.input.value);
        pe.assertiveness = parseInt(persFields.assertiveness.input.value);
        pe.submissiveness = parseInt(persFields.submissiveness.input.value);
        pe.jealousy = parseInt(persFields.jealousy.input.value);
        pe.possessiveness = parseInt(persFields.possessiveness.input.value);

        saveDynamicsData(context);
        closeCharEditor();
        const ctx = getContextSafely();
        if (ctx) injectDynamicsContext(ctx);
        refreshUI();
        showToast('Saved', charName + '\'s profile updated.', 'success');
    });

    btnRow.append(cancelBtn, saveBtn);
    modal.append(btnRow);

    overlay.append(modal);
    document.body.append(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeCharEditor();
    });

    charEditorModal = overlay;
}

// ==================== Scenario List ====================

function renderScenarioList() {
    const context = getContextSafely();
    if (!context) return;

    const settings = getSettings(context);
    const list = document.getElementById('obsession_engine_scenario_list');
    if (!list) return;

    if (!Array.isArray(settings.scenarios)) settings.scenarios = [];
    list.innerHTML = '';

    for (const scenario of settings.scenarios) {
        const row = document.createElement('div');
        row.className = 'oe-ext__scenario-row';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'oe-ext__scenario-name';
        nameSpan.textContent = scenario.name;

        const descSpan = document.createElement('span');
        descSpan.className = 'oe-ext__scenario-desc';
        descSpan.textContent = scenario.description || '';

        const delBtn = document.createElement('button');
        delBtn.className = 'menu_button oe-ext__btn--small oe-ext__btn--danger';
        delBtn.textContent = 'X';
        delBtn.addEventListener('click', () => {
            settings.scenarios = settings.scenarios.filter(s => s.id !== scenario.id);
            saveSettings(context);
            renderScenarioList();
        });

        row.append(nameSpan, descSpan, delBtn);
        list.append(row);
    }
}

// ==================== Preset List ====================

function renderPresetList() {
    const context = getContextSafely();
    if (!context) return;

    const presets = getPresets(context);
    const list = document.getElementById('obsession_engine_preset_list');
    if (!list) return;

    list.innerHTML = '';

    if (presets.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'oe-ext__empty';
        empty.textContent = 'No presets saved yet. Configure a character and save as preset.';
        list.append(empty);
        return;
    }

    for (const preset of presets) {
        const row = document.createElement('div');
        row.className = 'oe-ext__preset-row';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'oe-ext__preset-name';
        nameSpan.textContent = preset.name;

        const infoSpan = document.createElement('span');
        infoSpan.className = 'oe-ext__preset-info';
        const toneLabel = preset.tone >= 3 ? 'Dark' : preset.tone <= -3 ? 'Wholesome' : 'Neutral';
        infoSpan.textContent = toneLabel + ' \u00B7 Love ' + preset.stats.love;

        const applyBtn = document.createElement('button');
        applyBtn.className = 'menu_button oe-ext__btn--small';
        applyBtn.textContent = 'Apply';
        applyBtn.addEventListener('click', () => {
            const charName = getActiveCharName(context);
            if (!charName) {
                showToast('Error', 'No active character to apply preset to.', 'error');
                return;
            }
            applyPreset(context, charName, preset.id);
            showToast('Applied', 'Preset "' + preset.name + '" applied to ' + charName, 'success');
            refreshUI();
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'menu_button oe-ext__btn--small oe-ext__btn--danger';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => {
            if (confirm('Delete preset "' + preset.name + '"?')) {
                deletePreset(context, preset.id);
                renderPresetList();
                showToast('Deleted', 'Preset removed.', 'info');
            }
        });

        row.append(nameSpan, infoSpan, applyBtn, delBtn);
        list.append(row);
    }
}

// ==================== Dashboard ====================

export function toggleDashboard() {
    const dash = document.getElementById(DASHBOARD_ID);
    if (dash) {
        if (dash.style.display === 'none') {
            dash.style.display = '';
            state.dashboardOpen = true;
        } else {
            dash.style.display = 'none';
            state.dashboardOpen = false;
        }
    } else {
        const newDash = createDashboard();
        const context = getContextSafely();
        if (context) renderDashboard(context);
        state.dashboardOpen = true;
    }
}

function bindDashboardEvents() {
    const dash = document.getElementById(DASHBOARD_ID);
    if (!dash || dash.dataset.oeDashBound) return;
    dash.dataset.oeDashBound = 'true';

    const closeBtn = dash.querySelector('.oe-dash__close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            dash.style.display = 'none';
            state.dashboardOpen = false;
        });
    }

    const toggleBtn = document.getElementById('obsession_engine_minimize_dash');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const content = document.getElementById('obsession_engine_dash_content');
            const tabs = document.getElementById('obsession_engine_dash_tabs');
            if (content) content.style.display = content.style.display === 'none' ? '' : 'none';
            if (tabs) tabs.style.display = tabs.style.display === 'none' ? '' : 'none';
        });
    }

    dash.addEventListener('click', (e) => {
        const btn = e.target.closest('.oe-dash__action-btn');
        if (!btn) return;

        const context = getContextSafely();
        if (!context) return;

        const charName = btn.dataset.char;
        const action = btn.dataset.action;

        switch (action) {
            case 'boost':
                forceAffectionBoost(context, charName, 10);
                showToast('Boosted', charName + ': Affection +10, Lust +6', 'success');
                refreshUI();
                break;
            case 'scene':
                triggerIntimateScene(context, charName);
                showToast('Scene Triggered', charName + ': Lust +20, Love +5', 'success');
                refreshUI();
                break;
            case 'event':
                const event = triggerRandomEvent(context, charName);
                if (event) {
                    refreshUI();
                }
                break;
        }
    });
}

// ==================== Refresh UI ====================

export function refreshUI() {
    const context = getContextSafely();
    if (!context) return;

    const settings = getSettings(context);
    const data = getDynamicsData(context);

    const el = (id) => document.getElementById(id);

    const enabledCb = el('obsession_engine_enabled');
    if (enabledCb) enabledCb.checked = settings.enabled;

    const autoInjectCb = el('obsession_engine_auto_inject');
    if (autoInjectCb) autoInjectCb.checked = settings.autoInject;

    const globalEnabledCb = el('obsession_engine_global_enabled');
    if (globalEnabledCb) globalEnabledCb.checked = data.global.enabled;

    const intervalInput = el('obsession_engine_event_interval');
    if (intervalInput) intervalInput.value = settings.eventInterval;

    const probInput = el('obsession_engine_event_probability');
    if (probInput) probInput.value = settings.eventProbability;

    renderConnectionProfileOptions(context, settings);

    const quickIndicator = el('obsession_engine_quick_indicator');
    if (quickIndicator) {
        const count = Object.keys(data.characters || {}).length;
        quickIndicator.textContent = count > 0 ? '(' + count + ' chars)' : '';
    }

    const dash = el(DASHBOARD_ID);
    if (dash && state.dashboardOpen) {
        renderDashboard(context);
        bindDashboardEvents();
    }
}

// ==================== Event Binding ====================

function bindEvents(context, settings) {
    const bind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el && !el.dataset.oeBound) {
            el.dataset.oeBound = 'true';
            el.addEventListener(event, handler);
        }
    };

    bind('obsession_engine_enabled', 'change', function () {
        settings.enabled = this.checked;
        saveSettings(context);
        if (settings.enabled && settings.autoInject) {
            injectDynamicsContext(context);
        } else {
            removeDynamicsContext();
        }
        refreshUI();
    });

    bind(PROFILE_SELECT_ID, 'change', function () {
        settings.connectionProfileId = this.value;
        saveSettings(context);
    });

    bind('obsession_engine_auto_inject', 'change', function () {
        settings.autoInject = this.checked;
        saveSettings(context);
        if (settings.autoInject && settings.enabled) {
            injectDynamicsContext(context);
        } else {
            removeDynamicsContext();
        }
    });

    bind('obsession_engine_global_enabled', 'change', function () {
        const data = getDynamicsData(context);
        data.global.enabled = this.checked;
        saveDynamicsData(context);
        if (data.global.enabled && settings.enabled && settings.autoInject) {
            injectDynamicsContext(context);
        } else {
            removeDynamicsContext();
        }
    });

    bind('obsession_engine_event_interval', 'change', function () {
        settings.eventInterval = parseInt(this.value) || 5;
        saveSettings(context);
    });

    bind('obsession_engine_event_probability', 'change', function () {
        settings.eventProbability = parseFloat(this.value) || 0.2;
        saveSettings(context);
    });

    bind('obsession_engine_toggle_dashboard', 'click', () => {
        toggleDashboard();
    });

    bind('obsession_engine_save_preset', 'click', () => {
        const nameInput = document.getElementById('obsession_engine_preset_name');
        const name = nameInput?.value?.trim();
        if (!name) {
            showToast('Error', 'Enter a preset name.', 'error');
            return;
        }
        const charName = getActiveCharName(context);
        if (!charName) {
            showToast('Error', 'No character in current chat.', 'error');
            return;
        }
        const profile = getCharProfile(context, charName);
        if (!profile) return;
        savePreset(context, name, profile);
        nameInput.value = '';
        renderPresetList();
        showToast('Saved', 'Preset "' + name + '" saved.', 'success');
    });

    bind('obsession_engine_export_config', 'click', () => {
        const charName = getActiveCharName(context);
        if (!charName) {
            showToast('Error', 'No character to export.', 'error');
            return;
        }
        const config = exportConfig(context, charName);
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = charName.replace(/[^a-z0-9]/gi, '_') + '_obsession_config.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Exported', charName + ' config exported.', 'success');
    });

    bind('obsession_engine_import_config', 'click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', async () => {
            const file = input.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const config = JSON.parse(text);
                const charName = getActiveCharName(context);
                if (!charName) {
                    showToast('Error', 'No character to import to.', 'error');
                    return;
                }
                if (importConfig(context, charName, config)) {
                    refreshUI();
                    injectDynamicsContext(context);
                    showToast('Imported', 'Config imported to ' + charName, 'success');
                } else {
                    showToast('Error', 'Invalid config file.', 'error');
                }
            } catch (err) {
                showToast('Error', 'Failed to parse config: ' + err.message, 'error');
            }
        });
        input.click();
    });

    bind('obsession_engine_migrate_prompt', 'click', async () => {
        const charName = getActiveCharName(context);
        if (!charName) {
            showToast('Error', 'No active character.', 'error');
            return;
        }
        if (!settings.connectionProfileId) {
            showToast('Error', 'Select a Connection Profile first (for AI analysis).', 'error');
            return;
        }

        const userPrompt = prompt('Paste your existing system prompt to migrate:', '');
        if (!userPrompt?.trim()) return;

        showToast('Migrating', 'Analyzing prompt with AI...', 'info');

        try {
            const result = await generateMigrationPreset(context, userPrompt);
            if (result) {
                const suggestedName = result.suggestedPreset || 'Migrated Preset';

                if (result.stats) {
                    updateCharProfile(context, charName, { stats: result.stats });
                }
                if (result.personality) {
                    updateCharProfile(context, charName, { personality: result.personality });
                }
                if (result.tone !== undefined) {
                    updateCharProfile(context, charName, { tone: result.tone });
                }

                savePreset(context, suggestedName, getCharProfile(context, charName));

                let msg = suggestedName + ' created.';
                if (result.extractedRules) {
                    msg += '\n\nExtracted Rules:\n' + result.extractedRules.map(r => '\u2022 ' + r).join('\n');
                }

                refreshUI();
                injectDynamicsContext(context);
                showToast('Migrated', msg, 'success');
            } else {
                showToast('Error', 'Migration failed. Check connection profile and try again.', 'error');
            }
        } catch (err) {
            showToast('Error', 'Migration error: ' + err.message, 'error');
        }
    });

    bind('obsession_engine_add_scenario', 'click', () => {
        const nameInput = document.getElementById('obsession_engine_new_scenario_name');
        const descInput = document.getElementById('obsession_engine_new_scenario_desc');
        const name = nameInput?.value?.trim();
        if (!name) return;

        if (!Array.isArray(settings.scenarios)) settings.scenarios = [];
        settings.scenarios.push({
            id: '__custom_' + Date.now(),
            name,
            description: descInput?.value?.trim() || '',
        });
        saveSettings(context);
        nameInput.value = '';
        descInput.value = '';
        renderScenarioList();
        showToast('Added', 'Scenario "' + name + '" added.', 'success');
    });

    const settingsPanel = document.getElementById(SETTINGS_PANEL_ID);
    if (settingsPanel && !settingsPanel.dataset.oeTabsBound) {
        settingsPanel.dataset.oeTabsBound = 'true';
        settingsPanel.addEventListener('click', (e) => {
            const tab = e.target.closest('.oe-ext__tab');
            if (tab && tab.dataset.tab) {
                switchTab(tab.dataset.tab);
            }
        });
    }
}

function bindConnectionProfileEvents(context) {
    if (!context?.eventSource || !context?.eventTypes || state.profileEventsBound) return;
    for (const eventName of CONNECTION_PROFILE_EVENTS) {
        const eventType = context.eventTypes[eventName];
        if (!eventType) continue;
        context.eventSource.on(eventType, () => refreshUI());
    }
    state.profileEventsBound = true;
}

export function initUI(context, settings) {
    if (!ensureSettingsPanel()) return false;
    bindEvents(context, settings);
    bindConnectionProfileEvents(context);
    refreshUI();
    return true;
}

export function bindChatEvents(context) {
    if (!context?.eventSource || !context?.eventTypes || state.chatEventsBound) return;

    const cc = context.eventTypes.CHAT_CHANGED;
    if (cc) {
        context.eventSource.on(cc, () => {
            const ctx = getContextSafely();
            if (!ctx) return;
            const settings = getSettings(ctx);
            const data = getDynamicsData(ctx);
            if (settings.enabled && settings.autoInject && data.global.enabled) {
                injectDynamicsContext(ctx);
            }
            refreshUI();
        });
    }

    const ms = context.eventTypes.MESSAGE_SENT;
    if (ms) {
        context.eventSource.on(ms, (data) => {
            const ctx = getContextSafely();
            if (!ctx) return;

            if (data?.message) {
                processMessage(ctx, {
                    name: data.message.name || data.message.character,
                    mes: data.message.mes || data.message.message || data.message.content,
                    is_user: data.message.is_user,
                });
            }

            refreshUI();
        });
    }

    state.chatEventsBound = true;
}

// ==================== Panel Init ====================

function getSettingsContainer() {
    return document.getElementById('extensions_settings') || document.getElementById('extensions_settings2');
}

export function ensureSettingsPanel() {
    let panel = document.getElementById(SETTINGS_PANEL_ID);
    if (panel) return panel;
    const container = getSettingsContainer();
    if (!container) return null;
    panel = createSettingsPanel();
    container.append(panel);
    return panel;
}
