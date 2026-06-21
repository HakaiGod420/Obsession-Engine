import {
    EXTENSION_PROMPT_KEY_DYNAMICS,
    EXTENSION_PROMPT_KEY_NUDGE,
    EXTENSION_PROMPT_KEY_GOALS,
    EXTENSION_PROMPT_KEY_EVENT,
    PROMPT_POSITION_AFTER,
    PROMPT_DEPTH,
    PROMPT_POSITION_BEFORE,
    PROMPT_DEPTH_BEFORE,
    PROMPT_ROLE_SYSTEM,
    MODULE_NAME,
    MAX_AI_STAT_DELTA,
    DARKNESS_MAP,
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
    getUnanalyzedMessages,
    updateLastAnalyzedIndex,
    getCharNamesInChat,
    setPendingAIResults,
    getPendingAIResults,
    clearPendingAIResults,
    adjustCharStat,
    updateCharProfile,
    updateGoal,
    addEventLogEntry,
    addThought,
    setThoughts,
    getCharacterCardData,
    setInitialized,
    addGoal,
    savePreset,
    resolveCharName,
    renameCharProfile,
} from './data.js';
import { buildDynamicsContext, buildGoalNudgeText, buildScenarioContext, buildHiddenThoughtsPrompt, buildMigrationPrompt, buildStatAnalysisPrompt, buildInitializationPrompt, buildRandomEventSuggestion, buildIntimateSceneNudge } from './prompts.js';

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

        const eventNudgeTexts = [];
        for (const ap of activeProfiles) {
            const p = getCharProfile(context, ap.name);
            if (!p) continue;
            if (p.pendingEventNudge) eventNudgeTexts.push(p.pendingEventNudge);
            if (p.pendingSceneNudge) eventNudgeTexts.push(buildIntimateSceneNudge(p));
        }
        const eventCombined = eventNudgeTexts.join('\n\n');

        context.setExtensionPrompt(
            EXTENSION_PROMPT_KEY_EVENT,
            eventCombined,
            PROMPT_POSITION_AFTER,
            PROMPT_DEPTH,
            eventCombined.length > 0,
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
    try { ctx.setExtensionPrompt(EXTENSION_PROMPT_KEY_EVENT, '', 0, 0, false, 0); } catch { /* */ }
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
    if (!settings.connectionProfileId) {
        console.info('[ObsessionEngine] AI analysis skipped: no Connection Profile selected.');
        return null;
    }

    if (state.aiAnalysisInFlight) {
        console.info('[ObsessionEngine] AI analysis skipped: already in flight.');
        return null;
    }
    state.aiAnalysisInFlight = true;

    let timeoutId = null;
    const forwardContext = context;

    try {
        const windowSize = settings.aiAnalysisWindow || 15;
        const unanalyzed = getUnanalyzedMessages(context, windowSize);

        if (!unanalyzed || !unanalyzed.messages || unanalyzed.messages.length < 2) {
            state.aiAnalysisInFlight = false;
            return null;
        }

        const recentMessages = unanalyzed.messages;
        const endIdx = unanalyzed.endIdx;
        const data = getDynamicsData(context);

        const allProfiles = getAllCharProfiles(context);
        const activeProfiles = allProfiles.filter(p => p.enabled);
        if (activeProfiles.length === 0) {
            state.aiAnalysisInFlight = false;
            return null;
        }

        console.info(`[ObsessionEngine] AI analyzing messages ${unanalyzed.startIdx} to ${endIdx - 1} (${recentMessages.length} msgs) for ${activeProfiles.length} character(s)`);

        const messages = buildStatAnalysisPrompt(activeProfiles, recentMessages);

        const aiPromise = callAI(context, [
            { role: 'system', content: messages.systemContent },
            { role: 'user', content: messages.userContent },
        ], settings);

        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('AI analysis timed out after 30s'));
            }, 30000);
        });

        const result = await Promise.race([aiPromise, timeoutPromise]);

        clearTimeout(timeoutId);
        timeoutId = null;

        if (result) {
            const text = typeof result === 'string' ? result : (result.text || result.response || result.content || '');
            const parsed = extractJson(text);
            if (parsed && parsed.characters) {
                setPendingAIResults(context, parsed.characters);
                updateLastAnalyzedIndex(context, endIdx - 1);
                console.info(`[ObsessionEngine] AI analysis completed, results pending. Analyzed up to index ${endIdx - 1}.`);
                return parsed.characters;
            }
            console.info('[ObsessionEngine] AI analysis returned no valid character data.');
        }
    } catch (err) {
        console.error('[ObsessionEngine] AI analysis failed:', err);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
        state.aiAnalysisInFlight = false;
    }
    return null;
}

