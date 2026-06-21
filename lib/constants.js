export const MODULE_NAME = 'obsessionEngine';
export const DYNAMICS_METADATA_KEY = 'obsessionEngine';
export const SETTINGS_PANEL_ID = 'obsession_engine_settings';
export const DASHBOARD_ID = 'obsession_engine_dashboard';
export const PROFILE_SELECT_ID = 'obsession_engine_connection_profile';
export const PROFILE_STATUS_ID = 'obsession_engine_profile_status';
export const EXTENSION_PROMPT_KEY_DYNAMICS = MODULE_NAME + '_dynamics';
export const EXTENSION_PROMPT_KEY_NUDGE = MODULE_NAME + '_nudge';
export const EXTENSION_PROMPT_KEY_GOALS = MODULE_NAME + '_goals';
export const PROMPT_POSITION_AFTER = 2;
export const PROMPT_DEPTH = 2;
export const PROMPT_POSITION_BEFORE = 1;
export const PROMPT_DEPTH_BEFORE = 0;
export const PROMPT_ROLE_SYSTEM = 0;
export const MAX_DYNAMICS_CHARS = 300;
export const EVENT_INTERVAL_DEFAULT = 5;
export const EVENT_PROBABILITY_DEFAULT = 0.2;
export const AI_ANALYSIS_INTERVAL_DEFAULT = 10;
export const AI_ANALYSIS_WINDOW_DEFAULT = 15;
export const MAX_AI_STAT_DELTA = 5;

export const STAGES = Object.freeze([
    { key: 'stranger', label: 'Stranger', loveMin: 0, loveMax: 15, color: '#9e9e9e' },
    { key: 'acquaintance', label: 'Acquaintance', loveMin: 15, loveMax: 30, color: '#90caf9' },
    { key: 'crush', label: 'Crush', loveMin: 30, loveMax: 50, color: '#f48fb1' },
    { key: 'infatuated', label: 'Infatuated', loveMin: 50, loveMax: 70, color: '#ef5350' },
    { key: 'obsessed', label: 'Obsessed', loveMin: 70, loveMax: 90, color: '#c62828' },
    { key: 'soulbound', label: 'Soulbound', loveMin: 90, loveMax: 100, color: '#7b1fa2' },
]);

export const DEFAULT_SCENARIOS = Object.freeze([
    { id: '__breeding', name: 'Breeding Talk', description: 'Obsession with impregnation and family-building themes.' },
    { id: '__teasing', name: 'Public Teasing', description: 'Provocative behavior in risky or public settings.' },
    { id: '__noncon_fantasy', name: 'Non-Con Fantasy (IC)', description: 'In-character dark fantasy themes, power dynamics.' },
    { id: '__aftercare', name: 'Aftercare Focus', description: 'Emphasis on tender recovery after intense scenes.' },
    { id: '__claiming', name: 'Rough Claiming', description: 'Aggressive marking, ownership, physical dominance.' },
    { id: '__emotional_dep', name: 'Emotional Dependency', description: 'Using emotional vulnerability as a tether.' },
    { id: '__gaslighting', name: 'Gaslighting', description: 'Subtly twisting reality to create dependency.' },
    { id: '__yandere_violence', name: 'Yandere Violence', description: 'Threats or acts of violence toward rivals or user.' },
    { id: '__love_bombing', name: 'Protective Love-Bombing', description: 'Overwhelming affection and devotion.' },
    { id: '__denial', name: 'Teasing Denial', description: 'Playful withholding and denial of affection or release.' },
    { id: '__mind_break', name: 'Mind-Break', description: 'Psychological unmaking and rebuilding of identity.' },
    { id: '__guilt', name: 'Guilt-Tripping', description: 'Using guilt and obligation as manipulation tools.' },
]);

export const DARKNESS_MAP = {
    __breeding: 4,
    __teasing: 3,
    __noncon_fantasy: 9,
    __aftercare: 0,
    __claiming: 5,
    __emotional_dep: 5,
    __gaslighting: 7,
    __yandere_violence: 8,
    __love_bombing: 0,
    __denial: 2,
    __mind_break: 10,
    __guilt: 6,
};

export const defaultSettings = Object.freeze({
    enabled: true,
    connectionProfileId: '',
    autoInject: true,
    eventInterval: EVENT_INTERVAL_DEFAULT,
    eventProbability: EVENT_PROBABILITY_DEFAULT,
    aiAnalysisEnabled: true,
    aiAnalysisInterval: AI_ANALYSIS_INTERVAL_DEFAULT,
    aiAnalysisWindow: AI_ANALYSIS_WINDOW_DEFAULT,
    scenarios: structuredClone ? structuredClone(DEFAULT_SCENARIOS) : JSON.parse(JSON.stringify(DEFAULT_SCENARIOS)),
    presets: [],
});

export function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'oe_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export function createDefaultCharProfile(charName) {
    if (!charName) charName = '';
    return {
        id: generateId(),
        name: charName,
        enabled: true,
        stats: {
            love: 0,
            lust: 0,
            hate: 0,
            sanity: 10,
            trust: 50,
            jealousy: 0,
        },
        growthRates: {
            love: 0.5,
            lust: 0.3,
            hate: 0.1,
            trust: 0.2,
            jealousy: 0.1,
            sanity: -0.05,
        },
        personality: {
            craziness: 1,
            manipulation: 1,
            assertiveness: 5,
            submissiveness: 5,
            jealousy: 1,
            possessiveness: 1,
        },
        tone: 0,
        growthRate: 0.5,
        intensityMultiplier: 1.0,
        darknessCeiling: 10,
        scenarios: {},
        goals: [],
        thoughts: [],
        eventLog: [],
        messagesSinceEvent: 0,
        messagesSinceAI: 0,
    };
}

