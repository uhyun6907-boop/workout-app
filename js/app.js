'use strict';
/* ================= storage (IndexedDB) ================= */
const DBNAME = 'workout-app-db';
let _db;
function idb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DBNAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
async function dbGet(k) { const d = await idb(); return new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function dbSet(k, v) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
const KEYS = ['workouts', 'templates', 'customEx', 'bw', 'settings', 'active', 'sdsync'];
const DEFAULT_SETTINGS = { unit: 'kg', goal: 6, rest: 120, name: '나', exUnit: {}, dash: ['Squat (Barbell)', 'Bench Press (Barbell)', 'Deadlift (Barbell)', 'Sumo Deadlift (Barbell)', 'Overhead Press (Barbell)'] };
const S = { workouts: [], templates: [], customEx: [], bw: [], settings: { ...DEFAULT_SETTINGS }, active: null, sdsync: { token: '', last: 0, count: 0, err: '' } };
const saveTimers = {};
function save(k, now) {
  clearTimeout(saveTimers[k]);
  const f = () => dbSet(k, S[k]).catch(e => toast('저장 실패: ' + e.message));
  if (now) return f();
  saveTimers[k] = setTimeout(f, 300);
}
async function loadAll() {
  for (const k of KEYS) { const v = await dbGet(k); if (v !== undefined) S[k] = v; }
  S.settings = { ...DEFAULT_SETTINGS, ...S.settings };
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

/* ================= helpers ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LB = StrongCSV.LB;
const WD = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
function pd(s) { const m = /(\d+)-(\d+)-(\d+)T?(\d+)?:?(\d+)?:?(\d+)?/.exec(s); return new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)); }
function isoLocal(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtDateK(d, withYear) { return `${WD[d.getDay()]}, ${withYear ? d.getFullYear() + '년 ' : ''}${d.getMonth() + 1}월 ${d.getDate()}일`; }
function fmtShort(d) { return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; }
function ago(d) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const t1 = new Date(d); t1.setHours(0, 0, 0, 0);
  const days = Math.round((t0 - t1) / 864e5);
  if (days <= 0) return '오늘'; if (days === 1) return '어제'; if (days < 30) return days + '일 전';
  return fmtShort(d);
}
const fmtDur = StrongCSV.fmtDurationK;
function fmtClock(sec) { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`; }
function unitOf(ex) { return (ex && S.settings.exUnit[ex]) || S.settings.unit; }
function toU(kg, ex) { return unitOf(ex) === 'lb' ? kg / LB : kg; }
function fromU(v, ex) { return unitOf(ex) === 'lb' ? v * LB : v; }
function nfmt(x) { x = Math.round(x * 100) / 100; return Number.isInteger(x) ? String(x) : String(+x.toFixed(2)); }
function fmtW(kg, ex) { return nfmt(toU(kg, ex)) + ' ' + unitOf(ex); }
function fmtVol(kg) { const u = S.settings.unit; const v = u === 'lb' ? kg / LB : kg; return Math.round(v).toLocaleString('ko-KR') + ' ' + u; }
function fmtRm(kg, ex) { return Math.round(toU(kg, ex) * 2) / 2 + ' ' + unitOf(ex); }
function e1rm(w, r) { if (!(w > 0) || !(r > 0)) return 0; return r === 1 ? w : w * (1 + r / 30); }
function setLabel(s, ex) {
  if (s.dist || s.sec) { const p = []; if (s.dist) p.push(s.dist + ' km'); if (s.sec) p.push(fmtClock(s.sec)); if (s.w) p.unshift(fmtW(s.w, ex)); return p.join(' · '); }
  if (!s.w) return `${nfmt(s.r)} 렙`;
  return `${fmtW(s.w, ex)} × ${nfmt(s.r)}`;
}
function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, ms); }
function download(name, text, type) {
  const blob = new Blob([text], { type }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const ICON = {
  clock: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6 3.6 2.1-.9 1.6L11 13.6V6h2z"/></svg>',
  weight: '<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 1 2.8 4H18l3 13H3L6 7h3.2A3 3 0 0 1 12 3zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M7 3h10v2h4v3a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15.9V18h4v3H7v-3h4v-2.1A5 5 0 0 1 7.6 13 5 5 0 0 1 3 8V5h4zm-2 4v1a3 3 0 0 0 2 2.8V7zm14 0h-2v3.8A3 3 0 0 0 19 8z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="20" fill="#8E8E93"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>',
  person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4.2"/><path d="M3.5 21c.6-4.6 4-7 8.5-7s7.9 2.4 8.5 7z"/></svg>',
};

/* ================= derived data ================= */
let D = { byStart: [], exHist: {}, exMap: {}, best: {} };
function exInfo(name) {
  return D.exMap[name] || { name, body: EXDB.guessBody(name), cat: EXDB.guessCategory(name, EXDB.guessBody(name)) };
}
function derive() {
  const asc = [...S.workouts].sort((a, b) => a.start < b.start ? -1 : 1);
  const exHist = {};
  const best = {};
  for (const w of asc) {
    let prs = 0;
    const date = pd(w.start);
    w._vol = 0;
    for (const ex of w.exercises) {
      const b = best[ex.name] || (best[ex.name] = { rm: 0, w: 0, vol: 0, reps: 0, seen: false });
      let sRm = 0, sW = 0, sVol = 0, sReps = 0, bestSet = null, bestScore = -1;
      for (const s of ex.sets) {
        const v = (s.w || 0) * (s.r || 0); w._vol += v;
        const rm = e1rm(s.w, s.r);
        if (rm > sRm) sRm = rm; if ((s.w || 0) > sW) sW = s.w || 0; if (v > sVol) sVol = v; if ((s.r || 0) > sReps) sReps = s.r || 0;
        const score = rm || (s.w ? s.w : 0) * 1000 + (s.r || 0) + (s.dist || 0) * 10 + (s.sec || 0) / 100;
        if (score > bestScore && s.type !== 'W') { bestScore = score; bestSet = s; }
      }
      if (!bestSet && ex.sets.length) bestSet = ex.sets[0];
      ex._best = bestSet;
      let p = 0;
      if (b.seen) {
        if (sRm > b.rm + 1e-9) p++;
        if (sW > b.w + 1e-9) p++;
        if (sVol > b.vol + 1e-9) p++;
        if (!sRm && sReps > b.reps) p++;
      }
      ex._pr = p; prs += p;
      if (ex.sets.length) {
        b.seen = true; b.rm = Math.max(b.rm, sRm); b.w = Math.max(b.w, sW); b.vol = Math.max(b.vol, sVol); b.reps = Math.max(b.reps, sReps);
      }
      (exHist[ex.name] || (exHist[ex.name] = [])).push({ w, ex, date, rm: sRm, maxW: sW, vol: sVol, reps: sReps });
    }
    w._prs = prs;
    w._date = date;
  }
  const exMap = {};
  for (const e of EXDB.SEED_LIST) exMap[e.name] = { ...e };
  for (const e of S.customEx) exMap[e.name] = { ...e, custom: true };
  for (const n in exHist) if (!exMap[n]) { const body = EXDB.guessBody(n); exMap[n] = { name: n, body, cat: EXDB.guessCategory(n, body), imported: true }; }
  D = { byStart: asc.slice().reverse(), exHist, exMap, best };
}
function lastPerformance(name, excludeId) {
  const h = D.exHist[name]; if (!h) return null;
  for (let i = h.length - 1; i >= 0; i--) if (h[i].w.id !== excludeId) return h[i];
  return null;
}

/* ================= charts (SVG) ================= */
function barChart(vals, labels, goal) {
  const W = 340, H = 170, L = 6, R = 34, T = 10, B = 24;
  const max = Math.max(goal + 2, ...vals, 4);
  const top = Math.ceil(max / 2) * 2;
  const cw = (W - L - R) / vals.length, bw = Math.min(26, cw * 0.62);
  const y = v => T + (H - T - B) * (1 - v / top);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}">`;
  for (let i = 0; i <= 4; i++) { const v = top * i / 4; s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#EEE"/>`; }
  s += `<text x="${W - R + 6}" y="${y(top) + 4}">${top}</text><text x="${W - R + 6}" y="${y(0) + 4}">0</text>`;
  vals.forEach((v, i) => {
    const x = L + cw * i + (cw - bw) / 2;
    const col = v >= goal ? 'var(--purple)' : 'var(--purple-l)';
    if (v > 0) s += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${y(0) - y(v)}" rx="4" fill="${col}"/>`;
    s += `<text class="lbl" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>`;
  });
  s += `<line x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--purple)" stroke-width="1" opacity=".6"/><text x="${W - R + 6}" y="${y(goal) + 4}" style="fill:var(--purple);font-weight:700">${goal}</text>`;
  return s + '</svg>';
}
function lineChart(pts, opts = {}) {
  const W = 340, H = 170, L = 6, R = 50, T = 12, B = 24;
  if (!pts.length) return `<div class="empty small">데이터가 아직 없어요</div>`;
  const xs = pts.map(p => +p.x), ys = pts.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (opts.from && opts.from < x0) x0 = opts.from; if (x1 === x0) { x0 -= 864e5 * 7; x1 += 864e5 * 7; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const padY = Math.max((y1 - y0) * 0.12, 1); y0 = Math.max(0, y0 - padY); y1 = y1 + padY;
  const X = x => L + (W - L - R) * (x - x0) / (x1 - x0), Y = v => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}">`;
  for (let i = 0; i <= 3; i++) { const yy = T + (H - T - B) * i / 3; s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#F0F0F0"/>`; }
  const span = x1 - x0, nl = 4;
  for (let i = 0; i <= nl; i++) {
    const t = new Date(x0 + span * i / nl);
    const lab = span > 864e5 * 400 ? `${String(t.getFullYear()).slice(2)}.${t.getMonth() + 1}` : `${t.getMonth() + 1}월`;
    s += `<text x="${X(+t)}" y="${H - 6}" text-anchor="middle">${lab}</text>`;
  }
  const u = opts.unit || '';
  s += `<text x="${W - R + 6}" y="${T + 4}">${Math.round(y1)} ${u}</text><text x="${W - R + 6}" y="${H - B}">${Math.round(y0)} ${u}</text>`;
  const d = pts.map((p, i) => (i ? 'L' : 'M') + X(+p.x).toFixed(1) + ',' + Y(p.y).toFixed(1)).join('');
  s += `<path d="${d}" fill="none" stroke="var(--purple-l)" stroke-width="2.2" stroke-linejoin="round"/>`;
  if (pts.length <= 80) pts.forEach(p => s += `<circle cx="${X(+p.x)}" cy="${Y(p.y)}" r="3.2" fill="#fff" stroke="var(--purple-l)" stroke-width="1.8"/>`);
  const lp = pts[pts.length - 1];
  s += `<circle cx="${X(+lp.x)}" cy="${Y(lp.y)}" r="4" fill="var(--purple)"/>`;
  return s + '</svg>';
}
const RANGES = [['3M', 92], ['1Y', 366], ['ALL', 0]];
const chartRange = {};
function rangeBtns(key) {
  const cur = chartRange[key] || '1Y';
  return `<div class="range">${RANGES.map(([k]) => `<button data-range="${esc(key)}" data-v="${k}" class="${cur === k ? 'on' : ''}">${k === 'ALL' ? '전체' : k === '1Y' ? '1년' : '3개월'}</button>`).join('')}</div>`;
}
function rangeFrom(key) { const r = RANGES.find(x => x[0] === (chartRange[key] || '1Y')); return r[1] ? Date.now() - r[1] * 864e5 : 0; }
function prPoints(name, from) {
  const h = D.exHist[name] || [];
  let run = 0; const pts = [];
  for (const e of h) { if (!e.rm) continue; if (e.rm > run) run = e.rm; if (+e.date >= from) pts.push({ x: e.date, y: toU(run, name) }); }
  return pts;
}

/* ================= navigation ================= */
let TAB = 'profile';
function go(tab) {
  TAB = tab;
  $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  render();
  $('#view').scrollTop = 0;
}
function render() {
  const v = $('#view');
  ({ profile: renderProfile, history: renderHistory, start: renderStart, exercises: renderExercises, settings: renderSettings })[TAB](v);
  updateBanner();
}

/* ================= profile ================= */
function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; }
function renderProfile(v) {
  const n = S.workouts.length;
  const ws0 = weekStart(new Date());
  const weeks = []; for (let i = 7; i >= 0; i--) { const d = new Date(ws0); d.setDate(d.getDate() - 7 * i); weeks.push(d); }
  const counts = weeks.map(() => 0);
  for (const w of S.workouts) { const d = w._date || pd(w.start); const idx = Math.round((weekStart(d) - weeks[0]) / (7 * 864e5)); if (idx >= 0 && idx < 8) counts[idx]++; }
  const labels = weeks.map(d => `${d.getMonth() + 1}.${d.getDate()}.`);
  const bwFrom = rangeFrom('bw');
  const bwSorted = S.bw.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const bwDaily = []; let lastDay = '';
  for (const e of bwSorted) { const dk = e.date.slice(0, 10); if (dk !== lastDay) { bwDaily.push(e); lastDay = dk; } } // first (morning) value per day
  const bwPts = bwDaily.filter(e => +pd(e.date) >= bwFrom).map(e => ({ x: pd(e.date), y: toU(e.kg) }));
  const lastBw = bwSorted[bwSorted.length - 1];
  v.innerHTML = `
  <div class="topbar"><div class="l"><button class="icon-btn" data-act="settings">${ICON.gear}</button></div><div class="r"></div></div>
  <h1 class="big">프로필</h1>
  <div class="profile-head"><div class="avatar">${ICON.person}</div><div><div class="bold" style="font-size:20px">${esc(S.settings.name)}</div><div class="muted" style="font-size:17px;font-weight:600">${n.toLocaleString('ko-KR')} 워크아웃</div></div></div>
  <div class="section-h"><span>대시보드</span></div>
  <div class="card">
    <div class="between"><div><h3>주당 워크아웃</h3><div class="sub">최근 8주 · 목표 ${S.settings.goal}회</div></div>
      <button class="pill" data-act="goal">◎ 목표</button></div>
    <div style="margin-top:10px">${barChart(counts, labels, S.settings.goal)}</div>
  </div>
  <div class="card">
    <div class="between"><div><h3>체중</h3><div class="sub">${lastBw ? '최근 ' + fmtW(lastBw.kg) + ' · ' + fmtShort(pd(lastBw.date)) + ' ' + lastBw.date.slice(11, 16) : '기록 없음 · 설정에서 심플다이어트 연동'}</div></div>
      <div class="row"><button class="pill" data-act="bw-list">목록</button><button class="pill" data-act="bw-add">＋</button></div></div>
    <div style="margin-top:10px">${lineChart(bwPts, { unit: S.settings.unit })}</div>${rangeBtns('bw')}<div class="muted tiny" style="margin-top:6px">하루 첫(아침) 기록 기준${S.sdsync.token ? ' · 심플다이어트 연동됨' : ''}</div>
  </div>
  ${S.settings.dash.map(name => {
    const pts = prPoints(name, rangeFrom(name));
    const b = D.best[name];
    return `<div class="card"><div class="between"><div><h3>${esc(name)}</h3><div class="sub">PR 진행 상황 (추정 1RM)${b && b.rm ? ' · 최고 ' + fmtRm(b.rm, name) : ''}</div></div>
      <button class="dots" data-act="ex-detail" data-name="${esc(name)}">•••</button></div>
      <div style="margin-top:10px">${lineChart(pts, { unit: unitOf(name), from: rangeFrom(name) || undefined })}</div>${rangeBtns(name)}</div>`;
  }).join('')}
  <button class="btn light" data-act="dash-edit" style="margin-bottom:10px">＋ 차트 운동 추가</button>
  ${n === 0 ? `<div class="card empty">아직 기록이 없어요.<br>설정에서 Strong CSV를 가져오거나<br>워크아웃을 시작해보세요.<br><br><button class="btn" data-act="settings">CSV 가져오기</button></div>` : ''}`;
}

/* ================= history ================= */
let histMode = 'list', calMonth = null, calSel = null, histLimit = 40;
function workoutCard(w) {
  const d = w._date || pd(w.start);
  return `<div class="card" data-act="w-detail" data-id="${w.id}">
    <div class="between"><h3 style="font-size:17px">${esc(w.name)}</h3><button class="dots" data-act="w-menu" data-id="${w.id}">•••</button></div>
    <div class="sub" style="font-weight:600;color:#555">${fmtDateK(d, d.getFullYear() !== new Date().getFullYear())}</div>
    <div class="stat-row"><span>${ICON.clock}${fmtDur(w.duration)}</span><span>${ICON.weight}${fmtVol(w._vol || 0)}</span><span>${ICON.trophy}${w._prs || 0} PR</span></div>
    <div class="ex-grid"><div class="h">운동</div><div class="h">최고 세트</div>
    ${w.exercises.map(e => `<div>${e.sets.length} × ${esc(e.name)}</div><div>${e._best ? esc(setLabel(e._best, e.name)) : ''}${e._pr ? ' <span class="pr-badge">🏆</span>' : ''}</div>`).join('')}</div>
  </div>`;
}
function renderHistory(v) {
  const list = D.byStart;
  let html = `<div class="topbar"><div class="l"></div><div class="r"><div class="seg"><button data-act="hmode" data-v="list" class="${histMode === 'list' ? 'on' : ''}">목록</button><button data-act="hmode" data-v="cal" class="${histMode === 'cal' ? 'on' : ''}">캘린더</button></div></div></div><h1 class="big">이력</h1>`;
  if (!list.length) { v.innerHTML = html + `<div class="empty">워크아웃 기록이 없어요.</div>`; return; }
  if (histMode === 'cal') { v.innerHTML = html + calendarHtml(); return; }
  let lastM = '', i = 0;
  for (const w of list) {
    if (i >= histLimit) break;
    const d = w._date; const m = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    if (m !== lastM) { html += `<div class="month-h">${m}</div>`; lastM = m; }
    html += workoutCard(w); i++;
  }
  if (histLimit < list.length) html += `<div id="more" class="empty small">불러오는 중…</div>`;
  v.innerHTML = html;
  const more = $('#more');
  if (more) {
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); const st = v.scrollTop; histLimit += 60; renderHistory(v); v.scrollTop = st; } }, { root: v, rootMargin: '600px' });
    io.observe(more);
  }
}
function calendarHtml() {
  const now = new Date();
  if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const days = new Date(y, m + 1, 0).getDate(), first = new Date(y, m, 1).getDay();
  const byDay = {};
  for (const w of S.workouts) { const k = dayKey(w._date); (byDay[k] || (byDay[k] = [])).push(w); }
  let monthCount = 0;
  let cells = ['일', '월', '화', '수', '목', '금', '토'].map(x => `<div class="dow">${x}</div>`).join('');
  for (let i = 0; i < first; i++) cells += '<div></div>';
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`; const has = byDay[k]; if (has) monthCount += has.length;
    cells += `<div class="d ${has ? 'w' : ''} ${k === dayKey(now) ? 'today' : ''} ${k === calSel ? 'sel' : ''}" data-act="cal-day" data-k="${k}"><span>${d}</span></div>`;
  }
  const sel = calSel && byDay[calSel] ? byDay[calSel].sort((a, b) => a.start < b.start ? -1 : 1) : [];
  return `<div class="card"><div class="between" style="margin-bottom:10px"><button class="pill" data-act="cal-nav" data-v="-1">‹</button><div class="bold">${y}년 ${m + 1}월 <span class="muted small">· ${monthCount}회</span></div><button class="pill" data-act="cal-nav" data-v="1">›</button></div>
  <div class="cal">${cells}</div></div>
  ${calSel ? (sel.length ? sel.map(workoutCard).join('') : `<div class="empty small">${calSel} 기록 없음</div>`) : `<div class="empty small">날짜를 눌러 워크아웃을 확인하세요</div>`}`;
}
function workoutDetail(id) {
  const w = S.workouts.find(x => x.id === id); if (!w) return;
  const d = w._date;
  openModal(`<div class="modal-h"><button class="xbtn" data-close>✕</button><h2>${esc(w.name)}</h2><button class="dots" data-act="w-menu" data-id="${w.id}">•••</button></div>
  <div class="muted small bold">${fmtDateK(d, true)} · ${pad(d.getHours())}:${pad(d.getMinutes())}</div>
  <div class="stat-row"><span>${ICON.clock}${fmtDur(w.duration)}</span><span>${ICON.weight}${fmtVol(w._vol || 0)}</span><span>${ICON.trophy}${w._prs || 0} PR</span></div>
  ${w.note ? `<div class="card small" style="background:#fafafa">${esc(w.note)}</div>` : ''}
  ${w.exercises.map(e => `<div style="margin:14px 0 4px"><button class="bold" style="color:var(--blue)" data-act="ex-detail" data-name="${esc(e.name)}">${esc(e.name)}</button>${e._pr ? '<span class="chip pr">🏆 PR</span>' : ''}${e.note ? `<div class="muted small">${esc(e.note)}</div>` : ''}</div>
    ${e.sets.map((s, i) => `<div class="hist-set"><span class="i">${s.type !== 'n' ? `<span class="stype ${s.type}">${s.type}</span>` : i + 1}</span><span>${esc(setLabel(s, e.name))}</span>${s.rpe ? `<span class="muted small">RPE ${s.rpe}</span>` : ''}<span class="muted small" style="margin-left:auto">${e1rm(s.w, s.r) ? '1RM ' + nfmt(Math.round(toU(e1rm(s.w, s.r), e.name))) : ''}</span></div>`).join('')}`).join('')}
  <div style="height:14px"></div><button class="btn" data-act="w-repeat" data-id="${w.id}">이 워크아웃 다시 하기</button>`, { bottom: true });
}
function workoutMenu(id) {
  openModal(`<div class="modal-h"><span></span><h2>워크아웃</h2><button class="xbtn" data-close>✕</button></div>
   <button class="menu-item" data-act="w-repeat" data-id="${id}">다시 하기</button>
   <button class="menu-item" data-act="w-totpl" data-id="${id}">템플릿으로 저장</button>
   <button class="menu-item" data-act="w-edit" data-id="${id}">편집</button>
   <button class="menu-item danger" data-act="w-del" data-id="${id}">삭제</button>`, { bottom: true });
}

/* ================= start / templates ================= */
function tplLast(t) {
  let last = t.lastUsed ? pd(t.lastUsed) : null;
  for (const w of D.byStart) { if (w.name === t.name) { const d = w._date; if (!last || d > last) last = d; break; } }
  return last;
}
function renderStart(v) {
  const tpls = S.templates;
  v.innerHTML = `<div class="topbar"><div class="l"></div><div class="r"></div></div>
  <h1 class="big">워크아웃 시작</h1>
  <div class="bold" style="margin-bottom:8px">빠른 시작</div>
  <button class="btn" data-act="start-empty">비어 있는 워크아웃 시작</button>
  <div class="section-h" style="font-size:26px;font-weight:800"><span>템플릿</span><span class="row"><button class="pill" data-act="tpl-new">＋ 템플릿</button><button class="dots" data-act="tpl-menu">•••</button></span></div>
  <div class="bold" style="margin-bottom:10px">내 템플릿 (${tpls.length})</div>
  ${tpls.length ? `<div class="tpl-grid">${tpls.map(t => { const l = tplLast(t); return `<div class="tpl" data-act="tpl-open" data-id="${t.id}">
     <div class="between" style="width:100%;align-items:flex-start"><h4>${esc(t.name)}</h4><button class="dots" data-act="tpl-edit" data-id="${t.id}">•••</button></div>
     <div class="ex">${esc(t.exercises.map(e => e.name).join(', '))}</div>
     <div class="last">${l ? '🕘 ' + ago(l) : ''}</div></div>`; }).join('')}</div>`
    : `<div class="empty small">템플릿이 없어요.<br>＋ 템플릿으로 만들거나, ••• 메뉴에서 기존 기록으로 자동 생성할 수 있어요.</div>`}`;
}
function tplOpen(id) {
  const t = S.templates.find(x => x.id === id); if (!t) return;
  const l = tplLast(t);
  openModal(`<div class="modal-h"><button class="xbtn" data-close>✕</button><h2>${esc(t.name)}</h2><button style="color:var(--blue);font-weight:600" data-act="tpl-edit" data-id="${t.id}">편집</button></div>
  <div class="muted bold small">마지막 수행: ${l ? ago(l) : '없음'}</div>
  ${t.exercises.map(e => `<div class="ex-item" style="border:0"><div class="ex-thumb">${esc(e.name[0])}</div><div><div class="n">${e.sets.length} × ${esc(e.name)}</div><div class="b">${esc(exInfo(e.name).body)}</div></div></div>`).join('')}
  <div style="height:10px"></div><button class="btn" data-act="tpl-start" data-id="${t.id}">워크아웃 시작</button>`);
}
function tplEditor(id, seed) {
  const t = id ? JSON.parse(JSON.stringify(S.templates.find(x => x.id === id))) : (seed || { id: uid(), name: '', exercises: [] });
  const el = openModal(`<div class="tpl-editor"><div class="modal-h"><button class="xbtn" data-close>✕</button><h2>${id ? '템플릿 편집' : '새 템플릿'}</h2><button style="color:var(--blue);font-weight:700" class="tsave">저장</button></div>
   <div class="field"><label>이름</label><input class="tname" value="${esc(t.name)}" placeholder="예: Squat"></div>
   <div class="tpl-list"></div><div style="height:10px"></div><button class="btn light tadd">＋ 운동 추가</button>
   ${id ? '<div style="height:10px"></div><button class="btn red tdel">템플릿 삭제</button>' : ''}</div>`, { bottom: true });
  const draw = () => {
    el.querySelector('.tpl-list').innerHTML = t.exercises.map((e, i) => `<div class="list-row"><div style="min-width:0"><div class="bold">${esc(e.name)}</div><div class="muted small">${e.sets.map(s => s.w ? setLabel(s, e.name) : (s.r ? s.r + '렙' : '-')).join(', ')}</div></div>
      <div class="row"><button class="pill gray" data-i="${i}" data-op="minus">−</button><b>${e.sets.length}</b><button class="pill gray" data-i="${i}" data-op="plus">＋</button><button class="del" data-i="${i}" data-op="del">✕</button></div></div>`).join('') || '<div class="empty small">운동을 추가하세요</div>';
  };
  draw();
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-op]');
    if (b) { const ex = t.exercises[+b.dataset.i]; if (b.dataset.op === 'plus') ex.sets.push({ ...(ex.sets[ex.sets.length - 1] || { w: 0, r: 0, type: 'n' }) }); else if (b.dataset.op === 'minus') { if (ex.sets.length > 1) ex.sets.pop(); } else t.exercises.splice(+b.dataset.i, 1); draw(); }
    if (e.target.closest('.tadd')) pickExercise(names => { for (const n of names) { const lp = lastPerformance(n); t.exercises.push({ name: n, rest: lp && lp.ex.rest, sets: lp ? lp.ex.sets.map(s => ({ w: s.w, r: s.r, type: s.type })) : [{ w: 0, r: 0, type: 'n' }, { w: 0, r: 0, type: 'n' }, { w: 0, r: 0, type: 'n' }] }); } draw(); });
    if (e.target.closest('.tsave')) {
      t.name = $('.tname', el).value.trim() || (t.exercises[0] ? t.exercises[0].name : '템플릿');
      const i = S.templates.findIndex(x => x.id === t.id); if (i >= 0) S.templates[i] = t; else S.templates.push(t);
      save('templates'); closeAllModals(); render(); toast('템플릿 저장됨');
    }
    if (e.target.closest('.tdel') && confirm('이 템플릿을 삭제할까요?')) { S.templates = S.templates.filter(x => x.id !== t.id); save('templates'); closeAllModals(); render(); }
  });
}
function templatesFromHistory() {
  const seen = new Set(S.templates.map(t => t.name)); let n = 0;
  for (const w of D.byStart) {
    if (seen.has(w.name)) continue; seen.add(w.name);
    S.templates.push({ id: uid(), name: w.name, exercises: w.exercises.map(e => ({ name: e.name, rest: e.rest, sets: e.sets.map(s => ({ w: s.w, r: s.r, type: s.type })) })) }); n++;
  }
  save('templates'); return n;
}

/* ================= active workout ================= */
let restTimer = null; // {end,total}
let audioCtx = null;
function startWorkout(from) {
  if (S.active) { if (!confirm('진행 중인 워크아웃이 있어요. 취소하고 새로 시작할까요?')) { openActive(); return; } }
  const exs = from ? from.exercises.map(e => ({ name: e.name, rest: e.rest, sets: e.sets.map(s => ({ w: '', r: '', pw: s.w || 0, pr: s.r || 0, type: s.type || 'n', done: false })) })) : [];
  const h = new Date().getHours();
  const defName = h < 5 ? '심야 워크아웃' : h < 9 ? '이른 아침 워크아웃' : h < 12 ? '오전 워크아웃' : h < 18 ? '오후 워크아웃' : '저녁 워크아웃';
  S.active = { id: 'w' + uid(), name: from ? from.name : defName, startTs: Date.now(), exercises: exs, note: '', tplId: from && from.id && S.templates.some(t => t.id === from.id) ? from.id : null };
  restTimer = null;
  save('active', true); closeAllModals(); openActive();
}
function openActive() {
  if (!S.active) return;
  closeAllModals();
  if ($('#activeSheet')) return;
  const el = document.createElement('div'); el.className = 'full'; el.id = 'activeSheet';
  $('#sheets').appendChild(el);
  drawActive();
  el.addEventListener('click', activeClick);
  el.addEventListener('input', activeInput);
  updateBanner();
}
function closeActive() { const el = $('#activeSheet'); if (el) el.remove(); updateBanner(); }
function normalIndex(sets, si) { let n = 0; for (let i = 0; i <= si; i++) if (sets[i].type !== 'W') n++; return n; }
function drawActive() {
  const el = $('#activeSheet'); if (!el) return; const A = S.active;
  const scroll = el.querySelector('.fbody') ? el.querySelector('.fbody').scrollTop : 0;
  el.innerHTML = `<div class="fhead"><button class="pill gray" data-a="min">⌄ 최소화</button><div class="bold" id="awClock" style="font-variant-numeric:tabular-nums">${fmtClock((Date.now() - A.startTs) / 1000)}</div><button class="pill" style="background:var(--green);color:#fff" data-a="finish">완료</button></div>
  <div class="fbody">
    <input class="aw-name" value="${esc(A.name)}" style="font-size:24px;font-weight:800;border:0;outline:none;width:100%;padding:6px 0">
    <textarea class="aw-note" placeholder="워크아웃 노트" rows="1" style="width:100%;border:0;outline:none;resize:none;color:var(--sub);font-size:15px">${esc(A.note || '')}</textarea>
    ${A.exercises.length ? '' : '<div class="empty small">아래 “운동 추가”를 눌러 시작하세요</div>'}
    ${A.exercises.map((e, ei) => {
      const lp = lastPerformance(e.name); const u = unitOf(e.name);
      return `<div class="aw-ex"><div class="between"><button class="name" data-a="exinfo" data-ei="${ei}">${esc(e.name)}</button><button class="dots" data-a="exmenu" data-ei="${ei}">•••</button></div>
      <table class="sets"><tr><th style="width:34px">세트</th><th>이전</th><th>${u}</th><th>렙</th><th style="width:38px">✓</th><th style="width:20px"></th></tr>
      ${e.sets.map((s, si) => {
        const p = lp && lp.ex.sets[si];
        const ph = p ? p : (s.pw || s.pr ? { w: s.pw, r: s.pr } : null);
        return `<tr class="${s.done ? 'done' : ''}" data-ei="${ei}" data-si="${si}"><td><button class="stype ${s.type}" data-a="stype">${s.type === 'n' ? normalIndex(e.sets, si) : s.type}</button></td>
        <td class="prev">${p ? esc(p.w ? nfmt(toU(p.w, e.name)) + ' × ' + nfmt(p.r) : nfmt(p.r) + '렙') : '—'}</td>
        <td><input inputmode="decimal" data-f="w" value="${s.w === '' ? '' : nfmt(toU(s.w, e.name))}" placeholder="${ph && ph.w ? nfmt(toU(ph.w, e.name)) : ''}"></td>
        <td><input inputmode="numeric" data-f="r" value="${s.r === '' ? '' : nfmt(s.r)}" placeholder="${ph && ph.r ? nfmt(ph.r) : ''}"></td>
        <td><button class="check" data-a="check">${ICON.check}</button></td><td><button class="del" data-a="delset">−</button></td></tr>`;
      }).join('')}</table>
      <button class="btn gray" style="padding:8px;font-size:15px;margin-top:4px" data-a="addset" data-ei="${ei}">＋ 세트 추가 <span class="muted small">(휴식 ${fmtClock(e.rest || S.settings.rest)})</span></button></div>`;
    }).join('')}
    <div style="height:18px"></div><button class="btn light" data-a="addex">운동 추가</button>
    <div style="height:10px"></div><button class="btn red" data-a="cancel">워크아웃 취소</button>
    <div style="height:20px"></div>
  </div>
  <div class="timer-bar" id="timerBar" hidden></div>`;
  el.querySelector('.fbody').scrollTop = scroll;
  drawTimer();
}
function activeInput(e) {
  const A = S.active;
  if (e.target.classList.contains('aw-name')) { A.name = e.target.value; save('active'); return; }
  if (e.target.classList.contains('aw-note')) { A.note = e.target.value; save('active'); return; }
  const tr = e.target.closest('tr[data-ei]'); if (!tr) return;
  const ex = A.exercises[+tr.dataset.ei], s = ex.sets[+tr.dataset.si];
  const raw = e.target.value.replace(',', '.');
  const val = raw === '' ? '' : parseFloat(raw);
  if (e.target.dataset.f === 'w') s.w = val === '' || isNaN(val) ? '' : fromU(val, ex.name);
  else s.r = val === '' || isNaN(val) ? '' : val;
  save('active');
}
function activeClick(e) {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const A = S.active; const a = b.dataset.a;
  const tr = b.closest('tr[data-ei]');
  const ex = tr ? A.exercises[+tr.dataset.ei] : (b.dataset.ei != null ? A.exercises[+b.dataset.ei] : null);
  const si = tr ? +tr.dataset.si : -1;
  if (a === 'min') { closeActive(); render(); return; }
  if (a === 'check') {
    const s = ex.sets[si];
    if (!s.done) {
      const lp = lastPerformance(ex.name); const p = lp && lp.ex.sets[si];
      if (s.w === '') s.w = s.pw || s.pr ? (s.pw || 0) : (p ? p.w : 0);
      if (s.r === '') s.r = s.pw || s.pr ? (s.pr || 0) : (p ? p.r : 0);
      s.done = true; startRest(ex.rest || S.settings.rest);
    } else s.done = false;
    save('active'); drawActive(); return;
  }
  if (a === 'stype') { const order = ['n', 'W', 'D', 'F']; const s = ex.sets[si]; s.type = order[(order.indexOf(s.type) + 1) % 4]; save('active'); drawActive(); return; }
  if (a === 'delset') { ex.sets.splice(si, 1); save('active'); drawActive(); return; }
  if (a === 'addset') { const last = ex.sets[ex.sets.length - 1]; ex.sets.push({ w: '', r: '', type: 'n', done: false, pw: last ? (last.w === '' ? last.pw : last.w) : 0, pr: last ? (last.r === '' ? last.pr : last.r) : 0 }); save('active'); drawActive(); return; }
  if (a === 'addex') { pickExercise(names => { for (const n of names) { const lp = lastPerformance(n); const sets = lp ? lp.ex.sets.map(s => ({ w: '', r: '', type: s.type, done: false })) : [{ w: '', r: '', type: 'n', done: false }]; A.exercises.push({ name: n, sets, rest: lp && lp.ex.rest }); } save('active'); drawActive(); }); return; }
  if (a === 'exinfo') { exDetail(ex.name, true); return; }
  if (a === 'exmenu') {
    const ei = +b.dataset.ei;
    const m = openModal(`<div class="modal-h"><span></span><h2>${esc(ex.name)}</h2><button class="xbtn" data-close>✕</button></div>
     <div class="field"><label>휴식 타이머 (초)</label><input type="number" inputmode="numeric" class="rest-in" value="${ex.rest || S.settings.rest}"></div>
     <button class="menu-item" data-m="up">위로 이동</button><button class="menu-item" data-m="down">아래로 이동</button>
     <button class="menu-item" data-m="replace">운동 교체</button><button class="menu-item danger" data-m="remove">운동 삭제</button>`, { bottom: true, nested: true });
    m.querySelector('.rest-in').addEventListener('change', ev => { ex.rest = Math.max(0, parseInt(ev.target.value) || 0); save('active'); drawActive(); });
    m.addEventListener('click', ev => {
      const k = ev.target.closest('[data-m]'); if (!k) return; const op = k.dataset.m;
      if (op === 'up' && ei > 0) [A.exercises[ei - 1], A.exercises[ei]] = [A.exercises[ei], A.exercises[ei - 1]];
      if (op === 'down' && ei < A.exercises.length - 1) [A.exercises[ei + 1], A.exercises[ei]] = [A.exercises[ei], A.exercises[ei + 1]];
      if (op === 'remove') A.exercises.splice(ei, 1);
      if (op === 'replace') { closeTopModal(); pickExercise(n => { if (n[0]) { ex.name = n[0]; save('active'); drawActive(); } }, true); return; }
      save('active'); closeTopModal(); drawActive();
    });
    return;
  }
  if (a === 'cancel') { if (confirm('워크아웃을 취소할까요? 기록이 저장되지 않아요.')) { S.active = null; restTimer = null; save('active', true); closeActive(); render(); } return; }
  if (a === 'finish') { finishWorkout(); return; }
  if (a === 'rt-minus') { if (restTimer) { restTimer.end -= 15000; restTimer.total = Math.max(1, restTimer.total - 15); } drawTimer(); return; }
  if (a === 'rt-plus') { if (restTimer) { restTimer.end += 15000; restTimer.total += 15; } drawTimer(); return; }
  if (a === 'rt-skip') { restTimer = null; drawTimer(); updateBanner(); return; }
}
function startRest(sec) {
  if (!sec) return;
  try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
  restTimer = { end: Date.now() + sec * 1000, total: sec };
}
function beep() {
  try {
    if (!audioCtx) return; const t = audioCtx.currentTime;
    [0, .25, .5].forEach(d => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.25, t + d); g.gain.exponentialRampToValueAtTime(.001, t + d + .2); o.connect(g); g.connect(audioCtx.destination); o.start(t + d); o.stop(t + d + .22); });
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
function drawTimer() {
  const tb = $('#timerBar'); if (!tb) return;
  if (!restTimer) { tb.hidden = true; return; }
  tb.hidden = false;
  const left = (restTimer.end - Date.now()) / 1000;
  tb.innerHTML = `<button class="pill gray" data-a="rt-minus">−15</button><div class="prog"><i style="width:${Math.max(0, Math.min(100, left / restTimer.total * 100))}%"></i><b>휴식 ${fmtClock(Math.ceil(left))}</b></div><button class="pill gray" data-a="rt-plus">+15</button><button class="pill" data-a="rt-skip">건너뛰기</button>`;
}
function tick() {
  if (!S.active) return;
  const c = $('#awClock'); if (c) c.textContent = fmtClock((Date.now() - S.active.startTs) / 1000);
  if (restTimer) {
    if (Date.now() >= restTimer.end) { restTimer = null; beep(); toast('휴식 끝! 다음 세트 💪'); }
    drawTimer();
  }
  updateBanner();
}
function updateBanner() {
  const b = $('#activeBanner');
  const show = S.active && !$('#activeSheet');
  if (!show) { if (!b.hidden) { b.hidden = true; $('#view').style.bottom = ''; } return; }
  b.innerHTML = `<span>🏋️ ${esc(S.active.name)}</span><span class="t">${restTimer ? '휴식 ' + fmtClock(Math.ceil((restTimer.end - Date.now()) / 1000)) : fmtClock((Date.now() - S.active.startTs) / 1000)}</span>`;
  if (b.hidden) { b.hidden = false; $('#view').style.bottom = `calc(var(--tabh) + 46px)`; }
}
function finishWorkout() {
  const A = S.active;
  const anyDone = A.exercises.some(e => e.sets.some(s => s.done));
  if (!anyDone) { if (!confirm('완료 체크된 세트가 없어요. 입력한 세트를 모두 저장할까요?')) return; }
  else if (!confirm('워크아웃을 완료할까요? (체크 안 된 세트는 제외)')) return;
  const w = { id: A.id, name: (A.name || '워크아웃').trim(), start: isoLocal(new Date(A.startTs)), duration: Math.round((Date.now() - A.startTs) / 1000), note: A.note || '', exercises: [] };
  for (const e of A.exercises) {
    const sets = e.sets.filter(s => anyDone ? s.done : (s.w !== '' || s.r !== '')).map(s => ({ w: +s.w || 0, r: +s.r || 0, type: s.type || 'n' }));
    if (sets.length) w.exercises.push({ name: e.name, sets, rest: e.rest });
  }
  if (!w.exercises.length) { toast('저장할 세트가 없어요'); return; }
  S.workouts.push(w);
  if (A.tplId) { const t = S.templates.find(x => x.id === A.tplId); if (t) { t.lastUsed = w.start; save('templates'); } }
  S.active = null; restTimer = null;
  save('workouts', true); save('active', true);
  derive(); closeActive();
  const saved = S.workouts.find(x => x.id === w.id);
  const prEx = saved.exercises.filter(e => e._pr);
  go('history');
  openModal(`<div style="text-align:center;padding:10px 0"><div style="font-size:46px">🎉</div><h2 style="margin:6px 0">수고했어요!</h2>
   <div class="muted">${S.workouts.length.toLocaleString('ko-KR')}번째 워크아웃 완료</div>
   <div class="stat-row" style="justify-content:center"><span>${ICON.clock}${fmtDur(saved.duration)}</span><span>${ICON.weight}${fmtVol(saved._vol)}</span><span>${ICON.trophy}${saved._prs} PR</span></div>
   ${prEx.length ? `<div class="card" style="text-align:left">${prEx.map(e => `<div>🏆 <b>${esc(e.name)}</b> <span class="muted small">${esc(setLabel(e._best, e.name))}</span></div>`).join('')}</div>` : ''}
   <button class="btn" data-close>확인</button></div>`);
}

/* ================= exercises ================= */
let exQuery = '', exBody = '', exCat = '';
function allExercises() { return Object.values(D.exMap).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })); }
function filteredEx() {
  const q = exQuery.trim().toLowerCase();
  return allExercises().filter(e => (!q || e.name.toLowerCase().includes(q)) && (!exBody || e.body === exBody) && (!exCat || e.cat === exCat));
}
function letterOf(n) { return /[A-Z]/i.test(n[0]) ? n[0].toUpperCase() : '#'; }
function exListHtml(list, pickMode) {
  let html = '', last = '';
  for (const e of list) {
    const L = letterOf(e.name);
    if (L !== last && !pickMode) { html += `<div class="letter-h" id="L-${L}">${L}</div>`; last = L; }
    const h = D.exHist[e.name]; const cnt = h ? h.length : 0;
    html += `<button class="ex-item" ${pickMode ? 'data-pick="1"' : 'data-act="ex-detail"'} data-name="${esc(e.name)}"><div class="ex-thumb">${esc(e.name[0])}</div><div style="min-width:0"><div class="n">${esc(e.name)}</div><div class="b">${esc(e.body)}</div></div><div class="c">${cnt ? cnt + '회' : ''}</div></button>`;
  }
  return html || '<div class="empty small">결과 없음</div>';
}
function filterHtml() {
  return `<div class="filters"><select class="f-body"><option value="">임의의 신체 부위</option>${EXDB.BODY_PARTS.map(b => `<option ${b === exBody ? 'selected' : ''}>${b}</option>`).join('')}</select>
  <select class="f-cat"><option value="">임의의 카테고리</option>${EXDB.CATEGORIES.map(b => `<option ${b === exCat ? 'selected' : ''}>${b}</option>`).join('')}</select></div>`;
}
function renderExercises(v) {
  const list = filteredEx();
  const letters = [...new Set(list.map(e => letterOf(e.name)))];
  v.innerHTML = `<div class="topbar"><div class="l"><button data-act="ex-new">신규</button></div><div class="r"><span class="muted small">${list.length}개</span></div></div>
  <h1 class="big">운동</h1>
  <div class="search">${ICON.search}<input class="ex-q" placeholder="검색" value="${esc(exQuery)}" autocomplete="off"></div>
  ${filterHtml()}
  <div class="ex-list">${exListHtml(list)}</div>
  <div class="az">${letters.map(l => `<a data-az="${l}">${l}</a>`).join('')}</div>`;
  const qi = $('.ex-q', v);
  qi.addEventListener('input', () => { exQuery = qi.value; $('.ex-list', v).innerHTML = exListHtml(filteredEx()); });
  $('.f-body', v).addEventListener('change', e => { exBody = e.target.value; renderExercises(v); });
  $('.f-cat', v).addEventListener('change', e => { exCat = e.target.value; renderExercises(v); });
}
function exDetail(name, nested) {
  const info = exInfo(name); const h = (D.exHist[name] || []).slice().reverse(); const b = D.best[name];
  let tab = 'hist';
  const el = openModal(`<div class="modal-h"><button class="xbtn" data-close>✕</button><h2 style="font-size:16px">${esc(name)}</h2><button class="dots exd-menu">•••</button></div>
  <div class="muted small" style="text-align:center">${esc(info.body)} · ${esc(info.cat)} · ${h.length}회 수행</div>
  <div class="tabs2"><button data-t="hist" class="on">이력</button><button data-t="chart">차트</button><button data-t="rec">기록</button></div><div class="exd-body"></div>`, { bottom: true, nested });
  const body = $('.exd-body', el);
  const draw = () => {
    $$('.tabs2 button', el).forEach(x => x.classList.toggle('on', x.dataset.t === tab));
    if (tab === 'hist') {
      body.innerHTML = h.length ? h.slice(0, 150).map(x => `<div class="card" style="padding:12px"><div class="between"><b style="font-size:15px">${esc(x.w.name)}</b><span class="muted small">${fmtShort(x.date)}</span></div>
      ${x.ex.sets.map((s, i) => `<div class="hist-set"><span class="i">${s.type !== 'n' ? s.type : i + 1}</span><span>${esc(setLabel(s, name))}</span><span class="muted small" style="margin-left:auto">${e1rm(s.w, s.r) ? '1RM ' + nfmt(Math.round(toU(e1rm(s.w, s.r), name))) : ''}</span></div>`).join('')}</div>`).join('') + (h.length > 150 ? '<div class="muted small">최근 150회만 표시</div>' : '') : '<div class="empty small">아직 기록이 없어요</div>';
    } else if (tab === 'chart') {
      const key = 'exd:' + name; const from = rangeFrom(key);
      const asc = (D.exHist[name] || []).filter(x => +x.date >= from);
      const rmPts = asc.filter(x => x.rm).map(x => ({ x: x.date, y: toU(x.rm, name) }));
      const wPts = asc.filter(x => x.maxW).map(x => ({ x: x.date, y: toU(x.maxW, name) }));
      const vPts = asc.filter(x => x.vol).map(x => ({ x: x.date, y: toU(x.ex.sets.reduce((a, s) => a + (s.w || 0) * (s.r || 0), 0), name) }));
      const rPts = asc.map(x => ({ x: x.date, y: x.reps }));
      body.innerHTML = rangeBtns(key) + (rmPts.length ? `<div class="bold" style="margin-top:12px">추정 1RM</div>${lineChart(rmPts, { unit: unitOf(name) })}<div class="bold" style="margin-top:12px">최고 무게</div>${lineChart(wPts, { unit: unitOf(name) })}<div class="bold" style="margin-top:12px">총 볼륨</div>${lineChart(vPts, { unit: unitOf(name) })}` : `<div class="bold" style="margin-top:12px">최고 렙</div>${lineChart(rPts, { unit: '렙' })}`);
    } else {
      if (!b || !h.length) { body.innerHTML = '<div class="empty small">기록 없음</div>'; return; }
      const find = f => { let best = null; for (const x of h) if (!best || f(x) > f(best)) best = x; return best; };
      const bRm = find(x => x.rm), bW = find(x => x.maxW), bV = find(x => x.vol), bR = find(x => x.reps);
      const repMax = {};
      for (const x of h) for (const s of x.ex.sets) { if (!(s.r > 0) || !(s.w > 0) || s.r > 12) continue; if (!repMax[s.r] || s.w > repMax[s.r].w) repMax[s.r] = { w: s.w, d: x.date }; }
      body.innerHTML = `<div class="rec-grid">
        <div class="rec"><div class="k">추정 1RM</div><div class="v">${bRm.rm ? fmtRm(bRm.rm, name) : '-'}</div><div class="muted tiny">${bRm.rm ? fmtShort(bRm.date) : ''}</div></div>
        <div class="rec"><div class="k">최고 무게</div><div class="v">${bW.maxW ? fmtW(bW.maxW, name) : '-'}</div><div class="muted tiny">${bW.maxW ? fmtShort(bW.date) : ''}</div></div>
        <div class="rec"><div class="k">최고 세트 볼륨</div><div class="v">${bV.vol ? fmtW(bV.vol, name) : '-'}</div><div class="muted tiny">${bV.vol ? fmtShort(bV.date) : ''}</div></div>
        <div class="rec"><div class="k">최다 렙</div><div class="v">${bR.reps ? nfmt(bR.reps) + '렙' : '-'}</div><div class="muted tiny">${fmtShort(bR.date)}</div></div></div>
        ${Object.keys(repMax).length ? `<div class="bold" style="margin:14px 0 4px">렙별 최고 기록</div>${Object.keys(repMax).sort((a, b) => a - b).map(r => `<div class="list-row"><span>${r} 렙</span><span><b>${fmtW(repMax[r].w, name)}</b> <span class="muted small">${fmtShort(repMax[r].d)}</span></span></div>`).join('')}` : ''}`;
    }
  };
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; draw(); }
    const r = e.target.closest('[data-range]'); if (r) { chartRange[r.dataset.range] = r.dataset.v; draw(); }
    if (e.target.closest('.exd-menu')) exMenu(name);
  });
  draw();
}
function exMenu(name) {
  const inDash = S.settings.dash.includes(name); const info = exInfo(name);
  const m = openModal(`<div class="modal-h"><span></span><h2 style="font-size:16px">${esc(name)}</h2><button class="xbtn" data-close>✕</button></div>
   <button class="menu-item" data-m="dash">${inDash ? '대시보드 차트에서 제거' : '대시보드 차트에 추가'}</button>
   <div class="list-row"><span>이 운동의 무게 단위</span><div class="seg"><button data-m="u-def" class="${!S.settings.exUnit[name] ? 'on' : ''}">기본</button><button data-m="u-kg" class="${S.settings.exUnit[name] === 'kg' ? 'on' : ''}">kg</button><button data-m="u-lb" class="${S.settings.exUnit[name] === 'lb' ? 'on' : ''}">lb</button></div></div>
   <div class="muted tiny" style="margin:4px 0 8px">Strong에서 lb로 기록한 운동은 CSV에 lb 숫자 그대로 들어있어요. 단위를 바꾸면 기존 숫자를 새 단위로 다시 해석할지 물어봐요.</div>
   ${info.custom ? '<button class="menu-item danger" data-m="del">사용자 운동 삭제</button>' : ''}`, { bottom: true, nested: true });
  m.addEventListener('click', e => {
    const k = e.target.closest('[data-m]'); if (!k) return; const op = k.dataset.m;
    if (op === 'dash') { if (inDash) S.settings.dash = S.settings.dash.filter(x => x !== name); else S.settings.dash.push(name); save('settings'); toast(inDash ? '제거됨' : '대시보드에 추가됨'); }
    if (op.startsWith('u-')) {
      const prev = unitOf(name); const nu = op === 'u-def' ? null : op.slice(2);
      if (nu) S.settings.exUnit[name] = nu; else delete S.settings.exUnit[name];
      const now = unitOf(name);
      if (prev !== now && D.exHist[name] && confirm(`기존 기록의 숫자를 ${now}로 다시 해석할까요?\n(예: 65 ${prev} → 65 ${now})\nStrong에서 ${now}로 기록했던 운동이면 '확인', 숫자를 환산해서 보려면 '취소'.`)) {
        const f = now === 'lb' ? LB : 1 / LB;
        for (const w of S.workouts) for (const ex of w.exercises) if (ex.name === name) for (const s of ex.sets) s.w = Math.round(s.w * f * 1000) / 1000;
        save('workouts', true);
      }
      save('settings'); derive();
    }
    if (op === 'del' && confirm('삭제할까요?')) { S.customEx = S.customEx.filter(x => x.name !== name); save('customEx'); derive(); }
    closeAllModals(); render();
  });
}
function newExercise(cb) {
  const m = openModal(`<div class="modal-h"><button class="xbtn" data-close>✕</button><h2>새 운동</h2><button class="nsave" style="color:var(--blue);font-weight:700">저장</button></div>
   <div class="field"><label>이름 (예: Hip Thrust (Barbell))</label><input class="nn"></div>
   <div class="field"><label>신체 부위</label><select class="nb">${EXDB.BODY_PARTS.map(b => `<option>${b}</option>`).join('')}</select></div>
   <div class="field"><label>카테고리</label><select class="nc">${EXDB.CATEGORIES.map(b => `<option>${b}</option>`).join('')}</select></div>`, { bottom: true, nested: true });
  $('.nsave', m).addEventListener('click', () => {
    const name = $('.nn', m).value.trim(); if (!name) return toast('이름을 입력하세요');
    if (D.exMap[name]) return toast('이미 있는 운동이에요');
    S.customEx.push({ name, body: $('.nb', m).value, cat: $('.nc', m).value }); save('customEx'); derive(); closeTopModal(); if (cb) cb(name); else render();
  });
}
function pickExercise(cb, single) {
  const sel = new Set();
  const m = openModal(`<div class="modal-h"><button class="xbtn" data-close>✕</button><h2>운동 추가</h2><button class="padd" style="color:var(--blue);font-weight:700">추가</button></div>
  <div class="search">${ICON.search}<input class="pq" placeholder="검색" autocomplete="off"></div>${filterHtml()}
  <button class="btn light pnew" style="padding:8px;margin-bottom:6px">＋ 새 운동 만들기</button>
  <div class="plist"></div>`, { bottom: true, nested: true });
  const draw = () => {
    const q = $('.pq', m).value.trim().toLowerCase(), b = $('.f-body', m).value, c = $('.f-cat', m).value;
    let list = allExercises().filter(e => (!q || e.name.toLowerCase().includes(q)) && (!b || e.body === b) && (!c || e.cat === c));
    if (!q) list.sort((x, y) => ((D.exHist[y.name] || []).length - (D.exHist[x.name] || []).length) || x.name.localeCompare(y.name));
    $('.plist', m).innerHTML = exListHtml(list.slice(0, 300), true);
    $$('.plist .ex-item', m).forEach(x => { if (sel.has(x.dataset.name)) x.style.background = 'var(--blue-l)'; });
  };
  m.addEventListener('input', draw); m.addEventListener('change', draw);
  m.addEventListener('click', e => {
    const it = e.target.closest('[data-pick]');
    if (it) { const n = it.dataset.name; if (single) { closeTopModal(); cb([n]); return; } sel.has(n) ? sel.delete(n) : sel.add(n); it.style.background = sel.has(n) ? 'var(--blue-l)' : ''; $('.padd', m).textContent = sel.size ? `추가 (${sel.size})` : '추가'; }
    if (e.target.closest('.padd')) { closeTopModal(); if (sel.size) cb([...sel]); }
    if (e.target.closest('.pnew')) newExercise(n => { sel.add(n); draw(); $('.padd', m).textContent = `추가 (${sel.size})`; });
  });
  draw();
}

/* ================= settings ================= */
function renderSettings(v) {
  const nW = S.workouts.length; const sets = S.workouts.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.length, 0), 0);
  const first = D.byStart[D.byStart.length - 1], last = D.byStart[0];
  v.innerHTML = `<div class="topbar"><div class="l"></div><div class="r"></div></div><h1 class="big">설정</h1>
  <div class="card">
    <div class="list-row"><span>이름</span><input class="s-name" value="${esc(S.settings.name)}" style="border:0;text-align:right;outline:none;font-size:16px;width:50%"></div>
    <div class="list-row"><span>무게 단위</span><div class="seg"><button data-act="unit" data-v="kg" class="${S.settings.unit === 'kg' ? 'on' : ''}">kg</button><button data-act="unit" data-v="lb" class="${S.settings.unit === 'lb' ? 'on' : ''}">lb</button></div></div>
    <div class="list-row"><span>주간 목표 (회)</span><input class="s-goal" type="number" inputmode="numeric" value="${S.settings.goal}" style="width:70px;text-align:right;border:0;outline:none;font-size:16px"></div>
    <div class="list-row"><span>기본 휴식 타이머 (초)</span><input class="s-rest" type="number" inputmode="numeric" value="${S.settings.rest}" style="width:70px;text-align:right;border:0;outline:none;font-size:16px"></div>
  </div>
  <div class="section-h">데이터</div>
  <div class="card">
    <div class="muted small" style="margin-bottom:10px" id="dataSummary">워크아웃 ${nW.toLocaleString('ko-KR')}개 · 세트 ${sets.toLocaleString('ko-KR')}개${first ? ` · ${fmtShort(first._date)} ~ ${fmtShort(last._date)}` : ''}<br>데이터는 이 기기(브라우저)에만 저장돼요. 정기적으로 백업하세요.</div>
    <label class="btn" style="margin-bottom:8px">Strong CSV 가져오기<input type="file" accept=".csv,text/csv,text/plain" class="f-csv" hidden></label>
    <button class="btn light" data-act="exp-csv" style="margin-bottom:8px">CSV 내보내기 (Strong 형식)</button>
    <button class="btn light" data-act="exp-json" style="margin-bottom:8px">전체 백업 (JSON)</button>
    <label class="btn light" style="margin-bottom:8px">백업 복원 (JSON)<input type="file" accept=".json,application/json" class="f-json" hidden></label>
    <button class="btn light" data-act="tpl-auto" style="margin-bottom:8px">기록에서 템플릿 자동 생성</button>
    <button class="btn red" data-act="clear">모든 데이터 삭제</button>
  </div>
  <div class="section-h">심플다이어트 체중</div>
  <div class="card" id="sdCard">${sdCardHtml()}</div>
  <div class="muted tiny" style="text-align:center;margin:10px 0 30px">운동기록 v3 · 오프라인 사용 가능</div>`;
  $('.s-name', v).addEventListener('change', e => { S.settings.name = e.target.value.trim() || '나'; save('settings'); });
  $('.s-goal', v).addEventListener('change', e => { S.settings.goal = Math.max(1, parseInt(e.target.value) || 6); save('settings'); });
  $('.s-rest', v).addEventListener('change', e => { S.settings.rest = Math.max(0, parseInt(e.target.value) || 0); save('settings'); });
  $('.f-csv', v).addEventListener('change', e => { importCsvFile(e.target.files[0]); e.target.value = ''; });
  $('.f-json', v).addEventListener('change', e => { importJsonFile(e.target.files[0]); e.target.value = ''; });
  bindSdCard(v);
}
async function importCsvText(text) {
  const res = StrongCSV.importStrong(text, { exUnit: S.settings.exUnit });
  const have = new Set(S.workouts.map(w => w.start + '|' + w.name));
  let added = 0, dup = 0;
  for (const w of res.workouts) { if (have.has(w.start + '|' + w.name)) { dup++; continue; } S.workouts.push(w); added++; }
  await save('workouts', true); derive();
  return { ...res, added, dup };
}
async function importCsvFile(file) {
  if (!file) return;
  toast('가져오는 중…', 10000);
  try {
    const res = await importCsvText(await file.text());
    const ws = res.workouts;
    $('#toast').hidden = true;
    openModal(`<div style="text-align:center"><div style="font-size:40px">✅</div><h2 style="margin:6px 0">가져오기 완료</h2>
    <div class="card" style="text-align:left;line-height:1.8">파일의 워크아웃: <b>${ws.length.toLocaleString('ko-KR')}</b>개<br>새로 추가: <b>${res.added.toLocaleString('ko-KR')}</b>개 ${res.dup ? `(중복 ${res.dup}개 건너뜀)` : ''}<br>세트 ${res.setRows.toLocaleString('ko-KR')}개 · 행 ${res.rows.toLocaleString('ko-KR')}개<br>기간: ${ws.length ? fmtShort(pd(ws[0].start)) + ' ~ ' + fmtShort(pd(ws[ws.length - 1].start)) : '-'}<br>운동 종류: ${new Set(ws.flatMap(w => w.exercises.map(e => e.name))).size}개</div>
    ${S.templates.length ? '' : '<button class="btn light" data-act="tpl-auto" style="margin-bottom:8px">워크아웃 이름별로 템플릿 만들기</button>'}
    <button class="btn" data-close>확인</button></div>`);
    render();
  } catch (e) { toast('가져오기 실패: ' + e.message, 4000); }
}
async function importJsonFile(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.workouts)) throw new Error('백업 파일이 아니에요');
    if (!confirm(`백업을 복원하면 현재 데이터가 바뀌어요. 워크아웃 ${data.workouts.length}개를 복원할까요?`)) return;
    for (const k of KEYS) if (k in data && k !== 'active') { S[k] = data[k]; await save(k, true); }
    S.settings = { ...DEFAULT_SETTINGS, ...S.settings };
    derive(); render(); toast('복원 완료');
  } catch (e) { toast('복원 실패: ' + e.message, 4000); }
}
function stamp() { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }
function clean(w) { return JSON.parse(JSON.stringify(w, (k, v) => k.startsWith('_') ? undefined : v)); }
function editWorkout(id) {
  const w = S.workouts.find(x => x.id === id); if (!w) return;
  const c = clean(w);
  const m = openModal(`<div class="modal-h"><button class="xbtn" data-close>✕</button><h2>워크아웃 편집</h2><button class="wes" style="color:var(--blue);font-weight:700">저장</button></div>
   <div class="field"><label>이름</label><input class="wen" value="${esc(c.name)}"></div>
   <div class="field"><label>시작 시간</label><input class="wed" type="datetime-local" step="1" value="${c.start}"></div>
   <div class="field"><label>시간 (분)</label><input class="wem" type="number" inputmode="numeric" value="${Math.round(c.duration / 60)}"></div>
   <div class="field"><label>노트</label><textarea class="weno" rows="2">${esc(c.note || '')}</textarea></div>
   <div class="we-list"></div>`, { bottom: true });
  const draw = () => {
    $('.we-list', m).innerHTML = c.exercises.map((e, ei) => `<div style="margin-top:12px"><div class="between"><b>${esc(e.name)}</b><button class="del" data-wx="${ei}">✕</button></div>
     ${e.sets.map((s, si) => `<div class="row" style="margin:4px 0"><span class="muted small" style="width:20px">${s.type !== 'n' ? s.type : si + 1}</span><input data-ei="${ei}" data-si="${si}" data-f="w" inputmode="decimal" value="${nfmt(toU(s.w, e.name))}" style="width:80px;border:1px solid var(--line);border-radius:8px;padding:6px;text-align:center"> ${unitOf(e.name)} × <input data-ei="${ei}" data-si="${si}" data-f="r" inputmode="numeric" value="${nfmt(s.r)}" style="width:60px;border:1px solid var(--line);border-radius:8px;padding:6px;text-align:center"><button class="del" data-ws="${ei}:${si}">−</button></div>`).join('')}</div>`).join('');
  };
  draw();
  m.addEventListener('input', e => { const i = e.target; if (i.dataset.f) { const ex = c.exercises[+i.dataset.ei], s = ex.sets[+i.dataset.si]; const v = parseFloat(i.value.replace(',', '.')) || 0; if (i.dataset.f === 'w') s.w = fromU(v, ex.name); else s.r = v; } });
  m.addEventListener('click', e => {
    const x = e.target.closest('[data-wx]'); if (x) { c.exercises.splice(+x.dataset.wx, 1); draw(); }
    const y = e.target.closest('[data-ws]'); if (y) { const [ei, si] = y.dataset.ws.split(':').map(Number); c.exercises[ei].sets.splice(si, 1); if (!c.exercises[ei].sets.length) c.exercises.splice(ei, 1); draw(); }
    if (e.target.closest('.wes')) {
      c.name = $('.wen', m).value.trim() || c.name; const dv = $('.wed', m).value; if (dv) c.start = dv.length === 16 ? dv + ':00' : dv;
      c.duration = (parseInt($('.wem', m).value) || 0) * 60; c.note = $('.weno', m).value;
      const i = S.workouts.findIndex(z => z.id === id); S.workouts[i] = c; save('workouts', true); derive(); closeAllModals(); render(); toast('저장됨');
    }
  });
}

/* ================= modals ================= */
function openModal(html, opts = {}) {
  if (!opts.nested) closeAllModals();
  const back = document.createElement('div'); back.className = 'sheet-back' + (opts.bottom ? ' bottom' : '');
  back.innerHTML = `<div class="modal">${html}</div>`;
  back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) back.remove(); });
  $('#sheets').appendChild(back);
  return back.firstChild;
}
function closeTopModal() { const all = $$('#sheets .sheet-back'); if (all.length) all[all.length - 1].remove(); }
function closeAllModals() { $$('#sheets .sheet-back').forEach(x => x.remove()); }

/* ================= global actions ================= */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-range],[data-tab],[data-az]');
  if (!t) return;
  if (t.dataset.tab) { closeAllModals(); if ($('#activeSheet')) closeActive(); go(t.dataset.tab); return; }
  if (t.dataset.az) { const el = document.getElementById('L-' + t.dataset.az); if (el) $('#view').scrollTop = el.offsetTop - 70; return; }
  if (t.dataset.range && !t.closest('.modal')) { chartRange[t.dataset.range] = t.dataset.v; const st = $('#view').scrollTop; render(); $('#view').scrollTop = st; return; }
  const a = t.dataset.act; if (!a) return;
  const id = t.dataset.id;
  switch (a) {
    case 'settings': go('settings'); break;
    case 'goal': { const g = prompt('주간 목표 워크아웃 횟수', S.settings.goal); if (g && +g > 0) { S.settings.goal = Math.round(+g); save('settings'); render(); } break; }
    case 'bw-add': {
      const sorted = S.bw.slice().sort((a, b) => a.date < b.date ? -1 : 1); const lastBw = sorted[sorted.length - 1];
      const m = openModal(`<div class="modal-h"><button class="xbtn" data-close>✕</button><h2>체중 기록</h2><button class="bws" style="color:var(--blue);font-weight:700">저장</button></div>
        <div class="field"><label>체중 (${S.settings.unit})</label><input class="bwv" inputmode="decimal" type="number" step="0.1" value="${lastBw ? nfmt(toU(lastBw.kg)) : ''}"></div>
        <div class="field"><label>날짜</label><input class="bwd" type="date" value="${dayKey(new Date())}"></div>`, { bottom: true });
      $('.bws', m).addEventListener('click', () => { const v = parseFloat($('.bwv', m).value); if (!(v > 0)) return toast('숫자를 입력하세요'); const dv = $('.bwd', m).value || dayKey(new Date()); const now = new Date(); const date = dv + 'T' + (dv === dayKey(now) ? `${pad(now.getHours())}:${pad(now.getMinutes())}:00` : '07:00:00'); S.bw = S.bw.filter(x => x.date !== date); S.bw.push({ date, kg: fromU(v), src: 'manual' }); S.bw.sort((a, b) => a.date < b.date ? -1 : 1); save('bw'); closeAllModals(); render(); });
      break;
    }
    case 'bw-list': {
      const m = openModal(`<div class="modal-h"><button class="xbtn" data-close>✕</button><h2>체중 기록</h2><span></span></div>${S.bw.length ? `<div class="muted small">${S.bw.length.toLocaleString('ko-KR')}개 기록${S.bw.length > 400 ? ' · 최근 400개 표시' : ''}</div>` + S.bw.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 400).map(x => `<div class="list-row"><span>${fmtShort(pd(x.date))} <span class="muted small">${x.date.slice(11, 16)}</span>${x.src === 'sd' ? '<span class="chip">심플다이어트</span>' : ''}</span><span><b>${fmtW(x.kg)}</b> <button class="del" data-bwdel="${x.date}">✕</button></span></div>`).join('') : '<div class="empty small">기록 없음</div>'}`, { bottom: true });
      m.addEventListener('click', ev => { const d = ev.target.closest('[data-bwdel]'); if (d && confirm('삭제할까요?')) { S.bw = S.bw.filter(x => x.date !== d.dataset.bwdel); save('bw'); closeAllModals(); render(); } });
      break;
    }
    case 'dash-edit': pickExercise(names => { for (const n of names) if (!S.settings.dash.includes(n)) S.settings.dash.push(n); save('settings'); render(); }); break;
    case 'ex-detail': exDetail(t.dataset.name, !!t.closest('.modal')); break;
    case 'ex-new': newExercise(); break;
    case 'hmode': histMode = t.dataset.v; render(); break;
    case 'cal-nav': calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + (+t.dataset.v), 1); render(); break;
    case 'cal-day': { calSel = calSel === t.dataset.k ? null : t.dataset.k; const st = $('#view').scrollTop; render(); $('#view').scrollTop = st; break; }
    case 'w-detail': workoutDetail(id); break;
    case 'w-menu': workoutMenu(id); break;
    case 'w-repeat': { const w = S.workouts.find(x => x.id === id); startWorkout(w); break; }
    case 'w-totpl': { const w = S.workouts.find(x => x.id === id); tplEditor(null, { id: uid(), name: w.name, exercises: w.exercises.map(e => ({ name: e.name, rest: e.rest, sets: e.sets.map(s => ({ w: s.w, r: s.r, type: s.type })) })) }); break; }
    case 'w-del': if (confirm('이 워크아웃을 삭제할까요?')) { S.workouts = S.workouts.filter(x => x.id !== id); save('workouts', true); derive(); closeAllModals(); render(); toast('삭제됨'); } break;
    case 'w-edit': editWorkout(id); break;
    case 'start-empty': startWorkout(null); break;
    case 'tpl-new': tplEditor(null); break;
    case 'tpl-open': tplOpen(id); break;
    case 'tpl-edit': tplEditor(id); break;
    case 'tpl-start': startWorkout(S.templates.find(x => x.id === id)); break;
    case 'tpl-menu': openModal(`<div class="modal-h"><span></span><h2>템플릿</h2><button class="xbtn" data-close>✕</button></div><button class="menu-item" data-act="tpl-auto">기록에서 자동 생성 (워크아웃 이름별 최근 기록)</button><button class="menu-item danger" data-act="tpl-clear">모든 템플릿 삭제</button>`, { bottom: true }); break;
    case 'tpl-auto': { const n = templatesFromHistory(); closeAllModals(); toast(n ? `템플릿 ${n}개 생성` : '새로 만들 템플릿이 없어요'); render(); break; }
    case 'tpl-clear': if (confirm('모든 템플릿을 삭제할까요?')) { S.templates = []; save('templates'); closeAllModals(); render(); } break;
    case 'unit': S.settings.unit = t.dataset.v; save('settings'); render(); break;
    case 'exp-csv': download(`strong_export_${stamp()}.csv`, '\uFEFF' + StrongCSV.exportStrong(S.workouts, { exUnit: S.settings.exUnit }), 'text/csv'); break;
    case 'exp-json': download(`workout_backup_${stamp()}.json`, JSON.stringify({ app: 'workout-app', version: 1, exported: new Date().toISOString(), workouts: S.workouts.map(clean), templates: S.templates, customEx: S.customEx, bw: S.bw, settings: S.settings }), 'application/json'); break;
    case 'clear': if (confirm('정말 모든 데이터를 삭제할까요? 되돌릴 수 없어요.') && confirm('한 번 더 확인: 모든 워크아웃·템플릿·체중 기록이 삭제됩니다.')) { S.workouts = []; S.templates = []; S.customEx = []; S.bw = []; S.active = null; S.sdsync = { token: '', last: 0, count: 0, err: '' }; S.settings = { ...DEFAULT_SETTINGS, exUnit: {} }; for (const k of KEYS) save(k, true); derive(); render(); toast('삭제됨'); } break;
  }
});

/* ================= boot ================= */
(async function boot() {
  try { await loadAll(); } catch (e) { toast('저장소를 열 수 없어요: ' + e.message, 5000); }
  derive();
  go('profile');
  $('#activeBanner').addEventListener('click', openActive);
  setInterval(tick, 500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); if (S.sdsync.token && Date.now() - (S.sdsync.tried || 0) > 60000) sdSync(false); } });
  window.addEventListener('online', () => { if (S.sdsync.token) sdSync(false); });
  if (S.sdsync.token) sdSync(false);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__app = { sdSync, S, D: () => D, importCsvText, derive, render, go, startWorkout, openActive };
})();

/* ================= 심플다이어트 ================= */
let sdBusy = false;
function sdCardHtml() {
  const z = S.sdsync; const n = S.bw.filter(e => e.src === 'sd').length;
  const last = z.last ? new Date(z.last) : null;
  return `<div class="muted small" style="margin-bottom:10px">심플다이어트 체중 기록 ${n.toLocaleString('ko-KR')}개가 이 앱에 있어요. 프로필 체중 차트는 하루 첫(아침) 기록으로 그려요.</div>
  <label class="btn light" style="margin-bottom:12px">심플다이어트 CSV 가져오기<input type="file" accept=".csv,text/csv,text/plain" class="f-sdcsv" hidden></label>
  <div class="bold" style="margin-bottom:4px">심플다이어트 연동 (읽기 전용 자동 동기화)</div>
  <div class="muted tiny" style="line-height:1.5;margin-bottom:8px">심플다이어트가 동기화하는 GitHub 저장소 <b>uhyun6907-boop/sd-data</b>의 records.json을 읽어와요. 이 앱은 sd-data에 절대 쓰지 않아요.<br>심플다이어트에 넣은 토큰을 그대로 붙여넣어도 되고, <b>sd-data 저장소에 Contents 읽기(Read-only) 권한만 있는 fine-grained 토큰</b>이면 충분해요. 토큰은 이 기기에만 저장돼요 (백업 파일에도 안 들어가요).</div>
  ${z.token ? `<div class="list-row"><span>상태</span><span class="small" style="text-align:right">${z.err ? `<span style="color:var(--red)">${esc(z.err)}</span>` : last ? `✅ ${fmtShort(last)} ${pad(last.getHours())}:${pad(last.getMinutes())} · ${(z.count || 0).toLocaleString('ko-KR')}개` : '아직 동기화 안 함'}</span></div>
    ${z.lastMsg ? `<div class="muted tiny" style="margin:-4px 0 8px;text-align:right">${esc(z.lastMsg)}</div>` : ''}
    <button class="btn" data-sd="sync" style="margin-bottom:8px">${sdBusy ? '동기화 중…' : '지금 동기화'}</button>
    <button class="btn gray" data-sd="off">연동 해제 (토큰 삭제)</button>`
  : `<div class="field"><label>GitHub 토큰</label><div class="row"><input class="sd-token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_… 또는 ghp_…" style="flex:1"><button class="pill" data-sd="paste" style="padding:10px 12px;white-space:nowrap">붙여넣기</button></div></div>
    <div class="muted tiny" style="margin:-4px 0 8px">심플다이어트 설정 &gt; 동기화에서 “토큰 복사”를 누른 뒤 여기서 “붙여넣기”를 누르세요.</div>
    <button class="btn" data-sd="connect">연결하고 동기화</button>`}
  <button class="btn light" data-sd="local" style="margin-top:8px">같은 브라우저의 심플다이어트 데이터 읽기</button>
  <div class="muted tiny" style="margin-top:4px">Safari에서 두 앱을 모두 열어 쓸 때만 돼요. 홈 화면 앱끼리는 저장소가 분리돼 있어서 위의 연동을 쓰세요.</div>`;
}
function refreshSdCard() { const c = $('#sdCard'); if (c) { c.innerHTML = sdCardHtml(); bindSdCard(c); } }
function bindSdCard(root) {
  const f = $('.f-sdcsv', root);
  if (f && !f._b) { f._b = 1; f.addEventListener('change', async e => { const file = e.target.files[0]; e.target.value = ''; if (file) importSdCsv(await file.text()); }); }
  const card = root.id === 'sdCard' ? root : $('#sdCard', root);
  if (card && !card._b) {
    card._b = 1;
    card.addEventListener('click', async e => {
      const b = e.target.closest('[data-sd]'); if (!b) return;
      const op = b.dataset.sd;
      if (op === 'connect') { const t = $('.sd-token', card).value.trim(); if (!t) return toast('토큰을 붙여넣으세요'); sdConnect(t); }
      if (op === 'paste') {
        let t = '';
        try { if (navigator.clipboard && navigator.clipboard.readText) t = (await navigator.clipboard.readText() || '').trim(); } catch (err) { t = ''; }
        if (looksLikeToken(t)) { $('.sd-token', card).value = t; sdConnect(t); }
        else { const i = $('.sd-token', card); i.focus(); toast(t ? '클립보드 내용이 GitHub 토큰이 아니에요' : '클립보드를 읽지 못했어요. 칸을 길게 눌러 직접 붙여넣어 주세요', 3500); }
      }
      if (op === 'sync') sdSync(true);
      if (op === 'off' && confirm('연동을 해제할까요? 이미 가져온 체중 기록은 남아있어요.')) { S.sdsync = { token: '', last: 0, count: 0, err: '' }; save('sdsync', true); refreshSdCard(); }
      if (op === 'local') {
        const list = await SD.readSameOrigin();
        if (!list || !list.length) return toast('이 브라우저에서 심플다이어트 데이터를 찾지 못했어요', 3500);
        const r = mergeSdEntries(list); toast(`같은 브라우저에서 ${list.length}개 읽음 · 새로 ${r.added}개`, 3500); refreshSdCard();
      }
    });
  }
}
function looksLikeToken(t) { return /^(github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}$/.test(t); }
async function sdConnect(t) { S.sdsync = { ...S.sdsync, token: t, err: '' }; await save('sdsync', true); sdSync(true); }
document.addEventListener('paste', e => {
  if (!e.target.classList || !e.target.classList.contains('sd-token')) return;
  const t = ((e.clipboardData && e.clipboardData.getData('text')) || '').trim();
  if (looksLikeToken(t)) { e.preventDefault(); e.target.value = t; sdConnect(t); }
});
function mergeSdEntries(list) {
  const byDate = new Map(S.bw.map((e, i) => [e.date, i]));
  let added = 0, updated = 0;
  for (const e of list) {
    const i = byDate.get(e.date);
    if (i == null) { S.bw.push(e); byDate.set(e.date, S.bw.length - 1); added++; }
    else if (S.bw[i].kg !== e.kg || S.bw[i].src !== 'sd') { S.bw[i] = e; updated++; }
  }
  S.bw.sort((a, b) => a.date < b.date ? -1 : 1);
  save('bw', true);
  if (TAB === 'profile') render();
  return { added, updated };
}
function importSdCsv(text) {
  try {
    const res = SD.parseCsv(text);
    const r = mergeSdEntries(res.entries);
    const es = res.entries, last = es[es.length - 1];
    openModal(`<div style="text-align:center"><div style="font-size:40px">⚖️</div><h2 style="margin:6px 0">체중 가져오기 완료</h2>
    <div class="card" style="text-align:left;line-height:1.8">파일 행: ${res.rows.toLocaleString('ko-KR')}개 (같은 시각 중복 ${res.rows - es.length - res.bad}개 정리)<br>체중 기록: <b>${es.length.toLocaleString('ko-KR')}</b>개 · 새로 ${r.added.toLocaleString('ko-KR')}개${r.updated ? ` · 갱신 ${r.updated}개` : ''}<br>기간: ${es.length ? fmtShort(pd(es[0].date)) + ' ~ ' + fmtShort(pd(last.date)) : '-'}<br>최근: ${last ? fmtW(last.kg) + ' (' + fmtShort(pd(last.date)) + ' ' + last.date.slice(11, 16) + ')' : '-'}</div>
    <button class="btn" data-close>확인</button></div>`);
    refreshSdCard();
  } catch (e) { toast('가져오기 실패: ' + e.message, 4000); }
}
async function sdSync(manual) {
  const z = S.sdsync; if (!z.token || sdBusy) return;
  sdBusy = true; z.tried = Date.now(); refreshSdCard();
  try {
    const recs = await SD.fetchRemote(z.token);
    const r = SD.applyRecords(S.bw, recs);
    S.bw = r.bw;
    await save('bw', true);
    S.sdsync = { ...S.sdsync, last: Date.now(), count: r.live, err: '', lastMsg: `새로 ${r.added} · 갱신 ${r.updated} · 삭제 ${r.removed}` };
    if (manual) toast(`동기화 완료 · 새로 ${r.added}개, 갱신 ${r.updated}개, 삭제 ${r.removed}개`, 3000);
    if (TAB === 'profile') render();
  } catch (e) {
    S.sdsync = { ...S.sdsync, err: e.message };
    if (manual) toast('동기화 실패: ' + e.message, 4000);
  } finally {
    sdBusy = false; save('sdsync', true); refreshSdCard();
  }
}
