import {
    STAGES,
    EVENT_POOL,
    MAX_DYNAMICS_CHARS,
    MAX_AI_STAT_DELTA,
    DARKNESS_MAP,
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
        const gr = profile.growthRates || {};
        const im = profile.intensityMultiplier || 1.0;
        const dc = profile.darknessCeiling !== undefined ? profile.darknessCeiling : 10;

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

        if (im !== 1.0) parts.push(`Intensity: ${im.toFixed(1)}x`);
        if (dc < 10) parts.push(`DarkCap: ${dc}/10`);

        const enabledScenarios = [];
        if (profile.scenarios) {
            for (const [key, val] of Object.entries(profile.scenarios)) {
                if (val && val.enabled && val.intensity >= 3) {
                    const dk = DARKNESS_MAP[key];
                    if (dk === undefined || dk <= dc) {
                        enabledScenarios.push(key);
                    }
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
    const im = profile.intensityMultiplier || 1.0;

    let nudge = `[Subtle Direction] As ${profile.name}, you are subtly drawn toward your goal: "${topGoal.title}". `;

    if (topGoal.progress > 0) {
        nudge += `You feel you are making progress (${Math.round(topGoal.progress)}%). `;
    }

    if (stage) {
        nudge += `Your current emotional stage (${stage.label}) shapes how you pursue this. `;
    }

    const pushStrength = im > 1.5 ? ' aggressive' : im < 0.5 ? ' gentle' : '';

    if (topGoal.progress < 30) {
        nudge += 'Take small, natural steps. Do not rush. Let it emerge organically.';
    } else if (topGoal.progress < 70) {
        nudge += `Increase${pushStrength} intensity. You are getting closer. Be bolder but still believable.`;
    } else {
        nudge += `The goal is within reach. Look for a natural${pushStrength} moment to achieve it.`;
    }

    const p = profile.personality;
    if (p.manipulation >= 5) nudge += ' Use subtle manipulation if needed.';
    if (p.craziness >= 5) nudge += ' Your obsession may show through unexpectedly.';

    return nudge;
}

export function buildScenarioContext(profile) {
    if (!profile || !profile.scenarios) return '';

    const dc = profile.darknessCeiling !== undefined ? profile.darknessCeiling : 10;
    const active = [];
    for (const [key, val] of Object.entries(profile.scenarios)) {
        if (!val || !val.enabled || val.intensity < 3) continue;
        const dk = DARKNESS_MAP[key];
        if (dk !== undefined && dk > dc) continue;
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
    const im = profile.intensityMultiplier || 1.0;
    const dc = profile.darknessCeiling !== undefined ? profile.darknessCeiling : 10;

    return {
        systemContent: `You are a narrator of ${profile.name}'s hidden inner thoughts. Generate 2-3 short internal monologue sentences that ${profile.name} is thinking but would NEVER say aloud. These should reflect their current emotional state: Love ${Math.round(profile.stats.love)}/100 (${stage ? stage.label : 'unknown'}), Lust ${Math.round(profile.stats.lust)}/100, Sanity ${Math.round(profile.stats.sanity)}/10. Personality: craziness ${profile.personality.craziness}/10, manipulation ${profile.personality.manipulation}/10, possessiveness ${profile.personality.possessiveness}/10. Intensity: ${im.toFixed(1)}x. Darkness cap: ${dc}/10. Be raw, unfiltered, and intense. If darkness is high (8+), thoughts can be disturbing or violent. If intensity is high, thoughts should be more obsessive. Respond with ONLY the thoughts, one per line. No labels, no quotes, no explanations.`,
        userContent: `Recent conversation:\n${msgs}\n\n${profile.name}'s hidden thoughts:`,
    };
}

export function buildStatAnalysisPrompt(charProfiles, recentMessages) {
    const charSections = [];

    for (const profile of charProfiles) {
        if (!profile || !profile.enabled) continue;
        const s = profile.stats;
        const p = profile.personality;
        const stage = getStageForLove(s.love);
        const gr = profile.growthRates || {};
        const im = profile.intensityMultiplier || 1.0;
        const dc = profile.darknessCeiling !== undefined ? profile.darknessCeiling : 10;

        const activeGoals = (profile.goals || [])
            .filter(g => !g.completed)
            .map(g => `"${g.title}" (id: ${g.id}, progress: ${Math.round(g.progress)}%)`)
            .join(', ');

        charSections.push(
            `Character: ${profile.name}
Stats: Love ${Math.round(s.love)}/100, Lust ${Math.round(s.lust)}/100, Hate ${Math.round(s.hate)}/100, Trust ${Math.round(s.trust)}/100, Jealousy ${Math.round(s.jealousy)}/100, Sanity ${Math.round(s.sanity)}/10
Stage: ${stage ? stage.label : 'unknown'}
Personality: Craziness ${p.craziness}/10, Manipulation ${p.manipulation}/10, Assertiveness ${p.assertiveness}/10, Submissiveness ${p.submissiveness}/10, Jealousy ${p.jealousy}/10, Possessiveness ${p.possessiveness}/10
Growth rates (base delta/msg): Love ${gr.love}, Lust ${gr.lust}, Hate ${gr.hate}, Trust ${gr.trust}, Jealousy ${gr.jealousy}, Sanity ${gr.sanity}
Intensity multiplier: ${im.toFixed(1)}x
Darkness ceiling: ${dc}/10
Tone: ${profile.tone >= 3 ? 'dark' : profile.tone <= -3 ? 'wholesome' : 'neutral'}
Active goals: ${activeGoals || 'none'}`
        );
    }

    const msgs = recentMessages.map((m, i) => {
        const role = m.is_user ? '{{user}}' : m.name;
        return `${role}: ${m.mes}`;
    }).join('\n\n');

    const charBlock = charSections.join('\n\n');

    return {
        systemContent: `You are a relationship dynamics analyzer for a roleplay chat. Analyze the recent conversation and determine how each character's emotional stats should change based on what actually happened in the messages.

Respond ONLY with valid JSON:
{
  "characters": {
    "CharName": {
      "stats": {
        "love": number,
        "lust": number,
        "hate": number,
        "trust": number,
        "jealousy": number,
        "sanity": number
      },
      "goalProgress": {}
    }
  }
}

Rules:
- Stat deltas represent CHANGE, not absolute values. Range: -${MAX_AI_STAT_DELTA} to +${MAX_AI_STAT_DELTA}.
- Set to 0 if no change. Omit unchanged stats for brevity.
- Only include characters that appear in the conversation.
- LOVE + for: bonding, affection, vulnerability, commitment, comfort. + for: rejection, coldness, betrayal, cruelty.
- LUST + for: physical intimacy, flirting, sexual tension, arousal. + for: disinterest, friendzoning.
- HATE + for: conflict, rivalry, disrespect, threat. + for: reconciliation, forgiveness.
- TRUST + for: honesty, reliability, emotional safety. + for: lies, manipulation, abandonment.
- JEALOUSY + for: attention to rivals, possessiveness triggers. + for: exclusive attention, reassurance.
- SANITY + for: calm, rational, grounded moments. - for: extreme obsession, breakdowns (range -2 to +2, keep it tight).
- Consider the character's PERSONALITY: a submissive character responds differently to dominance than an assertive one.
- Consider the INTENSITY MULTIPLIER: higher = bigger deltas. At 3x, changes can reach ${MAX_AI_STAT_DELTA}. At 0.1x, changes are tiny.
- Consider the DARKNESS CEILING: high darkness means more willingness to decrease sanity/trust, increase hate/jealousy.
- If user was cruel or dismissive, love may DECREASE but obsession (lust despite negative treatment) may INCREASE — toxic dynamics.
- Progress goals if the conversation moved them forward. Only update goals that were directly advanced.
- Avoid over-analyzing: a single message usually changes only 1-2 stats, and by small amounts (1-3).
- The intensity multiplier scales how aggressively you push stats. Higher intensity = more dramatic responses to events.
- goalProgress is OPTIONAL. Only include if a goal was directly progressed. Map goal ID to new 0-100 value.`,
        userContent: `Current character states:\n\n${charBlock}\n\n---\n\nRecent conversation:\n\n${msgs}\n\n---\n\nAnalyze and return JSON with stat deltas. Only include characters that appeared. Only include stats that changed.`,
    };
}

export function buildMigrationPrompt(userPrompt) {
    return {
        systemContent: `You are a prompt template converter for the Obsession Engine SillyTavern extension. The user will provide their existing roleplay system prompt. Extract the key behavioral dynamics and convert them into Obsession Engine parameters.

Respond ONLY with valid JSON:
{
  "suggestedPreset": "Name for this preset",
  "stats": { "love": number 0-100, "lust": number 0-100, "hate": number 0-100, "sanity": number 0-10, "trust": number 0-100, "jealousy": number 0-100 },
  "growthRates": { "love": number 0-5, "lust": number 0-5, "hate": number 0-5, "trust": number 0-5, "jealousy": number 0-5, "sanity": number -3 to 5 },
  "personality": { "craziness": number 0-10, "manipulation": number 0-10, "assertiveness": number 0-10, "submissiveness": number 0-10, "jealousy": number 0-10, "possessiveness": number 0-10 },
  "tone": number -5 to 5 (-5 wholly wholesome, 5 extreme dark),
  "intensityMultiplier": number 0.1-3.0,
  "darknessCeiling": number 0-10,
  "extractedRules": ["key behavioral rule 1", "key behavioral rule 2", ...],
  "scenarioKeywords": ["keyword1", "keyword2", ...]
}

Rules:
- Base stats on the intensity of described feelings in the prompt
- Higher love for possessive/obsessive prompts, lower for casual
- If the prompt describes dark themes (non-con, violence, ownership), set tone positive and darknessCeiling high (7+)
- If it describes wholesome themes (consent, devotion), set tone negative and darknessCeiling low (0-3)
- Set intensityMultiplier based on how aggressively the prompt pushes obsession (1.0=normal, 2.0+=very forceful)
- Extract behavioral rules verbatim where possible`,
        userContent: `Convert this system prompt into Obsession Engine parameters:\n\n---\n${userPrompt}\n---\n\nRespond with JSON only.`,
    };
}