export function createDefaultDynamicsData() {
    return {
        global: {
            enabled: true,
            msgCount: 0,
            lastEventMsg: 0,
        },
        characters: {},
        edges: [],
        pendingAIResults: null,
    };
}

export const EVENT_POOL = Object.freeze([
    { key: 'sudden_confession', label: 'Sudden Confession', description: 'Character blurts out feelings impulsively.', minCraziness: 2, minDarkness: 0, statEffects: { love: 5 } },
    { key: 'wet_dream', label: 'Wet Dream Memory', description: 'Character recalls a vivid intimate dream.', minLust: 30, minDarkness: 2, statEffects: { lust: 8 } },
    { key: 'rival_appears', label: 'Rival Appears', description: 'A perceived rival enters the scene or chat.', minJealousy: 20, minDarkness: 3, statEffects: { jealousy: 10, hate: 5 } },
    { key: 'arousal_spike', label: 'Arousal Spike', description: 'Sudden physical desire triggered by a look/touch.', minLust: 20, minDarkness: 2, statEffects: { lust: 10 } },
    { key: 'jealousy_burst', label: 'Jealousy Burst', description: 'Extreme possessive reaction to minor trigger.', minPossessiveness: 3, minDarkness: 3, statEffects: { jealousy: 15 } },
    { key: 'mood_crash', label: 'Mood Crash', description: 'Sudden emotional low, need for reassurance.', minLove: 40, minDarkness: 1, statEffects: { love: -3, trust: -5 } },
    { key: 'obsessive_thought', label: 'Obsessive Thought', description: 'Character fixates on user with dark intensity.', minCraziness: 4, minLove: 50, minDarkness: 5, statEffects: { love: 3, sanity: -1 } },
    { key: 'manipulation_move', label: 'Manipulation Move', description: 'Character deploys a manipulation tactic.', minManipulation: 4, minDarkness: 4, statEffects: { trust: -3 } },
    { key: 'possessive_marking', label: 'Possessive Marking', description: 'Character leaves visible marks or claims user.', minPossessiveness: 5, minDarkness: 5, statEffects: { love: 5, lust: 5 } },
    { key: 'breakdown', label: 'Emotional Breakdown', description: 'Character has a breakdown from pent-up feelings.', minCraziness: 3, minLove: 60, minDarkness: 3, statEffects: { love: -5, sanity: -2, trust: 5 } },
    { key: 'guilt_trip', label: 'Guilt Trip', description: 'Character uses guilt to manipulate user.', minManipulation: 5, minDarkness: 6, statEffects: { trust: -5, love: 3 } },
    { key: 'gaslight_attempt', label: 'Gaslight Attempt', description: 'Character subtly twists reality.', minCraziness: 5, minDarkness: 7, statEffects: { sanity: -2, trust: -4 } },
    { key: 'yandere_eruption', label: 'Yandere Eruption', description: 'Extreme violent or threatening outburst.', minCraziness: 7, minDarkness: 8, statEffects: { love: 8, hate: 5, sanity: -3, jealousy: 10 } },
    { key: 'love_bomb_surge', label: 'Love-Bomb Surge', description: 'Overwhelming wave of affection and devotion.', minLove: 30, minDarkness: 0, statEffects: { love: 8, trust: 5 } },
    { key: 'dark_fantasy_intrusion', label: 'Dark Fantasy Intrusion', description: 'Non-con or extreme dark fantasy breaks through.', minCraziness: 6, minDarkness: 9, statEffects: { lust: 12, sanity: -2, love: 4 } },
    { key: 'mind_break_trigger', label: 'Mind-Break Trigger', description: 'Psychological fracture begins or deepens.', minCraziness: 8, minDarkness: 10, statEffects: { sanity: -4, love: 10, trust: -8 } },
]);

export const NSFW_KEYWORDS = [
    'moan', 'groan', 'thrust', 'penetrat', 'inside', 'cum', 'orgasm',
    'climax', 'breed', 'cream', 'seed', 'pussy', 'cock', 'dick',
    'fuck', 'slam', 'pound', 'fill', 'stretch', 'tight', 'wet',
    'whimper', 'shudder', 'release', 'spasm', 'convulse', 'afterglow',
    'aftercare', 'cuddle', 'nuzzle', 'nestle', 'kiss', 'lick',
    'suck', 'bite', 'mark', 'hickey', 'naked', 'bare', 'strip',
    'undress', 'clothes', 'remove', 'exposed', 'vulnerable',
];

export const CONNECTION_PROFILE_EVENTS = [
    'CONNECTION_PROFILE_CREATED',
    'CONNECTION_PROFILE_UPDATED',
    'CONNECTION_PROFILE_DELETED',
];

export const state = {
    isGenerating: false,
    isChecking: false,
    chatEventsBound: false,
    profileEventsBound: false,
    uiInitialized: false,
    dashboardOpen: false,
    aiAnalysisInFlight: false,
};
