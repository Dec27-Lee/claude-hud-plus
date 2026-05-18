import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getRouterModelInfo, getRouterModelStatus } from '../dist/plus/router-model.js';

test('router model resolver reads session state when Claude base URL matches CCR config', () => {
  const env = snapshotEnv();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hud-router-'));
  const sessionId = '22222222-2222-4222-8222-222222222222';
  const transcriptPath = path.join(root, `${sessionId}.jsonl`);
  const sessionDir = path.join(root, sessionId);

  try {
    useHome(root);
    writeCcrConfig(root, { host: 'localhost', port: 4567 });
    fs.writeFileSync(transcriptPath, '{}\n');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'ccr-model.json'), JSON.stringify({ model: 'session-model', provider: 'openrouter' }));
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:4567/v1/messages';

    assert.deepEqual(getRouterModelInfo({ transcript_path: transcriptPath }), {
      model: 'session-model',
      provider: 'openrouter',
      requestedModel: null,
      source: 'session',
    });
  } finally {
    restoreEnv(env);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('router model resolver ignores session state when Claude base URL does not match CCR config', () => {
  const env = snapshotEnv();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hud-router-'));
  const sessionId = '33333333-3333-4333-8333-333333333333';
  const transcriptPath = path.join(root, `${sessionId}.jsonl`);
  const sessionDir = path.join(root, sessionId);

  try {
    useHome(root);
    writeCcrConfig(root, { host: '127.0.0.1', port: 3456 });
    fs.writeFileSync(transcriptPath, '{}\n');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'ccr-model.json'), JSON.stringify({ model: 'session-model', provider: 'openrouter' }));
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:4567';

    assert.equal(getRouterModelInfo({ transcript_path: transcriptPath }), null);
  } finally {
    restoreEnv(env);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('router model resolver accepts wildcard CCR host for loopback base URL with matching port', () => {
  const env = snapshotEnv();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hud-router-'));
  const sessionId = '44444444-4444-4444-8444-444444444444';
  const transcriptPath = path.join(root, `${sessionId}.jsonl`);
  const sessionDir = path.join(root, sessionId);

  try {
    useHome(root);
    writeCcrConfig(root, { host: '0.0.0.0', port: 3456 });
    fs.writeFileSync(transcriptPath, '{}\n');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'ccr-model.json'), JSON.stringify({ model: 'wildcard-model', provider: 'ccr' }));
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:3456';

    assert.deepEqual(getRouterModelInfo({ transcript_path: transcriptPath }), {
      model: 'wildcard-model',
      provider: 'ccr',
      requestedModel: null,
      source: 'session',
    });
  } finally {
    restoreEnv(env);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('router model resolver ignores stale session state', () => {
  const env = snapshotEnv();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hud-router-'));
  const sessionId = '55555555-5555-4555-8555-555555555555';
  const transcriptPath = path.join(root, `${sessionId}.jsonl`);
  const sessionDir = path.join(root, sessionId);
  const statePath = path.join(sessionDir, 'ccr-model.json');

  try {
    useHome(root);
    writeCcrConfig(root, { host: '127.0.0.1', port: 3456 });
    fs.writeFileSync(transcriptPath, '{}\n');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({ model: 'stale-model' }));
    const old = new Date(Date.now() - 10_000);
    fs.utimesSync(statePath, old, old);
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:3456';
    process.env.CLAUDE_HUD_ROUTER_MODEL_MAX_AGE_MS = '1';

    assert.equal(getRouterModelInfo({ transcript_path: transcriptPath }), null);
  } finally {
    restoreEnv(env);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('router model status reports missing session state when using CCR without a state file', () => {
  const env = snapshotEnv();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hud-router-'));
  const sessionId = '66666666-6666-4666-8666-666666666666';
  const transcriptPath = path.join(root, `${sessionId}.jsonl`);

  try {
    useHome(root);
    writeCcrConfig(root, { host: '127.0.0.1', port: 3456 });
    fs.writeFileSync(transcriptPath, '{}\n');
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:3456';

    assert.deepEqual(getRouterModelStatus({ transcript_path: transcriptPath }), { kind: 'missing-session-state' });
    assert.equal(getRouterModelInfo({ transcript_path: transcriptPath }), null);
  } finally {
    restoreEnv(env);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('router model resolver returns null without a transcript session path', () => {
  const env = snapshotEnv();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hud-router-'));

  try {
    useHome(root);
    writeCcrConfig(root, { host: '127.0.0.1', port: 3456 });
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:3456';

    assert.equal(getRouterModelInfo({}), null);
  } finally {
    restoreEnv(env);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function writeCcrConfig(root, { host, port }) {
  const ccrDir = path.join(root, '.claude-code-router');
  fs.mkdirSync(ccrDir, { recursive: true });
  fs.writeFileSync(path.join(ccrDir, 'config.json'), JSON.stringify({ HOST: host, PORT: port }));
}

function useHome(root) {
  process.env.HOME = root;
  process.env.USERPROFILE = root;
}

function snapshotEnv() {
  return {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    CLAUDE_HUD_ROUTER_MODEL_MAX_AGE_MS: process.env.CLAUDE_HUD_ROUTER_MODEL_MAX_AGE_MS,
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
    ANTHROPIC_API_BASE_URL: process.env.ANTHROPIC_API_BASE_URL,
  };
}

function restoreEnv(env) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
