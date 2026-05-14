import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PassThrough } from 'node:stream';
import { readStdin, getModelName, getProviderLabel } from '../dist/stdin.js';

test('readStdin returns null for TTY input', async () => {
  const originalIsTTY = process.stdin.isTTY;
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

  try {
    const result = await readStdin();
    assert.equal(result, null);
  } finally {
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});

test('readStdin returns null on stream errors', async () => {
  const originalIsTTY = process.stdin.isTTY;
  const originalSetEncoding = process.stdin.setEncoding;
  Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
  process.stdin.setEncoding = () => {
    throw new Error('boom');
  };

  try {
    const result = await readStdin();
    assert.equal(result, null);
  } finally {
    process.stdin.setEncoding = originalSetEncoding;
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});

function createPipe() {
  const stream = new PassThrough();
  Object.defineProperty(stream, 'isTTY', { value: false, configurable: true });
  return stream;
}

test('readStdin parses valid JSON without waiting for EOF', async () => {
  const stream = createPipe();
  const resultPromise = readStdin(stream, { firstByteTimeoutMs: 20, idleTimeoutMs: 10 });

  stream.write('{"cwd":"/tmp/project","model":{"display_name":"Opus"}}');

  const result = await resultPromise;
  assert.deepEqual(result, {
    cwd: '/tmp/project',
    model: { display_name: 'Opus' },
  });
});

test('readStdin parses JSON split across multiple chunks', async () => {
  const stream = createPipe();
  const resultPromise = readStdin(stream, { firstByteTimeoutMs: 20, idleTimeoutMs: 10 });

  stream.write('{"cwd":"/tmp/project",');
  stream.write('"model":{"display_name":"Opus"}}');

  const result = await resultPromise;
  assert.deepEqual(result, {
    cwd: '/tmp/project',
    model: { display_name: 'Opus' },
  });
});

test('readStdin returns null when a non-TTY stream never produces data', async () => {
  const stream = createPipe();
  const result = await readStdin(stream, { firstByteTimeoutMs: 10, idleTimeoutMs: 5 });
  assert.equal(result, null);
});

test('readStdin returns null when partial JSON goes idle', async () => {
  const stream = createPipe();
  const resultPromise = readStdin(stream, { firstByteTimeoutMs: 20, idleTimeoutMs: 10 });

  stream.write('{"cwd":"/tmp/project"');

  const result = await resultPromise;
  assert.equal(result, null);
});

test('readStdin applies context window size override from env', async () => {
  const original = process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE;
  const stream = createPipe();
  const resultPromise = readStdin(stream, { firstByteTimeoutMs: 20, idleTimeoutMs: 10 });

  try {
    process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE = '270000';
    stream.write(JSON.stringify({
      context_window: {
        context_window_size: 200000,
        current_usage: {
          input_tokens: 40000,
          cache_creation_input_tokens: 3000,
          cache_read_input_tokens: 2000,
        },
      },
    }));

    const result = await resultPromise;
    assert.equal(result?.context_window?.context_window_size, 270000);
    assert.equal(result?.context_window?.used_percentage, 17);
  } finally {
    if (original === undefined) delete process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE;
    else process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE = original;
  }
});

test('getModelName prefers session router model state', () => {
  const env = snapshotRouterEnv();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hud-router-'));
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const transcriptPath = path.join(root, `${sessionId}.jsonl`);
  const sessionDir = path.join(root, sessionId);

  try {
    fs.writeFileSync(transcriptPath, '{}\n');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'ccr-model.json'), JSON.stringify({
      model: 'openrouter/claude-sonnet-4.6',
      provider: 'openrouter',
      requestedModel: 'claude-sonnet-4-6',
    }));
    process.env.CLAUDE_HUD_ROUTER_MODEL = '1';

    const stdin = { transcript_path: transcriptPath, model: { display_name: 'Claude Sonnet 4.6' } };
    assert.equal(getModelName(stdin), 'openrouter/claude-sonnet-4.6');
    assert.equal(getProviderLabel(stdin), 'openrouter');
  } finally {
    restoreRouterEnv(env);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('getModelName falls back to latest router model state', () => {
  const env = snapshotRouterEnv();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hud-router-'));
  const statePath = path.join(root, 'latest-model.json');

  try {
    fs.writeFileSync(statePath, JSON.stringify({ model: 'gemini-2.5-pro', provider: 'gemini' }));
    process.env.CLAUDE_HUD_ROUTER_MODEL = '1';
    process.env.CLAUDE_HUD_ROUTER_MODEL_STATE_PATH = statePath;

    const stdin = { model: { display_name: 'Claude Opus 4.7' } };
    assert.equal(getModelName(stdin), 'gemini-2.5-pro');
    assert.equal(getProviderLabel(stdin), 'gemini');
  } finally {
    restoreRouterEnv(env);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function snapshotRouterEnv() {
  return {
    CLAUDE_HUD_ROUTER_MODEL: process.env.CLAUDE_HUD_ROUTER_MODEL,
    CLAUDE_HUD_ROUTER_MODEL_STATE_PATH: process.env.CLAUDE_HUD_ROUTER_MODEL_STATE_PATH,
    CLAUDE_HUD_ROUTER_MODEL_MAX_AGE_MS: process.env.CLAUDE_HUD_ROUTER_MODEL_MAX_AGE_MS,
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
    ANTHROPIC_API_BASE_URL: process.env.ANTHROPIC_API_BASE_URL,
  };
}

function restoreRouterEnv(env) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

// getProviderLabel tests

test('getProviderLabel returns Bedrock when CLAUDE_CODE_USE_BEDROCK=1', () => {
  const orig = process.env.CLAUDE_CODE_USE_BEDROCK;
  const routerEnv = snapshotRouterEnv();
  try {
    process.env.CLAUDE_CODE_USE_BEDROCK = '1';
    process.env.CLAUDE_HUD_ROUTER_MODEL = '0';
    const result = getProviderLabel({ model: { id: 'claude-sonnet-4-6' } });
    assert.equal(result, 'Bedrock');
  } finally {
    if (orig === undefined) delete process.env.CLAUDE_CODE_USE_BEDROCK;
    else process.env.CLAUDE_CODE_USE_BEDROCK = orig;
    restoreRouterEnv(routerEnv);
  }
});

test('getProviderLabel returns null when CLAUDE_CODE_USE_BEDROCK is not set', () => {
  const orig = process.env.CLAUDE_CODE_USE_BEDROCK;
  const routerEnv = snapshotRouterEnv();
  try {
    delete process.env.CLAUDE_CODE_USE_BEDROCK;
    process.env.CLAUDE_HUD_ROUTER_MODEL = '0';
    const result = getProviderLabel({ model: { id: 'anthropic.claude-sonnet-4-6' } });
    assert.equal(result, null);
  } finally {
    if (orig === undefined) delete process.env.CLAUDE_CODE_USE_BEDROCK;
    else process.env.CLAUDE_CODE_USE_BEDROCK = orig;
    restoreRouterEnv(routerEnv);
  }
});

test('getProviderLabel returns null for cross-region model ID without env var', () => {
  const orig = process.env.CLAUDE_CODE_USE_BEDROCK;
  const routerEnv = snapshotRouterEnv();
  try {
    delete process.env.CLAUDE_CODE_USE_BEDROCK;
    process.env.CLAUDE_HUD_ROUTER_MODEL = '0';
    const result = getProviderLabel({ model: { id: 'us.anthropic.claude-sonnet-4-6' } });
    assert.equal(result, null);
  } finally {
    if (orig === undefined) delete process.env.CLAUDE_CODE_USE_BEDROCK;
    else process.env.CLAUDE_CODE_USE_BEDROCK = orig;
    restoreRouterEnv(routerEnv);
  }
});

test('getProviderLabel returns null when CLAUDE_CODE_USE_BEDROCK=0', () => {
  const orig = process.env.CLAUDE_CODE_USE_BEDROCK;
  const routerEnv = snapshotRouterEnv();
  try {
    process.env.CLAUDE_CODE_USE_BEDROCK = '0';
    process.env.CLAUDE_HUD_ROUTER_MODEL = '0';
    const result = getProviderLabel({ model: { id: 'anthropic.claude-sonnet-4-6' } });
    assert.equal(result, null);
  } finally {
    if (orig === undefined) delete process.env.CLAUDE_CODE_USE_BEDROCK;
    else process.env.CLAUDE_CODE_USE_BEDROCK = orig;
    restoreRouterEnv(routerEnv);
  }
});
