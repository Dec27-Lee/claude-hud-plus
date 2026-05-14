import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { StdinData } from '../types.js';

const CACHE_TTL_MS = 1500;
const DEFAULT_STATE_MAX_AGE_MS = 120000;

type RouterModelCacheEntry = {
  value: RouterModelInfo | null;
  expiresAt: number;
  statePath?: string;
  stateMtimeMs?: number;
};

type TranscriptSessionCacheEntry = {
  transcriptPath: string;
  sessionId: string | null;
};

export type RouterModelInfo = {
  model: string;
  provider: string | null;
  requestedModel: string | null;
  source: 'session' | 'latest';
};

let routerModelCache: RouterModelCacheEntry | null = null;
let transcriptSessionCache: TranscriptSessionCacheEntry | null = null;

export function getRouterModelInfo(stdin: StdinData): RouterModelInfo | null {
  if (!isRouterModelEnabled()) {
    return null;
  }

  const now = Date.now();
  const transcriptPath = stdin.transcript_path;
  const sessionId = getSessionIdFromTranscriptPath(transcriptPath);
  if (sessionId && typeof transcriptPath === 'string' && transcriptPath.trim()) {
    const sessionModel = readRouterModelState(getClaudeSessionModelPath(transcriptPath, sessionId), now, 'session');
    if (sessionModel) {
      return sessionModel;
    }
  }

  return readRouterModelState(getLatestModelPath(), now, 'latest');
}

function readRouterModelState(statePath: string, now: number, source: RouterModelInfo['source']): RouterModelInfo | null {
  if (routerModelCache && routerModelCache.statePath === statePath && routerModelCache.expiresAt > now) {
    return routerModelCache.value;
  }

  try {
    const stat = fs.statSync(statePath);
    if (now - stat.mtimeMs > getStateMaxAgeMs()) {
      routerModelCache = {
        value: null,
        expiresAt: now + CACHE_TTL_MS,
        statePath,
        stateMtimeMs: stat.mtimeMs,
      };
      return null;
    }

    if (
      routerModelCache &&
      routerModelCache.statePath === statePath &&
      routerModelCache.stateMtimeMs === stat.mtimeMs
    ) {
      routerModelCache.expiresAt = now + CACHE_TTL_MS;
      return routerModelCache.value;
    }

    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8')) as Record<string, unknown>;
    const model = readString(parsed.model);
    const value = model
      ? {
          model,
          provider: readString(parsed.provider),
          requestedModel: readString(parsed.requestedModel) ?? readString(parsed.request_model) ?? readString(parsed.localModel),
          source,
        }
      : null;

    routerModelCache = {
      value,
      expiresAt: now + CACHE_TTL_MS,
      statePath,
      stateMtimeMs: stat.mtimeMs,
    };
    return value;
  } catch {
    routerModelCache = { value: null, expiresAt: now + CACHE_TTL_MS, statePath };
    return null;
  }
}

function getSessionIdFromTranscriptPath(transcriptPath: string | undefined): string | null {
  if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) {
    return null;
  }

  if (transcriptSessionCache && transcriptSessionCache.transcriptPath === transcriptPath) {
    return transcriptSessionCache.sessionId;
  }

  const basename = path.basename(transcriptPath, path.extname(transcriptPath));
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(basename)) {
    transcriptSessionCache = { transcriptPath, sessionId: basename };
    return basename;
  }

  let fd: number | null = null;
  try {
    fd = fs.openSync(transcriptPath, 'r');
    const buffer = Buffer.alloc(65536);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const firstChunk = buffer.subarray(0, bytesRead).toString('utf8');
    for (const line of firstChunk.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      try {
        const parsed = JSON.parse(line) as { sessionId?: unknown };
        const sessionId = readString(parsed.sessionId);
        if (sessionId) {
          transcriptSessionCache = { transcriptPath, sessionId };
          return sessionId;
        }
      } catch {}
    }
  } catch {
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }

  transcriptSessionCache = { transcriptPath, sessionId: null };
  return null;
}

function getClaudeSessionModelPath(transcriptPath: string, sessionId: string): string {
  return path.join(path.dirname(transcriptPath), sessionId, 'ccr-model.json');
}

function getLatestModelPath(): string {
  return process.env.CLAUDE_HUD_ROUTER_MODEL_STATE_PATH?.trim()
    || path.join(os.homedir(), '.claude-code-router', 'runtime', 'latest-model.json');
}

function isRouterModelEnabled(): boolean {
  const mode = process.env.CLAUDE_HUD_ROUTER_MODEL?.trim().toLowerCase();
  if (mode === '0' || mode === 'false' || mode === 'off' || mode === 'disabled') {
    return false;
  }
  if (mode === '1' || mode === 'true' || mode === 'on' || mode === 'enabled') {
    return true;
  }

  const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim() ?? process.env.ANTHROPIC_API_BASE_URL?.trim() ?? '';
  return isLikelyCcrBaseUrl(baseUrl);
}

function isLikelyCcrBaseUrl(baseUrl: string): boolean {
  if (!baseUrl) {
    return false;
  }

  try {
    const parsed = new URL(baseUrl);
    const isLocalHost = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
    return isLocalHost && parsed.port === '3456';
  } catch {
    return false;
  }
}

function getStateMaxAgeMs(): number {
  const value = Number.parseInt(process.env.CLAUDE_HUD_ROUTER_MODEL_MAX_AGE_MS ?? '', 10);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_STATE_MAX_AGE_MS;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
