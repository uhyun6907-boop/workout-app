// CSV parsing / Strong (Korean) import & export
(function (g) {
  const LB = 0.45359237;

  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], f = '', i = 0, q = false;
    const n = text.length;
    while (i < n) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { f += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        f += c; i++; continue;
      }
      if (c === '"') { q = true; i++; continue; }
      if (c === ',') { row.push(f); f = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
      f += c; i++;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
  }

  // "41분", "1시간 5분", "1시간", "30초", "1h 5m", "45m", "0"
  function parseDuration(s) {
    if (!s) return 0;
    s = String(s).trim();
    let sec = 0, hit = false;
    const h = /(\d+(?:\.\d+)?)\s*(시간|h(?:ours?|rs?)?)(?![a-z])/i.exec(s);
    const m = /(\d+(?:\.\d+)?)\s*(분|m(?:in(?:utes?|s)?)?)(?![a-z])/i.exec(s);
    const ss = /(\d+(?:\.\d+)?)\s*(초|s(?:ec(?:onds?|s)?)?)(?![a-z])/i.exec(s);
    if (h) { sec += parseFloat(h[1]) * 3600; hit = true; }
    if (m) { sec += parseFloat(m[1]) * 60; hit = true; }
    if (ss) { sec += parseFloat(ss[1]); hit = true; }
    if (!hit) {
      const hms = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
      if (hms) sec = hms[3] != null ? (+hms[1]) * 3600 + (+hms[2]) * 60 + (+hms[3]) : (+hms[1]) * 60 + (+hms[2]);
      else if (/^\d+(\.\d+)?$/.test(s)) sec = parseFloat(s) * 60;
    }
    return Math.round(sec);
  }

  function fmtDurationK(sec) {
    const m = Math.round((sec || 0) / 60);
    const h = Math.floor(m / 60), mm = m % 60;
    if (h && mm) return `${h}시간 ${mm}분`;
    if (h) return `${h}시간`;
    return `${mm}분`;
  }

  const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : 0; };

  const COLS = {
    date: ['날짜', 'Date'], name: ['워크아웃 이름', 'Workout Name'], dur: ['지속 시간', 'Duration'],
    ex: ['운동 이름', 'Exercise Name'], order: ['세트 순서', 'Set Order'], w: ['체중', 'Weight'],
    r: ['렙', 'Reps'], dist: ['거리', 'Distance'], sec: ['초', 'Seconds'], note: ['노트', 'Notes'],
    wnote: ['워크아웃 노트', 'Workout Notes'], rpe: ['RPE'],
  };

  function normDate(s) {
    s = String(s || '').trim();
    const m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})[ T]?(\d{1,2})?:?(\d{2})?:?(\d{2})?/.exec(s);
    if (!m) return null;
    const p = (x, d = '00') => (x == null ? d : String(x).padStart(2, '0'));
    return `${m[1]}-${p(m[2])}-${p(m[3])}T${p(m[4])}:${p(m[5])}:${p(m[6])}`;
  }

  // Returns {workouts, rows, skipped, restRows}
  function importStrong(text, opts = {}) {
    const exUnit = opts.exUnit || {};
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('빈 파일이에요');
    const head = rows[0].map(h => h.trim());
    const idx = {};
    for (const k in COLS) idx[k] = head.findIndex(h => COLS[k].includes(h));
    if (idx.date < 0 || idx.ex < 0) throw new Error('Strong CSV 형식이 아니에요 (날짜/운동 이름 열 없음)');
    const map = new Map();
    let skipped = 0, restRows = 0, setRows = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const get = k => (idx[k] >= 0 ? (r[idx[k]] ?? '') : '');
      const date = normDate(get('date'));
      const exName = get('ex').trim();
      if (!date || !exName) { skipped++; continue; }
      const wname = get('name').trim() || '워크아웃';
      const key = date + '|' + wname;
      let w = map.get(key);
      if (!w) {
        w = { id: 'w' + date.replace(/\D/g, '') + '_' + hash(wname), name: wname, start: date,
          duration: parseDuration(get('dur')), note: '', exercises: [] };
        map.set(key, w);
      }
      const wn = get('wnote').trim();
      if (wn && !w.note) w.note = wn;
      let ex = w.exercises[w.exercises.length - 1];
      const order = get('order').trim();
      if (/휴식|rest/i.test(order)) {
        restRows++;
        if (ex && ex.name === exName) ex.rest = Math.round(num(get('sec')));
        continue;
      }
      if (!ex || ex.name !== exName) { ex = { name: exName, sets: [] }; w.exercises.push(ex); }
      const note = get('note').trim();
      if (note && !ex.note) ex.note = note;
      let type = 'n';
      const o = order.toUpperCase();
      if (o === 'W' || o === '워밍업') type = 'W';
      else if (o === 'D' || o === '드롭') type = 'D';
      else if (o === 'F' || o === '실패') type = 'F';
      let wt = num(get('w'));
      if (exUnit[exName] === 'lb') wt = wt * LB;
      const set = { w: round(wt, 3), r: num(get('r')), type };
      const dist = num(get('dist')), sec = num(get('sec')), rpe = get('rpe').trim();
      if (dist) set.dist = dist;
      if (sec) set.sec = sec;
      if (rpe) set.rpe = num(rpe);
      ex.sets.push(set);
      setRows++;
    }
    const workouts = [...map.values()].sort((a, b) => a.start < b.start ? -1 : 1);
    return { workouts, rows: rows.length - 1, setRows, restRows, skipped };
  }

  function round(x, d) { const p = Math.pow(10, d); return Math.round(x * p) / p; }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

  function q(s) { s = String(s ?? ''); return '"' + s.replace(/"/g, '""') + '"'; }

  function exportStrong(workouts, opts = {}) {
    const exUnit = opts.exUnit || {};
    const out = ['날짜,워크아웃 이름,지속 시간,운동 이름,세트 순서,체중,렙,거리,초,노트,워크아웃 노트,RPE'];
    const sorted = [...workouts].sort((a, b) => a.start < b.start ? -1 : 1);
    for (const w of sorted) {
      const d = w.start.replace('T', ' ');
      let first = true;
      for (const ex of w.exercises) {
        ex.sets.forEach((s, i) => {
          const order = s.type && s.type !== 'n' ? s.type : String(i + 1);
          let wt = s.w || 0;
          if (exUnit[ex.name] === 'lb') wt = round(wt / LB, 2);
          out.push([d, q(w.name), fmtDurationK(w.duration), q(ex.name), order, wt, (s.r || 0).toFixed(1), s.dist || 0,
            (s.sec || 0).toFixed(1), i === 0 ? q(ex.note || '') : '', first ? q(w.note || '') : '', s.rpe ?? ''].join(','));
          first = false;
          if (ex.rest) out.push([d, q(w.name), fmtDurationK(w.duration), q(ex.name), '휴식 타이머', 0, '0.0', 0, ex.rest.toFixed(1), '', '', ''].join(','));
        });
      }
    }
    return out.join('\n') + '\n';
  }

  g.StrongCSV = { parseCSV, parseDuration, fmtDurationK, importStrong, exportStrong, LB };
  if (typeof module !== 'undefined') module.exports = g.StrongCSV;
})(typeof window !== 'undefined' ? window : globalThis);
