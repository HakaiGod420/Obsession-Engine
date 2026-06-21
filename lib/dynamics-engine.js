import {
    EVENT_POOL,
    STAGES,
    NSFW_KEYWORDS,
} from './constants.js';

import {
    getContextSafely,
    getSettings,
    getDynamicsData,
    getCharProfile,
    getAllCharProfiles,
    updateCharProfile,
    adjustCharStat,
    saveDynamicsData,
    addEventLogEntry,
    getStageForLove,
} from './data.js';

import {
    injectDynamicsContext,
    showToast,
} from './services.js';

function isNSFWMessage(messageText) {
    if (!messageText) return false;
    const lower = messageText.toLowerCase();
    let hits = 0;
    for (const kw of NSFW_KEYWORDS) {
        if (lower.includes(kw)) hits++;
        if (hits >= 3) return true;
    }
    return hits >= 2;
}

export function getStageForLoveValue(love) {
    for (let i = 0; i < STAGES.length; i++) {
        if (love >= STAGES[i].loveMin && love < STAGES[i].loveMax) return STAGES[i];
    }
    return STAGES[STAGES.length - 1];
}

export function resolveStage(context, charName) {
    const profile = getCharProfile(context, charName);
    if (!profile) return null;
    const love = profile.stats.love;
    return getStageForLoveValue(love);
}

export function applyPostIntimacyBoost(context, charName) {
    const profile = getCharProfile(context, charName);
    if (!profile) return;

    const growthRate = profile.growthRate || 0.5;
    const loveBoost = Math.round(2 * growthRate);
    const lustBoost = Math.round(3 * growthRate);
    const trustBoost = Math.round(1 * growthRate);

    adjustCharStat(context, charName, 'love', loveBoost);
    adjustCharStat(context, charName, 'lust', lustBoost);
    adjustCharStat(context, charName, 'trust', trustBoost);

    addEventLogEntry(context, charName, 'post_intimacy_boost',
        `Love +${loveBoost}, Lust +${lustBoost}, Trust +${trustBoost}`
    );

    const stage = getStageForLoveValue(profile.stats.love + loveBoost);
    if (stage) {
        addEventLogEntry(context, charName, 'stage_update',
            `Relationship stage: ${stage.label}`
        );
    }
}

export function applyStatDecay(context, charName) {
    const profile = getCharProfile(context, charName);
    if (!profile || !profile.enabled) return;

    const decay = 0.5;
    let changed = false;

    if (profile.stats.lust > 20) {
        profile.stats.lust = Math.max(0, profile.stats.lust - decay);
        changed = true;
    }
    if (profile.stats.jealousy > 5) {
        profile.stats.jealousy = Math.max(0, profile.stats.jealousy - decay * 0.5);
        changed = true;
    }
    if (profile.stats.sanity < 10 && profile.personality.craziness < 8) {
        profile.stats.sanity = Math.min(10, profile.stats.sanity + 0.2);
        changed = true;
    }

    if (changed) saveDynamicsData(context);
}

export function evaluateRandomEvent(context, charName) {
    const settings = getSettings(context);
    const profile = getCharProfile(context, charName);
    if (!profile || !profile.enabled) return null;

    const roll = Math.random();
    if (roll > settings.eventProbability) return null;

    const eligibleEvents = EVENT_POOL.filter(ev => {
        if (ev.minCraziness && profile.personality.craziness < ev.minCraziness) return false;
        if (ev.minLust && profile.stats.lust < ev.minLust) return false;
        if (ev.minLove && profile.stats.love < ev.minLove) return false;
        if (ev.minJealousy && profile.stats.jealousy < ev.minJealousy) return false;
        if (ev.minManipulation && profile.personality.manipulation < ev.minManipulation) return false;
        if (ev.minPossessiveness && profile.personality.possessiveness < ev.minPossessiveness) return false;
        return true;
    });

    if (eligibleEvents.length === 0) return null;

    const event = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];

    if (event.statEffects) {
        for (const [stat, delta] of Object.entries(event.statEffects)) {
            adjustCharStat(context, charName, stat, delta);
        }
    }

    addEventLogEntry(context, charName, event.key,
        `${event.description} (${Object.entries(event.statEffects || {}).map(([s, d]) => `${s} ${d > 0 ? '+' : ''}${d}`).join(', ')})`
    );

    const statDiffs = Object.entries(event.statEffects || {})
        .map(([s, d]) => `${s} ${d > 0 ? '+' : ''}${d}`).join(', ');
    showToast('Random Event', `${profile.name}: ${event.description} (${statDiffs})`, 'info');

    return event;
}

