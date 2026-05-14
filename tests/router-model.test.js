import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getRouterModelInfo } from '../dist/plus/router-model.js';

test('router model resolver prefers session state over latest state', () => {
  const env = snapshotEnv();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hud-router-'));
  const sessionId = '22222222-2222-4222-8222-222222222222';
  const transcriptPath = path.join(root, `${sessionId}.jsonl`);
  const sessionDir = path.join(root, sessionId);
  const latestPath = path.join(root, 'latest-model.json');

  try {
    fs.writeFileSync(transcriptPath, '{}\n');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'ccr-model.json'), JSON.stringify({ model: 'session-model', provider: 'openrouter' }));
    fs.writeFileSync(latestPath, JSON.stringify({ model: 'latest-model', provider: 'fallback' }));
    process.env.CLAUDE_HUD_ROUTER_MODEL = '1';
    process.env.CLAUDE_HUD_ROUTER_MODEL_STATE_PATH = latestPath;

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

test('router model resolver ignores stale state', () => {
  const env = snapshotEnv();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hud-router-'));
  const latestPath = path.join(root, 'latest-model.json');

  try {
    fs.writeFileSync(latestPath, JSON.stringify({ model: 'stale-model' }));
    const old = new Date(Date.now() - 10_000);
    fs.utimesSync(latestPath, old, old);
    process.env.CLAUDE_HUD_ROUTER_MODEL = '1';
    process.env.CLAUDE_HUD_ROUTER_MODEL_STATE_PATH = latestPath;
    process.env.CLAUDE_HUD_ROUTER_MODEL_MAX_AGE_MS = '1';

    assert.equal(getRouterModelInfo({}), null);
  } finally {
    restoreEnv(env);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function snapshotEnv() {
  return {
    CLAUDE_HUD_ROUTER_MODEL: process.env.CLAUDE_HUD_ROUTER_MODEL,
    CLAUDE_HUD_ROUTER_MODEL_STATE_PATH: process.env.CLAUDE_HUD_ROUTER_MODEL_STATE_PATH,
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
