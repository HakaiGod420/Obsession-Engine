import {
    STAGES,
    EVENT_POOL,
    MAX_DYNAMICS_CHARS,
} from './constants.js';

export function getStageForLove(love) {
    for (let i = 0; i < STAGES.length; i++) {
        if (love >= STAGES[i].loveMin && love < STAGES[i].loveMax) return STAGES[i];
    }
    return STAGES[STAGES.length - 1];
}

export function buildDynamicsContext(charProfiles) {
    const lines = [];

    if (!Array.isArray(charProfiles)) {
        charProfiles = charProfiles ? [charProfiles] : [];
    }

    for (const profile of charProfiles) {
        if (!profile || !profile.enabled) continue;
        const s = profile.stats;
        const p = profile.personality;
        const stage = getStageForLove(s.love);

        const parts = [`[${profile.name} Dynamics]`];

        parts.push(`Love: ${Math.round(s.love)}/100`);
        if (stage) parts.push(`(${stage.label})`);

        if (s.lust > 20) parts.push(`Lust: ${Math.round(s.lust)}/100`);
        if (s.hate > 10) parts.push(`Hate: ${Math.round(s.hate)}/100`);
        if (s.jealousy > 15) parts.push(`Jealousy: ${Math.round(s.jealousy)}/100`);

        const traits = [];
        if (p.craziness >= 6) traits.push('unstable');
        else if (p.craziness >= 4) traits.push('obsessive');
        if (p.manipulation >= 6) traits.push('manipulative');
        if (p.assertiveness >= 7) traits.push('assertive, dominant');
        if (p.submissiveness >= 7) traits.push('submissive');
        if (p.jealousy >= 5) traits.push('jealous');
        if (p.possessiveness >= 5) traits.push('possessive');

        if (profile.tone <= -3) traits.push('wholesome, consent-focused');
        else if (profile.tone >= 3) traits.push('dark, boundary-pushing');

        if (traits.length) parts.push(`Traits: ${traits.join(', ')}`);

        const activeGoals = (profile.goals || []).filter(g => !g.completed);
        if (activeGoals.length > 0) {
            const topGoal = activeGoals[0];
            parts.push(`Goal: "${topGoal.title}" (${Math.round(topGoal.progress)}%)`);
        }

        const toneLabel = profile.tone >= 3 ? 'dark' : profile.tone <= -3 ? 'wholesome' : 'neutral';
        parts.push(`Tone: ${toneLabel}`);

        const enabledScenarios = [];
        if (profile.scenarios) {
            for (const [key, val] of Object.entries(profile.scenarios)) {
                if (val && val.enabled && val.intensity >= 3) {
                    enabledScenarios.push(key);
                }
            }
        }
        if (enabledScenarios.length) {
            parts.push(`Scenarios: ${enabledScenarios.join(', ')}`);
        }

        lines.push(parts.join(' '));
    }

    let text = lines.join('\n');
    if (text.length > MAX_DYNAMICS_CHARS) {
        text = text.slice(0, MAX_DYNAMICS_CHARS - 3) + '...';
    }

    return text;
}

export function buildGoalNudgeText(profile) {
    if (!profile) return '';
    const activeGoals = (profile.goals || []).filter(g => !g.completed && !g.hidden);
    if (activeGoals.length === 0) return '';

    const topGoal = activeGoals[0];
    const stage = getStageForLove(profile.stats.love);

    let nudge = `[Subtle Direction] As ${profile.name}, you are subtly drawn toward your goal: "${topGoal.title}". `;

    if (topGoal.progress > 0) {
        nudge += `You feel you are making progress (${Math.round(topGoal.progress)}%). `;
    }

    if (stage) {
        nudge += `Your current emotional stage (${stage.label}) shapes how you pursue this. `;
    }

    if (topGoal.progress < 30) {
        nudge += 'Take small, natural steps. Do not rush. Let it emerge organically.';
    } else if (topGoal.progress < 70) {
        nudge += 'Increase intensity. You are getting closer. Be bolder but still believable.';
    } else {
        nudge += 'The goal is within reach. Look for a natural moment to achieve it.';
    }

    const p = profile.personality;
    if (p.manipulation >= 5) nudge += ' Use subtle manipulation if needed.';
    if (p.craziness >= 5) nudge += ' Your obsession may show through unexpectedly.';

    return nudge;
}

