import {
    EXTENSION_PROMPT_KEY_DYNAMICS,
    EXTENSION_PROMPT_KEY_NUDGE,
    EXTENSION_PROMPT_KEY_GOALS,
    PROMPT_POSITION_AFTER,
    PROMPT_DEPTH,
    PROMPT_POSITION_BEFORE,
    PROMPT_DEPTH_BEFORE,
    PROMPT_ROLE_SYSTEM,
    MODULE_NAME,
    MAX_AI_STAT_DELTA,
    state,
} from './constants.js';

import {
    getContextSafely,
    getSettings,
    getDynamicsData,
    getAllCharProfiles,
    getCharProfile,
    saveDynamicsData,
    getRecentMessages,
    getCharNamesInChat,
    setPendingAIResults,
    getPendingAIResults,
    clearPendingAIResults,
    adjustCharStat,
    updateGoal,
    addEventLogEntry,
    addThought,
} from './data.js';
import { buildDynamicsContext, buildGoalNudgeText, buildScenarioContext, buildHiddenThoughtsPrompt, buildMigrationPrompt, buildStatAnalysisPrompt } from './prompts.js';

export function getProfileApi(context, profileId) {
    const profiles = context.extensionSettings?.connectionManager?.profiles || [];
    return profiles.find(p => p.id === profileId)?.api;
}

export function getConnectionManagerState(context) {
    const em = context?.extensionSettings;
    const cm = em?.connectionManager;
    const isDisabled = Array.isArray(em?.disabledExtensions) && em.disabledExtensions.includes('connection-manager');
    return {
        available: Boolean(cm) && !isDisabled,
        isDisabled,
        profiles: Array.isArray(cm?.profiles) ? cm.profiles : [],
    };
}

export function getProfileGroupLabel(context, profile) {
    const m = context?.CONNECT_API_MAP?.[profile?.api];
    if (m?.selected === 'openai') return 'Chat Completion';
    if (m?.selected === 'textgenerationwebui') return 'Text Completion';
    return 'Other Profiles';
}

