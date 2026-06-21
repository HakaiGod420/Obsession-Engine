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
    addThought,
    getStageForLove,
} from './data.js';

import {
    injectDynamicsContext,
    showToast,
    applyAIResults,
    runAIAnalysis,
    generateHiddenThoughts,
} from './services.js';

import { buildRandomEventSuggestion } from './prompts.js';

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

    const gr = profile.growthRates || {};
    const im = profile.intensityMultiplier || 1.0;
    const loveBoost = Math.round(2 * (gr.love || 0.5) * im);
    const lustBoost = Math.round(3 * (gr.lust || 0.3) * im);
    const trustBoost = Math.round(1 * (gr.trust || 0.2) * im);

    adjustCharStat(context, charName, 'love', loveBoost);
    adjustCharStat(context, charName, 'lust', lustBoost);
    adjustCharStat(context, charName, 'trust', trustBoost);

    addEventLogEntry(context, charName, 'post_intimacy_boost',
        `NSFW detected: Love +${loveBoost}, Lust +${lustBoost}, Trust +${trustBoost} (${im.toFixed(1)}x)`
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

    const gr = profile.growthRates || {};
    const sanityRate = gr.sanity || -0.05;
    let changed = false;

    if (profile.stats.lust > 20) {
        const decay = Math.abs(gr.lust || 0.3) * 0.5;
        profile.stats.lust = Math.max(0, profile.stats.lust - decay);
        changed = true;
    }
    if (profile.stats.jealousy > 5) {
        const decay = Math.abs(gr.jealousy || 0.1) * 0.3;
        profile.stats.jealousy = Math.max(0, profile.stats.jealousy - decay);
        changed = true;
    }
    if (sanityRate < 0 && profile.stats.sanity < 10 && profile.personality.craziness >= 4) {
        profile.stats.sanity = Math.max(0, profile.stats.sanity + sanityRate);
        changed = true;
    }
    if (sanityRate > 0 && profile.stats.sanity < 10 && profile.personality.craziness < 8) {
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

    const dc = profile.darknessCeiling !== undefined ? profile.darknessCeiling : 10;

    const eligibleEvents = EVENT_POOL.filter(ev => {
        if (ev.minCraziness && profile.personality.craziness < ev.minCraziness) return false;
        if (ev.minLust && profile.stats.lust < ev.minLust) return false;
        if (ev.minLove && profile.stats.love < ev.minLove) return false;
        if (ev.minJealousy && profile.stats.jealousy < ev.minJealousy) return false;
        if (ev.minManipulation && profile.personality.manipulation < ev.minManipulation) return false;
        if (ev.minPossessiveness && profile.personality.possessiveness < ev.minPossessiveness) return false;
        if (ev.minDarkness !== undefined && dc < ev.minDarkness) return false;
        return true;
    });

    if (eligibleEvents.length === 0) return null;

    const event = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
    const im = profile.intensityMultiplier || 1.0;

    if (event.statEffects) {
        for (const [stat, delta] of Object.entries(event.statEffects)) {
            const scaledDelta = Math.round(delta * im);
            adjustCharStat(context, charName, stat, scaledDelta);
        }
    }

    const scaledEffects = Object.entries(event.statEffects || {})
        .map(([s, d]) => `${s} ${Math.round(d * im) > 0 ? '+' : ''}${Math.round(d * im)}`).join(', ');

    addEventLogEntry(context, charName, event.key,
        `${event.description} [${event.key}] (${scaledEffects})`
    );

    profile.pendingEventNudge = buildRandomEventSuggestion(profile, event);

    showToast('Random Event', `${profile.name}: ${event.description} (${scaledEffects})`, 'info');

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

    if (profile.pendingEventNudge) delete profile.pendingEventNudge;
    if (profile.pendingSceneNudge) delete profile.pendingSceneNudge;
    profile.lastMsgAt = new Date().toISOString();

    applyAIResults(context);

    profile.messagesSinceEvent = (profile.messagesSinceEvent || 0) + 1;
    profile.messagesSinceAI = (profile.messagesSinceAI || 0) + 1;

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

    const aiInterval = settings.aiAnalysisInterval || 10;
    if (profile.messagesSinceAI >= aiInterval) {
        profile.messagesSinceAI = 0;
        if (settings.aiAnalysisEnabled) {
            runAIAnalysis(context).catch(err => {
                console.error('[ObsessionEngine] AI analysis fire-and-forget failed:', err);
            });
        } else if (settings.connectionProfileId) {
            generateHiddenThoughts(context, charName).then(text => {
                if (!text) return;
                const ctx = getContextSafely();
                if (!ctx) return;
                const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
                for (const line of lines) addThought(ctx, charName, line);
                const p = getCharProfile(ctx, charName);
                if (p) {
                    p.lastThoughtAt = new Date().toISOString();
                    saveDynamicsData(ctx);
                }
                console.info(`[ObsessionEngine] Generated ${lines.length} hidden thought(s) for ${charName}`);
            }).catch(err => {
                console.error('[ObsessionEngine] Hidden thoughts generation failed:', err);
            });
        }
    }

    applyStatDecay(context, charName);

    const messageText = lastMessage.mes || lastMessage.message || lastMessage.content || '';
    if (messageText && isNSFWMessage(messageText)) {
        applyPostIntimacyBoost(context, charName);
    }

    const gr = profile.growthRates || {};
    const im = profile.intensityMultiplier || 1.0;

    if (gr.love) profile.stats.love = Math.min(100, profile.stats.love + gr.love * im);
    if (gr.lust) profile.stats.lust = Math.min(100, profile.stats.lust + gr.lust * im);
    if (gr.hate) profile.stats.hate = Math.min(100, profile.stats.hate + gr.hate * im);
    if (gr.trust) profile.stats.trust = Math.max(0, Math.min(100, profile.stats.trust + gr.trust * im));
    if (gr.jealousy) profile.stats.jealousy = Math.max(0, Math.min(100, profile.stats.jealousy + gr.jealousy * im));
    if (gr.sanity) profile.stats.sanity = Math.max(0, Math.min(10, profile.stats.sanity + gr.sanity * im));

    saveDynamicsData(context);

    if (settings.autoInject) {
        injectDynamicsContext(context);
    }
}

export function forceAffectionBoost(context, charName, amount) {
    if (!amount) amount = 10;
    const profile = getCharProfile(context, charName);
    const im = profile ? (profile.intensityMultiplier || 1.0) : 1.0;
    const scaled = Math.round(amount * im);
    adjustCharStat(context, charName, 'love', scaled);
    adjustCharStat(context, charName, 'lust', Math.round(scaled * 0.6));
    addEventLogEntry(context, charName, 'manual_boost',
        `Manual boost: Love +${scaled}, Lust +${Math.round(scaled * 0.6)} (${im.toFixed(1)}x)`
    );
    const ctx = context || getContextSafely();
    if (ctx) injectDynamicsContext(ctx);
}

export function triggerIntimateScene(context, charName) {
    const profile = getCharProfile(context, charName);
    const im = profile ? (profile.intensityMultiplier || 1.0) : 1.0;
    adjustCharStat(context, charName, 'lust', Math.round(20 * im));
    adjustCharStat(context, charName, 'love', Math.round(5 * im));
    addEventLogEntry(context, charName, 'manual_scene',
        `Intimate scene triggered: Lust +${Math.round(20 * im)}, Love +${Math.round(5 * im)} (${im.toFixed(1)}x)`
    );
    if (profile) profile.pendingSceneNudge = true;
    const ctx = context || getContextSafely();
    if (ctx) injectDynamicsContext(ctx);
}

export function triggerRandomEvent(context, charName) {
    const profile = getCharProfile(context, charName);
    const event = evaluateRandomEvent(context, charName);
    if (event) {
        const ctx = context || getContextSafely();
        if (ctx) injectDynamicsContext(ctx);
        return event;
    }
    if (!profile) return null;

    const dc = profile.darknessCeiling !== undefined ? profile.darknessCeiling : 10;
    const im = profile.intensityMultiplier || 1.0;

    const darkOk = EVENT_POOL.filter(ev => (ev.minDarkness || 0) <= dc);
    const pool = darkOk.length > 0 ? darkOk : EVENT_POOL.filter(ev => !ev.minDarkness);
    const selected = pool[Math.floor(Math.random() * pool.length)];

    if (selected && selected.statEffects) {
        for (const [stat, delta] of Object.entries(selected.statEffects)) {
            adjustCharStat(context, charName, stat, Math.round(delta * im));
        }
    }

    if (selected) {
        addEventLogEntry(context, charName, selected.key,
            `Forced event: ${selected.description}`
        );
        profile.pendingEventNudge = buildRandomEventSuggestion(profile, selected);
    }

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
