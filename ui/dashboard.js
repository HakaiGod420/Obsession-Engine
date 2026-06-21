import { DASHBOARD_ID, STAGES, MODULE_NAME, state } from '../lib/constants.js';
import { getContextSafely, getCharProfile, getDynamicsData, getStageForLove, getSettings, isChatActive } from '../lib/data.js';

function colorForStat(statName, value) {
    if (statName === 'love' || statName === 'lust') {
        if (value > 80) return '#e91e63';
        if (value > 60) return '#ef5350';
        if (value > 40) return '#ff7043';
        if (value > 20) return '#ffa726';
        return '#66bb6a';
    }
    if (statName === 'hate') {
        if (value > 60) return '#d32f2f';
        if (value > 30) return '#ff5722';
        return '#ff9800';
    }
    if (statName === 'sanity') {
        if (value < 3) return '#d32f2f';
        if (value < 6) return '#ff9800';
        if (value < 8) return '#ffc107';
        return '#66bb6a';
    }
    if (statName === 'trust') {
        if (value > 70) return '#66bb6a';
        if (value > 40) return '#42a5f5';
        if (value > 20) return '#ffa726';
        return '#ef5350';
    }
    if (statName === 'jealousy') {
        if (value > 70) return '#d32f2f';
        if (value > 40) return '#ff7043';
        if (value > 20) return '#ffa726';
        return '#66bb6a';
    }
    return '#90caf9';
}

