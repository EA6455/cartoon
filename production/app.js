/* ============================================================
   The Secret Map in the Treehouse — storyboard app
   Loads data/film.json and renders the full 48-shot production
   board: keyframes with on-image voice chips + play buttons,
   per-line voice playback, copy-ready prompts, and an in-browser
   EDIT MODE (auto-saved to localStorage, export an updated
   film.json — flag ↻ lines you want re-recorded).
   ============================================================ */

const SPEAKER_SLUGS = {
  NARRATOR: ['narrator'],
  LEO: ['leo'],
  MIA: ['mia'],
  GRANDPA_TOM: ['grandpa'],
  LEO_AND_MIA: ['leo', 'mia'],
  BOBO: []
};

const SPEAKER_LABELS = {
  NARRATOR: 'NARRATOR',
  LEO: 'LEO',
  MIA: 'MIA',
  GRANDPA_TOM: 'GRANDPA TOM',
  BOBO: 'BOBO',
  LEO_AND_MIA: 'LEO & MIA'
};

const VOICE_NOTES = {
  narrator: 'Narrator — voice-00',
  leo: 'Leo — voice-01',
  mia: 'Mia — voice-02',
  grandpa: 'Grandpa Tom — voice-03'
};

/* Representative existing clip per voice, for the "Hear this voice" buttons */
const VOICE_SAMPLES = {
  narrator: 'assets/audio/shot_01_narrator.mp3',
  leo: 'assets/audio/shot_02_leo.mp3',
  mia: 'assets/audio/shot_03_mia.mp3',
  grandpa: 'assets/audio/shot_07_grandpa.mp3'
};

const SPEAKER_OPTIONS = ['NARRATOR', 'LEO', 'MIA', 'GRANDPA_TOM', 'LEO_AND_MIA', 'BOBO'];
const EDITABLE_FIELDS = ['title', 'video_prompt', 'camera', 'sfx', 'music', 'graphics'];

const pad2 = (n) => String(n).padStart(2, '0');
const audioFile = (shotId, slug) => `assets/audio/shot_${pad2(shotId)}_${slug}.mp3`;
const keyframeFile = (shotId) => `assets/keyframes/shot_${pad2(shotId)}.jpg`;

/* ---------- existence helper ---------- */
const cache = new Map();
async function exists(url) {
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url, { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
  cache.set(url, p);
  return p;
}

/* ---------- audio player ---------- */
const player = { queue: [], idx: -1, el: null };

function stopAudio() {
  if (player.el) { player.el.pause(); player.el = null; }
  player.queue = [];
  player.idx = -1;
  document.querySelectorAll('.play-btn.playing').forEach((b) => b.classList.remove('playing'));
}

function playSequence(urls, btn) {
  stopAudio();
  player.queue = urls.slice();
  player.idx = 0;
  if (btn) btn.classList.add('playing');
  const step = () => {
    if (player.idx >= player.queue.length) { stopAudio(); return; }
    const el = new Audio(player.queue[player.idx]);
    player.el = el;
    el.onended = () => { player.idx++; step(); };
    el.onerror = () => { player.idx++; step(); };
    el.play().catch(() => { player.idx++; step(); });
  };
  step();
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.play-btn');
  if (!btn) return;
  if (btn.classList.contains('playing')) { stopAudio(); return; }
  const urls = JSON.parse(btn.dataset.urls || '[]');
  if (urls.length) playSequence(urls, btn);
});

/* ---------- edit mode state (localStorage) ---------- */
const EDITS_KEY = 'treehouse_edits_v1';
let edits = {};
try { edits = JSON.parse(localStorage.getItem(EDITS_KEY) || '{}') || {}; } catch (err) { edits = {}; }
let editMode = false;
let saveTimer = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
    const pill = document.getElementById('save-status');
    if (pill) { pill.classList.add('show'); setTimeout(() => pill.classList.remove('show'), 1400); }
  }, 350);
}

function shotEdits(shot) {
  if (!edits[shot.id]) edits[shot.id] = {};
  return edits[shot.id];
}

function fieldValue(shot, field) {
  const e = edits[shot.id];
  if (e && e[field] != null && e[field] !== '') return e[field];
  return shot[field] != null ? shot[field] : '';
}

/* unified line list = voiceover + dialogue, honouring local edits */
function editedLines(shot) {
  const e = edits[shot.id];
  if (e && Array.isArray(e.lines)) return e.lines;
  return [
    ...shot.voiceover.map((v) => ({ kind: 'voiceover', speaker: v.speaker, text: v.text })),
    ...shot.dialogue.map((d) => ({ kind: 'dialogue', speaker: d.speaker, text: d.text }))
  ];
}

