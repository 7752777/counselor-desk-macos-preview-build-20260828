'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const networkCore = require('../src/core/cwb-network-diagnostics.js');

const DEFAULT_MAX_ENTRIES = 240;
const DEFAULT_MAX_BYTES = 512 * 1024;

function createDesktopNetworkDiagnostics(options) {
  const opts = options || {};
  const filePath = path.resolve(String(opts.filePath || 'network-diagnostics.jsonl'));
  const maxEntries = Math.max(20, Math.min(1000, Number(opts.maxEntries) || DEFAULT_MAX_ENTRIES));
  const maxBytes = Math.max(16 * 1024, Math.min(8 * 1024 * 1024, Number(opts.maxBytes) || DEFAULT_MAX_BYTES));
  let queue = Promise.resolve();
  let lastError = '';

  async function ensureParent() { await fs.mkdir(path.dirname(filePath), { recursive:true }); }
  async function readEntries() {
    let raw;
    try { raw = await fs.readFile(filePath, 'utf8'); }
    catch (error) { if (error && error.code === 'ENOENT') return []; throw error; }
    return raw.split(/\r?\n/).filter(Boolean).map(line => {
      try { return networkCore.sanitizeEvent(JSON.parse(line)); } catch (_) { return null; }
    }).filter(Boolean).slice(-maxEntries);
  }
  async function rotateIfNeeded() {
    let stat;
    try { stat = await fs.stat(filePath); } catch (error) { if (error && error.code === 'ENOENT') return; throw error; }
    if (stat.size <= maxBytes) return;
    const entries = await readEntries();
    await fs.writeFile(filePath, entries.map(item => JSON.stringify(item)).join('\n') + (entries.length ? '\n' : ''), { encoding:'utf8', mode:0o600 });
  }
  function record(input) {
    const event = networkCore.sanitizeEvent(input);
    queue = queue.then(async () => {
      await ensureParent();
      await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, { encoding:'utf8', mode:0o600 });
      await rotateIfNeeded();
    }).catch(error => { lastError = String(error && error.code || 'NETWORK_DIAGNOSTICS_WRITE_FAILED'); });
    return event;
  }
  async function flush() { await queue; return { ok:!lastError, error:lastError, path:filePath }; }
  async function snapshot() { await flush(); return readEntries(); }
  async function clear() {
    await flush();
    await ensureParent();
    await fs.writeFile(filePath, '', { encoding:'utf8', mode:0o600 });
    lastError = '';
    return true;
  }
  const logger = Object.freeze({
    filePath,
    maxEntries,
    maxBytes,
    record,
    log:record,
    flush,
    snapshot,
    clear,
    exportText:async () => JSON.stringify(await snapshot(), null, 2),
    status:() => ({ path:filePath, max_entries:maxEntries, max_bytes:maxBytes, last_error:lastError }),
    traceFetch:(fetcher, url, options, metadata) => networkCore.traceFetch(fetcher, url, options, Object.assign({}, metadata || {}, { logger })),
  });
  return logger;
}

module.exports = { createDesktopNetworkDiagnostics };
