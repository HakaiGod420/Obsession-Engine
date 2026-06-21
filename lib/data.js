import {
    MODULE_NAME,
    DYNAMICS_METADATA_KEY,
    defaultSettings,
    createDefaultCharProfile,
    createDefaultDynamicsData,
    generateId,
    STAGES,
    DARKNESS_MAP,
} from './constants.js';

export function getContextSafely() {
    if (!globalThis.SillyTavern || typeof globalThis.SillyTavern.getContext !== 'function') {
        return null;
    }
    return globalThis.SillyTavern.getContext();
}

export function getSettings(context) {
    if (!context?.extensionSettings) {
        return structuredClone(defaultSettings);
    }
    if (!context.extensionSettings[MODULE_NAME]) {
        context.extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    const settings = context.extensionSettings[MODULE_NAME];
    let changed = false;
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(settings, key)) {
            settings[key] = defaultSettings[key];
            changed = true;
        }
    }
    if (changed) context.saveSettingsDebounced?.();
    return settings;
}

export function saveSettings(context) {
    if (typeof context?.saveSettingsDebounced === 'function') {
        context.saveSettingsDebounced();
    }
}

export function getDynamicsData(context) {
    if (!context?.chatMetadata) {
        console.warn('[ObsessionEngine] getDynamicsData: no chatMetadata (no chat loaded?) — returning throwaway data');
        return createDefaultDynamicsData();
    }
    if (!context.chatMetadata[DYNAMICS_METADATA_KEY]) {
        context.chatMetadata[DYNAMICS_METADATA_KEY] = createDefaultDynamicsData();
    }
    return context.chatMetadata[DYNAMICS_METADATA_KEY];
}

export function saveDynamicsData(context) {
    if (typeof context?.saveMetadataDebounced === 'function') {
        context.saveMetadataDebounced();
    } else if (typeof context?.saveMetadata === 'function') {
        context.saveMetadata();
    }
}

export function getCharProfile(context, charName) {
    const data = getDynamicsData(context);
    if (!charName) return null;
    if (!data.characters[charName]) {
        data.characters[charName] = createDefaultCharProfile(charName);
        saveDynamicsData(context);
    }
    return data.characters[charName];
}

export function getAllCharProfiles(context) {
    const data = getDynamicsData(context);
    return Object.entries(data.characters).map(([name, profile]) => ({
        name,
        ...profile,
    }));
}

export function removeCharProfile(context, charName) {
    const data = getDynamicsData(context);
    delete data.characters[charName];
    data.edges = (data.edges || []).filter(
        e => e.from !== charName && e.to !== charName
    );
    saveDynamicsData(context);
}

export function updateCharProfile(context, charName, updates) {
    const profile = getCharProfile(context, charName);
    if (!profile) return;
    if (updates.enabled !== undefined) profile.enabled = updates.enabled;
    if (updates.stats) {
        for (const [key, val] of Object.entries(updates.stats)) {
            if (profile.stats[key] !== undefined) {
                profile.stats[key] = Math.max(0, Math.min(100, Number(val)));
            }
        }
    }
    if (updates.growthRates) {
        if (!profile.growthRates) profile.growthRates = { love: 0.5, lust: 0.3, hate: 0.1, trust: 0.2, jealousy: 0.1, sanity: -0.05 };
        for (const [key, val] of Object.entries(updates.growthRates)) {
            if (profile.growthRates[key] !== undefined) {
                profile.growthRates[key] = Math.max(-3, Math.min(5, Number(val)));
            }
        }
    }
    if (updates.personality) {
        for (const [key, val] of Object.entries(updates.personality)) {
            if (profile.personality[key] !== undefined) {
                profile.personality[key] = Math.max(0, Math.min(10, Number(val)));
            }
        }
    }
    if (updates.tone !== undefined) profile.tone = Math.max(-5, Math.min(5, Number(updates.tone)));
    if (updates.growthRate !== undefined) profile.growthRate = Math.max(0, Math.min(5, Number(updates.growthRate)));
    if (updates.intensityMultiplier !== undefined) profile.intensityMultiplier = Math.max(0.1, Math.min(3, Number(updates.intensityMultiplier)));
    if (updates.darknessCeiling !== undefined) profile.darknessCeiling = Math.max(0, Math.min(10, Number(updates.darknessCeiling)));
    if (updates.scenarios)
        profile.scenarios = { ...profile.scenarios, ...updates.scenarios };
    if (updates.name !== undefined) profile.name = updates.name;
    profile.lastModifiedAt = new Date().toISOString();
    saveDynamicsData(context);
}

