import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const testHome = mkdtempSync(join(tmpdir(), 'claude-hud-test-'));

process.env.HOME = testHome;
process.env.USERPROFILE = testHome;
delete process.env.CLAUDE_CONFIG_DIR;
delete process.env.ANTHROPIC_BASE_URL;
delete process.env.ANTHROPIC_API_BASE_URL;
delete process.env.CLAUDE_HUD_ROUTER_MODEL_MAX_AGE_MS;
delete process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE;