function formatStatLabel(key) {
    const map = { love: 'Love', lust: 'Lust/Desire', hate: 'Hate/Rivalry', sanity: 'Sanity', trust: 'Trust', jealousy: 'Jealousy' };
    return map[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

function makeGauge(label, value, max, statKey) {
    const wrapper = document.createElement('div');
    wrapper.className = 'oe-dash__gauge';

    const header = document.createElement('div');
    header.className = 'oe-dash__gauge-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'oe-dash__gauge-label';
    nameSpan.textContent = label;

    const valSpan = document.createElement('span');
    valSpan.className = 'oe-dash__gauge-value';
    valSpan.textContent = Math.round(value) + '/' + max;

    header.append(nameSpan, valSpan);

    const barOuter = document.createElement('div');
    barOuter.className = 'oe-dash__gauge-bar';

    const barInner = document.createElement('div');
    barInner.className = 'oe-dash__gauge-fill';
    barInner.style.width = Math.min(100, (value / max) * 100) + '%';
    barInner.style.backgroundColor = colorForStat(statKey, value);
    barInner.title = `${label}: ${Math.round(value)}/${max}`;

    barOuter.append(barInner);
    wrapper.append(header, barOuter);
    return wrapper;
}

function makePersonalityIndicator(label, value, max) {
    const wrapper = document.createElement('div');
    wrapper.className = 'oe-dash__pers';

    const lbl = document.createElement('span');
    lbl.className = 'oe-dash__pers-label';
    lbl.textContent = label;

    const dots = document.createElement('span');
    dots.className = 'oe-dash__pers-dots';
    for (let i = 0; i < max; i++) {
        const dot = document.createElement('span');
        dot.className = 'oe-dash__pers-dot' + (i < value ? ' oe-dash__pers-dot--filled' : '');
        dots.append(dot);
    }

    wrapper.append(lbl, dots);
    return wrapper;
}

export function createDashboard() {
    const existing = document.getElementById(DASHBOARD_ID);
    if (existing) return existing;

    const wrapper = document.createElement('div');
    wrapper.id = DASHBOARD_ID;
    wrapper.className = 'oe-dash';

    const header = document.createElement('div');
    header.className = 'oe-dash__header';

    const title = document.createElement('span');
    title.className = 'oe-dash__title';
    title.textContent = '\u2665 Obsession Engine';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'oe-dash__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close dashboard';

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'obsession_engine_minimize_dash';
    toggleBtn.className = 'oe-dash__toggle';
    toggleBtn.textContent = '\u2013';
    toggleBtn.title = 'Minimize';

    header.append(title, toggleBtn, closeBtn);

    const tabsRow = document.createElement('div');
    tabsRow.id = 'obsession_engine_dash_tabs';
    tabsRow.className = 'oe-dash__tabs';

    const contentArea = document.createElement('div');
    contentArea.id = 'obsession_engine_dash_content';
    contentArea.className = 'oe-dash__content';

    wrapper.append(header, tabsRow, contentArea);
    document.body.append(wrapper);

    return wrapper;
}

export function renderDashboard(context) {
    const dash = document.getElementById(DASHBOARD_ID);
    if (!dash) createDashboard();
    if (!context) context = getContextSafely();
    if (!context) return;

    const tabsRow = document.getElementById('obsession_engine_dash_tabs');
    const contentArea = document.getElementById('obsession_engine_dash_content');

    if (!tabsRow || !contentArea) return;

    if (!isChatActive(context)) {
        tabsRow.innerHTML = '';
        let emptyHtml = '<div class="oe-dash__empty">No chat open. Open a character chat to see dynamics.</div>';
        if (state.aiAnalysisInFlight) {
            emptyHtml += '<div class="oe-dash__loading">\u25CF Analyzing chat stats\u2026</div>';
        }
        contentArea.innerHTML = emptyHtml;
        return;
    }

    const data = getDynamicsData(context);
    const charNames = Object.keys(data.characters || {});

    if (charNames.length === 0) {
        tabsRow.innerHTML = '';
        let emptyHtml = '<div class="oe-dash__empty">No characters in chat. Start a conversation to see dynamics.</div>';
        if (state.aiAnalysisInFlight) {
            emptyHtml += '<div class="oe-dash__loading">\u25CF Analyzing chat stats\u2026</div>';
        }
        contentArea.innerHTML = emptyHtml;
        return;
    }

    tabsRow.innerHTML = '';
    let first = true;
    for (const name of charNames) {
        const tab = document.createElement('button');
        tab.className = 'oe-dash__tab' + (first ? ' oe-dash__tab--active' : '');
        tab.dataset.char = name;
        tab.textContent = name;
        tab.addEventListener('click', () => {
            for (const t of tabsRow.querySelectorAll('.oe-dash__tab')) {
                t.classList.remove('oe-dash__tab--active');
            }
            tab.classList.add('oe-dash__tab--active');
            renderCharContent(context, name, contentArea);
        });
        tabsRow.append(tab);
        if (first) {
            first = false;
            renderCharContent(context, name, contentArea);
        }
    }

    const settings = getSettings(context);
    if (state.aiAnalysisInFlight && settings.connectionProfileId) {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'oe-dash__loading';
        loadingEl.textContent = '\u25CF AI analyzing stats\u2026';
        contentArea.insertBefore(loadingEl, contentArea.firstChild);
    }
}

export function renderCharContent(context, charName, container) {
    container.innerHTML = '';

    const profile = getCharProfile(context, charName);
    if (!profile) {
        container.innerHTML = '<div class="oe-dash__empty">No profile for ' + charName + '</div>';
        return;
    }

    if (!profile.initialized) {
        const uninitDiv = document.createElement('div');
        uninitDiv.className = 'oe-dash__uninit';

        const warning = document.createElement('div');
        warning.className = 'oe-dash__uninit-warn';
        warning.innerHTML = '\u26A0 Not Initialized';
        uninitDiv.append(warning);

        const desc = document.createElement('div');
        desc.className = 'oe-dash__empty';
        desc.style.marginBottom = '0.5rem';
        desc.textContent = 'This character needs initialization. The AI will read the character card description and determine starting stats, personality, and goals.';
        uninitDiv.append(desc);

        const settings = getSettings(context);

        if (!settings.connectionProfileId) {
            const noProfile = document.createElement('div');
            noProfile.className = 'oe-dash__empty';
            noProfile.style.color = '#ff7043';
            noProfile.textContent = 'Select a Connection Profile in the extension settings first.';
            uninitDiv.append(noProfile);
        }

        const initBtn = document.createElement('button');
        initBtn.className = 'menu_button oe-dash__init-btn';
        const shortName = charName.length > 20 ? charName.slice(0, 17) + '\u2026' : charName;
        initBtn.textContent = '\u2728 Initialize ' + shortName;
        initBtn.title = 'Initialize ' + charName;
        initBtn.disabled = !settings.connectionProfileId || state.initInFlight;
        if (state.initInFlight) initBtn.textContent = '\u23F3 Initializing...';
        initBtn.addEventListener('click', async () => {
            initBtn.disabled = true;
            initBtn.textContent = '\u23F3 Initializing...';
            const { initializeCharacter } = await import('../lib/services.js');
            const ctx = getContextSafely();
            if (ctx) {
                await initializeCharacter(ctx, charName);
                const { refreshUI } = await import('./app.js');
                refreshUI();
                renderCharContent(ctx, charName, container);
            }
        });
        uninitDiv.append(initBtn);

        container.append(uninitDiv);
        return;
    }

    const s = profile.stats;
    const p = profile.personality;

    const statsSection = document.createElement('div');
    statsSection.className = 'oe-dash__stats';

    const stage = getStageForLove(s.love);
    if (stage) {
        const stageBadge = document.createElement('div');
        stageBadge.className = 'oe-dash__stage';
        stageBadge.style.borderColor = stage.color;
        stageBadge.style.color = stage.color;
        stageBadge.textContent = '\u2665 ' + stage.label;
        statsSection.append(stageBadge);
    }

    statsSection.append(makeGauge('Love', s.love, 100, 'love'));
    statsSection.append(makeGauge('Lust/Desire', s.lust, 100, 'lust'));
    if (s.hate > 5) {
        statsSection.append(makeGauge('Hate/Rivalry', s.hate, 100, 'hate'));
    }
    statsSection.append(makeGauge('Trust', s.trust, 100, 'trust'));
    statsSection.append(makeGauge('Jealousy', s.jealousy, 100, 'jealousy'));

    const sanityLabel = 'Sanity (' + Math.round(s.sanity) + '/10)';
    statsSection.append(makeGauge(sanityLabel, s.sanity, 10, 'sanity'));

    const im = profile.intensityMultiplier !== undefined ? profile.intensityMultiplier : 1.0;
    const dc = profile.darknessCeiling !== undefined ? profile.darknessCeiling : 10;

    const forceRow = document.createElement('div');
    forceRow.className = 'oe-dash__force-row';

    const forceLabel = document.createElement('span');
    forceLabel.className = 'oe-dash__force-label';
    forceLabel.textContent = 'Force ' + im.toFixed(1) + 'x';

    const darkLabel = document.createElement('span');
    darkLabel.className = 'oe-dash__force-label';
    const darkTier = dc <= 2 ? '\u2601 Mild' : dc <= 4 ? 'Dark' : dc <= 6 ? 'Twisted' : dc <= 8 ? 'Extreme' : '\u2620 Abyssal';
    darkLabel.textContent = 'Darkness ' + dc + '/10 ' + darkTier;
    darkLabel.style.color = dc <= 2 ? '#66bb6a' : dc <= 4 ? '#ffa726' : dc <= 6 ? '#ff7043' : dc <= 8 ? '#ef5350' : '#d32f2f';

    forceRow.append(forceLabel, darkLabel);
    statsSection.append(forceRow);

    container.append(statsSection);

    const divider = document.createElement('hr');
    divider.className = 'oe-dash__divider';
    container.append(divider);

    const personalitySection = document.createElement('div');
    personalitySection.className = 'oe-dash__personality';

    const persTitle = document.createElement('h4');
    persTitle.className = 'oe-dash__section-title';
    persTitle.textContent = 'Personality';
    personalitySection.append(persTitle);

    personalitySection.append(makePersonalityIndicator('Craziness', p.craziness, 10));
    personalitySection.append(makePersonalityIndicator('Manipulation', p.manipulation, 10));
    personalitySection.append(makePersonalityIndicator('Assertiveness', p.assertiveness, 10));
    personalitySection.append(makePersonalityIndicator('Submissiveness', p.submissiveness, 10));
    personalitySection.append(makePersonalityIndicator('Jealousy', p.jealousy, 10));
    personalitySection.append(makePersonalityIndicator('Possessiveness', p.possessiveness, 10));

    container.append(personalitySection);

    const divider2 = document.createElement('hr');
    divider2.className = 'oe-dash__divider';
    container.append(divider2);

    const goalsSection = document.createElement('div');
    goalsSection.className = 'oe-dash__goals';

    const goalsTitle = document.createElement('h4');
    goalsTitle.className = 'oe-dash__section-title';
    goalsTitle.textContent = 'Goals';
    goalsSection.append(goalsTitle);

    const activeGoals = (profile.goals || []).filter(g => !g.completed);
    const completedGoals = (profile.goals || []).filter(g => g.completed);

    if (activeGoals.length === 0 && completedGoals.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'oe-dash__empty';
        empty.textContent = 'No goals set.';
        goalsSection.append(empty);
    }

    for (const goal of activeGoals) {
        const goalRow = document.createElement('div');
        goalRow.className = 'oe-dash__goal';

        const goalInfo = document.createElement('div');
        goalInfo.className = 'oe-dash__goal-info';
        if (goal.hidden) goalInfo.classList.add('oe-dash__goal--hidden');

        const goalTitle = document.createElement('span');
        goalTitle.className = 'oe-dash__goal-title';
        goalTitle.textContent = goal.title + (goal.hidden ? ' \uD83D\uDC41' : '');

        const goalProgress = document.createElement('span');
        goalProgress.className = 'oe-dash__goal-pct';
        goalProgress.textContent = Math.round(goal.progress) + '%';

        goalInfo.append(goalTitle, goalProgress);

        const progressBar = document.createElement('div');
        progressBar.className = 'oe-dash__goal-bar';
        const fill = document.createElement('div');
        fill.className = 'oe-dash__goal-fill';
        fill.style.width = goal.progress + '%';
        if (goal.progress > 80) fill.style.backgroundColor = '#e91e63';
        else if (goal.progress > 50) fill.style.backgroundColor = '#ff7043';
        else fill.style.backgroundColor = '#42a5f5';
        progressBar.append(fill);

        goalRow.append(goalInfo, progressBar);
        goalsSection.append(goalRow);
    }

    if (completedGoals.length > 0) {
        const doneTitle = document.createElement('div');
        doneTitle.className = 'oe-dash__goals-done-title';
        doneTitle.textContent = 'Completed (' + completedGoals.length + ')';
        goalsSection.append(doneTitle);
        for (const goal of completedGoals) {
            const doneRow = document.createElement('div');
            doneRow.className = 'oe-dash__goal-done';
            doneRow.textContent = '\u2714 ' + goal.title;
            goalsSection.append(doneRow);
        }
    }

    container.append(goalsSection);

    const divider3 = document.createElement('hr');
    divider3.className = 'oe-dash__divider';
    container.append(divider3);

    const actionsSection = document.createElement('div');
    actionsSection.className = 'oe-dash__actions';

    const actionsTitle = document.createElement('h4');
    actionsTitle.className = 'oe-dash__section-title';
    actionsTitle.textContent = 'Quick Actions';
    actionsSection.append(actionsTitle);

    const btnRow = document.createElement('div');
    btnRow.className = 'oe-dash__btn-row';

    const affectionBtn = document.createElement('button');
    affectionBtn.className = 'menu_button oe-dash__action-btn';
    affectionBtn.textContent = '\u2665 Boost Affection';
    affectionBtn.dataset.action = 'boost';
    affectionBtn.dataset.char = charName;

    const sceneBtn = document.createElement('button');
    sceneBtn.className = 'menu_button oe-dash__action-btn';
    sceneBtn.textContent = '\uD83D\uDD25 Intimate Scene';
    sceneBtn.dataset.action = 'scene';
    sceneBtn.dataset.char = charName;

    const eventBtn = document.createElement('button');
    eventBtn.className = 'menu_button oe-dash__action-btn';
    eventBtn.textContent = '\uD83C\uDFB2 Random Event';
    eventBtn.dataset.action = 'event';
    eventBtn.dataset.char = charName;

    btnRow.append(affectionBtn, sceneBtn, eventBtn);
    actionsSection.append(btnRow);

    container.append(actionsSection);

    const divider4 = document.createElement('hr');
    divider4.className = 'oe-dash__divider';
    container.append(divider4);

    const logSection = document.createElement('div');
    logSection.className = 'oe-dash__log';

    const logTitle = document.createElement('h4');
    logTitle.className = 'oe-dash__section-title';
    logTitle.textContent = 'Recent Events';
    logSection.append(logTitle);

    const recentLogs = (profile.eventLog || []).slice(0, 5);
    if (recentLogs.length === 0) {
        const emptyLog = document.createElement('div');
        emptyLog.className = 'oe-dash__empty';
        emptyLog.textContent = 'No events yet.';
        logSection.append(emptyLog);
    } else {
        for (const entry of recentLogs) {
            const logRow = document.createElement('div');
            logRow.className = 'oe-dash__log-entry';

            const logTime = document.createElement('span');
            logTime.className = 'oe-dash__log-time';
            const ts = new Date(entry.timestamp);
            logTime.textContent = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const logText = document.createElement('span');
            logText.className = 'oe-dash__log-text';
            logText.textContent = entry.details || entry.eventKey;

            logRow.append(logTime, logText);
            logSection.append(logRow);
        }
    }

    container.append(logSection);

    const divider5 = document.createElement('hr');
    divider5.className = 'oe-dash__divider';
    container.append(divider5);

    const thoughtsSection = document.createElement('div');
    thoughtsSection.className = 'oe-dash__thoughts';

    const thoughtsTitle = document.createElement('h4');
    thoughtsTitle.className = 'oe-dash__section-title';
    thoughtsTitle.textContent = 'Hidden Thoughts';
    thoughtsSection.append(thoughtsTitle);

    const recentThoughts = (profile.thoughts || []).slice(0, 3);
    if (recentThoughts.length === 0) {
        const emptyThoughts = document.createElement('div');
        emptyThoughts.className = 'oe-dash__empty';
        emptyThoughts.textContent = 'No hidden thoughts generated yet.';
        thoughtsSection.append(emptyThoughts);
    } else {
        for (const thought of recentThoughts) {
            const thoughtRow = document.createElement('div');
            thoughtRow.className = 'oe-dash__thought';
            thoughtRow.textContent = '\u201C' + thought.text + '\u201D';
            thoughtsSection.append(thoughtRow);
        }
    }

    container.append(thoughtsSection);
}