export function adjustCharStat(context, charName, statName, delta) {
    const profile = getCharProfile(context, charName);
    if (!profile) return;
    if (profile.stats[statName] === undefined) return;
    profile.stats[statName] = Math.max(0, Math.min(100, profile.stats[statName] + delta));
    saveDynamicsData(context);
}

export function addGoal(context, charName, goal) {
    const profile = getCharProfile(context, charName);
    if (!profile) return null;
    const newGoal = {
        id: generateId(),
        title: goal.title || 'Untitled Goal',
        description: goal.description || '',
        progress: goal.progress || 0,
        hidden: goal.hidden || false,
        completed: false,
        createdAt: new Date().toISOString(),
    };
    profile.goals.push(newGoal);
    saveDynamicsData(context);
    return newGoal;
}

export function updateGoal(context, charName, goalId, updates) {
    const profile = getCharProfile(context, charName);
    if (!profile) return;
    const goal = profile.goals.find(g => g.id === goalId);
    if (!goal) return;
    if (updates.title !== undefined) goal.title = updates.title;
    if (updates.description !== undefined) goal.description = updates.description;
    if (updates.progress !== undefined) goal.progress = Math.max(0, Math.min(100, updates.progress));
    if (updates.hidden !== undefined) goal.hidden = updates.hidden;
    if (updates.completed !== undefined) goal.completed = updates.completed;
    saveDynamicsData(context);
}

export function deleteGoal(context, charName, goalId) {
    const profile = getCharProfile(context, charName);
    if (!profile) return;
    profile.goals = profile.goals.filter(g => g.id !== goalId);
    saveDynamicsData(context);
}

export function addThought(context, charName, thought) {
    const profile = getCharProfile(context, charName);
    if (!profile) return;
    profile.thoughts.unshift({
        id: generateId(),
        text: thought,
        timestamp: new Date().toISOString(),
    });
    if (profile.thoughts.length > 20) profile.thoughts.length = 20;
    saveDynamicsData(context);
}

export function addEventLogEntry(context, charName, eventKey, details) {
    const profile = getCharProfile(context, charName);
    if (!profile) return;
    profile.eventLog.unshift({
        id: generateId(),
        eventKey,
        details: details || '',
        timestamp: new Date().toISOString(),
    });
    if (profile.eventLog.length > 50) profile.eventLog.length = 50;
    saveDynamicsData(context);
}

export function getStageForLove(love) {
    for (const stage of STAGES) {
        if (love >= stage.loveMin && love < stage.loveMax) return stage;
    }
    return STAGES[STAGES.length - 1];
}

export function setEdge(context, charA, charB, love, hate) {
    const data = getDynamicsData(context);
    if (!data.edges) data.edges = [];
    const existing = data.edges.find(
        e => (e.from === charA && e.to === charB) || (e.from === charB && e.to === charA)
    );
    if (existing) {
        if (love !== undefined) existing.love = love;
        if (hate !== undefined) existing.hate = hate;
    } else {
        data.edges.push({ from: charA, to: charB, love: love || 0, hate: hate || 0 });
    }
    saveDynamicsData(context);
}

export function getEdges(context) {
    const data = getDynamicsData(context);
    return data.edges || [];
}

export function getPresets(context) {
    const settings = getSettings(context);
    if (!Array.isArray(settings.presets)) {
        settings.presets = [];
    }
    return settings.presets;
}