export function applyAIResults(context) {
    const results = getPendingAIResults(context);
    if (!results || typeof results !== 'object') return;

    let applied = 0;
    const skipped = [];
    const charNames = Object.keys(results);

    for (const rawName of charNames) {
        const charResult = results[rawName];
        if (!charResult) continue;

        const matchedName = resolveCharName(context, rawName);
        if (!matchedName) {
            skipped.push(rawName);
            continue;
        }

        const profile = getCharProfile(context, matchedName);
        if (!profile || !profile.enabled) continue;

        if (charResult.stats && typeof charResult.stats === 'object') {
            for (const [statName, delta] of Object.entries(charResult.stats)) {
                const clampedDelta = Math.max(-MAX_AI_STAT_DELTA, Math.min(MAX_AI_STAT_DELTA, Number(delta) || 0));
                if (clampedDelta !== 0) {
                    adjustCharStat(context, matchedName, statName, clampedDelta);
                }
            }
        }

        if (charResult.goalProgress && typeof charResult.goalProgress === 'object') {
            for (const [goalId, progress] of Object.entries(charResult.goalProgress)) {
                const goal = (profile.goals || []).find(g => g.id === goalId);
                if (goal && !goal.completed) {
                    updateGoal(context, matchedName, goalId, { progress: Math.round(Number(progress)) || 0 });
                }
            }
        }

        if (Array.isArray(charResult.completedGoals)) {
            for (const goalId of charResult.completedGoals) {
                const goal = (profile.goals || []).find(g => g.id === goalId);
                if (goal && !goal.completed) {
                    updateGoal(context, matchedName, goalId, { completed: true, progress: 100 });
                    addEventLogEntry(context, matchedName, 'goal_completed',
                        `AI marked goal completed: "${goal.title}"`
                    );
                    showToast('Goal Completed', `${profile.name}: "${goal.title}"`, 'success');
                }
            }
        }

        if (Array.isArray(charResult.newGoals)) {
            const existingTitles = new Set((profile.goals || []).map(g => g.title.toLowerCase()));
            let added = 0;
            for (const title of charResult.newGoals.slice(0, 3)) {
                const trimmed = typeof title === 'string' ? title.trim() : '';
                if (!trimmed) continue;
                if (existingTitles.has(trimmed.toLowerCase())) continue;
                addGoal(context, matchedName, { title: trimmed, description: '', progress: 0, hidden: false });
                existingTitles.add(trimmed.toLowerCase());
                added++;
            }
            if (added > 0) {
                addEventLogEntry(context, matchedName, 'goals_added',
                    `AI added ${added} new goal(s)`
                );
            }
        }

        if (Array.isArray(charResult.hiddenThoughts)) {
            const thoughtTexts = charResult.hiddenThoughts
                .slice(0, 5)
                .map(t => typeof t === 'string' ? t.trim() : '')
                .filter(Boolean);
            if (thoughtTexts.length > 0) {
                setThoughts(context, matchedName, thoughtTexts);
            }
            profile.lastThoughtAt = new Date().toISOString();
        }

        if (charResult.scenarioUpdates && typeof charResult.scenarioUpdates === 'object') {
            const dc = profile.darknessCeiling !== undefined ? profile.darknessCeiling : 10;
            let scenarioChanges = 0;
            const scenarioPatch = {};
            for (const [scenId, upd] of Object.entries(charResult.scenarioUpdates)) {
                if (!upd || typeof upd !== 'object') continue;
                const requiredDarkness = DARKNESS_MAP[scenId];
                const enabled = Boolean(upd.enabled);
                if (enabled && requiredDarkness !== undefined && requiredDarkness > dc) {
                    continue;
                }
                const intensity = Math.max(1, Math.min(10, parseInt(upd.intensity) || 5));
                const existing = profile.scenarios?.[scenId];
                if (existing?.enabled === enabled && existing?.intensity === intensity) continue;
                scenarioPatch[scenId] = { enabled, intensity };
                scenarioChanges++;
            }
            if (scenarioChanges > 0) {
                updateCharProfile(context, matchedName, { scenarios: scenarioPatch });
                addEventLogEntry(context, matchedName, 'scenarios_updated',
                    `AI updated ${scenarioChanges} scenario(s)`
                );
            }
        }

        addEventLogEntry(context, matchedName, 'ai_analysis',
            'AI analyzed recent chat: stats, goals, thoughts, and scenarios updated'
        );
        applied++;
    }

    if (skipped.length > 0) {
        console.info(`[ObsessionEngine] AI returned unmatched names: ${skipped.join(', ')} — skipped.`);
    }

    clearPendingAIResults(context);

    if (applied > 0) {
        console.info(`[ObsessionEngine] AI results applied to ${applied} character(s).`);
        injectDynamicsContext(context);
    }
}