export function processMessage(context, lastMessage) {
    if (!context || !lastMessage) return;

    const data = getDynamicsData(context);
    if (!data.global.enabled) return;

    const charName = lastMessage.name || lastMessage.character;
    if (!charName || lastMessage.is_user) return;

    data.global.msgCount = (data.global.msgCount || 0) + 1;

    const profile = getCharProfile(context, charName);
    if (!profile || !profile.enabled) return;

    profile.messagesSinceEvent = (profile.messagesSinceEvent || 0) + 1;

    const settings = getSettings(context);
    const interval = settings.eventInterval || 5;

    if (profile.messagesSinceEvent >= interval) {
        const event = evaluateRandomEvent(context, charName);
        if (event) {
            profile.messagesSinceEvent = 0;
        } else {
            profile.messagesSinceEvent = Math.floor(interval / 2);
        }
    }

    applyStatDecay(context, charName);

    const messageText = lastMessage.mes || lastMessage.message || lastMessage.content || '';
    if (messageText && isNSFWMessage(messageText)) {
        applyPostIntimacyBoost(context, charName);
    }

    profile.stats.love = Math.min(100, profile.stats.love + profile.growthRate * 0.1);

    saveDynamicsData(context);

    if (settings.autoInject) {
        injectDynamicsContext(context);
    }
}

export function forceAffectionBoost(context, charName, amount) {
    if (!amount) amount = 10;
    adjustCharStat(context, charName, 'love', amount);
    adjustCharStat(context, charName, 'lust', Math.round(amount * 0.6));
    addEventLogEntry(context, charName, 'manual_boost',
        `Manual affection boost: Love +${amount}, Lust +${Math.round(amount * 0.6)}`
    );
    const ctx = context || getContextSafely();
    if (ctx) injectDynamicsContext(ctx);
}

export function triggerIntimateScene(context, charName) {
    adjustCharStat(context, charName, 'lust', 20);
    adjustCharStat(context, charName, 'love', 5);
    addEventLogEntry(context, charName, 'manual_scene',
        'Intimate scene triggered manually: Lust +20, Love +5'
    );
    const ctx = context || getContextSafely();
    if (ctx) injectDynamicsContext(ctx);
}

export function triggerRandomEvent(context, charName) {
    const event = evaluateRandomEvent(context, charName);
    if (event) {
        const ctx = context || getContextSafely();
        if (ctx) injectDynamicsContext(ctx);
        return event;
    }
    const profile = getCharProfile(context, charName);
    if (!profile) return null;

    const allEligible = EVENT_POOL.filter(() => true);
    const selected = allEligible[Math.floor(Math.random() * allEligible.length)];

    if (selected.statEffects) {
        for (const [stat, delta] of Object.entries(selected.statEffects)) {
            adjustCharStat(context, charName, stat, delta);
        }
    }

    addEventLogEntry(context, charName, selected.key,
        `Forced event: ${selected.description}`
    );

    const ctx = context || getContextSafely();
    if (ctx) injectDynamicsContext(ctx);

    return selected;
}

export function advanceGoal(context, charName, goalId, amount) {
    const profile = getCharProfile(context, charName);
    if (!profile) return false;

    const goal = profile.goals.find(g => g.id === goalId);
    if (!goal) return false;

    const prevProgress = goal.progress;
    goal.progress = Math.min(100, goal.progress + (amount || 10));

    if (goal.progress >= 100 && prevProgress < 100) {
        goal.completed = true;
        addEventLogEntry(context, charName, 'goal_completed',
            `Goal completed: "${goal.title}"`
        );
        showToast('Goal Completed', `${profile.name}: "${goal.title}"`, 'success');
    }

    saveDynamicsData(context);
    return true;
}