export function savePreset(context, name, charProfile) {
    const settings = getSettings(context);
    if (!Array.isArray(settings.presets)) settings.presets = [];
    const existing = settings.presets.findIndex(p => p.name === name);
    const preset = {
        id: generateId(),
        name,
        stats: { ...charProfile.stats },
        growthRates: { ...charProfile.growthRates },
        personality: { ...charProfile.personality },
        tone: charProfile.tone,
        growthRate: charProfile.growthRate,
        intensityMultiplier: charProfile.intensityMultiplier,
        darknessCeiling: charProfile.darknessCeiling,
        scenarios: { ...charProfile.scenarios },
        createdAt: new Date().toISOString(),
    };
    if (existing >= 0) {
        settings.presets[existing] = preset;
    } else {
        settings.presets.push(preset);
    }
    saveSettings(context);
    return preset;
}

export function deletePreset(context, presetId) {
    const settings = getSettings(context);
    if (!Array.isArray(settings.presets)) return;
    settings.presets = settings.presets.filter(p => p.id !== presetId);
    saveSettings(context);
}

export function applyPreset(context, charName, presetId) {
    const settings = getSettings(context);
    const preset = (settings.presets || []).find(p => p.id === presetId);
    if (!preset) return false;
    updateCharProfile(context, charName, {
        stats: preset.stats,
        growthRates: preset.growthRates,
        personality: preset.personality,
        tone: preset.tone,
        growthRate: preset.growthRate,
        intensityMultiplier: preset.intensityMultiplier,
        darknessCeiling: preset.darknessCeiling,
        scenarios: preset.scenarios,
    });
    return true;
}

export function getActiveCharName(context) {
    if (!context?.chat) return null;
    if (Array.isArray(context.chat) && context.chat.length > 0) {
        const last = context.chat[context.chat.length - 1];
        if (last?.name && !last.is_user) return last.name;
        for (let i = context.chat.length - 2; i >= 0; i--) {
            if (context.chat[i]?.name && !context.chat[i].is_user) {
                return context.chat[i].name;
            }
        }
    }
    return null;
}

export function getRecentMessages(context, count) {
    if (!context?.chat || !Array.isArray(context.chat)) return [];
    const chat = context.chat;
    const msgs = chat.slice(-(count || 15));
    return msgs.map(m => ({
        name: m.name || 'Unknown',
        is_user: m.is_user || false,
        mes: (m.mes || m.message || m.content || '').slice(0, 500),
    }));
}

export function getUnanalyzedMessages(context, count) {
    if (!context?.chat || !Array.isArray(context.chat)) return [];
    const data = getDynamicsData(context);
    const startIdx = Math.max(0, (data.global.lastAnalyzedMsgIndex || -1) + 1);
    const endIdx = Math.min(context.chat.length, startIdx + (count || 15));
    if (startIdx >= endIdx) return [];
    const msgs = context.chat.slice(startIdx, endIdx);
    return {
        messages: msgs.map(m => ({
            name: m.name || 'Unknown',
            is_user: m.is_user || false,
            mes: (m.mes || m.message || m.content || '').slice(0, 500),
        })),
        startIdx,
        endIdx,
    };
}

export function updateLastAnalyzedIndex(context, newIndex) {
    const data = getDynamicsData(context);
    data.global.lastAnalyzedMsgIndex = Math.max(data.global.lastAnalyzedMsgIndex || -1, newIndex);
    saveDynamicsData(context);
}

export function getCharNamesInChat(context) {
    if (!context?.chat || !Array.isArray(context.chat)) return [];
    const names = new Set();
    for (const msg of context.chat) {
        if (msg?.name && !msg.is_user) names.add(msg.name);
    }
    return [...names];
}

export function getChatCharacterNames(context) {
    if (!context) return [];
    const names = new Set();
    if (context.name2) names.add(context.name2);
    if (Array.isArray(context.chat)) {
        for (const msg of context.chat) {
            if (msg?.name && !msg.is_user) names.add(msg.name);
        }
    }
    return [...names];
}

export function isChatActive(context) {
    return getChatCharacterNames(context).length > 0;
}

