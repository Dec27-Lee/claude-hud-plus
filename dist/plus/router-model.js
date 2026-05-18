import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
const CACHE_TTL_MS = 1500;
const DEFAULT_STATE_MAX_AGE_MS = 120000;
let routerModelCache = null;
let transcriptSessionCache = null;
export function getRouterModelInfo(stdin) {
    const status = getRouterModelStatus(stdin);
    return status.kind === 'ready' ? status.info : null;
}
export function getRouterModelStatus(stdin) {
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
function readRouterModelState(statePath, now, source) {
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
        if (routerModelCache &&
            routerModelCache.statePath === statePath &&
            routerModelCache.stateMtimeMs === stat.mtimeMs) {
            routerModelCache.expiresAt = now + CACHE_TTL_MS;
            return routerModelCache.value;
        }
        const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
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
    }
    catch {
        routerModelCache = { value: null, expiresAt: now + CACHE_TTL_MS, statePath };
        return null;
    }
}
function getSessionIdFromTranscriptPath(transcriptPath) {
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
    let fd = null;
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
                const parsed = JSON.parse(line);
                const sessionId = readString(parsed.sessionId);
                if (sessionId) {
                    transcriptSessionCache = { transcriptPath, sessionId };
                    return sessionId;
                }
            }
            catch { }
        }
    }
    catch {
    }
    finally {
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            }
            catch { }
        }
    }
    transcriptSessionCache = { transcriptPath, sessionId: null };
    return null;
}
function getClaudeSessionModelPath(transcriptPath, sessionId) {
    return path.join(path.dirname(transcriptPath), sessionId, 'ccr-model.json');
}
function shouldWarnForMissingSessionState(stdin, transcriptPath) {
    if (!hasModelRequestEvidence(stdin)) {
        return false;
    }
    if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) {
        return true;
    }
    return countTranscriptUserTurns(transcriptPath) > 1;
}
function hasModelRequestEvidence(stdin) {
    const usage = stdin.context_window?.current_usage;
    const currentTokens = (usage?.input_tokens ?? 0) +
        (usage?.output_tokens ?? 0) +
        (usage?.cache_creation_input_tokens ?? 0) +
        (usage?.cache_read_input_tokens ?? 0);
    const totalTokens = (stdin.context_window?.total_input_tokens ?? 0) +
        (stdin.context_window?.total_output_tokens ?? 0);
    return currentTokens > 0 || totalTokens > 0;
}
function countTranscriptUserTurns(transcriptPath) {
    let fd = null;
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
                const parsed = JSON.parse(line);
                if (parsed.type === 'user') {
                    userTurns += 1;
                    if (userTurns > 1) {
                        return userTurns;
                    }
                }
            }
            catch { }
        }
    }
    catch {
        return 0;
    }
    finally {
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            }
            catch { }
        }
    }
    return userTurns;
}
function isCurrentClaudeCodeUsingCcr() {
    const baseUrl = readString(process.env.ANTHROPIC_BASE_URL) ?? readString(process.env.ANTHROPIC_API_BASE_URL);
    const claudeEndpoint = parseUrlEndpoint(baseUrl);
    const ccrEndpoint = readCcrEndpoint();
    return Boolean(claudeEndpoint && ccrEndpoint && endpointsMatch(claudeEndpoint, ccrEndpoint));
}
function readCcrEndpoint() {
    try {
        const configPath = path.join(os.homedir(), '.claude-code-router', 'config.json');
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const host = readString(parsed.HOST) ?? readString(parsed.host) ?? '127.0.0.1';
        const port = readPort(parsed.PORT) ?? readPort(parsed.port) ?? '3456';
        return { host: normalizeHost(host), port };
    }
    catch {
        return null;
    }
}
function parseUrlEndpoint(value) {
    if (!value) {
        return null;
    }
    const candidates = value.includes('://') ? [value] : [`http://${value}`];
    for (const candidate of candidates) {
        try {
            const parsed = new URL(candidate);
            const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
            return { host: normalizeHost(parsed.hostname), port };
        }
        catch { }
    }
    return null;
}
function readPort(value) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65535) {
        return String(value);
    }
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? String(parsed) : null;
}
function endpointsMatch(claudeEndpoint, ccrEndpoint) {
    return claudeEndpoint.port === ccrEndpoint.port && hostsMatch(claudeEndpoint.host, ccrEndpoint.host);
}
function hostsMatch(claudeHost, ccrHost) {
    if (claudeHost === ccrHost) {
        return true;
    }
    if (isWildcardHost(ccrHost)) {
        return isLoopbackHost(claudeHost) || isLocalInterfaceHost(claudeHost);
    }
    return isLoopbackHost(claudeHost) && isLoopbackHost(ccrHost);
}
function normalizeHost(host) {
    return host.trim().toLowerCase().replace(/^\[|\]$/g, '');
}
function isLoopbackHost(host) {
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}
function isLocalInterfaceHost(host) {
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
function isWildcardHost(host) {
    return host === '0.0.0.0' || host === '::' || host === '';
}
function getStateMaxAgeMs() {
    const value = Number.parseInt(process.env.CLAUDE_HUD_ROUTER_MODEL_MAX_AGE_MS ?? '', 10);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_STATE_MAX_AGE_MS;
}
function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
//# sourceMappingURL=router-model.js.map