export function getSortedProfilesByGroup(context, profiles) {
    const groups = new Map();
    for (const profile of profiles) {
        if (!profile?.id || !profile?.name) continue;
        const label = getProfileGroupLabel(context, profile);
        const arr = groups.get(label) ?? [];
        arr.push(profile);
        groups.set(label, arr);
    }
    for (const arr of groups.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return groups;
}

export function showToast(title, body, type) {
    if (typeof toastr !== 'undefined') {
        const method = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
        toastr[method](body, title, { timeOut: 4000 });
    } else {
        console.log(`[ObsessionEngine] [${type}] ${title}: ${body}`);
    }
}

export function injectDynamicsContext(context) {
    if (!context || typeof context.setExtensionPrompt !== 'function') return;

    const settings = getSettings(context);
    if (!settings?.enabled || !settings?.autoInject) {
        removeDynamicsContext();
        return;
    }

    const data = getDynamicsData(context);
    if (!data.global.enabled) {
        removeDynamicsContext();
        return;
    }

    const allProfiles = getAllCharProfiles(context);
    const activeProfiles = allProfiles.filter(p => p.enabled);

    if (activeProfiles.length === 0) {
        removeDynamicsContext();
        return;
    }

    const dynamicsText = buildDynamicsContext(activeProfiles);

    try {
        context.setExtensionPrompt(
            EXTENSION_PROMPT_KEY_DYNAMICS,
            dynamicsText,
            PROMPT_POSITION_AFTER,
            PROMPT_DEPTH,
            true,
            PROMPT_ROLE_SYSTEM
        );

        const nudgeTexts = activeProfiles
            .map(p => buildGoalNudgeText(getCharProfile(context, p.name)))
            .filter(Boolean);
        const nudgeCombined = nudgeTexts.join('\n');

        context.setExtensionPrompt(
            EXTENSION_PROMPT_KEY_NUDGE,
            nudgeCombined,
            PROMPT_POSITION_AFTER,
            PROMPT_DEPTH,
            nudgeCombined.length > 0,
            PROMPT_ROLE_SYSTEM
        );

        const scenarioTexts = activeProfiles
            .map(p => buildScenarioContext(getCharProfile(context, p.name)))
            .filter(Boolean);
        const scenarioCombined = scenarioTexts.join('\n');

        context.setExtensionPrompt(
            EXTENSION_PROMPT_KEY_GOALS,
            scenarioCombined,
            PROMPT_POSITION_AFTER,
            PROMPT_DEPTH,
            scenarioCombined.length > 0,
            PROMPT_ROLE_SYSTEM
        );
    } catch (err) {
        console.error('[ObsessionEngine] Failed to inject dynamics context:', err);
    }
}

export function removeDynamicsContext() {
    const ctx = globalThis.SillyTavern?.getContext?.() || null;
    if (!ctx || typeof ctx.setExtensionPrompt !== 'function') return;
    try { ctx.setExtensionPrompt(EXTENSION_PROMPT_KEY_DYNAMICS, '', 0, 0, false, 0); } catch { /* */ }
    try { ctx.setExtensionPrompt(EXTENSION_PROMPT_KEY_NUDGE, '', 0, 0, false, 0); } catch { /* */ }
    try { ctx.setExtensionPrompt(EXTENSION_PROMPT_KEY_GOALS, '', 0, 0, false, 0); } catch { /* */ }
}

export async function callAI(context, messages, settings) {
    if (!context || !settings?.connectionProfileId) return null;

    const profileId = settings.connectionProfileId;
    try {
        if (context.ConnectionManagerRequestService?.sendRequest) {
            const result = await context.ConnectionManagerRequestService.sendRequest(
                profileId,
                messages
            );
            return result;
        }
        if (typeof context.generateQuietPrompt === 'function') {
            const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
            const result = await context.generateQuietPrompt(prompt, true, '');
            return result;
        }
    } catch (err) {
        console.error('[ObsessionEngine] AI call failed:', err);
    }
    return null;
}

export async function generateHiddenThoughts(context, charName) {
    const settings = getSettings(context);
    if (!settings.connectionProfileId) return null;

    const profile = getCharProfile(context, charName);
    if (!profile) return null;

    const recentMessages = Array.isArray(context.chat)
        ? context.chat.slice(-10)
        : [];

    const messages = buildHiddenThoughtsPrompt(profile, recentMessages);

    try {
        const result = await callAI(context, [
            { role: 'system', content: messages.systemContent },
            { role: 'user', content: messages.userContent },
        ], settings);

        if (result) {
            const text = typeof result === 'string' ? result : (result.text || result.response || result.content || '');
            return text.trim();
        }
    } catch (err) {
        console.error('[ObsessionEngine] Failed to generate hidden thoughts:', err);
    }
    return null;
}

export async function generateMigrationPreset(context, userPrompt) {
    const settings = getSettings(context);
    if (!settings.connectionProfileId) return null;

    const messages = buildMigrationPrompt(userPrompt);

    try {
        const result = await callAI(context, [
            { role: 'system', content: messages.systemContent },
            { role: 'user', content: messages.userContent },
        ], settings);

        if (result) {
            const text = typeof result === 'string' ? result : (result.text || result.response || result.content || '');
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
    } catch (err) {
        console.error('[ObsessionEngine] Migration generation failed:', err);
    }
    return null;
}

export async function runAIAnalysis(context) {
    const settings = getSettings(context);
    if (!settings.aiAnalysisEnabled) return null;
    if (!settings.connectionProfileId) return null;

    if (state.aiAnalysisInFlight) return null;
    state.aiAnalysisInFlight = true;

    try {
        const windowSize = settings.aiAnalysisWindow || 15;
        const recentMessages = getRecentMessages(context, windowSize);

        if (recentMessages.length < 2) {
            state.aiAnalysisInFlight = false;
            return null;
        }

        const allProfiles = getAllCharProfiles(context);
        const activeProfiles = allProfiles.filter(p => p.enabled);
        if (activeProfiles.length === 0) {
            state.aiAnalysisInFlight = false;
            return null;
        }

        const messages = buildStatAnalysisPrompt(activeProfiles, recentMessages);
        const result = await callAI(context, [
            { role: 'system', content: messages.systemContent },
            { role: 'user', content: messages.userContent },
        ], settings);

        if (result) {
            const text = typeof result === 'string' ? result : (result.text || result.response || result.content || '');
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.characters) {
                    setPendingAIResults(context, parsed.characters);
                    console.info('[ObsessionEngine] AI analysis completed, results pending for next cycle.');
                    return parsed.characters;
                }
            }
        }
    } catch (err) {
        console.error('[ObsessionEngine] AI analysis failed:', err);
    } finally {
        state.aiAnalysisInFlight = false;
    }
    return null;
}

export function applyAIResults(context) {
    const results = getPendingAIResults(context);
    if (!results || typeof results !== 'object') return;

    let applied = 0;
    const charNames = Object.keys(results);

    for (const charName of charNames) {
        const charResult = results[charName];
        if (!charResult) continue;

        const profile = getCharProfile(context, charName);
        if (!profile || !profile.enabled) continue;

        if (charResult.stats && typeof charResult.stats === 'object') {
            for (const [statName, delta] of Object.entries(charResult.stats)) {
                const clampedDelta = Math.max(-MAX_AI_STAT_DELTA, Math.min(MAX_AI_STAT_DELTA, Number(delta) || 0));
                if (clampedDelta !== 0) {
                    adjustCharStat(context, charName, statName, clampedDelta);
                }
            }
        }

        if (charResult.goalProgress && typeof charResult.goalProgress === 'object') {
            for (const [goalId, progress] of Object.entries(charResult.goalProgress)) {
                const goal = (profile.goals || []).find(g => g.id === goalId);
                if (goal && !goal.completed) {
                    updateGoal(context, charName, goalId, { progress: Math.round(Number(progress)) || 0 });
                }
            }
        }

        addEventLogEntry(context, charName, 'ai_analysis',
            'AI analyzed recent chat and updated stats'
        );
        applied++;
    }

    clearPendingAIResults(context);

    if (applied > 0) {
        console.info(`[ObsessionEngine] AI results applied to ${applied} character(s).`);
        injectDynamicsContext(context);
    }
}
