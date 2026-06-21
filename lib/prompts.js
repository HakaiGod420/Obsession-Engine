import {
    STAGES,
    EVENT_POOL,
    MAX_DYNAMICS_CHARS,
    MAX_AI_STAT_DELTA,
    DARKNESS_MAP,
    DEFAULT_SCENARIOS,
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

export function buildIntimateSceneNudge(profile) {
    if (!profile) return '';
    const stage = getStageForLove(profile.stats.love);
    const im = profile.intensityMultiplier || 1.0;
    const s = profile.stats;
    const intensityWord = im >= 1.5 ? 'overwhelming' : im <= 0.5 ? 'gentle' : 'strong';
    let nudge = `[Intimate Moment] As ${profile.name}, you feel an ${intensityWord} surge of desire. Your lust is ${Math.round(s.lust)}/100, love ${Math.round(s.love)}/100 (${stage ? stage.label : 'unknown'}). `;
    nudge += 'Let this intimate moment unfold naturally in your words and actions. Reflect your arousal and emotional state through behavior, dialogue, and body language. ';
    if (s.love > 70) nudge += 'Your deep obsession colors this moment with possessive tenderness. ';
    else if (s.love > 40) nudge += 'Your growing affection makes this feel meaningful. ';
    if (s.sanity < 5) nudge += 'Your unstable sanity may surface as erratic intensity. ';
    if (profile.personality.possessiveness >= 5) nudge += 'Your possessiveness makes you want to claim and mark. ';
    return nudge;
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

        const scenarioList = (scen, val) => `${scen.name} (id: ${scen.id}, darkness ${DARKNESS_MAP[scen.id] ?? '?'}, ${val?.enabled ? 'ENABLED' : 'disabled'}, intensity ${val?.intensity ?? 0})`;
        const scenariosStr = DEFAULT_SCENARIOS.map(scen => scenarioList(scen, profile.scenarios?.[scen.id])).join('; ');

        charSections.push(
            `Character: ${profile.name}
Stats: Love ${Math.round(s.love)}/100, Lust ${Math.round(s.lust)}/100, Hate ${Math.round(s.hate)}/100, Trust ${Math.round(s.trust)}/100, Jealousy ${Math.round(s.jealousy)}/100, Sanity ${Math.round(s.sanity)}/10
Stage: ${stage ? stage.label : 'unknown'}
Personality: Craziness ${p.craziness}/10, Manipulation ${p.manipulation}/10, Assertiveness ${p.assertiveness}/10, Submissiveness ${p.submissiveness}/10, Jealousy ${p.jealousy}/10, Possessiveness ${p.possessiveness}/10
Growth rates (base delta/msg): Love ${gr.love}, Lust ${gr.lust}, Hate ${gr.hate}, Trust ${gr.trust}, Jealousy ${gr.jealousy}, Sanity ${gr.sanity}
Intensity multiplier: ${im.toFixed(1)}x
Darkness ceiling: ${dc}/10
Tone: ${profile.tone >= 3 ? 'dark' : profile.tone <= -3 ? 'wholesome' : 'neutral'}
Active goals: ${activeGoals || 'none'}
Scenarios: ${scenariosStr}`
        );
    }

    const msgs = recentMessages.map((m, i) => {
        const role = m.is_user ? '{{user}}' : m.name;
        return `${role}: ${m.mes}`;
    }).join('\n\n');

    const charNames = charProfiles.filter(p => p && p.enabled).map(p => p.name);
    const nameList = charNames.map(n => `"${n}"`).join(', ');

    const charBlock = charSections.join('\n\n');

    return {
        systemContent: `You are a relationship dynamics analyzer for a roleplay chat. Analyze the recent conversation and determine how each character's emotional stats should change based on what actually happened in the messages. You also manage the character's goals and scenarios: adding new goals, updating progress, marking them completed, and enabling/disabling scenarios to fit the character's current state.

IMPORTANT - Character names in use: ${nameList}. Use these EXACT full names as keys in the JSON. Do not shorten, split, or alter them.

Respond ONLY with valid parseable JSON using REAL numbers, never placeholders like "number". Example:
{
  "characters": {
    "ExactFullCharacterNameGoesHere": {
      "stats": {
        "love": 2,
        "lust": 0,
        "hate": 0,
        "trust": 3,
        "jealousy": 0,
        "sanity": 0
      },
      "goalProgress": {},
      "completedGoals": ["goalId1"],
      "newGoals": ["New goal title 1", "New goal title 2"],
      "hiddenThoughts": ["Internal thought 1", "Internal thought 2"],
      "scenarioUpdates": {
        "__scenario_id": { "enabled": true, "intensity": 7 }
      }
    }
  }
}

Rules:
- Output ONLY valid JSON with actual numeric values. Never use placeholders like "number" as values.
- CRITICAL: Use the EXACT character names: ${nameList}. Do NOT use shortened versions, nicknames, or partial names. Copy-paste the names exactly.
- Stat deltas represent CHANGE, not absolute values. Range: -${MAX_AI_STAT_DELTA} to +${MAX_AI_STAT_DELTA}.
- Set to 0 if no change. Omit unchanged stats for brevity.
- Only include characters that appear in the conversation.
- LOVE + for: bonding, affection, vulnerability, commitment, comfort. - for: rejection, coldness, betrayal, cruelty.
- LUST + for: physical intimacy, flirting, sexual tension, arousal. - for: disinterest, friendzoning.
- HATE + for: conflict, rivalry, disrespect, threat. - for: reconciliation, forgiveness.
- TRUST + for: honesty, reliability, emotional safety. - for: lies, manipulation, abandonment.
- JEALOUSY + for: attention to rivals, possessiveness triggers. - for: exclusive attention, reassurance.
- SANITY + for: calm, rational, grounded moments. - for: extreme obsession, breakdowns (range -2 to +2, keep it tight).
- Consider the character's PERSONALITY: a submissive character responds differently to dominance than an assertive one.
- Consider the INTENSITY MULTIPLIER: higher = bigger deltas. At 3x, changes can reach ${MAX_AI_STAT_DELTA}. At 0.1x, changes are tiny.
- Consider the DARKNESS CEILING: high darkness means more willingness to decrease sanity/trust, increase hate/jealousy.
- If user was cruel or dismissive, love may DECREASE but obsession (lust despite negative treatment) may INCREASE — toxic dynamics.
- goalProgress is OPTIONAL. Map goal ID to new 0-100 value. Only update goals that were directly advanced by the conversation.
- completedGoals is OPTIONAL. Array of goal IDs that have been fulfilled by the story. Mark a goal completed only when it has clearly been achieved in the narrative.
- newGoals is OPTIONAL. Array of short goal titles (3-8 words) that emerge naturally from the conversation. Add 0-2 new goals per analysis. Goals should be specific, character-driven objectives (e.g., "Make user say I love you", "Isolate user from friends", "Earn user's forgiveness"). Do not add goals that already exist.
- hiddenThoughts is OPTIONAL. Array of 1-3 short internal monologue sentences the character is thinking but would NEVER say aloud. Reflect their true emotional state — raw, unfiltered, intense. If darkness ceiling is high (8+), thoughts can be disturbing. If intensity is high, thoughts should be more obsessive. Keep each thought to 1-2 sentences.
- scenarioUpdates is OPTIONAL. Map scenario ID to { enabled: boolean, intensity: number 1-10 }. Evaluate each scenario against the character's CURRENT stats, personality, and darkness ceiling:
  - ENABLE a scenario if the character's state now fits it (e.g., craziness 7+ and darkness 8+ fits __yandere_violence; high love and trust fits __love_bombing; high lust fits __breeding).
  - DISABLE a scenario if it no longer fits (e.g., character became wholesome, disable __gaslighting/__mind_break).
  - Set intensity 1-10 based on how strongly the scenario applies (higher = more prominent).
  - NEVER enable a scenario whose darkness requirement exceeds the character's darkness ceiling.
  - Only include scenarios that should CHANGE. Don't include scenarios that are already correctly configured.
  - A character should NOT start as yandere from the beginning — only enable dark scenarios after stats have evolved to support them.
- Avoid over-analyzing: a single message usually changes only 1-2 stats, and by small amounts (1-3).
- The intensity multiplier scales how aggressively you push stats. Higher intensity = more dramatic responses to events.`,
        userContent: `Current character states:\n\n${charBlock}\n\n---\n\nRecent conversation:\n\n${msgs}\n\n---\n\nAnalyze and return JSON with stat deltas, goal updates, hidden thoughts, and scenario updates. Only include characters that appeared. Only include fields that are relevant.`,
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

export function buildInitializationPrompt(charData) {
    const desc = charData.description || '';
    const personality = charData.personality || '';
    const firstMsg = charData.firstMessage || '';
    const scenario = charData.scenario || '';
    const mesExample = charData.mesExample || '';
    const cardName = charData.name || '';

    const contextText = [
        cardName ? `Card Name: ${cardName}` : '',
        desc ? `Character Description: ${desc}` : '',
        personality ? `Personality Summary: ${personality}` : '',
        scenario ? `Scenario/Context: ${scenario}` : '',
        firstMsg ? `Greeting Message: ${firstMsg}` : '',
        mesExample ? `Example Dialogue: ${mesExample}` : '',
    ].filter(Boolean).join('\n\n');

    return {
        systemContent: `You initialize relationship dynamics for roleplay character(s). Based on the character's description, personality, and first message, determine their starting emotional stats and behavioral profile.

IMPORTANT - MULTI-CHARACTER CARDS: Some character cards describe MULTIPLE characters (e.g., two sisters, a master and servant, a group of friends, a couple). Carefully scan the description, personality, scenario, first message, and example dialogue for evidence of more than one character entity. If multiple characters are present, return the primary one in the top-level fields and the others in additionalCharacters[].

Respond ONLY with valid parseable JSON using REAL numbers, never placeholders like "number". Example:
{
  "analysis": "Brief explanation of your assessment",
  "canonicalName": "The primary character's actual/correct name as stated in the card",
  "stats": {
    "love": 50,
    "lust": 30,
    "hate": 0,
    "trust": 50,
    "jealousy": 0,
    "sanity": 7
  },
  "personality": {
    "craziness": 3,
    "manipulation": 2,
    "assertiveness": 5,
    "submissiveness": 5,
    "jealousy": 2,
    "possessiveness": 2
  },
  "tone": 0,
  "intensityMultiplier": 1.0,
  "darknessCeiling": 10,
  "growthRates": {
    "love": 0.5,
    "lust": 0.3,
    "hate": 0.1,
    "trust": 0.2,
    "jealousy": 0.1,
    "sanity": -0.05
  },
  "suggestedGoals": ["Goal 1", "Goal 2"],
  "suggestedPresetName": "Short descriptive name",
  "additionalCharacters": [
    {
      "name": "Other Character Name",
      "analysis": "Brief assessment of this character",
      "stats": { "love": 0, "lust": 0, "hate": 0, "trust": 50, "jealousy": 0, "sanity": 10 },
      "personality": { "craziness": 1, "manipulation": 1, "assertiveness": 5, "submissiveness": 5, "jealousy": 1, "possessiveness": 1 },
      "tone": 0,
      "intensityMultiplier": 1.0,
      "darknessCeiling": 10,
      "growthRates": { "love": 0.5, "lust": 0.3, "hate": 0.1, "trust": 0.2, "jealousy": 0.1, "sanity": -0.05 },
      "suggestedGoals": ["Their goal 1"]
    }
  ]
}

Rules:
- Output ONLY valid JSON with actual numeric values. Never use placeholders like "number" or "0-100" as values.
- canonicalName: The primary character's actual name as written in the card. This may differ from the card's filename. If unsure, use the card name.
- additionalCharacters: ONLY include if the card genuinely describes multiple distinct character entities who participate in the roleplay. Do NOT include characters merely mentioned in passing (e.g., "her sister who lives abroad"). Include 0-3 additional characters. Each needs a full profile.
- If only one character exists, leave additionalCharacters as an empty array or omit it.
- LOVE: 0-100. High if the character is affectionate, in love, possessive, devoted. 0 for strangers. 80+ for yandere/obsessed.
- LUST: 0-100. High if the character has strong physical desire, breeding kinks, or sexual themes. Explicit character descriptions or sexual scenarios = 50+.
- HATE: 0-100. High if the character is tsundere, rivals, enemies, conflicted. Usually 0 for pure love.
- TRUST: 0-100. High if the character trusts user (old friends, partners). Low if strangers or betrayal themes.
- JEALOUSY: 0-100. High if possessive, yandere, or explicitly jealous. Low for carefree/poly.
- SANITY: 1-10. Low for crazy/yandere/broken (1-4). High for stable/wholesome (7-10).
- CRAZINESS: 0-10. Scale based on obsessiveness described. Yandere = 7-10. Normal crush = 1-3.
- MANIPULATION: 0-10. High for gaslighters, guilt-trippers, schemers. 0 for innocent/naive.
- ASSERTIVENESS: 0-10. High for dominant/confident. Low for shy/submissive.
- SUBMISSIVENESS: 0-10. High for submissive/devoted. Low for dominant/controlling.
- TONE: -5 to 5. Positive (+3 to +5) for dark/violent/twisted themes. Negative (-5 to -3) for wholesome/consent-focused. 0 for neutral.
- DARKNESS CEILING: 0-10. 8-10 for yandere/violence/mind-break. 3-5 for playful teasing. 0-2 for wholesome.
- INTENSITY: 0.1-3.0. 2.0-3.0 for extreme obsession. 0.5-1.0 for mild. Default 1.0.
- GROWTH RATES: 0-5 per stat. Higher for obsessive characters (love growth 2-4). Lower for slow-burn (0.2-0.5).
- Sanity growth: -3 to 5. Negative (draining) for crazy chars, near 0 for stable.
- Extract any stated character goals into suggestedGoals. Infer reasonable goals if none stated.
- For additional characters, tailor their stats/personality to THEIR role in the card, not the primary character's.`,
        userContent: `Analyze this character and determine initial relationship dynamics:\n\n${contextText}\n\nRespond with JSON only. Use actual numbers, never placeholders.`,
    };
}

