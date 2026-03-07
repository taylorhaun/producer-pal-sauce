// Producer Pal
// Copyright (C) 2026 Taylor Haun
// AI assistance: Claude (Anthropic)
// SPDX-License-Identifier: GPL-3.0-or-later

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  type McpOptions,
  type ToolDefFunction,
} from "#src/tools/shared/tool-framework/define-tool.ts";
import { stemSeparate } from "./stem-separate.ts";

const TOOL_NAME = "ppal-stem-separate";

const inputSchema = {
  audioFile: z.string().describe("Absolute path to the audio file to separate"),
  model: z
    .string()
    .optional()
    .describe(
      "Demucs model name. Default: htdemucs. Use htdemucs_ft for best quality (slower), htdemucs_6s for 6 stems (adds guitar + piano)",
    ),
};

/**
 * Tool definition for stem separation.
 * Runs in Node.js (not V8) — bypasses callLiveApi.
 */
export const toolDefStemSeparate: ToolDefFunction = Object.assign(
  (
    server: McpServer,
    _callLiveApi: unknown,
    _mcpOptions: McpOptions = {},
  ): void => {
    server.registerTool(
      TOOL_NAME,
      {
        title: "Stem Separate",
        description:
          "Separate an audio file into individual stems (vocals, drums, bass, other) using Demucs AI. Returns file paths for each stem. Use ppal-create-track and ppal-create-clip to import stems into Ableton.",
        annotations: { readOnlyHint: false, destructiveHint: false },
        inputSchema: z.object(inputSchema),
      },
      async (args) => {
        const validated = z.object(inputSchema).parse(args);

        return await stemSeparate(validated);
      },
    );
  },
  { toolName: TOOL_NAME },
);
