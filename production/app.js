/* ============================================================
   The Secret Map in the Treehouse — storyboard app
   Loads data/film.json and renders the full 48-shot production
   board with keyframes, voice lines and copy-ready prompts.
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

const pad2 = (n) => String(n).padStart(2, '0');
const audioFile = (shotId, slug) => `assets/audio/shot_${pad2(shotId)}_${slug}.mp3`;
const keyframeFile = (shotId) => `assets/keyframes/shot_${pad2(shotId)}.jpg`;

/* ---------- existence helper ---------- */
const cache = new Map();
async function exists(url) {
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url, { method: 'HEAD' })
    .then((r) => r.ok)
    .catch(() => false);
  cache.set(url, p);
  return p;
}

/* ---------- audio queue (plays a shot's lines in order) ---------- */
const player = { queue: [], idx: -1, el: null, onDone: null };

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
    if (player.idx >= player.queue.length) {
      stopAudio();
      return;
    }
    const url = player.queue[player.idx];
    const el = new Audio(url);
    player.el = el;
    el.onended = () => { player.idx++; step(); };
    el.onerror = () => { player.idx++; step(); };
    el.play().catch(() => { player.idx++; step(); });
  };
  step();
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.play-btn')) return;
  const btn = e.target.closest('.play-btn');
  if (btn.classList.contains('playing')) { stopAudio(); return; }
  const urls = JSON.parse(btn.dataset.urls || '[]');
  if (urls.length) playSequence(urls, btn);
});

/* ---------- data ---------- */
let FILM = null;

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
  for (const act of FILM.acts) {
    const a = document.createElement('a');
    a.href = `#act-${act.id}`;
    a.innerHTML = `<b>${act.id}</b>${act.title}`;
    nav.appendChild(a);
  }
}

function lineRow(shot, kind, line) {
  const row = document.createElement('div');
  row.className = 'line-row';

  const slugs = SPEAKER_SLUGS[line.speaker] || [];
  const urls = slugs.map((s) => audioFile(shot.id, s));

  const sp = document.createElement('span');
  sp.className = `speaker sp-${line.speaker}`;
  sp.textContent = SPEAKER_LABELS[line.speaker] || line.speaker;

  const txt = document.createElement('div');
  txt.className = `line-text ${kind === 'voiceover' ? 'vo' : ''}`;
  txt.textContent = line.text;
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

function shotCard(shot) {
  const card = document.createElement('article');
  card.className = 'shot-card';
  card.id = `shot-${shot.id}`;
  card.dataset.search = [
    shot.title, shot.video_prompt, shot.camera, shot.sfx || '',
    shot.music || '', shot.graphics || '',
    ...shot.dialogue.map((d) => d.text), ...shot.voiceover.map((v) => v.text)
  ].join(' ').toLowerCase();

  const media = document.createElement('div');
  media.className = 'shot-media';
  const kf = keyframeFile(shot.id);
  media.innerHTML = `
    <span class="shot-badge">SHOT ${pad2(shot.id)}</span>
    <span class="shot-time">${shot.timecode}</span>
    <img src="${kf}" alt="Shot ${pad2(shot.id)} keyframe — ${shot.title}" loading="lazy">`;
  const img = media.querySelector('img');
  img.onerror = () => {
    img.replaceWith(Object.assign(document.createElement('div'), {
      className: 'shot-placeholder',
      innerHTML: '<div class="icon">🎬</div><div class="lbl">keyframe rendering…</div>'
    }));
  };
  card.appendChild(media);

  const body = document.createElement('div');
  body.className = 'shot-body';

  const title = document.createElement('div');
  title.className = 'shot-title';
  title.textContent = shot.title;
  body.appendChild(title);

  const cam = document.createElement('div');
  cam.className = 'camera-note';
  cam.innerHTML = `<b>🎥 CAMERA</b><span>${shot.camera}</span>`;
  body.appendChild(cam);

  const allLines = [...shot.voiceover.map((v) => ['voiceover', v]),
                    ...shot.dialogue.map((d) => ['dialogue', d])];
  if (allLines.length) {
    const lines = document.createElement('div');
    lines.className = 'lines';
    for (const [kind, line] of allLines) lines.appendChild(lineRow(shot, kind, line));
    body.appendChild(lines);
  }

  const chips = document.createElement('div');
  chips.className = 'meta-chips';
  chips.innerHTML = `<span class="meta-chip"><b>SFX</b> ${shot.sfx}</span>`;
  if (shot.music) chips.innerHTML += `<span class="meta-chip music"><b>MUSIC</b> ${shot.music}</span>`;
  if (shot.graphics) chips.innerHTML += `<span class="meta-chip graphics"><b>GRAPHICS</b> ${shot.graphics}</span>`;
  body.appendChild(chips);

  const actions = document.createElement('div');
  actions.className = 'shot-actions';

  const promptBox = document.createElement('details');
  promptBox.className = 'prompt-box';
  promptBox.innerHTML = `<summary>Video prompt</summary><div class="prompt-text"></div>`;
  promptBox.querySelector('.prompt-text').textContent = shot.video_prompt;
  actions.appendChild(promptBox);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.textContent = '⧉ Copy prompt';
  copyBtn.addEventListener('click', async () => {
    const payload = [
      '[STYLE ANCHOR]', FILM.style_anchor, '',
      `[VIDEO PROMPT — SHOT ${pad2(shot.id)}: ${shot.title} (${shot.timecode})]`, shot.video_prompt, '',
      '[CAMERA]', shot.camera, '',
      '[NEGATIVE PROMPT]', FILM.negative_prompt
    ].join('\n');
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = payload; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
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
  const main = document.getElementById('acts');
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
    sec.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'shot-grid';
    for (const shot of act.shots) grid.appendChild(shotCard(shot));
    sec.appendChild(grid);

    main.appendChild(sec);
  }
}

function renderFilmstrip() {
  const strip = document.getElementById('filmstrip');
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
