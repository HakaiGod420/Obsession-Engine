import { state } from './lib/constants.js';
import { getContextSafely, getSettings, getDynamicsData } from './lib/data.js';
import { injectDynamicsContext } from './lib/services.js';
import { initUI, bindChatEvents, ensureSettingsPanel } from './ui/app.js';

function tryInitUI() {
    try {
        const context = getContextSafely();
        if (!context) return false;
        const settings = getSettings(context);
        if (!initUI(context, settings)) return false;
        bindChatEvents(context);
        const data = getDynamicsData(context);
        if (settings.enabled && settings.autoInject && data.global.enabled) {
            injectDynamicsContext(context);
        }
        console.info('[ObsessionEngine] UI initialized.');
        return true;
    } catch (err) {
        console.error('[ObsessionEngine] Init error:', err);
        return false;
    }
}

let initAttempts = 0;
function scheduleUIInit() {
    if (state.uiInitialized) return;
    if (tryInitUI()) { state.uiInitialized = true; return; }
    if (initAttempts >= 20) return;
    initAttempts++;
    setTimeout(scheduleUIInit, 500);
}

export function onActivate() {
    console.info('[ObsessionEngine] onActivate called.');
    const context = getContextSafely();
    if (context) {
        bindChatEvents(context);
        const settings = getSettings(context);
        const data = getDynamicsData(context);
        if (settings.enabled && settings.autoInject && data.global.enabled) {
            injectDynamicsContext(context);
        }
    }
    if (context?.eventSource && context?.eventTypes) {
        const appReady = context.eventTypes.APP_READY;
        if (appReady) {
            context.eventSource.once(appReady, () => {
                if (!state.uiInitialized) scheduleUIInit();
            });
        }
    }
    scheduleUIInit();
}
