#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/**
 * 只为 @musistudio/claude-code-router 增加会话级模型状态写入能力。
 *
 * 本脚本不会修改 Claude HUD Plus、Claude Code settings.json 或 statusLine wrapper。
 * 它只在用户明确执行 --apply 时修补 CCR 的 dist/cli.js，使 CCR 在确定真实请求模型后写入：
 *
 *   ~/.claude/projects/<project>/<sessionId>/ccr-model.json
 *
 * 推荐流程：
 *   node scripts/patch-ccr-session-model.cjs --dry-run --json
 *   node scripts/patch-ccr-session-model.cjs --apply --json
 *   node --check "<dry-run 输出里的 targets.ccr.distPath>"
 *   ccr restart
 *
 * 回滚：
 *   node scripts/patch-ccr-session-model.cjs --restore --json
 *   ccr restart
 */

const PATCH_VERSION = 'claude-hud-plus-ccr-session-model-v1';
const ccrPackageName = '@musistudio/claude-code-router';
const stateRoot = getPatchStateRoot();
const statePath = path.join(stateRoot, 'ccr-patch-state.json');
const backupRoot = path.join(stateRoot, 'ccr-patch-backups');

const CCR_RUNTIME_HELPERS = `const CLAUDE_HUD_PLUS_CCR_PATCH_VERSION = "claude-hud-plus-ccr-session-model-v1";
function getCcrSessionModelCandidate(payload) {
  try {
    if (!payload || typeof payload !== 'object') {
      return { model: null, provider: null, requestedModel: null, pickedFrom: null };
    }
    const candidates = [
      ['payload.modelVersion', payload.modelVersion],
      ['payload.response.model', payload.response?.model],
      ['payload.response.modelVersion', payload.response?.modelVersion],
      ['payload.model', payload.model],
    ];
    let model = null;
    let pickedFrom = null;
    for (const [source, candidate] of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        model = candidate.trim();
        pickedFrom = source;
        break;
      }
    }
    const provider = readCcrSessionString(payload.provider)
      || readCcrSessionString(payload.providerName)
      || readCcrSessionString(payload.vendor)
      || readCcrSessionString(payload.metadata?.provider)
      || null;
    const requestedModel = readCcrSessionString(payload.requestedModel)
      || readCcrSessionString(payload.request_model)
      || readCcrSessionString(payload.localModel)
      || readCcrSessionString(payload.metadata?.requestedModel)
      || null;
    return { model, provider, requestedModel, pickedFrom };
  } catch {}
  return { model: null, provider: null, requestedModel: null, pickedFrom: null };
}
function readCcrSessionString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function extractSessionIdFromValue(value) {
  try {
    if (typeof value === 'string' && value.trim()) {
      const direct = value.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(direct)) {
        return direct;
      }
      try {
        return extractSessionIdFromValue(JSON.parse(direct));
      } catch {}
    }
    if (value && typeof value === 'object') {
      const candidates = [
        value.session_id,
        value.sessionId,
        value?.metadata?.session_id,
        value?.metadata?.sessionId,
        value?.user_id,
        value?.userId,
        value?.metadata?.user_id,
        value?.metadata?.userId,
      ];
      for (const candidate of candidates) {
        const sessionId = extractSessionIdFromValue(candidate);
        if (sessionId) {
          return sessionId;
        }
      }
    }
  } catch {}
  return null;
}
function extractSessionIdFromPayload(payload) {
  return extractSessionIdFromValue(payload);
}
function writeJsonFileAtomic(filePath, payload) {
  const fs = require('node:fs');
  const path = require('node:path');
  const tempPath = filePath + '.tmp';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(payload) + "\\n", 'utf8');
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  fs.renameSync(tempPath, filePath);
}
function appendCcrSessionModelDebug(entry) {
  try {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const runtimeDir = path.join(os.homedir(), '.claude-code-router', 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.appendFileSync(path.join(runtimeDir, 'ccr-session-model-debug.jsonl'), JSON.stringify(entry) + "\\n", 'utf8');
  } catch {}
}
function getClaudeProjectsRoot() {
  const os = require('node:os');
  const path = require('node:path');
  return path.join(os.homedir(), '.claude', 'projects');
}
function findClaudeTranscriptPath(sessionId) {
  try {
    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      return null;
    }
    const fs = require('node:fs');
    const path = require('node:path');
    const projectsRoot = getClaudeProjectsRoot();
    const targetName = sessionId.trim() + '.jsonl';
    const projectEntries = fs.readdirSync(projectsRoot, { withFileTypes: true });
    for (const entry of projectEntries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const transcriptPath = path.join(projectsRoot, entry.name, targetName);
      if (fs.existsSync(transcriptPath)) {
        return transcriptPath;
      }
    }
  } catch {}
  return null;
}
function getClaudeSessionModelPath(sessionId) {
  try {
    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      return null;
    }
    const fs = require('node:fs');
    const path = require('node:path');
    const projectsRoot = getClaudeProjectsRoot();
    const trimmedSessionId = sessionId.trim();
    const projectEntries = fs.readdirSync(projectsRoot, { withFileTypes: true });
    for (const entry of projectEntries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const sessionDir = path.join(projectsRoot, entry.name, trimmedSessionId);
      if (fs.existsSync(sessionDir)) {
        return path.join(sessionDir, 'ccr-model.json');
      }
    }
    const transcriptPath = findClaudeTranscriptPath(trimmedSessionId);
    if (!transcriptPath) {
      return null;
    }
    return path.join(path.dirname(transcriptPath), trimmedSessionId, 'ccr-model.json');
  } catch {}
  return null;
}
function writeClaudeSessionModel(sessionId, candidate, source = 'unknown') {
  try {
    if (typeof sessionId !== 'string' || !sessionId.trim() || !candidate?.model) {
      return;
    }
    const statePath = getClaudeSessionModelPath(sessionId);
    if (!statePath) {
      return;
    }
    const payload = {
      sessionId: sessionId.trim(),
      model: candidate.model.trim(),
      timestamp: Date.now(),
      source,
    };
    if (candidate.provider) {
      payload.provider = candidate.provider;
    }
    if (candidate.requestedModel) {
      payload.requestedModel = candidate.requestedModel;
    }
    writeJsonFileAtomic(statePath, payload);
  } catch {}
}
function writeCcrSessionModelFromPayload(payload, source = 'unknown') {
  const candidate = getCcrSessionModelCandidate(payload);
  if (!candidate.model) {
    return;
  }
  const sessionId = extractSessionIdFromPayload(payload);
  const sessionModelPath = sessionId ? getClaudeSessionModelPath(sessionId) : null;
  appendCcrSessionModelDebug({
    ts: Date.now(),
    source,
    sessionId,
    model: candidate.model,
    provider: candidate.provider,
    requestedModel: candidate.requestedModel,
    pickedFrom: candidate.pickedFrom,
    payloadType: payload?.type,
    payloadModelVersion: payload?.modelVersion,
    payloadResponseModel: payload?.response?.model,
    payloadResponseModelVersion: payload?.response?.modelVersion,
    payloadModel: payload?.model,
    sessionModelPath,
    writeTarget: sessionModelPath ? 'session' : 'none',
  });
  if (sessionId) {
    writeClaudeSessionModel(sessionId, candidate, source);
  }
}
`;