export function pruneCharactersToChat(context) {
    const data = getDynamicsData(context);
    if (!data.characters) return;
    const chatNames = new Set(getChatCharacterNames(context));
    let changed = false;
    for (const name of Object.keys(data.characters)) {
        if (!chatNames.has(name)) {
            delete data.characters[name];
            changed = true;
        }
    }
    if (changed) {
        if (Array.isArray(data.edges)) {
            data.edges = data.edges.filter(
                e => chatNames.has(e.from) && chatNames.has(e.to)
            );
        }
        saveDynamicsData(context);
    }
}

export function setPendingAIResults(context, results) {
    const data = getDynamicsData(context);
    data.pendingAIResults = results;
    saveDynamicsData(context);
}

export function getPendingAIResults(context) {
    const data = getDynamicsData(context);
    return data.pendingAIResults || null;
}

export function clearPendingAIResults(context) {
    const data = getDynamicsData(context);
    data.pendingAIResults = null;
    saveDynamicsData(context);
}

export function isDarkScenarioEnabled(profile, scenarioId) {
    const darkness = DARKNESS_MAP[scenarioId];
    if (darkness === undefined) return true;
    return (profile.darknessCeiling || 10) >= darkness;
}

export function getEligibleScenarios(profile, settings) {
    const allScenarios = settings.scenarios || [];
    return allScenarios.filter(s => {
        const enabled = profile.scenarios[s.id]?.enabled || false;
        const darknessOK = isDarkScenarioEnabled(profile, s.id);
        return enabled && darknessOK;
    });
}

export function setInitialized(context, charName, initData) {
    const profile = getCharProfile(context, charName);
    if (!profile) return;
    if (initData) {
        if (initData.stats) {
            for (const [key, val] of Object.entries(initData.stats)) {
                if (profile.stats[key] !== undefined) {
                    profile.stats[key] = Math.max(0, Math.min(100, Number(val)));
                }
            }
        }
        if (initData.personality) {
            for (const [key, val] of Object.entries(initData.personality)) {
                if (profile.personality[key] !== undefined) {
                    profile.personality[key] = Math.max(0, Math.min(10, Number(val)));
                }
            }
        }
        if (initData.tone !== undefined) profile.tone = Math.max(-5, Math.min(5, Number(initData.tone)));
        if (initData.intensityMultiplier !== undefined) profile.intensityMultiplier = Math.max(0.1, Math.min(3, Number(initData.intensityMultiplier)));
        if (initData.darknessCeiling !== undefined) profile.darknessCeiling = Math.max(0, Math.min(10, Number(initData.darknessCeiling)));
        if (initData.growthRates) {
            if (!profile.growthRates) profile.growthRates = {};
            for (const [key, val] of Object.entries(initData.growthRates)) {
                profile.growthRates[key] = Math.max(-3, Math.min(5, Number(val)));
            }
        }
    }
    profile.initialized = true;
    profile.initializedAt = new Date().toISOString();
    saveDynamicsData(context);
}

export function getCharacterCardData(context, charName) {
    if (!context) return null;

    let char = null;
    const target = (charName || '').toLowerCase().trim();

    if (Array.isArray(context.characters)) {
        for (const c of context.characters) {
            if (!c) continue;
            const cName = (c.name || c.data?.name || '').toLowerCase().trim();
            if (!cName) continue;
            if (cName === target) { char = c; break; }
        }
        if (!char) {
            for (const c of context.characters) {
                if (!c) continue;
                const cName = (c.name || c.data?.name || '').toLowerCase().trim();
                if (!cName) continue;
                if (cName.includes(target) || target.includes(cName)) { char = c; break; }
            }
        }
    } else if (context.characters && typeof context.characters === 'object') {
        char = context.characters[charName] || context.characters[target];
        if (!char) {
            for (const key of Object.keys(context.characters)) {
                const c = context.characters[key];
                if (!c) continue;
                const cName = (c.name || c.data?.name || key || '').toLowerCase().trim();
                if (!cName) continue;
                if (cName === target || cName.includes(target) || target.includes(cName)) {
                    char = c;
                    break;
                }
            }
        }
    }

    if (!char && context.characterId !== undefined && Array.isArray(context.characters)) {
        char = context.characters[context.characterId];
    }

    if (!char && context.name2) {
        const ctxName = context.name2.toLowerCase().trim();
        if (ctxName === target || ctxName.includes(target) || target.includes(ctxName)) {
            if (context.characterId !== undefined && Array.isArray(context.characters)) {
                char = context.characters[context.characterId];
            }
        }
    }

    if (!char) return null;

    return {
        name: char.name || char.data?.name || charName,
        description: char.data?.description || char.description || '',
        personality: char.data?.personality || char.personality || '',
        firstMessage: char.data?.first_mes || char.first_mes || '',
        scenario: char.data?.scenario || char.scenario || '',
        mesExample: char.data?.mes_example || char.mes_example || '',
        systemPrompt: char.data?.system_prompt || char.system_prompt || '',
        creatorNotes: char.data?.creator_notes || char.creator_notes || '',
        tags: char.data?.tags || char.tags || [],
    };
}

