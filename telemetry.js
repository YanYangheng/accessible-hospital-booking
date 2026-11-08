'use strict';

const study = (() => {
  const online = location.protocol.startsWith('http');
  const eventPrefix = 'booking.event.';
  const rejectedPrefix = 'booking.rejected.';
  const pending = new Map();
  const progressKey = 'booking.progress';
  const controllers = new Set();
  let snapshotReader, generation = 0, pendingReturn;
  let mode = 'inactive', session, attempt = null, sequence = 0;
  let busy = false, timer, failures = 0, singleEvent = false;
  let pendingSession, pendingAttempt;

  function id() {
    return Array.from(crypto.getRandomValues(new Uint8Array(18)), n => n.toString(16).padStart(2, '0')).join('');
  }
  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* Keep the memory copy if storage is unavailable or full. */ }
  }
  function forget(key) {
    pending.delete(key);
    try { localStorage.removeItem(key); } catch { /* Memory acknowledgement still applies. */ }
  }
  function restore() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key.startsWith(eventPrefix)) continue;
        try {
          const record = JSON.parse(localStorage.getItem(key));
          if (record?.event && typeof record.session === 'string' && !pending.has(key)) pending.set(key, record);
        } catch { /* An unreadable entry must not block other records. */ }
      }
    } catch { /* Private browsing may disable persistence. */ }
  }
  function identity() { return mode === 'record' ? {session, attempt, sequence} : null; }
  function getProgress() {
    try {
      const record = JSON.parse(localStorage.getItem(progressKey));
      if (record?.version !== window.BOOKING_DATA.version || !record.snapshot?.state ||
          !/^[a-f0-9]{36}$/.test(record.identity?.session) ||
          (record.identity.attempt !== null && !/^[a-f0-9]{36}$/.test(record.identity.attempt)) ||
          !Number.isSafeInteger(record.identity.sequence) || record.identity.sequence < 0) return null;
      return record;
    } catch { return null; }
  }
  function checkpoint() {
    if (mode !== 'record' || !snapshotReader) return;
    const snapshot = snapshotReader();
    if (!snapshot || snapshot.state.page === 'cover') return;
    store(progressKey, {version:window.BOOKING_DATA.version, identity:identity(), snapshot, saved_ms:Date.now()});
  }
  function pause() { mode = 'inactive'; clearTimeout(timer); timer = null; }
  function clear() {
    generation++;
    pause();
    for (const controller of controllers) controller.abort();
    controllers.clear();
    pending.clear();
    session = undefined; attempt = null; sequence = 0;
    pendingSession = pendingAttempt = pendingReturn = null;
    failures = 0; singleEvent = false; busy = false;
    try {
      const keys = Array.from({length:localStorage.length}, (_, i) => localStorage.key(i));
      for (const key of keys) if (key.startsWith('booking.')) localStorage.removeItem(key);
    } catch { /* Storage can be disabled by the browser. */ }
  }
  async function resume(record) {
    if (!record || !online) return false;
    pause();
    const epoch = generation;
    pendingReturn ||= {session:record.identity.session, attempt:record.identity.attempt,
      return_id:id(), client_ms:Date.now(), page:record.snapshot.state.page, version:record.version};
    try {
      const response = await post('/api/resume', pendingReturn);
      if (!response.ok || epoch !== generation) return false;
      const result = await response.json();
      if (epoch !== generation || !Number.isSafeInteger(result.last_seq)) return false;
      session = record.identity.session; attempt = record.identity.attempt;
      restore();
      sequence = Math.max(record.identity.sequence, result.last_seq);
      for (const item of pending.values()) {
        if (item.session === session && Number.isSafeInteger(item.event.seq)) sequence = Math.max(sequence, item.event.seq);
      }
      mode = 'record'; pendingReturn = null;
      log('result', record.snapshot.state.page, 'resume', {result:'test_resumed', saved_ms:record.saved_ms});
      schedule(0);
      return true;
    } catch { return false; }
  }
  async function post(path, body) {
    checkpoint();
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      return await fetch(path, {method:'POST', body:JSON.stringify(body), signal:controller.signal,
        headers:{'Content-Type':'application/json'}, keepalive:true});
    } finally { clearTimeout(timeout); controllers.delete(controller); }
  }
  async function begin(name, debug = false, conditions = {expiry:false, delayed:false}) {
    mode = 'inactive';
    attempt = null;
    pendingAttempt = null;
    clearTimeout(timer);
    if (debug) { clear(); mode = 'debug'; return true; }
    if (!online) return false;
    if (!pendingSession || pendingSession.name !== name) {
      pendingSession = {session:id(), name, started_ms:Date.now(), version:window.BOOKING_DATA.version, conditions};
    }
    const epoch = generation;
    try {
      const payload = pendingSession;
      const result = await post('/api/sessions', payload);
      if (!result.ok || epoch !== generation) return false;
      session = payload.session;
      sequence = 0;
      pendingSession = null;
      mode = 'record';
      restore();
      schedule(0);
      return true;
    } catch { return false; }
  }
  async function beginAttempt(conditions) {
    if (mode === 'debug') return true;
    if (mode !== 'record') return false;
    pendingAttempt ||= {session, attempt:id(), started_ms:Date.now(), conditions};
    const epoch = generation;
    try {
      const payload = pendingAttempt;
      const result = await post('/api/attempts', payload);
      if (!result.ok || epoch !== generation) return false;
      attempt = payload.attempt;
      pendingAttempt = null;
      log('result', 'home', 'start', {result:'attempt_started'});
      return true;
    } catch { return false; }
  }
  function schedule(delay = 200) {
    clearTimeout(timer);
    if (mode === 'record') timer = setTimeout(() => { timer = null; void flush(); }, delay);
  }
  function batch() {
    const entries = Array.from(pending.entries());
    const firstSession = entries[0][1].session;
    return entries.filter(([, value]) => value.session === firstSession).slice(0, singleEvent ? 1 : 50);
  }
  function quarantine(key, record, reason) {
    store(rejectedPrefix + key.slice(eventPrefix.length), {...record, reason});
    forget(key);
  }
  async function flush() {
    if (mode !== 'record' || busy || !pending.size) return;
    busy = true;
    const entries = batch();
    const epoch = generation;
    try {
      const response = await post('/api/events', {session:entries[0][1].session, events:entries.map(([, r]) => r.event)});
      if (epoch !== generation) return;
      if (!response.ok) {
        if ([400, 413, 422].includes(response.status)) {
          if (entries.length === 1) quarantine(entries[0][0], entries[0][1], 'http_' + response.status);
          else singleEvent = true;
        } else throw new Error('Retryable upload failure');
      } else {
        const result = await response.json();
        if (epoch !== generation) return;
        if (!Array.isArray(result.accepted) || !Array.isArray(result.rejected)) throw new Error('Invalid acknowledgement');
        for (const index of result.accepted) if (entries[index]) forget(entries[index][0]);
        for (const item of result.rejected) if (entries[item.index]) {
          const [key, record] = entries[item.index];
          quarantine(key, record, item.reason);
        }
      }
      failures = 0;
    } catch { if (epoch === generation) failures++; }
    finally {
      if (epoch !== generation) return;
      busy = false;
      if (!pending.size) singleEvent = false;
      if (pending.size) schedule(failures ? Math.min(30000, 1000 * 2 ** Math.min(failures, 5)) : 200);
    }
  }
  function log(kind, page, control = 'background', details = {}) {
    if (mode !== 'record') return;
    const event = {seq:++sequence, client_ms:Date.now(), kind, page, control, attempt, details};
    const record = {session, event};
    const key = eventPrefix + session + '.' + event.seq;
    pending.set(key, record);
    store(key, record);
    if (!timer && !busy) schedule();
  }
  async function save(form, details, doctor, profile) {
    if (mode === 'debug') return true;
    if (mode !== 'record' || !attempt) return false;
    const epoch = generation;
    try {
      const response = await post('/api/submissions', {session, attempt, form, details, doctor, profile});
      return response.ok && epoch === generation;
    } catch { return false; }
  }
  function sendOnExit() {
    if (mode !== 'record') return;
    checkpoint();
    const sessions = [...new Set(Array.from(pending.values(), r => r.session))];
    for (const value of sessions) {
      const events = Array.from(pending.values()).filter(r => r.session === value).map(r => r.event);
      for (let offset = 0; offset < events.length; offset += 50) {
        navigator.sendBeacon('/api/events', JSON.stringify({session:value, events:events.slice(offset, offset + 50)}));
      }
    }
    // Retain persisted entries until a later acknowledged fetch, even if the beacon was queued.
  }
  if (online) {
    window.addEventListener('online', () => { restore(); schedule(0); });
    window.addEventListener('pagehide', event => {
      const snapshot = snapshotReader?.();
      if (snapshot) log('result', snapshot.state.page, 'page-exit', {result:'page_left', cached:Boolean(event.persisted)});
      sendOnExit();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) sendOnExit();
      else { restore(); schedule(0); }
    });
  }
  return {begin, beginAttempt, log, save, resume, getProgress, identity, clear, pause,
    setSnapshotReader(reader) { snapshotReader = reader; },
    selectAttempt(value) { if (mode === 'record') attempt = value; }
  };
})();
