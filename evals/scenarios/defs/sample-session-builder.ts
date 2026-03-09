// Producer Pal
// Copyright (C) 2026 Taylor Haun
// AI assistance: Claude (Anthropic)
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Scenario: Build session view scenes from audio samples with key transposition
 */

import { resolve } from "node:path";
import { type EvalScenario } from "../types.ts";

const sampleFolder = resolve(import.meta.dirname, "../../sample_bag");

export const sampleSessionBuilder: EvalScenario = {
  id: "sample-session-builder",
  description:
    "Build session view scenes from audio samples with key transposition",
  liveSet: "basic-midi-4-track",

  config: {
    sampleFolder,
  },

  messages: [
    "Connect to Ableton Live",

    `I have audio samples in the sample folder. The filenames contain useful info like instrument type, BPM, and musical key. List the samples and tell me what you find — group them by instrument type (guitars, bass, drums, synths, vox, etc.) and identify their keys.`,

    `Create audio tracks for each instrument category you identified. Then load ALL of the samples into clips on their respective tracks. Don't transpose anything yet — we'll handle that when building scenes.`,

    `Now build at least 10 session view scenes using different combinations of these samples. Think like a producer generating musical ideas:

- For each scene, pick an "anchor" sample and keep it in its original key. Transpose the other melodic samples in that scene to match the anchor's key.
- NEVER transpose a sample more than 6 semitones — it starts sounding unnatural beyond that. If two samples are too far apart in key, don't put them in the same scene.
- Drums don't need transposition.
- Some scenes should be full band arrangements (drums + bass + guitar + synth), others sparser (just drums + bass, or guitar + vinyl loop).
- Think about energy and mood — pair moody samples together, funky samples together.
- Different scenes can target different keys depending on which samples combine well.
- Use a variety of samples across scenes, not the same ones repeated.
- This is about idea generation — I want to audition different combos and find what sounds good together.`,
  ],

  assertions: [
    // Turn 0: Connection
    { type: "tool_called", tool: "ppal-connect", turn: 0, score: 5 },

    // Turn 1: List samples via context search
    { type: "tool_called", tool: "ppal-context", turn: 1, score: 3 },

    // Creates audio tracks for instrument categories (may batch into 1 call)
    {
      type: "tool_called",
      tool: "ppal-create-track",
      turn: "any",
      count: { min: 1 },
      score: 5,
    },

    // Loads samples into clips
    {
      type: "tool_called",
      tool: "ppal-create-clip",
      turn: "any",
      count: { min: 14 },
      score: 5,
    },

    // Transposes clips per scene
    {
      type: "tool_called",
      tool: "ppal-update-clip",
      turn: "any",
      count: { min: 5 },
      score: 5,
    },

    // Response mentions transposition approach
    {
      type: "response_contains",
      pattern: /transpose|pitch|semitone|anchor/i,
      turn: "any",
      score: 2,
    },

    // Response mentions scenes
    { type: "response_contains", pattern: /scene/i, turn: 3, score: 2 },

    // LLM quality check
    {
      type: "llm_judge",
      prompt: `Evaluate if the assistant:
1. Created separate audio tracks for different instrument categories
2. Loaded all samples into clips on their respective tracks
3. Built at least 10 scenes with musically intelligent sample combinations
4. Used anchor samples and transposed others to match, rather than forcing one key
5. Never transposed any sample more than 6 semitones
6. Recognized that drum samples don't need transposition
7. Mixed full band arrangements with sparser 2-3 instrument combos
8. Considered mood/energy when pairing samples
9. Used different target keys across scenes based on which samples combine well
10. Used a variety of samples across scenes rather than repeating the same ones`,
      score: 10,
    },
  ],
};
