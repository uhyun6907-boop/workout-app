// 심플다이어트 (Simple Diet) bodyweight import / read-only sync
(function (g) {
  const OWNER = 'uhyun6907-boop', REPO = 'sd-data', BRANCH = 'main', PATH = 'records.json';
  const KEY_RE = /^\d{4}-\d{2}-\d{2} (오전|오후)$/;
  const pad = n => String(n).padStart(2, '0');
  const slotOfHour = h => (h >= 4 && h < 12 ? '오전' : '오후'); // same rule as Simple Diet sync.ts slotOfT
  const r1 = w => Math.round(w * 10) / 10;

  function parseCsv(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) throw new Error('빈 파일이에요');
    const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    const iT = head.findIndex(h => h === '일시'), iW = head.findIndex(h => /^체중/.test(h)), iS = head.findIndex(h => h === '구분');
    if (iT < 0 || iW < 0) throw new Error('심플다이어트 CSV 형식이 아니에요 (일시/체중 열 없음)');
    const byTs = new Map(); let bad = 0;
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/.exec(c[iT] || '');
      const w = parseFloat(c[iW]);
      if (!m || !(w > 20 && w < 400)) { bad++; continue; }
      const day = `${m[1]}-${pad(m[2])}-${pad(m[3])}`, h = +m[4];
      const date = `${day}T${pad(h)}:${m[5]}:00`;
      const slot = c[iS] === '오전' || c[iS] === '오후' ? c[iS] : slotOfHour(h);
      byTs.set(date, { date, kg: r1(w), src: 'sd', sk: `${day} ${slot}` }); // same timestamp -> last row wins
    }
    return { entries: [...byTs.values()].sort((a, b) => a.date < b.date ? -1 : 1), rows: lines.length - 1, bad };
  }

  function b64ToUtf8(b64) {
    const bin = atob(b64.replace(/\s+/g, '')); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function parseRecords(text) {
    const d = text.trim() ? JSON.parse(text) : {};
    const src = (d && d.records) || {}; const out = {};
    for (const k of Object.keys(src)) if (KEY_RE.test(k)) {
      const r = src[k] || {};
      out[k] = { w: r1(Number(r.w) || 0), time: String(r.time || '07:00'), u: Number(r.u) || 0, del: !!r.del };
    }
    return out;
  }
  // READ ONLY: only GET requests are ever made.
  async function fetchRemote(token) {
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
    const hdr = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    let r;
    try { r = await fetch(`${api}?ref=${BRANCH}&t=${Date.now()}`, { headers: hdr, cache: 'no-store' }); }
    catch (e) { throw new Error('오프라인이거나 GitHub에 연결할 수 없어요'); }
    if (r.status === 401) throw new Error('토큰이 올바르지 않거나 만료됐어요 (401)');
    if (r.status === 403 || r.status === 404) throw new Error(`sd-data 저장소의 records.json을 읽을 수 없어요 (${r.status}). 토큰에 sd-data Contents 읽기 권한이 있는지 확인하세요.`);
    if (!r.ok) throw new Error('GitHub 오류 ' + r.status);
    const j = await r.json();
    let text;
    if (j.content && j.encoding === 'base64') text = b64ToUtf8(j.content);
    else {
      const raw = await fetch(`${api}?ref=${BRANCH}`, { headers: { ...hdr, Accept: 'application/vnd.github.raw' }, cache: 'no-store' });
      if (!raw.ok) throw new Error('GitHub 오류 ' + raw.status);
      text = await raw.text();
    }
    return parseRecords(text);
  }
  function recToEntry(k, r) {
    const t = /^(\d{1,2}):(\d{2})/.exec(r.time) || [0, '07', '00'];
    return { date: `${k.slice(0, 10)}T${pad(+t[1])}:${t[2]}:00`, kg: r.w, src: 'sd', sk: k };
  }
  // Apply remote records (last-write-wins per slot key, tombstones delete) onto bw list. Manual entries untouched.
  function applyRecords(bw, recs) {
    let added = 0, updated = 0, removed = 0, live = 0;
    const bySk = new Map();
    bw.forEach((e, i) => { if (e.src === 'sd') { const sk = e.sk || skOf(e.date); (bySk.get(sk) || bySk.set(sk, []).get(sk)).push(i); } });
    const drop = new Set(); const add = [];
    for (const k of Object.keys(recs)) {
      const r = recs[k]; const idx = bySk.get(k) || [];
      if (r.del || !(r.w > 0)) { idx.forEach(i => drop.add(i)); removed += idx.length; continue; }
      live++;
      const ne = recToEntry(k, r);
      if (idx.length === 1 && bw[idx[0]].date === ne.date && bw[idx[0]].kg === ne.kg) continue;
      if (idx.length) updated++; else added++;
      idx.forEach(i => drop.add(i)); add.push(ne);
    }
    const out = bw.filter((_, i) => !drop.has(i)).concat(add).sort((a, b) => a.date < b.date ? -1 : 1);
    return { bw: out, added, updated, removed, live };
  }
  function skOf(date) { return `${date.slice(0, 10)} ${slotOfHour(+date.slice(11, 13))}`; }

  // Bonus: same-origin read of Simple Diet's local data (only works in the same browser, not across iOS home-screen apps).
  async function readSameOrigin() {
    let st = null;
    try { const s = localStorage.getItem('my-simple-diet-v1'); st = s ? JSON.parse(s) : null; } catch (e) { st = null; }
    if (!st && indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        if (dbs.some(d => d.name === 'simple-diet')) {
          st = await new Promise(res => {
            const r = indexedDB.open('simple-diet');
            r.onupgradeneeded = () => { r.transaction.abort(); }; // never create/alter the other app's DB
            r.onerror = () => res(null);
            r.onsuccess = () => { const db = r.result; try { const q = db.transaction('kv', 'readonly').objectStore('kv').get('state'); q.onsuccess = () => { res(q.result || null); db.close(); }; q.onerror = () => { res(null); db.close(); }; } catch (e) { db.close(); res(null); } };
          });
        }
      } catch (e) { st = null; }
    }
    if (!st || !Array.isArray(st.entries)) return null;
    const out = new Map();
    for (const [t, w] of st.entries) {
      if (!/^\d{12}$/.test(t) || !(w > 20)) continue;
      const date = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:00`;
      out.set(date, { date, kg: r1(w), src: 'sd', sk: skOf(date) });
    }
    return [...out.values()];
  }

  g.SD = { parseCsv, fetchRemote, parseRecords, applyRecords, readSameOrigin, skOf };
  if (typeof module !== 'undefined') module.exports = g.SD;
})(typeof window !== 'undefined' ? window : globalThis);