export function exportConfig(context, charName) {
    const profile = getCharProfile(context, charName);
    const settings = getSettings(context);
    return {
        version: '1.1.0',
        exportedAt: new Date().toISOString(),
        settings: {
            autoInject: settings.autoInject,
            eventInterval: settings.eventInterval,
            eventProbability: settings.eventProbability,
            aiAnalysisEnabled: settings.aiAnalysisEnabled,
            aiAnalysisInterval: settings.aiAnalysisInterval,
            aiAnalysisWindow: settings.aiAnalysisWindow,
        },
        profile: {
            stats: profile.stats,
            growthRates: profile.growthRates,
            personality: profile.personality,
            tone: profile.tone,
            growthRate: profile.growthRate,
            intensityMultiplier: profile.intensityMultiplier,
            darknessCeiling: profile.darknessCeiling,
            scenarios: profile.scenarios,
            goals: profile.goals,
        },
    };
}

export function importConfig(context, charName, config) {
    if (!config || !config.profile) return false;
    if (config.settings) {
        const settings = getSettings(context);
        if (config.settings.autoInject !== undefined) settings.autoInject = config.settings.autoInject;
        if (config.settings.eventInterval !== undefined) settings.eventInterval = config.settings.eventInterval;
        if (config.settings.eventProbability !== undefined) settings.eventProbability = config.settings.eventProbability;
        if (config.settings.aiAnalysisEnabled !== undefined) settings.aiAnalysisEnabled = config.settings.aiAnalysisEnabled;
        if (config.settings.aiAnalysisInterval !== undefined) settings.aiAnalysisInterval = config.settings.aiAnalysisInterval;
        if (config.settings.aiAnalysisWindow !== undefined) settings.aiAnalysisWindow = config.settings.aiAnalysisWindow;
        saveSettings(context);
    }
    updateCharProfile(context, charName, config.profile);
    if (Array.isArray(config.profile.goals)) {
        const profile = getCharProfile(context, charName);
        profile.goals = config.profile.goals.map(g => ({
            ...g,
            id: g.id || generateId(),
        }));
        saveDynamicsData(context);
    }
    return true;
}

export function resolveCharName(context, candidateName) {
    if (!candidateName) return null;
    const data = getDynamicsData(context);
    const existingNames = Object.keys(data.characters || {});
    if (existingNames.length === 0) return null;

    const trimmed = candidateName.trim();

    for (const name of existingNames) {
        if (name === trimmed) return name;
    }

    for (const name of existingNames) {
        if (name.toLowerCase() === trimmed.toLowerCase()) return name;
    }

    for (const name of existingNames) {
        if (name.includes(trimmed) || trimmed.includes(name)) return name;
    }

    for (const name of existingNames) {
        const nameParts = name.toLowerCase().split(/\s+/);
        const candParts = trimmed.toLowerCase().split(/\s+/);
        for (const np of nameParts) {
            if (np.length < 2) continue;
            for (const cp of candParts) {
                if (cp.length < 2) continue;
                if (np === cp || np.startsWith(cp) || cp.startsWith(np)) return name;
            }
        }
    }

    return null;
}