function extractJson(text) {
    if (!text || typeof text !== 'string') return null;
    const raw = text;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.error('[ObsessionEngine] No JSON object found in AI response. Raw (first 500 chars):', raw.slice(0, 500));
        return null;
    }

    let str = jsonMatch[0];

    try {
        return JSON.parse(str);
    } catch (e) {
        console.warn('[ObsessionEngine] Initial JSON parse failed, attempting repair. Error:', e.message);
    }

    const repairs = [
        { name: 'word-prefix', re: /"(\w+)":\s*[a-zA-Z][a-zA-Z\s]*?:\s*(-?\d+\.?\d*)/g, fn: '"$1": $2' },
        { name: 'number-placeholder', re: /"(\w+)":\s*number\b/gi, fn: '"$1": 0' },
        { name: 'string-numbers', re: /"(\w+)":\s*"(-?\d+\.?\d*)"/g, fn: '"$1": $2' },
        { name: 'trailing-commas-obj', re: /,\s*}/g, fn: '}' },
        { name: 'trailing-commas-arr', re: /,\s*]/g, fn: ']' },
        { name: 'single-quotes', re: /'/g, fn: '"' },
    ];

    for (const r of repairs) {
        const before = str;
        str = str.replace(r.re, r.fn);
        if (str !== before) {
            console.debug(`[ObsessionEngine] JSON repair applied: ${r.name}`);
        }
    }

    try {
        return JSON.parse(str);
    } catch (e) {
        console.error('[ObsessionEngine] JSON repair failed. Raw (first 500 chars):', raw.slice(0, 500));
        return null;
    }
}

