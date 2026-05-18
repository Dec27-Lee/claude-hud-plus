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
  source: 'session';
};

export type RouterModelStatus =
  | { kind: 'not-ccr' }
  | { kind: 'ready'; info: RouterModelInfo }
  | { kind: 'pending-session-state' }
  | { kind: 'missing-session-state' };

let routerModelCache: RouterModelCacheEntry | null = null;
let transcriptSessionCache: TranscriptSessionCacheEntry | null = null;

export function getRouterModelInfo(stdin: StdinData): RouterModelInfo | null {
  const status = getRouterModelStatus(stdin);
  return status.kind === 'ready' ? status.info : null;
}

export function getRouterModelStatus(stdin: StdinData): RouterModelStatus {
  if (!isCurrentClaudeCodeUsingCcr()) {
    return { kind: 'not-ccr' };
  }

  const now = Date.now();
  const transcriptPath = stdin.transcript_path;
  const sessionId = getSessionIdFromTranscriptPath(transcriptPath);
  if (sessionId && typeof transcriptPath === 'string' && transcriptPath.trim()) {
    const info = readRouterModelState(getClaudeSessionModelPath(transcriptPath, sessionId), now, 'session');
    if (info) {
      return { kind: 'ready', info };
    }
    return shouldWarnForMissingSessionState(stdin, transcriptPath) ? { kind: 'missing-session-state' } : { kind: 'pending-session-state' };
  }

  return shouldWarnForMissingSessionState(stdin, transcriptPath) ? { kind: 'missing-session-state' } : { kind: 'pending-session-state' };
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

function shouldWarnForMissingSessionState(stdin: StdinData, transcriptPath: unknown): boolean {
  if (!hasModelRequestEvidence(stdin)) {
    return false;
  }
  if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) {
    return true;
  }

  return countTranscriptUserTurns(transcriptPath) > 1;
}

function hasModelRequestEvidence(stdin: StdinData): boolean {
  const usage = stdin.context_window?.current_usage;
  const currentTokens =
    (usage?.input_tokens ?? 0) +
    (usage?.output_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0);
  const totalTokens =
    (stdin.context_window?.total_input_tokens ?? 0) +
    (stdin.context_window?.total_output_tokens ?? 0);

  return currentTokens > 0 || totalTokens > 0;
}

function countTranscriptUserTurns(transcriptPath: string): number {
  let fd: number | null = null;
  let userTurns = 0;
  try {
    fd = fs.openSync(transcriptPath, 'r');
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const firstChunk = buffer.subarray(0, bytesRead).toString('utf8');
    for (const line of firstChunk.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      try {
        const parsed = JSON.parse(line) as { type?: unknown };
        if (parsed.type === 'user') {
          userTurns += 1;
          if (userTurns > 1) {
            return userTurns;
          }
        }
      } catch {}
    }
  } catch {
    return 0;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }

  return userTurns;
}

function isCurrentClaudeCodeUsingCcr(): boolean {
  const baseUrl = readString(process.env.ANTHROPIC_BASE_URL) ?? readString(process.env.ANTHROPIC_API_BASE_URL);
  const claudeEndpoint = parseUrlEndpoint(baseUrl);
  const ccrEndpoint = readCcrEndpoint();

  return Boolean(claudeEndpoint && ccrEndpoint && endpointsMatch(claudeEndpoint, ccrEndpoint));
}

type Endpoint = {
  host: string;
  port: string;
};

function readCcrEndpoint(): Endpoint | null {
  try {
    const configPath = path.join(os.homedir(), '.claude-code-router', 'config.json');
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    const host = readString(parsed.HOST) ?? readString(parsed.host) ?? '127.0.0.1';
    const port = readPort(parsed.PORT) ?? readPort(parsed.port) ?? '3456';

    return { host: normalizeHost(host), port };
  } catch {
    return null;
  }
}

function parseUrlEndpoint(value: string | null): Endpoint | null {
  if (!value) {
    return null;
  }

  const candidates = value.includes('://') ? [value] : [`http://${value}`];
  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
      return { host: normalizeHost(parsed.hostname), port };
    } catch {}
  }

  return null;
}

function readPort(value: unknown): string | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65535) {
    return String(value);
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? String(parsed) : null;
}

function endpointsMatch(claudeEndpoint: Endpoint, ccrEndpoint: Endpoint): boolean {
  return claudeEndpoint.port === ccrEndpoint.port && hostsMatch(claudeEndpoint.host, ccrEndpoint.host);
}

function hostsMatch(claudeHost: string, ccrHost: string): boolean {
  if (claudeHost === ccrHost) {
    return true;
  }

  if (isWildcardHost(ccrHost)) {
    return isLoopbackHost(claudeHost) || isLocalInterfaceHost(claudeHost);
  }

  return isLoopbackHost(claudeHost) && isLoopbackHost(ccrHost);
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^\[|\]$/g, '');
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isLocalInterfaceHost(host: string): boolean {
  const interfaces = os.networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (normalizeHost(address.address) === host) {
        return true;
      }
    }
  }

  return false;
}

function isWildcardHost(host: string): boolean {
  return host === '0.0.0.0' || host === '::' || host === '';
}

function getStateMaxAgeMs(): number {
  const value = Number.parseInt(process.env.CLAUDE_HUD_ROUTER_MODEL_MAX_AGE_MS ?? '', 10);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_STATE_MAX_AGE_MS;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
