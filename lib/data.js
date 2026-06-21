import {
    MODULE_NAME,
    DYNAMICS_METADATA_KEY,
    defaultSettings,
    createDefaultCharProfile,
    createDefaultDynamicsData,
    generateId,
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
    if (!context?.chatMetadata) return createDefaultDynamicsData();
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
                profile.stats[key] = Math.max(0, Math.min(100, val));
            }
        }
    }
    if (updates.personality) {
        for (const [key, val] of Object.entries(updates.personality)) {
            if (profile.personality[key] !== undefined) {
                profile.personality[key] = Math.max(0, Math.min(10, val));
            }
        }
    }
    if (updates.tone !== undefined) profile.tone = Math.max(-5, Math.min(5, updates.tone));
    if (updates.growthRate !== undefined) profile.growthRate = Math.max(0, Math.min(5, updates.growthRate));
    if (updates.scenarios)
        profile.scenarios = { ...profile.scenarios, ...updates.scenarios };
    if (updates.name !== undefined) profile.name = updates.name;
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
        personality: { ...charProfile.personality },
        tone: charProfile.tone,
        growthRate: charProfile.growthRate,
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
        personality: preset.personality,
        tone: preset.tone,
        growthRate: preset.growthRate,
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

export function exportConfig(context, charName) {
    const profile = getCharProfile(context, charName);
    const settings = getSettings(context);
    return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        settings: {
            autoInject: settings.autoInject,
            eventInterval: settings.eventInterval,
            eventProbability: settings.eventProbability,
        },
        profile: {
            stats: profile.stats,
            personality: profile.personality,
            tone: profile.tone,
            growthRate: profile.growthRate,
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
