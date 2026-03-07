// Producer Pal
// Copyright (C) 2026 Taylor Haun
// AI assistance: Claude (Anthropic)
// SPDX-License-Identifier: GPL-3.0-or-later

import { execFile } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { type CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const DEMUCS_TIMEOUT_MS = 600_000; // 10 minutes

interface StemSeparateArgs {
  audioFile: string;
  model?: string;
}

/**
 * Separate an audio file into stems using Demucs
 *
 * @param args - Tool arguments
 * @returns MCP tool result with stem file paths
 */
export async function stemSeparate(
  args: StemSeparateArgs,
): Promise<CallToolResult> {
  const { audioFile, model = "htdemucs" } = args;

  try {
    await access(audioFile);
  } catch {
    return errorResult(`Audio file not found: ${audioFile}`);
  }

  const demucsPath = await findDemucs();

  if (!demucsPath) {
    return errorResult(
      "Demucs is not installed. Install it with: pip install demucs",
    );
  }

  const basename = path.basename(audioFile, path.extname(audioFile));
  const outputDir = path.join(path.dirname(audioFile), `${basename}_stems`);

  try {
    await execAsync(
      demucsPath,
      ["-n", model, "-d", "cpu", "-o", outputDir, audioFile],
      { timeout: DEMUCS_TIMEOUT_MS },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    return errorResult(`Demucs separation failed: ${msg}`);
  }

  const stemsDir = path.join(outputDir, model, basename);
  const stems = await readStemFiles(stemsDir);

  if (Object.keys(stems).length === 0) {
    return errorResult(`No stem files found in ${stemsDir}`);
  }

  const stemList = Object.entries(stems)
    .map(([name, filePath]) => `  ${name}: ${filePath}`)
    .join("\n");

  return {
    content: [
      {
        type: "text",
        text: [
          `Separated "${basename}" into ${Object.keys(stems).length} stems:`,
          stemList,
          "",
          "Use ppal-create-track and ppal-create-clip with the sampleFile parameter to import these stems into Ableton.",
        ].join("\n"),
      },
    ],
  };
}

function execAsync(
  cmd: string,
  args: string[],
  opts: { timeout?: number } = {},
): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (error, stdout) => {
      if (error) reject(error);
      else resolve({ stdout: stdout.toString() });
    });
  });
}

async function findDemucs(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("which", ["demucs"], { timeout: 5000 });

    return stdout.trim();
  } catch {
    return null;
  }
}

async function readStemFiles(
  stemsDir: string,
): Promise<Record<string, string>> {
  const stems: Record<string, string> = {};

  try {
    const files = await readdir(stemsDir);

    for (const file of files) {
      if (file.endsWith(".wav")) {
        const name = path.basename(file, ".wav");

        stems[name] = path.join(stemsDir, file);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return stems;
}

function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