export async function initializeCharacter(context, charName) {
    const settings = getSettings(context);
    if (!settings.connectionProfileId) {
        showToast('Error', 'Select a Connection Profile first to initialize characters.', 'error');
        return null;
    }

    if (state.initInFlight) {
        showToast('Busy', 'Character initialization already running. Wait and try again.', 'info');
        return null;
    }
    state.initInFlight = true;

    try {
        const charData = getCharacterCardData(context, charName);
        if (!charData) {
            showToast('Error', 'Could not find character card data for ' + charName, 'error');
            state.initInFlight = false;
            return null;
        }

        const messages = buildInitializationPrompt(charData);

        showToast('Initializing', 'Analyzing ' + charName + '\'s character card with AI...', 'info');

        const result = await callAI(context, [
            { role: 'system', content: messages.systemContent },
            { role: 'user', content: messages.userContent },
        ], settings);

        if (!result) {
            showToast('Error', 'AI init failed for ' + charName + '. Check connection profile.', 'error');
            state.initInFlight = false;
            return null;
        }

        const text = typeof result === 'string' ? result : (result.text || result.response || result.content || '');
        const parsed = extractJson(text);
        if (!parsed) {
            showToast('Error', 'AI returned unparseable JSON for ' + charName + '. Check console for details.', 'error');
            state.initInFlight = false;
            return null;
        }

        let primaryName = charName;
        let renamed = false;
        if (parsed.canonicalName && typeof parsed.canonicalName === 'string') {
            const canonical = parsed.canonicalName.trim();
            if (canonical && canonical.toLowerCase() !== charName.toLowerCase()) {
                const renamedOk = renameCharProfile(context, charName, canonical);
                if (renamedOk) {
                    primaryName = canonical;
                    renamed = true;
                    console.info(`[ObsessionEngine] Renamed profile "${charName}" -> "${canonical}" during init`);
                } else {
                    console.info(`[ObsessionEngine] Rename to "${canonical}" skipped (target exists or source missing)`);
                }
            }
        }

        setInitialized(context, primaryName, parsed);

        if (Array.isArray(parsed.suggestedGoals)) {
            const profile = getCharProfile(context, primaryName);
            if (profile) {
                profile.goals = profile.goals.filter(g => g.completed);
                for (const goalTitle of parsed.suggestedGoals.slice(0, 5)) {
                    if (typeof goalTitle === 'string' && goalTitle.trim()) {
                        addGoal(context, primaryName, {
                            title: goalTitle.trim(),
                            description: '',
                            progress: 0,
                            hidden: false,
                        });
                    }
                }
            }
        }

        const presetName = parsed.suggestedPresetName || primaryName + ' Init';
        savePreset(context, presetName, getCharProfile(context, primaryName));

        addEventLogEntry(context, primaryName, 'initialized',
            `Character initialized via AI analysis. Analysis: ${(parsed.analysis || 'No analysis provided').slice(0, 100)}`
        );

        const allInitNames = [primaryName];
        const addedNames = [];

        if (Array.isArray(parsed.additionalCharacters)) {
            for (const extra of parsed.additionalCharacters) {
                const extraName = typeof extra?.name === 'string' ? extra.name.trim() : '';
                if (!extraName) continue;
                if (allInitNames.some(n => n.toLowerCase() === extraName.toLowerCase())) {
                    console.info(`[ObsessionEngine] Skipping duplicate additional character "${extraName}"`);
                    continue;
                }
                const existing = getCharProfile(context, extraName);
                if (existing?.initialized) {
                    console.info(`[ObsessionEngine] Additional character "${extraName}" already initialized, skipping`);
                    allInitNames.push(extraName);
                    continue;
                }
                setInitialized(context, extraName, extra);
                if (Array.isArray(extra.suggestedGoals)) {
                    const eProfile = getCharProfile(context, extraName);
                    if (eProfile) {
                        eProfile.goals = eProfile.goals.filter(g => g.completed);
                        for (const goalTitle of extra.suggestedGoals.slice(0, 5)) {
                            if (typeof goalTitle === 'string' && goalTitle.trim()) {
                                addGoal(context, extraName, {
                                    title: goalTitle.trim(),
                                    description: '',
                                    progress: 0,
                                    hidden: false,
                                });
                            }
                        }
                    }
                }
                addEventLogEntry(context, extraName, 'initialized',
                    `Additional character initialized from card. Analysis: ${(extra.analysis || 'No analysis provided').slice(0, 100)}`
                );
                allInitNames.push(extraName);
                addedNames.push(extraName);
            }
        }

        injectDynamicsContext(context);

        let toastTitle = 'Initialized';
        let toastBody;
        if (addedNames.length > 0) {
            toastTitle = `Initialized ${allInitNames.length} characters`;
            const renameNote = renamed ? ` (renamed ${charName} \u2192 ${primaryName})` : '';
            toastBody = `${allInitNames.join(', ')}${renameNote}`;
        } else if (renamed) {
            toastBody = `Renamed ${charName} \u2192 ${primaryName}: ${(parsed.analysis || '').slice(0, 50)}`;
        } else {
            toastBody = `${primaryName} profile created: ${(parsed.analysis || '').slice(0, 60)}`;
        }
        showToast(toastTitle, toastBody, 'success');

        return parsed;
    } catch (err) {
        console.error('[ObsessionEngine] Character initialization failed:', err);
        showToast('Error', 'Init failed: ' + err.message, 'error');
    } finally {
        state.initInFlight = false;
    }
    return null;
}
