import { SETTINGS_PANEL_ID, PROFILE_SELECT_ID, PROFILE_STATUS_ID, STAGES, MODULE_NAME } from '../lib/constants.js';

export function makeRow(labelText, htmlFor, children, options) {
    const row = document.createElement('div');
    row.className = 'oe-ext__row' + (options?.setting ? ' oe-ext__row--setting' : '');
    const label = document.createElement('label');
    label.htmlFor = htmlFor;
    label.textContent = labelText;
    row.append(label);
    for (const child of children) row.append(child);
    return row;
}

export function makeTab(tabsContainer, tabId, label, isActive) {
    const tab = document.createElement('button');
    tab.className = 'oe-ext__tab' + (isActive ? ' oe-ext__tab--active' : '');
    tab.dataset.tab = tabId;
    tab.textContent = label;
    tabsContainer.append(tab);
    return tab;
}

export function makeSection(container, sectionId, title, active) {
    const section = document.createElement('div');
    section.className = 'oe-ext__section' + (active ? '' : ' oe-ext__section--hidden');
    section.dataset.section = sectionId;
    const h3 = document.createElement('h3');
    h3.className = 'oe-ext__section-title';
    h3.textContent = title;
    section.append(h3);
    container.append(section);
    return section;
}

export function createSettingsPanel() {
    const wrapper = document.createElement('div');
    wrapper.id = SETTINGS_PANEL_ID;
    wrapper.className = 'oe-ext';

    const drawer = document.createElement('div');
    drawer.className = 'inline-drawer';

    const toggle = document.createElement('div');
    toggle.className = 'inline-drawer-toggle inline-drawer-header';
    const title = document.createElement('b');
    title.textContent = '\u2665 Obsession Engine';
    const icon = document.createElement('div');
    icon.className = 'inline-drawer-icon fa-solid fa-circle-chevron-down down';
    const quickIndicator = document.createElement('span');
    quickIndicator.id = 'obsession_engine_quick_indicator';
    quickIndicator.className = 'oe-ext__indicator';
    toggle.append(title, quickIndicator, icon);

    const content = document.createElement('div');
    content.className = 'inline-drawer-content';

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'oe-ext__tabs';

    makeTab(tabsContainer, 'global', 'Global', true);
    makeTab(tabsContainer, 'chars', 'Characters', false);
    makeTab(tabsContainer, 'scenarios', 'Scenarios', false);
    makeTab(tabsContainer, 'presets', 'Presets', false);

    content.append(tabsContainer);

    const sectionsContainer = document.createElement('div');
    sectionsContainer.className = 'oe-ext__sections';

    const globalSection = makeSection(sectionsContainer, 'global', 'Global Settings', true);
    const charsSection = makeSection(sectionsContainer, 'chars', 'Character Management', false);
    const scenariosSection = makeSection(sectionsContainer, 'scenarios', 'Scenario Library', false);
    const presetsSection = makeSection(sectionsContainer, 'presets', 'Presets & Templates', false);

    // ---- Global Section ----

    const enableCb = document.createElement('input');
    enableCb.id = 'obsession_engine_enabled';
    enableCb.type = 'checkbox';
    enableCb.className = 'oe-ext__checkbox';
    globalSection.append(makeRow('Enabled', enableCb.id, [enableCb], { setting: true }));

    const profileSelect = document.createElement('select');
    profileSelect.id = PROFILE_SELECT_ID;
    profileSelect.className = 'text_pole oe-ext__select';
    const profileStatus = document.createElement('small');
    profileStatus.id = PROFILE_STATUS_ID;
    profileStatus.className = 'oe-ext__status';
    const profileWrapper = document.createElement('div');
    profileWrapper.append(
        makeRow('Connection Profile', PROFILE_SELECT_ID, [profileSelect], { setting: true }),
        profileStatus
    );
    globalSection.append(profileWrapper);

    const autoInjectCb = document.createElement('input');
    autoInjectCb.id = 'obsession_engine_auto_inject';
    autoInjectCb.type = 'checkbox';
    autoInjectCb.className = 'oe-ext__checkbox';
    globalSection.append(makeRow('Auto-Inject Dynamics', autoInjectCb.id, [autoInjectCb], { setting: true }));

    const globalEnableCb = document.createElement('input');
    globalEnableCb.id = 'obsession_engine_global_enabled';
    globalEnableCb.type = 'checkbox';
    globalEnableCb.className = 'oe-ext__checkbox';
    globalSection.append(makeRow('Dynamics Active', globalEnableCb.id, [globalEnableCb], { setting: true }));

    const eventIntervalInput = document.createElement('input');
    eventIntervalInput.id = 'obsession_engine_event_interval';
    eventIntervalInput.type = 'number';
    eventIntervalInput.min = '1';
    eventIntervalInput.max = '50';
    eventIntervalInput.className = 'text_pole oe-ext__number';
    eventIntervalInput.style.width = '5rem';
    globalSection.append(makeRow('Event Interval (msgs)', eventIntervalInput.id, [eventIntervalInput], { setting: true }));

    const eventProbInput = document.createElement('input');
    eventProbInput.id = 'obsession_engine_event_probability';
    eventProbInput.type = 'number';
    eventProbInput.min = '0';
    eventProbInput.max = '1';
    eventProbInput.step = '0.05';
    eventProbInput.className = 'text_pole oe-ext__number';
    eventProbInput.style.width = '5rem';
    globalSection.append(makeRow('Event Probability', eventProbInput.id, [eventProbInput], { setting: true }));

    const divider = document.createElement('hr');
    divider.className = 'oe-ext__divider';
    globalSection.append(divider);

    const dashboardBtn = document.createElement('button');
    dashboardBtn.id = 'obsession_engine_toggle_dashboard';
    dashboardBtn.className = 'menu_button oe-ext__btn oe-ext__btn--dashboard';
    dashboardBtn.textContent = '\u25A2 Toggle Stats Dashboard';
    globalSection.append(dashboardBtn);

    const divider2 = document.createElement('hr');
    divider2.className = 'oe-ext__divider';
    globalSection.append(divider2);

    const exportImportRow = document.createElement('div');
    exportImportRow.className = 'oe-ext__btn-row';

    const exportBtn = document.createElement('button');
    exportBtn.id = 'obsession_engine_export_config';
    exportBtn.className = 'menu_button oe-ext__btn--small';
    exportBtn.textContent = 'Export Config';

    const importBtn = document.createElement('button');
    importBtn.id = 'obsession_engine_import_config';
    importBtn.className = 'menu_button oe-ext__btn--small';
    importBtn.textContent = 'Import Config';

    const migrateBtn = document.createElement('button');
    migrateBtn.id = 'obsession_engine_migrate_prompt';
    migrateBtn.className = 'menu_button oe-ext__btn--small';
    migrateBtn.textContent = 'Migrate Prompt';

    exportImportRow.append(exportBtn, importBtn, migrateBtn);
    globalSection.append(exportImportRow);

    // ---- Character Section ----

    const charList = document.createElement('div');
    charList.id = 'obsession_engine_char_list';
    charList.className = 'oe-ext__char-list';
    charsSection.append(charList);

    const charEmpty = document.createElement('div');
    charEmpty.className = 'oe-ext__empty';
    charEmpty.textContent = 'Open a chat with a character to configure dynamics.';
    charsSection.append(charEmpty);

    // ---- Scenarios Section ----

    const scenarioDesc = document.createElement('p');
    scenarioDesc.className = 'oe-ext__desc';
    scenarioDesc.textContent = 'Define themes and kinks that influence character behavior. Enabled scenarios with intensity 3+ are injected into context.';
    scenariosSection.append(scenarioDesc);

    const scenarioList = document.createElement('div');
    scenarioList.id = 'obsession_engine_scenario_list';
    scenarioList.className = 'oe-ext__scenario-list';
    scenariosSection.append(scenarioList);

    const scenarioAddRow = document.createElement('div');
    scenarioAddRow.className = 'oe-ext__scenario-add';

    const scenarioNameInput = document.createElement('input');
    scenarioNameInput.id = 'obsession_engine_new_scenario_name';
    scenarioNameInput.type = 'text';
    scenarioNameInput.className = 'text_pole oe-ext__scenario-name-input';
    scenarioNameInput.placeholder = 'Scenario name...';

    const scenarioDescInput = document.createElement('input');
    scenarioDescInput.id = 'obsession_engine_new_scenario_desc';
    scenarioDescInput.type = 'text';
    scenarioDescInput.className = 'text_pole oe-ext__scenario-desc-input';
    scenarioDescInput.placeholder = 'Description...';

    const scenarioAddBtn = document.createElement('button');
    scenarioAddBtn.id = 'obsession_engine_add_scenario';
    scenarioAddBtn.className = 'menu_button oe-ext__btn--small';
    scenarioAddBtn.textContent = 'Add';

    scenarioAddRow.append(scenarioNameInput, scenarioDescInput, scenarioAddBtn);
    scenariosSection.append(scenarioAddRow);

    // ---- Presets Section ----

    const presetDesc = document.createElement('p');
    presetDesc.className = 'oe-ext__desc';
    presetDesc.textContent = 'Save and load character configuration presets for quick setup.';
    presetsSection.append(presetDesc);

    const presetList = document.createElement('div');
    presetList.id = 'obsession_engine_preset_list';
    presetList.className = 'oe-ext__preset-list';
    presetsSection.append(presetList);

    const presetSaveRow = document.createElement('div');
    presetSaveRow.className = 'oe-ext__preset-save';
    const presetNameInput = document.createElement('input');
    presetNameInput.id = 'obsession_engine_preset_name';
    presetNameInput.type = 'text';
    presetNameInput.className = 'text_pole oe-ext__preset-name-input';
    presetNameInput.placeholder = 'Preset name...';
    const presetSaveBtn = document.createElement('button');
    presetSaveBtn.id = 'obsession_engine_save_preset';
    presetSaveBtn.className = 'menu_button oe-ext__btn--small';
    presetSaveBtn.textContent = 'Save Current as Preset';
    presetSaveRow.append(presetNameInput, presetSaveBtn);
    presetsSection.append(presetSaveRow);

    // ---- Character Editor Section (appended to charsSection) ----

    const editorWrap = document.createElement('div');
    editorWrap.id = 'obsession_engine_char_editor';
    editorWrap.className = 'oe-ext__char-editor oe-ext__section--hidden';
    charsSection.append(editorWrap);

    content.append(sectionsContainer);
    drawer.append(toggle, content);
    wrapper.append(drawer);
    return wrapper;
}