export function buildScenarioContext(profile) {
    if (!profile || !profile.scenarios) return '';

    const active = [];
    for (const [key, val] of Object.entries(profile.scenarios)) {
        if (!val || !val.enabled || val.intensity < 3) continue;
        const lbl = key.replace(/^__/, '');
        active.push({ key: lbl, intensity: val.intensity });
    }

    if (active.length === 0) return '';

    active.sort((a, b) => b.intensity - a.intensity);

    let text = '[Active Themes] ';
    const parts = active.map(s => `${s.key.replace(/_/g, ' ')} (${s.intensity}/10)`);
    text += parts.join(', ');
    text += '. Let these themes influence your thoughts and actions naturally.';

    return text;
}

export function buildRandomEventSuggestion(profile, event) {
    if (!profile || !event) return '';
    const stage = getStageForLove(profile.stats.love);
    return `[Dynamic Event: ${event.label}] As ${profile.name}, you experience: ${event.description}. Your current state (${stage ? stage.label : 'unknown'}, Lust ${Math.round(profile.stats.lust)}/100) shapes your reaction. Express this naturally in your next response.`;
}

export function buildHiddenThoughtsPrompt(profile, recentMessages) {
    if (!profile) return '';
    const msgs = (recentMessages || []).slice(-6).map(m => `${m.is_user ? 'User' : m.name}: ${m.mes || ''}`).join('\n');
    const stage = getStageForLove(profile.stats.love);

    return {
        systemContent: `You are a narrator of ${profile.name}'s hidden inner thoughts. Generate 2-3 short internal monologue sentences that ${profile.name} is thinking but would NEVER say aloud. These should reflect their current emotional state: Love ${Math.round(profile.stats.love)}/100 (${stage ? stage.label : 'unknown'}), Lust ${Math.round(profile.stats.lust)}/100, Sanity ${Math.round(profile.stats.sanity)}/10. Personality: craziness ${profile.personality.craziness}/10, manipulation ${profile.personality.manipulation}/10, possessiveness ${profile.personality.possessiveness}/10. Be raw, unfiltered, and intense. Respond with ONLY the thoughts, one per line. No labels, no quotes, no explanations.`,
        userContent: `Recent conversation:\n${msgs}\n\n${profile.name}'s hidden thoughts:`,
    };
}

export function buildMigrationPrompt(userPrompt) {
    return {
        systemContent: `You are a prompt template converter for the Obsession Engine SillyTavern extension. The user will provide their existing roleplay system prompt. Extract the key behavioral dynamics and convert them into Obsession Engine parameters.

Respond ONLY with valid JSON:
{
  "suggestedPreset": "Name for this preset",
  "stats": { "love": number 0-100, "lust": number 0-100, "hate": number 0-100, "sanity": number 0-10, "trust": number 0-100, "jealousy": number 0-100 },
  "personality": { "craziness": number 0-10, "manipulation": number 0-10, "assertiveness": number 0-10, "submissiveness": number 0-10, "jealousy": number 0-10, "possessiveness": number 0-10 },
  "tone": number -5 to 5 (-5 wholly wholesome, 5 extreme dark),
  "extractedRules": ["key behavioral rule 1", "key behavioral rule 2", ...],
  "scenarioKeywords": ["keyword1", "keyword2", ...]
}

Rules:
- Base stats on the intensity of described feelings in the prompt
- Higher love for possessive/obsessive prompts, lower for casual
- If the prompt describes dark themes (non-con, violence, ownership), set tone positive
- If it describes wholesome themes (consent, devotion), set tone negative
- Extract behavioral rules verbatim where possible`,
        userContent: `Convert this system prompt into Obsession Engine parameters:\n\n---\n${userPrompt}\n---\n\nRespond with JSON only.`,
    };
}
