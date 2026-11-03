'use strict';

const study = (() => {
  const enabled = location.protocol.startsWith('http');
  let session, seq, busy = false;
  const queue = [];
  function begin() {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    session = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    seq = 0;
  }
  function batch() {
    const id = queue[0].session;
    const events = queue.slice(0, 75).filter(item => item.session === id).map(item => item.event);
    return {session:id, events};
  }
  async function flush() {
    if (!enabled || busy || !queue.length) return;
    busy = true;
    const payload = batch();
    try {
      const result = await fetch('/api/events', {
        method:'POST', body:JSON.stringify(payload), keepalive:true
      });
      if (result.ok) queue.splice(0, payload.events.length);
    } catch {
      // Keep unacknowledged events for the next retry.
    } finally {
      busy = false;
    }
  }
  function log(kind, page, control='background') {
    if (!enabled) return;
    queue.push({session, event:[++seq, Date.now(), kind, page, control]});
    void flush();
  }
  async function save(form, details) {
    if (!enabled) return true;
    try {
      const result = await fetch('/api/submissions', {method:'POST',body:JSON.stringify({session, form, details})});
      return result.ok;
    } catch {
      return false;
    }
  }
  function sendOnExit() {
    const ids = [...new Set(queue.map(item => item.session))];
    for (const id of ids) {
      const events = queue.filter(item => item.session === id).map(item => item.event);
      for (let offset=0; offset<events.length; offset+=75) {
        navigator.sendBeacon('/api/events', JSON.stringify({session:id,events:events.slice(offset,offset+75)}));
      }
    }
  }
  begin();
  if (enabled) {
    setInterval(flush, 1500);
    window.addEventListener('online', flush);
    window.addEventListener('pagehide', sendOnExit);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) sendOnExit();
    });
  }
  return {begin,log,save};
})();
