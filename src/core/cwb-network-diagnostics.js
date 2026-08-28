/* Shared, privacy-preserving network diagnostics for browser and Node hosts. */
(function installCwbNetworkDiagnostics(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CWBNetworkDiagnostics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCwbNetworkDiagnostics(root) {
  'use strict';

  const DEFAULT_STORAGE_KEY = 'cwb_network_diagnostics_v1';
  const DEFAULT_MAX_ENTRIES = 240;
  const MAX_ENDPOINT_LENGTH = 280;
  const MAX_OPERATION_LENGTH = 80;
  const MAX_COMPONENT_LENGTH = 40;
  const PHASES = new Set(['started', 'request_sent', 'response', 'completed', 'failed', 'aborted']);
  const SAFE_PATH_SEGMENTS = new Set([
    'api', 'v1', 'health', 'products', 'orders', 'licenses', 'activate', 'redeem', 'managed-relay', 'refresh',
    'deactivate', 'upgrade-orders', 'devices', 'relay-token', 'updates', 'latest', 'telemetry', 'events',
    'pairing', 'request', 'result', 'confirm', 'workspace', 'manifest', 'sync', 'push', 'pull', 'conflicts',
    'resolve', 'attachments', 'chunk', 'complete', 'downloads', 'preview', 'stable', 'ai', 'chat', 'transcribe',
    'source', 'audio', 'transcriptions', 'backups', 'customer', 'admin', 'webhook', 'messages', 'responses',
    'completions', 'chat', 'v4',
  ]);

  function text(value) { return String(value == null ? '' : value).trim(); }
  function timestamp() { return new Date().toISOString(); }
  function randomHex(length) {
    const size = Math.max(4, Number(length) || 8);
    const bytes = new Uint8Array(size);
    if (root && root.crypto && typeof root.crypto.getRandomValues === 'function') root.crypto.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  }
  function createRequestId(prefix) { return `${text(prefix) || 'cwb'}_${Date.now().toString(36)}_${randomHex(8)}`.slice(0, 96); }
  function hashText(value) {
    let hash = 2166136261;
    for (const character of text(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function sanitizeRequestId(value) {
    const raw = text(value);
    if (!raw) return createRequestId();
    if (/^(?:cwb|srv|req)_[a-z0-9_-]{4,90}$/i.test(raw)) return raw.slice(0, 96);
    return `external_${hashText(raw)}`;
  }
  function sanitizeOperation(value) {
    return (text(value) || 'network.request').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, MAX_OPERATION_LENGTH);
  }
  function sanitizeComponent(value) {
    return (text(value) || 'client').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, MAX_COMPONENT_LENGTH);
  }
  function safePathSegment(value) {
    let decoded = text(value);
    try { decoded = decodeURIComponent(decoded); } catch (_) {}
    if (!decoded) return '';
    if (SAFE_PATH_SEGMENTS.has(decoded.toLowerCase())) return decoded.toLowerCase();
    if (/^v?\d+(?:\.\d+){1,3}$/i.test(decoded)) return decoded;
    if (/^[a-z0-9_-]{1,12}$/i.test(decoded) && /^(?:x64|arm64|universal|json|yml|yaml|dmg|zip|exe|html)$/i.test(decoded)) return decoded.toLowerCase();
    return ':segment';
  }
  function sanitizeUrl(value) {
    const raw = text(value);
    if (!raw) return '';
    let parsed;
    let absolute = false;
    try {
      absolute = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(raw);
      parsed = new URL(raw, 'https://cwb.local');
    } catch (_) {
      return '/:invalid';
    }
    const path = `/${String(parsed.pathname || '/').split('/').filter(Boolean).map(safePathSegment).join('/')}`.replace(/\/+/g, '/');
    const origin = absolute && parsed.protocol !== 'file:' ? `${parsed.protocol}//${parsed.host}` : parsed.protocol === 'file:' ? 'file://' : '';
    return `${origin}${path === '/' ? '/' : path}`.slice(0, MAX_ENDPOINT_LENGTH);
  }
  function sanitizeErrorCode(value) {
    const raw = text(value && typeof value === 'object' ? value.code || value.name : value).toUpperCase();
    if (/^[A-Z][A-Z0-9_]{2,80}$/.test(raw)) return raw;
    const detail = text(value && typeof value === 'object' ? value.message : value).toUpperCase();
    if (/ABORT|TIMEOUT|TIMED OUT/.test(detail)) return 'NETWORK_TIMEOUT';
    if (/TLS|SSL|CERTIFICATE/.test(detail)) return 'NETWORK_TLS_FAILED';
    if (/DNS|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|NETWORK|FETCH FAILED/.test(detail)) return 'NETWORK_UNAVAILABLE';
    return 'NETWORK_REQUEST_FAILED';
  }
  function byteLength(value) {
    if (value == null) return 0;
    if (typeof value === 'string') {
      try { return new TextEncoder().encode(value).byteLength; } catch (_) { return unescape(encodeURIComponent(value)).length; }
    }
    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return value.byteLength;
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) return value.byteLength;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(value)) return value.length;
    try { return byteLength(JSON.stringify(value)); } catch (_) { return 0; }
  }
  function responseByteLength(response) {
    try {
      const headers = response && response.headers;
      const value = headers && typeof headers.get === 'function' ? headers.get('content-length') : headers && (headers['content-length'] || headers['Content-Length']);
      const size = Number(value || 0);
      return Number.isFinite(size) && size >= 0 ? Math.round(size) : null;
    } catch (_) { return null; }
  }
  function resolveLogger(explicit) {
    if (explicit && typeof explicit.begin === 'function') return explicit;
    if (!root) return null;
    const candidate = root.CWBNetworkLog || root.CWBNetworkDiagnosticsLogger || root.CWB && root.CWB.networkDiagnostics;
    return candidate && typeof candidate.begin === 'function' ? candidate : null;
  }
  async function traceFetch(fetcher, url, options, metadata) {
    if (typeof fetcher !== 'function') throw new Error('NETWORK_FETCH_UNAVAILABLE');
    const opts = options && typeof options === 'object' ? options : {};
    const meta = metadata && typeof metadata === 'object' ? metadata : {};
    const logger = resolveLogger(meta.logger);
    const trace = logger ? logger.begin(meta.operation || 'network.request', meta.transport || 'fetch', url, { component:meta.component || 'client', request_id:meta.request_id }) : null;
    const request = Object.assign({}, opts);
    request.headers = Object.assign({}, opts.headers || {});
    if (trace && !Object.keys(request.headers).some(key => key.toLowerCase() === 'x-cwb-request-id')) request.headers['X-CWB-Request-Id'] = trace.request_id;
    if (trace) trace.requestSent({ request_bytes:byteLength(request.body) });
    try {
      const response = await fetcher(url, request);
      const responseBytes = responseByteLength(response);
      const details = Object.assign({ status_code:Number(response && response.status || 0) }, responseBytes == null ? {} : { response_bytes:responseBytes });
      if (trace) trace.response(details);
      if (trace && meta.completeOnResponse !== false) {
        if (response && response.ok === false) trace.fail(`HTTP_${Number(response.status || 0)}`, details);
        else trace.complete(details);
      }
      try { if (trace && response && !Object.prototype.hasOwnProperty.call(response, 'cwbNetworkTrace')) Object.defineProperty(response, 'cwbNetworkTrace', { value:trace, enumerable:false, configurable:true }); } catch (_) {}
      return response;
    } catch (error) {
      if (trace) {
        if (error && error.name === 'AbortError') trace.abort(error);
        else trace.fail(error);
      }
      throw error;
    }
  }
  function completeResponse(response, extra) {
    const trace = response && response.cwbNetworkTrace;
    if (trace && typeof trace.complete === 'function') return trace.complete(Object.assign({}, extra || {}));
    return null;
  }
  function failResponse(response, error, extra) {
    const trace = response && response.cwbNetworkTrace;
    if (trace && typeof trace.fail === 'function') return trace.fail(error, extra);
    return null;
  }
  function finiteNumber(value, minimum, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.max(minimum, Math.min(maximum, Math.round(number)));
  }
  function sanitizeEvent(input) {
    const value = input && typeof input === 'object' ? input : {};
    const phase = PHASES.has(text(value.phase)) ? text(value.phase) : 'failed';
    const event = {
      timestamp:text(value.timestamp) || timestamp(),
      request_id:sanitizeRequestId(value.request_id),
      operation:sanitizeOperation(value.operation),
      transport:sanitizeComponent(value.transport || 'fetch'),
      endpoint:sanitizeUrl(value.endpoint || value.url || value.path),
      phase,
    };
    const status = finiteNumber(value.status_code, 100, 599);
    const duration = finiteNumber(value.duration_ms, 0, 24 * 60 * 60 * 1000);
    const requestBytes = finiteNumber(value.request_bytes, 0, 1024 * 1024 * 1024);
    const responseBytes = finiteNumber(value.response_bytes, 0, 1024 * 1024 * 1024);
    if (status != null) event.status_code = status;
    if (duration != null) event.duration_ms = duration;
    if (requestBytes != null) event.request_bytes = requestBytes;
    if (responseBytes != null) event.response_bytes = responseBytes;
    if (value.error_code || phase === 'failed' || phase === 'aborted') event.error_code = sanitizeErrorCode(value.error_code || value.error || value);
    if (value.component) event.component = sanitizeComponent(value.component);
    return event;
  }

  function resolveStorage(options) {
    if (options && Object.prototype.hasOwnProperty.call(options, 'storage')) return options.storage;
    try { return root && root.localStorage ? root.localStorage : null; } catch (_) { return null; }
  }
  function storageRead(storage, key) {
    try {
      if (!storage) return [];
      const raw = typeof storage.getItem === 'function' ? storage.getItem(key) : typeof storage.get === 'function' ? storage.get(key) : null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed.map(sanitizeEvent) : [];
    } catch (_) { return []; }
  }
  function storageWrite(storage, key, entries) {
    try {
      const value = JSON.stringify(entries);
      if (!storage) return;
      if (typeof storage.setItem === 'function') storage.setItem(key, value);
      else if (typeof storage.set === 'function') storage.set(key, value);
    } catch (_) {}
  }

  function createLogger(options) {
    const opts = options || {};
    const storage = resolveStorage(opts);
    const storageKey = text(opts.storageKey) || DEFAULT_STORAGE_KEY;
    const maxEntries = Math.max(20, Math.min(1000, Number(opts.maxEntries) || DEFAULT_MAX_ENTRIES));
    let entries = storageRead(storage, storageKey).slice(-maxEntries);
    let pending = Promise.resolve();
    const sink = typeof opts.sink === 'function' ? opts.sink : null;
    function persist() { storageWrite(storage, storageKey, entries); }
    function record(input) {
      const event = sanitizeEvent(input);
      entries.push(event);
      if (entries.length > maxEntries) entries = entries.slice(-maxEntries);
      persist();
      if (sink) {
        try {
          const result = sink(event);
          if (result && typeof result.then === 'function') pending = pending.then(() => result).catch(() => {});
        } catch (_) {}
      }
      return event;
    }
    function begin(operation, transport, endpoint, metadata) {
      const requestId = sanitizeRequestId(metadata && metadata.request_id || createRequestId());
      const startedAt = Date.now();
      let terminal = false;
      const base = { request_id:requestId, operation, transport, endpoint, component:metadata && metadata.component };
      record(Object.assign({}, base, { phase:'started' }));
      function mark(phase, extra) {
        if (terminal) return null;
        const value = Object.assign({}, base, extra || {}, { phase });
        if (phase !== 'started' && value.duration_ms == null) value.duration_ms = Date.now() - startedAt;
        const event = record(value);
        if (phase === 'completed' || phase === 'failed' || phase === 'aborted') terminal = true;
        return event;
      }
      return Object.freeze({
        request_id:requestId,
        mark,
        requestSent:extra => mark('request_sent', extra),
        response:extra => mark('response', extra),
        complete:extra => mark('completed', extra),
        fail:(error, extra) => mark('failed', Object.assign({}, extra || {}, { error_code:sanitizeErrorCode(error) })),
        abort:(error, extra) => mark('aborted', Object.assign({}, extra || {}, { error_code:sanitizeErrorCode(error || 'NETWORK_ABORTED') })),
      });
    }
    async function flush() { await pending; return true; }
    function snapshot() { return entries.map(item => Object.assign({}, item)); }
    function clear() { entries = []; persist(); return true; }
    const logger = Object.freeze({
      record, log:record, begin, flush, snapshot, clear,
      exportText:() => JSON.stringify(snapshot(), null, 2),
      storageKey, maxEntries,
      traceFetch:(fetcher, url, options, metadata) => traceFetch(fetcher, url, options, Object.assign({}, metadata || {}, { logger })),
    });
    return logger;
  }

  const api = Object.freeze({
    DEFAULT_STORAGE_KEY,
    createRequestId,
    sanitizeRequestId,
    sanitizeUrl,
    sanitizeErrorCode,
    sanitizeEvent,
    byteLength,
    responseByteLength,
    resolveLogger,
    traceFetch,
    completeResponse,
    failResponse,
    createLogger,
  });
  if (root && root.document && !root.CWBNetworkLog) {
    try { root.CWBNetworkLog = api.createLogger({ storageKey:DEFAULT_STORAGE_KEY, maxEntries:DEFAULT_MAX_ENTRIES }); } catch (_) {}
  }
  return api;
});