const shotIsEdited = (shot) => !!edits[shot.id];

/* ---------- data ---------- */
let FILM = null;

function findShot(id) {
  for (const a of FILM.acts) for (const s of a.shots) if (s.id === id) return s;
  return null;
}

async function main() {
  const res = await fetch('data/film.json');
  FILM = await res.json();

  document.getElementById('style-anchor').textContent = FILM.style_anchor;
  document.getElementById('negative-prompt').textContent = FILM.negative_prompt;

  renderCast();
  renderActNav();
  renderActs();
  renderFilmstrip();
  trackProgress();
  revealDownloads();
  revealBackground();
  wireControls();
  wireEditEvents();
}

/* one-click download buttons — shown only when the zips actually exist */
async function revealDownloads() {
  const row = document.getElementById('download-row');
  const full = document.getElementById('dl-full');
  const film = document.getElementById('dl-film');
  const [hasFull, hasFilm] = await Promise.all([
    exists('the_secret_map_complete_package.zip'),
    exists('the_secret_map_in_the_treehouse.zip')
  ]);
  if (!hasFull) full.style.display = 'none';
  if (!hasFilm) film.style.display = 'none';
  if (hasFull || hasFilm) row.hidden = false;
}

/* full-film background score player */
async function revealBackground() {
  const btn = document.getElementById('bg-play');
  if (!btn) return;
  const ok = await exists('assets/audio/bg/background_full.mp3');
  btn.hidden = !ok;
}

/* ---------- renderers ---------- */
function renderCast() {
  const grid = document.getElementById('cast-grid');
  grid.innerHTML = '';
  for (const c of FILM.characters) {
    const card = document.createElement('div');
    card.className = 'cast-card';
    let voiceHtml;
    if (c.id === 'BOBO') {
      voiceHtml = '<span class="voice sp-BOBO">🐶 SFX only — barks &amp; growls</span>';
    } else {
      const slug = SPEAKER_SLUGS[c.id][0];
      voiceHtml = `
        <span class="voice sp-${c.id}">🎙 ${VOICE_NOTES[slug]}</span>
        <button class="play-btn voice-sample" data-urls='["${VOICE_SAMPLES[slug]}"]'>🔊 Hear this voice</button>`;
    }
    card.innerHTML = `
      <img src="${c.sheet}" alt="${c.name} character reference sheet" loading="lazy"
           onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'shot-placeholder',innerHTML:'<div class=\\'icon\\'>🎨</div><div class=\\'lbl\\'>sheet pending</div>'}))">
      <div class="cast-body">
        <h5>${c.name}<span class="who">${c.id.replace('_', ' ')}</span></h5>
        ${voiceHtml}
        <p>${c.description}</p>
      </div>`;
    const sampleBtn = card.querySelector('.voice-sample');
    if (sampleBtn) {
      const url = JSON.parse(sampleBtn.dataset.urls)[0];
      exists(url).then((ok) => { if (!ok) sampleBtn.disabled = true; });
    }
    grid.appendChild(card);
  }
}

function renderActNav() {
  const nav = document.getElementById('actnav');
  nav.innerHTML = '';
  for (const act of FILM.acts) {
    const a = document.createElement('a');
    a.href = `#act-${act.id}`;
    a.innerHTML = `<b>${act.id}</b>${act.title}`;
    nav.appendChild(a);
  }
}

function staticLineRow(shot, line) {
  const row = document.createElement('div');
  row.className = 'line-row';

  const slugs = SPEAKER_SLUGS[line.speaker] || [];
  const urls = slugs.map((s) => audioFile(shot.id, s));

  const sp = document.createElement('span');
  sp.className = `speaker sp-${line.speaker}`;
  sp.textContent = SPEAKER_LABELS[line.speaker] || line.speaker;

  const txt = document.createElement('div');
  txt.className = `line-text ${line.kind === 'voiceover' ? 'vo' : ''}`;
  txt.textContent = line.text;
  if (line.rerecord) {
    const flag = document.createElement('span');
    flag.className = 'reflag-badge';
    flag.textContent = '↻ re-record';
    txt.appendChild(flag);
  }
  if (line.speaker === 'BOBO') {
    const note = document.createElement('div');
    note.className = 'small';
    note.textContent = '(puppy vocalization — rendered as SFX, not spoken)';
    txt.appendChild(note);
  }

  row.appendChild(sp);
  row.appendChild(txt);

  if (urls.length) {
    const btn = document.createElement('button');
    btn.className = 'play-btn';
    btn.dataset.urls = JSON.stringify(urls);
    btn.textContent = `▶ ${slugs.length > 1 ? 'both' : 'play'}`;
    exists(urls[0]).then((ok) => { if (!ok) btn.disabled = true; });
    row.appendChild(btn);
  }
  return row;
}

