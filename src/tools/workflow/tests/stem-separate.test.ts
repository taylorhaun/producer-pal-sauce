// Producer Pal
// Copyright (C) 2026 Taylor Haun
// AI assistance: Claude (Anthropic)
// SPDX-License-Identifier: GPL-3.0-or-later

import { execFile } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import { type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stemSeparate } from "../stem-separate.ts";
import { toolDefStemSeparate } from "../stem-separate.def.ts";

vi.mock(import("node:child_process"), () => ({ execFile: vi.fn() }) as never);

vi.mock(
  import("node:fs/promises"),
  () => ({ access: vi.fn(), readdir: vi.fn() }) as never,
);

const mockExecFile = vi.mocked(execFile);
const mockAccess = vi.mocked(access);
const mockReaddir = vi.mocked(readdir);

type ExecFileCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

function resultText(result: CallToolResult): string {
  const item = result.content[0];

  return item != null && "text" in item ? item.text : "";
}

function mockWhichDemucsSuccess(): void {
  mockExecFile.mockImplementationOnce(
    (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as ExecFileCallback)(null, "/usr/local/bin/demucs\n", "");

      return undefined as never;
    },
  );
}

function mockDemucsSuccess(): void {
  mockExecFile.mockImplementationOnce(
    (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as ExecFileCallback)(null, "", "");

      return undefined as never;
    },
  );
}

function mockExecFileError(message: string): void {
  mockExecFile.mockImplementationOnce(
    (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as ExecFileCallback)(new Error(message), "", "");

      return undefined as never;
    },
  );
}

describe("stemSeparate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns error when audio file not found", async () => {
    mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

    const result = await stemSeparate({ audioFile: "/no/such/file.mp3" });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("Audio file not found");
  });

  it("returns error when demucs is not installed", async () => {
    // First access call succeeds (audio file check), rest reject (candidate paths)
    mockAccess.mockResolvedValueOnce(undefined);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockExecFileError("not found");

    const result = await stemSeparate({ audioFile: "/path/to/song.mp3" });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("Demucs is not installed");
  });

  it("returns error when demucs process fails", async () => {
    mockAccess.mockResolvedValueOnce(undefined);
    mockWhichDemucsSuccess();
    mockExecFileError("Out of memory");

    const result = await stemSeparate({ audioFile: "/path/to/song.mp3" });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("Demucs separation failed");
    expect(resultText(result)).toContain("Out of memory");
  });

  it("returns stem file paths on success", async () => {
    mockAccess.mockResolvedValueOnce(undefined);
    mockWhichDemucsSuccess();
    mockDemucsSuccess();
    mockReaddir.mockResolvedValueOnce([
      "vocals.wav",
      "drums.wav",
      "bass.wav",
      "other.wav",
    ] as unknown as never);

    const result = await stemSeparate({ audioFile: "/path/to/song.mp3" });

    expect(result.isError).toBeUndefined();
    const text = resultText(result);

    expect(text).toContain("4 stems");
    expect(text).toContain("vocals");
    expect(text).toContain("drums");
    expect(text).toContain("bass");
    expect(text).toContain("other");
    expect(text).toContain("ppal-create-track");
  });

  it("passes custom model to demucs", async () => {
    mockAccess.mockResolvedValueOnce(undefined);
    mockWhichDemucsSuccess();
    mockDemucsSuccess();
    mockReaddir.mockResolvedValueOnce(["vocals.wav"] as unknown as never);

    await stemSeparate({
      audioFile: "/path/to/song.mp3",
      model: "htdemucs_6s",
    });

    // Second execFile call is the demucs invocation
    const demucsArgs = mockExecFile.mock.calls[1]?.[1] as string[];

    expect(demucsArgs).toContain("htdemucs_6s");
  });

  it("returns error when no stem files found", async () => {
    mockAccess.mockResolvedValueOnce(undefined);
    mockWhichDemucsSuccess();
    mockDemucsSuccess();
    mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));

    const result = await stemSeparate({ audioFile: "/path/to/song.mp3" });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("No stem files found");
  });
});

describe("toolDefStemSeparate", () => {
  it("registers tool and handler calls stemSeparate", async () => {
    let registeredHandler: ((args: object) => Promise<CallToolResult>) | null =
      null;

    const mockServer = {
      registerTool: (
        _name: string,
        _config: object,
        handler: (args: object) => Promise<CallToolResult>,
      ) => {
        registeredHandler = handler;
      },
    };

    toolDefStemSeparate(mockServer as never, vi.fn() as never, {});

    expect(registeredHandler).not.toBeNull();

    // Call the handler — it calls stemSeparate which hits our mocked access
    mockAccess.mockRejectedValueOnce(new Error("ENOENT"));
    const result = await registeredHandler!({
      audioFile: "/test.mp3",
    });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("Audio file not found");
  });

  it("has correct tool name", () => {
    expect(toolDefStemSeparate.toolName).toBe("ppal-stem-separate");
  });
});