const CCR_OPENAI_STREAM_ANCHOR = 'try{let R=JSON.parse(Q);';
const CCR_OPENAI_STREAM_REPLACEMENT = 'try{let R=JSON.parse(Q);writeCcrSessionModelFromPayload(R,"openai-stream");';
const CCR_RESPONSES_ANCHOR = 'try{let m=JSON.parse(D);if(m.type==="response.output_text.delta")';
const CCR_RESPONSES_REPLACEMENT = 'try{let m=JSON.parse(D);writeCcrSessionModelFromPayload(m,"responses-stream");if(m.type==="response.output_text.delta")';
const CCR_GEMINI_JSON_ANCHOR = 'let n=await e.json();';
const CCR_GEMINI_JSON_REPLACEMENT = 'let n=await e.json();writeCcrSessionModelFromPayload(n,"gemini-json");';
const CCR_GEMINI_STREAM_ANCHOR = 'try{let m=JSON.parse(D);if(!m.candidates||!m.candidates[0])';
const CCR_GEMINI_STREAM_REPLACEMENT = 'try{let m=JSON.parse(D);writeCcrSessionModelFromPayload(m,"gemini-stream");if(!m.candidates||!m.candidates[0])';
const CCR_OPENAI_JSON_ANCHOR = 'try{let r=e.choices[0];';
const CCR_OPENAI_JSON_REPLACEMENT = 'try{writeCcrSessionModelFromPayload(e,"openai-json");let r=e.choices[0];';
const CCR_FINAL_REQUEST_ANCHOR = 'let u={method:"POST",headers:o,body:JSON.stringify(t),signal:i};';
const CCR_FINAL_REQUEST_REPLACEMENT = 'let u={method:"POST",headers:o,body:JSON.stringify(t),signal:i};writeCcrSessionModelFromPayload(t,"final-request");';