function editLineRow(line, idx) {
  const row = document.createElement('div');
  row.className = 'line-edit';
  row.dataset.lineIdx = idx;
  row.dataset.kind = line.kind;

  const sel = document.createElement('select');
  sel.className = 'edit-select';
  sel.dataset.lf = 'speaker';
  sel.title = 'Voice';
  for (const s of SPEAKER_OPTIONS) {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = SPEAKER_LABELS[s] || s;
    if (s === line.speaker) o.selected = true;
    sel.appendChild(o);
  }

  const ta = document.createElement('textarea');
  ta.className = 'edit-area';
  ta.dataset.lf = 'text';
  ta.rows = 2;
  ta.value = line.text;
  ta.placeholder = 'Line text…';

  const tools = document.createElement('div');
  tools.className = 'line-tools';

  const flagLab = document.createElement('label');
  flagLab.className = 'reflag';
  flagLab.title = 'Flag this line to be re-recorded';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.dataset.lf = 'rerecord';
  cb.checked = !!line.rerecord;
  flagLab.appendChild(cb);
  flagLab.appendChild(document.createTextNode('↻'));

  const del = document.createElement('button');
  del.className = 'line-del';
  del.title = 'Remove line';
  del.textContent = '✕';

  tools.appendChild(flagLab);
  tools.appendChild(del);

  row.appendChild(sel);
  row.appendChild(ta);
  row.appendChild(tools);
  return row;
}

function shotCard(shot) {
  const card = document.createElement('article');
  card.className = 'shot-card';
  card.id = `shot-${shot.id}`;
  card.dataset.shotId = shot.id;

  const lines = editedLines(shot);
  const titleText = fieldValue(shot, 'title');
  const promptText = fieldValue(shot, 'video_prompt');
  const cameraText = fieldValue(shot, 'camera');
  const sfxText = fieldValue(shot, 'sfx');
  const musicText = fieldValue(shot, 'music');
  const graphicsText = fieldValue(shot, 'graphics');

  card.dataset.search = [
    titleText, promptText, cameraText, sfxText, musicText, graphicsText,
    ...lines.map((l) => `${l.speaker} ${l.text}`)
  ].join(' ').toLowerCase();

  /* ---- picture ---- */
  const media = document.createElement('div');
  media.className = 'shot-media';
  const kf = keyframeFile(shot.id);
  media.innerHTML = `
    <span class="shot-badge">SHOT ${pad2(shot.id)}</span>
    <span class="shot-time">${shot.timecode}</span>
    <img src="${kf}" alt="Shot ${pad2(shot.id)} keyframe — ${titleText}" loading="lazy">`;
  const img = media.querySelector('img');
  img.onerror = () => {
    img.replaceWith(Object.assign(document.createElement('div'), {
      className: 'shot-placeholder',
      innerHTML: '<div class="icon">🎬</div><div class="lbl">keyframe rendering…</div>'
    }));
  };

  /* voice chips overlaid on the picture */
  const speakers = [...new Set(lines.map((l) => l.speaker))];
  if (speakers.length) {
    const chips = document.createElement('div');
    chips.className = 'shot-voices';
    for (const sp of speakers) {
      const s = document.createElement('span');
      s.className = `speaker sp-${sp}`;
      s.textContent = `🎙 ${SPEAKER_LABELS[sp] || sp}`;
      chips.appendChild(s);
    }
    media.appendChild(chips);
  }

  /* ▶ play-whole-shot button on the picture */
  const playAll = document.createElement('button');
  playAll.className = 'play-btn media-play';
  playAll.title = "Play this shot's audio";
  const urls = lines.flatMap((l) => (SPEAKER_SLUGS[l.speaker] || []).map((s) => audioFile(shot.id, s)));
  playAll.dataset.urls = JSON.stringify(urls);
  playAll.textContent = '▶';
  if (!urls.length) {
    playAll.disabled = true;
  } else {
    Promise.all(urls.map(exists)).then((rs) => { if (!rs.some(Boolean)) playAll.disabled = true; });
  }
  media.appendChild(playAll);

  card.appendChild(media);

  /* ---- this picture's own audio files, directly under the picture ---- */
  const audioStrip = document.createElement('div');
  audioStrip.className = 'audio-strip';
  const audioFiles = [];
  for (const l of lines) {
    for (const slug of SPEAKER_SLUGS[l.speaker] || []) {
      audioFiles.push({ slug, url: audioFile(shot.id, slug) });
    }
  }
  if (audioFiles.length) {
    const lab = document.createElement('span');
    lab.className = 'audio-strip-label';
    lab.textContent = `🎧 This picture's audio (${audioFiles.length})`;
    audioStrip.appendChild(lab);
    for (const f of audioFiles) {
      const b = document.createElement('button');
      b.className = 'play-btn audio-file-btn';
      b.dataset.urls = JSON.stringify([f.url]);
      b.title = f.url;
      b.textContent = `▶ shot_${pad2(shot.id)}_${f.slug}.mp3`;
      exists(f.url).then((ok) => { if (!ok) b.disabled = true; });
      audioStrip.appendChild(b);
    }
  } else {
    const none = document.createElement('span');
    none.className = 'audio-strip-none';
    none.textContent = '🎧 No spoken audio in this picture — SFX / music only';
    audioStrip.appendChild(none);
  }
  card.appendChild(audioStrip);

  /* ---- body ---- */
  const body = document.createElement('div');
  body.className = 'shot-body';

  /* title */
  const title = document.createElement('div');
  title.className = 'shot-title';
  if (editMode) {
    const inp = document.createElement('input');
    inp.className = 'edit-input';
    inp.dataset.field = 'title';
    inp.value = titleText;
    title.appendChild(inp);
  } else {
    title.textContent = titleText;
    if (shotIsEdited(shot)) {
      const b = document.createElement('span');
      b.className = 'edited-flag';
      b.textContent = '● edited';
      title.appendChild(b);
    }
  }
  body.appendChild(title);

  /* camera */
  const cam = document.createElement('div');
  cam.className = 'camera-note';
  if (editMode) {
    const ta = document.createElement('textarea');
    ta.className = 'edit-area';
    ta.dataset.field = 'camera';
    ta.rows = 2;
    ta.value = cameraText;
    cam.appendChild(ta);
  } else {
    const b = document.createElement('b');
    b.textContent = '🎥 CAMERA';
    const span = document.createElement('span');
    span.textContent = cameraText;
    cam.appendChild(b);
    cam.appendChild(span);
  }
  body.appendChild(cam);

  /* lines */
  if (lines.length || editMode) {
    const wrap = document.createElement('div');
    wrap.className = 'lines';
    lines.forEach((line, i) => {
      wrap.appendChild(editMode ? editLineRow(line, i) : staticLineRow(shot, line));
    });
    if (editMode) {
      const addRow = document.createElement('div');
      addRow.className = 'add-line-row';
      for (const kind of ['dialogue', 'voiceover']) {
        const b = document.createElement('button');
        b.className = 'add-line';
        b.dataset.kind = kind;
        b.textContent = `＋ ${kind === 'dialogue' ? 'dialogue line' : 'voiceover line'}`;
        addRow.appendChild(b);
      }
      wrap.appendChild(addRow);
    }
    body.appendChild(wrap);
  }

  /* sfx / music / graphics */
  if (editMode) {
    const meta = document.createElement('div');
    meta.className = 'meta-edit';
    for (const [field, label] of [['sfx', 'SFX'], ['music', 'MUSIC'], ['graphics', 'GRAPHICS']]) {
      const lab = document.createElement('label');
      lab.className = 'meta-edit-field';
      const sp = document.createElement('span');
      sp.textContent = label;
      const inp = document.createElement('input');
      inp.className = 'edit-input';
      inp.dataset.field = field;
      inp.value = fieldValue(shot, field);
      lab.appendChild(sp);
      lab.appendChild(inp);
      meta.appendChild(lab);
    }
    body.appendChild(meta);
  } else {
    const chips = document.createElement('div');
    chips.className = 'meta-chips';
    const mk = (cls, label, val) => {
      const c = document.createElement('span');
      c.className = cls ? `meta-chip ${cls}` : 'meta-chip';
      const b = document.createElement('b');
      b.textContent = `${label} `;
      c.appendChild(b);
      c.appendChild(document.createTextNode(val));
      return c;
    };
    chips.appendChild(mk('', 'SFX', sfxText));
    if (musicText) chips.appendChild(mk('music', 'MUSIC', musicText));
    if (graphicsText) chips.appendChild(mk('graphics', 'GRAPHICS', graphicsText));
    body.appendChild(chips);
  }

  /* prompt + copy */
  const actions = document.createElement('div');
  actions.className = 'shot-actions';

  const promptBox = document.createElement('details');
  promptBox.className = 'prompt-box';
  if (editMode) {
    promptBox.innerHTML = '<summary>Video prompt (editable)</summary>';
    const holder = document.createElement('div');
    holder.style.padding = '0 12px 12px';
    const ta = document.createElement('textarea');
    ta.className = 'edit-area';
    ta.dataset.field = 'video_prompt';
    ta.rows = 7;
    ta.value = promptText;
    holder.appendChild(ta);
    promptBox.appendChild(holder);
  } else {
    promptBox.innerHTML = '<summary>Video prompt</summary><div class="prompt-text"></div>';
    promptBox.querySelector('.prompt-text').textContent = promptText;
  }
  actions.appendChild(promptBox);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.textContent = '⧉ Copy prompt';
  copyBtn.addEventListener('click', async () => {
    const payload = [
      '[STYLE ANCHOR]', FILM.style_anchor, '',
      `[VIDEO PROMPT — SHOT ${pad2(shot.id)}: ${titleText} (${shot.timecode})]`, promptText, '',
      '[CAMERA]', cameraText, '',
      '[NEGATIVE PROMPT]', FILM.negative_prompt
    ].join('\n');
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = payload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copyBtn.textContent = '✓ Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => { copyBtn.textContent = '⧉ Copy prompt'; copyBtn.classList.remove('copied'); }, 1600);
  });
  actions.appendChild(copyBtn);
  body.appendChild(actions);

  card.appendChild(body);
  return card;
}