function parseArgs(argv) {
  const positional = [];
  const flags = new Set();
  const values = new Map();

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--target') {
      values.set('target', argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--target=')) {
      values.set('target', arg.slice('--target='.length));
    } else if (arg.startsWith('--')) {
      flags.add(arg);
    } else {
      positional.push(arg);
    }
  }

  const restore = flags.has('--restore');
  const dryRun = flags.has('--dry-run');
  return {
    apply: flags.has('--apply') || (!restore && !dryRun),
    dryRun,
    restore,
    json: flags.has('--json'),
    target: values.get('target') || process.env.CCR_DIST_PATH || positional[0] || '',
  };
}

function fail(message) {
  throw new Error(message);
}

function runCommand(command, args) {
  try {
    if (process.platform === 'win32') {
      const shell = process.env.ComSpec || 'cmd.exe';
      return execFileSync(shell, ['/d', '/s', '/c', command, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    }

    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const stderr = error && typeof error.stderr === 'string' ? error.stderr.trim() : '';
    fail(`failed to run ${command} ${args.join(' ')}${stderr ? `: ${stderr}` : ''}`);
  }
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, '/');
}

function getPatchStateRoot() {
  const override = process.env.CLAUDE_HUD_PLUS_CCR_PATCH_STATE_DIR?.trim();
  if (override) {
    return path.resolve(override);
  }

  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(os.homedir(), '.claude');
  return path.join(claudeConfigDir, 'plugins', 'claude-hud-plus');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeUtf8(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function getLineEnding(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function withLineEnding(content, ending) {
  return content.replace(/\r?\n/g, ending);
}

function ensureOnce(content, anchor, replacement, label) {
  if (content.includes(replacement.trim())) {
    return content;
  }
  if (!content.includes(anchor)) {
    throw new Error(`CCR patch anchor not found: ${label}`);
  }
  return content.replace(anchor, withLineEnding(replacement, getLineEnding(content)));
}

function replaceByRegex(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`CCR patch anchor not found: ${label}`);
  }
  return content.replace(pattern, replacement);
}

function countOccurrences(content, search) {
  return content.split(search).length - 1;
}

function getCcrInstall(targetOverride) {
  if (targetOverride) {
    const distPath = path.resolve(targetOverride);
    if (!fs.existsSync(distPath)) {
      fail(`CCR dist entry not found at ${distPath}`);
    }
    return {
      packageName: ccrPackageName,
      version: 'custom-target',
      npmRoot: '',
      packageDir: path.dirname(path.dirname(distPath)),
      distPath,
    };
  }

  const npmRoot = runCommand('npm', ['root', '-g']);
  const packageDir = path.join(npmRoot, ...ccrPackageName.split('/'));
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    fail(`CCR package not found at ${packageDir} (npm root -g => ${npmRoot})`);
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (pkg.name !== ccrPackageName) {
    fail(`unexpected package at ${packageDir}: expected ${ccrPackageName}, got ${pkg.name || 'unknown'}`);
  }

  const distPath = path.join(packageDir, 'dist', 'cli.js');
  if (!fs.existsSync(distPath)) {
    fail(`CCR dist entry not found at ${distPath}`);
  }

  return {
    packageName: pkg.name,
    version: typeof pkg.version === 'string' ? pkg.version : 'unknown',
    npmRoot,
    packageDir,
    distPath,
  };
}

function getCcrDiagnostics(content) {
  return {
    patchVersionPresent: content.includes(`CLAUDE_HUD_PLUS_CCR_PATCH_VERSION = "${PATCH_VERSION}"`),
    runtimeHelpersPresent: content.includes('function writeCcrSessionModelFromPayload(payload'),
    debugHelperPresent: content.includes('function appendCcrSessionModelDebug(entry) {'),
    sessionWriterPresent: content.includes('function writeClaudeSessionModel(sessionId, candidate'),
    transcriptLookupPresent: content.includes('function findClaudeTranscriptPath(sessionId) {'),
    openaiStreamPatched: content.includes(CCR_OPENAI_STREAM_REPLACEMENT),
    responsesPatched: content.includes(CCR_RESPONSES_REPLACEMENT),
    geminiJsonPatched: content.includes(CCR_GEMINI_JSON_REPLACEMENT),
    geminiStreamPatched: content.includes(CCR_GEMINI_STREAM_REPLACEMENT),
    openaiJsonPatched: content.includes(CCR_OPENAI_JSON_REPLACEMENT),
    finalRequestPatched: content.includes(CCR_FINAL_REQUEST_REPLACEMENT),
    openaiStreamAnchorPresent: content.includes(CCR_OPENAI_STREAM_ANCHOR),
    responsesAnchorPresent: content.includes(CCR_RESPONSES_ANCHOR),
    geminiJsonAnchorPresent: content.includes(CCR_GEMINI_JSON_ANCHOR),
    geminiStreamAnchorPresent: content.includes(CCR_GEMINI_STREAM_ANCHOR),
    openaiJsonAnchorPresent: content.includes(CCR_OPENAI_JSON_ANCHOR),
    finalRequestAnchorPresent: content.includes(CCR_FINAL_REQUEST_ANCHOR),
    oldLatestWriterPresent: content.includes('function writeLatestCcrModel(model) {')
      || content.includes('writeLatestCcrModelFromPayload(')
      || content.includes('latest-model.json'),
    oldProviderDebugPresent: content.includes('function debugCcrProviderResponse(response, payload, requestUrl) {'),
    legacySessionPathPresent: content.includes("'.claude-code-router', 'runtime', 'sessions'"),
  };
}

function isCcrPatched(content) {
  const diagnostics = getCcrDiagnostics(content);
  return diagnostics.patchVersionPresent
    && diagnostics.runtimeHelpersPresent
    && diagnostics.debugHelperPresent
    && diagnostics.sessionWriterPresent
    && diagnostics.transcriptLookupPresent
    && diagnostics.openaiStreamPatched
    && diagnostics.responsesPatched
    && diagnostics.geminiJsonPatched
    && diagnostics.geminiStreamPatched
    && diagnostics.openaiJsonPatched
    && diagnostics.finalRequestPatched
    && !diagnostics.oldLatestWriterPresent
    && !diagnostics.oldProviderDebugPresent
    && !diagnostics.legacySessionPathPresent
    && countOccurrences(content, 'function writeCcrSessionModelFromPayload(payload') === 1;
}

function upgradeCcrPatch(content) {
  let next = content;

  if (next.includes('function getLatestCcrModelCandidate(payload) {')) {
    next = replaceByRegex(
      next,
      /function getLatestCcrModelCandidate\(payload\) \{[\s\S]*?(?=\nvar )/,
      `${CCR_RUNTIME_HELPERS}`,
      'old runtime helpers block',
    );
  } else if (next.includes('function writeLatestCcrModel(model) {')) {
    next = replaceByRegex(
      next,
      /function writeLatestCcrModel\(model\) \{[\s\S]*?(?=\nvar )/,
      `${CCR_RUNTIME_HELPERS}`,
      'legacy latest writer helpers block',
    );
  } else if (next.includes('function getCcrSessionModelCandidate(payload) {')) {
    next = replaceByRegex(
      next,
      /function getCcrSessionModelCandidate\(payload\) \{[\s\S]*?(?=\nvar )/,
      `${CCR_RUNTIME_HELPERS}`,
      'session runtime helpers block',
    );
  }

  next = next.replaceAll('writeLatestCcrModelFromPayload(R,"openai-stream");', 'writeCcrSessionModelFromPayload(R,"openai-stream");');
  next = next.replaceAll('writeLatestCcrModelFromPayload(m,"responses-stream");', 'writeCcrSessionModelFromPayload(m,"responses-stream");');
  next = next.replaceAll('writeLatestCcrModelFromPayload(n,"gemini-json");', 'writeCcrSessionModelFromPayload(n,"gemini-json");');
  next = next.replaceAll('writeLatestCcrModelFromPayload(m,"gemini-stream");', 'writeCcrSessionModelFromPayload(m,"gemini-stream");');
  next = next.replaceAll('writeLatestCcrModelFromPayload(e,"openai-json");', 'writeCcrSessionModelFromPayload(e,"openai-json");');
  next = next.replaceAll('writeLatestCcrModelFromPayload(t,"final-request");', 'writeCcrSessionModelFromPayload(t,"final-request");');
  next = next.replaceAll('fetch(typeof e=="string"?e:e.toString(),u).then(async l=>{await debugCcrProviderResponse(l,t,typeof e=="string"?e:e.toString());return l})', 'fetch(typeof e=="string"?e:e.toString(),u)');
  next = next.replaceAll('writeLatestCcrSessionModel(sessionId, model);', 'writeClaudeSessionModel(sessionId, { model }, "legacy-session");');
  next = next.replaceAll('writeLegacyCcrSessionModel(sessionId, model);', 'return;');

  return next;
}

function applyCcrPatch(content) {
  let next = upgradeCcrPatch(content);

  if (!next.includes('function writeCcrSessionModelFromPayload(payload')) {
    next = ensureOnce(
      next,
      '"use strict";',
      `"use strict";\n${CCR_RUNTIME_HELPERS}`,
      'runtime helpers',
    );
  }

  next = ensureOnce(next, CCR_OPENAI_STREAM_ANCHOR, CCR_OPENAI_STREAM_REPLACEMENT, 'openai stream parse anchor');
  next = ensureOnce(next, CCR_RESPONSES_ANCHOR, CCR_RESPONSES_REPLACEMENT, 'responses parse anchor');
  next = ensureOnce(next, CCR_GEMINI_JSON_ANCHOR, CCR_GEMINI_JSON_REPLACEMENT, 'gemini json parse anchor');
  next = ensureOnce(next, CCR_GEMINI_STREAM_ANCHOR, CCR_GEMINI_STREAM_REPLACEMENT, 'gemini stream parse anchor');
  next = ensureOnce(next, CCR_OPENAI_JSON_ANCHOR, CCR_OPENAI_JSON_REPLACEMENT, 'openai json parse anchor');
  next = ensureOnce(next, CCR_FINAL_REQUEST_ANCHOR, CCR_FINAL_REQUEST_REPLACEMENT, 'final request anchor');

  return next;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return { records: [] };
  }
}

function saveState(state) {
  ensureDir(path.dirname(statePath));
  writeUtf8(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function createBackup(targets, state) {
  ensureDir(backupRoot);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(backupRoot, stamp);
  ensureDir(backupDir);

  const ccrBackupPath = path.join(backupDir, 'ccr-cli.js');
  fs.copyFileSync(targets.ccr.distPath, ccrBackupPath);
  const stat = fs.statSync(targets.ccr.distPath);
  const record = {
    patchVersion: PATCH_VERSION,
    appliedAt: new Date().toISOString(),
    ccr: {
      packageName: targets.ccr.packageName,
      version: targets.ccr.version,
      npmRoot: toPosix(targets.ccr.npmRoot || ''),
      packageDir: toPosix(targets.ccr.packageDir),
      dist: {
        path: toPosix(targets.ccr.distPath),
        backupPath: toPosix(ccrBackupPath),
        mtimeMs: stat.mtimeMs,
      },
    },
  };

  state.records = Array.isArray(state.records) ? state.records : [];
  state.records.push(record);
  saveState(state);
  return record;
}

function summarizeTargets(targets) {
  const content = readUtf8(targets.ccr.distPath);
  return {
    patchVersion: PATCH_VERSION,
    statePath: toPosix(statePath),
    backupRoot: toPosix(backupRoot),
    ccr: {
      packageName: targets.ccr.packageName,
      version: targets.ccr.version,
      npmRoot: toPosix(targets.ccr.npmRoot || ''),
      packageDir: toPosix(targets.ccr.packageDir),
      distPath: toPosix(targets.ccr.distPath),
      distPatched: isCcrPatched(content),
      diagnostics: getCcrDiagnostics(content),
    },
  };
}

function apply(targets) {
  const state = loadState();
  const content = readUtf8(targets.ccr.distPath);
  const alreadyPatched = isCcrPatched(content);

  if (alreadyPatched) {
    return { changed: false, backup: null };
  }

  const backup = createBackup(targets, state);
  writeUtf8(targets.ccr.distPath, applyCcrPatch(content));
  return { changed: true, backup };
}

function restoreLatest(targets) {
  const state = loadState();
  const records = Array.isArray(state.records) ? state.records : [];
  const record = [...records].reverse().find((entry) => (
    entry.patchVersion === PATCH_VERSION
    && entry.ccr?.dist?.path === toPosix(targets.ccr.distPath)
    && fs.existsSync(entry.ccr.dist.backupPath)
  ));

  if (!record) {
    fail(`no restorable ${PATCH_VERSION} backup found for ${targets.ccr.distPath}`);
  }

  fs.copyFileSync(record.ccr.dist.backupPath, targets.ccr.distPath);
  return record;
}

function printHuman(result) {
  if (result.mode === 'dry-run') {
    process.stdout.write(`CCR package: ${result.targets.ccr.packageName}@${result.targets.ccr.version}\n`);
    process.stdout.write(`CCR dist: ${result.targets.ccr.distPath} (${result.targets.ccr.distPatched ? 'patched' : 'needs patch'})\n`);
    process.stdout.write(`state file: ${statePath}\n`);
    process.stdout.write(`backup dir: ${backupRoot}\n`);
    return;
  }

  if (result.mode === 'apply') {
    process.stdout.write(result.changed ? 'CCR session model patch applied. Restart CCR.\n' : 'CCR session model patch already applied.\n');
    return;
  }

  if (result.mode === 'restore') {
    process.stdout.write('CCR session model patch restored from latest backup. Restart CCR.\n');
  }
}

function main() {
  const args = parseArgs(process.argv);
  const targets = { ccr: getCcrInstall(args.target) };
  let result;

  if (args.dryRun) {
    result = { mode: 'dry-run', targets: summarizeTargets(targets) };
  } else if (args.restore) {
    const restored = restoreLatest(targets);
    result = { mode: 'restore', restored, targets: summarizeTargets(targets) };
  } else if (args.apply) {
    const applied = apply(targets);
    result = { mode: 'apply', ...applied, targets: summarizeTargets(targets) };
  } else {
    fail('no mode selected');
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printHuman(result);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}