function renderActs() {
  const mainEl = document.getElementById('acts');
  mainEl.innerHTML = '';
  for (const act of FILM.acts) {
    const sec = document.createElement('section');
    sec.className = 'act-section';
    sec.id = `act-${act.id}`;

    const head = document.createElement('div');
    head.className = 'act-header';
    head.innerHTML = `
      <span class="act-num">ACT ${act.id}</span>
      <span class="act-title">${act.title}</span>
      <span class="act-time">${act.time} · ${act.shots.length} shots</span>`;
    if (act.background) {
      const bgBtn = document.createElement('button');
      bgBtn.className = 'play-btn act-bg';
      bgBtn.dataset.urls = JSON.stringify([act.background]);
      bgBtn.title = "Play this act's background ambience";
      bgBtn.textContent = '🎵 ambience';
      exists(act.background).then((ok) => { if (!ok) bgBtn.disabled = true; });
      head.appendChild(bgBtn);
    }
    sec.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'shot-grid';
    for (const shot of act.shots) grid.appendChild(shotCard(shot));
    sec.appendChild(grid);

    mainEl.appendChild(sec);
  }
}

function renderFilmstrip() {
  const strip = document.getElementById('filmstrip');
  strip.innerHTML = '';
  const shots = FILM.acts.flatMap((a) => a.shots);
  for (const shot of shots) {
    const dot = document.createElement('div');
    dot.className = 'frame-dot';
    dot.innerHTML = `<span class="tip">Shot ${pad2(shot.id)} — ${shot.title}</span>`;
    dot.addEventListener('click', () => {
      document.getElementById(`shot-${shot.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    exists(keyframeFile(shot.id)).then((ok) => { if (ok) dot.classList.add('done'); });
    strip.appendChild(dot);
  }
}

/* ---------- progress tracking ---------- */
function trackProgress() {
  const shots = FILM.acts.flatMap((a) => a.shots);
  let expectedAudio = 0;
  const audioUrls = [];
  for (const s of shots) {
    for (const line of [...s.voiceover, ...s.dialogue]) {
      for (const slug of SPEAKER_SLUGS[line.speaker] || []) {
        expectedAudio++;
        audioUrls.push(audioFile(s.id, slug));
      }
    }
  }

  let kfDone = 0, voDone = 0;
  const kfBar = document.getElementById('kf-bar'), kfCount = document.getElementById('kf-count');
  const voBar = document.getElementById('vo-bar'), voCount = document.getElementById('vo-count');

  for (const s of shots) {
    exists(keyframeFile(s.id)).then((ok) => {
      if (ok) kfDone++;
      kfBar.style.width = `${(kfDone / shots.length) * 100}%`;
      kfCount.textContent = `${kfDone} / ${shots.length}`;
    });
  }
  for (const url of audioUrls) {
    exists(url).then((ok) => {
      if (ok) voDone++;
      voBar.style.width = `${(voDone / expectedAudio) * 100}%`;
      voCount.textContent = `${voDone} / ${expectedAudio}`;
    });
  }
}

/* ---------- edit mode wiring ---------- */
function wireEditEvents() {
  const actsEl = document.getElementById('acts');

  const onEditInput = (e) => {
    if (!editMode) return;
    const card = e.target.closest('.shot-card');
    if (!card) return;
    const shot = findShot(+card.dataset.shotId);
    if (!shot) return;
    const se = shotEdits(shot);
    const field = e.target.dataset.field;
    const lf = e.target.dataset.lf;
    if (field) se[field] = e.target.value;
    if (lf) {
      if (!Array.isArray(se.lines)) se.lines = editedLines(shot);
      const row = e.target.closest('[data-line-idx]');
      if (row) {
        const i = +row.dataset.lineIdx;
        if (e.target.type === 'checkbox') se.lines[i].rerecord = e.target.checked;
        else se.lines[i][lf] = e.target.value;
      }
    }
    if (field || lf) scheduleSave();
  };
  actsEl.addEventListener('input', onEditInput);
  actsEl.addEventListener('change', onEditInput);

  actsEl.addEventListener('click', (e) => {
    if (!editMode) return;
    const card = e.target.closest('.shot-card');
    if (!card) return;
    const shot = findShot(+card.dataset.shotId);
    if (!shot) return;
    const se = shotEdits(shot);

    if (e.target.classList.contains('line-del')) {
      const row = e.target.closest('[data-line-idx]');
      if (row) {
        if (!Array.isArray(se.lines)) se.lines = editedLines(shot);
        se.lines.splice(+row.dataset.lineIdx, 1);
        scheduleSave();
        renderActs();
      }
    } else if (e.target.classList.contains('add-line')) {
      if (!Array.isArray(se.lines)) se.lines = editedLines(shot);
      se.lines.push({ kind: e.target.dataset.kind, speaker: 'LEO', text: '' });
      scheduleSave();
      renderActs();
    }
  });
}

function wireControls() {
  const toggle = document.getElementById('edit-toggle');
  toggle.addEventListener('click', () => {
    editMode = !editMode;
    document.body.classList.toggle('editing', editMode);
    toggle.classList.toggle('active', editMode);
    toggle.textContent = editMode ? '✏️ Edit mode: ON' : '✏️ Edit mode';
    renderActs();
  });

  document.getElementById('export-btn').addEventListener('click', exportFilm);

  document.getElementById('clear-edits').addEventListener('click', () => {
    if (!Object.keys(edits).length) return;
    if (confirm('Discard all local edits and reload the original data?')) {
      localStorage.removeItem(EDITS_KEY);
      location.reload();
    }
  });
}

function exportFilm() {
  const out = JSON.parse(JSON.stringify(FILM));
  for (const act of out.acts) {
    for (const s of act.shots) {
      const e = edits[s.id];
      if (!e) continue;
      for (const f of EDITABLE_FIELDS) {
        if (e[f] != null && e[f] !== '') s[f] = e[f];
      }
      if (Array.isArray(e.lines)) {
        const clean = (l) => {
          const o = { speaker: l.speaker, text: l.text };
          if (l.rerecord) o.rerecord = true;
          return o;
        };
        s.voiceover = e.lines.filter((l) => l.kind === 'voiceover').map(clean);
        s.dialogue = e.lines.filter((l) => l.kind === 'dialogue').map(clean);
      }
    }
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'film.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- search ---------- */
document.getElementById('search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const cards = document.querySelectorAll('.shot-card');
  let shown = 0;
  cards.forEach((c) => {
    const hit = !q || c.dataset.search.includes(q);
    c.classList.toggle('hidden', !hit);
    if (hit) shown++;
  });
  document.getElementById('match-count').textContent = q ? `${shown} / ${cards.length} shots` : '';
});

main().catch((err) => {
  document.getElementById('acts').innerHTML =
    `<p style="padding:30px;color:#ff7a6e">Failed to load data/film.json — serve this folder over HTTP (see production/README.md).<br>${err}</p>`;
});
