# 🎬 The Secret Map in the Treehouse — Production Package

Full production package for the 10-minute, 48-shot, 16:9 Pixar-style animated
short **"The Secret Map in the Treehouse"** — keyframe art, cast voice lines,
camera notes and ready-to-paste video-generation prompts for every shot.

## Structure

```
production/
├── index.html            ← interactive storyboard site (open via a local server)
├── app.js                ← site logic (renders film.json, plays audio lines)
├── style.css             ← site styling
├── data/
│   └── film.json         ← master batch file as structured data (all 48 shots)
├── assets/
│   ├── characters/       ← character reference sheets (visual anchors)
│   │   ├── leo.jpg         mia.jpg         bobo.jpg       grandpa_tom.jpg
│   ├── keyframes/        ← shot_01.jpg … shot_48.jpg (one per shot)
│   └── audio/            ← shot_XX_speaker.mp3 (one clip per spoken line)
├── prompts/              ← shot_01.txt … shot_48.txt (paste-ready for
│                            Veo / Sora / Kling / Runway / Pika)
├── film/                 ← ONE-FOLDER view: every shot's picture first,
│                            then all its audio lines, part by part
│                            (+ _LIST.txt manifest of the whole film)
└── tools/
    ├── generate_prompts.py  ← regenerates prompts/ from data/film.json
    └── build_one_folder.py  ← regenerates film/ (picture + audios per shot)
```

## Run the storyboard site

```bash
# from the repo root (or any folder containing this one)
python3 -m http.server 8080 --directory production
# open http://localhost:8080
```

The site reads `data/film.json`, renders all 9 acts / 48 shots with keyframes,
per-line voice playback (▶ buttons, played in shot order), searchable cards and
one-click **Copy prompt** per shot. Missing keyframes/lines show as pending
placeholders and appear automatically once rendered.

## File conventions

| Asset | Pattern | Notes |
|---|---|---|
| Keyframe | `assets/keyframes/shot_XX.jpg` | 16:9 cinematic still per shot |
| Voice line | `assets/audio/shot_XX_speaker.mp3` | `speaker` ∈ `narrator, leo, mia, grandpa` |
| Prompt file | `prompts/shot_XX.txt` | style anchor + video prompt + camera + lines + negative prompt |
| Character sheet | `assets/characters/<name>.jpg` | used as generation reference for consistency |

## Cast voices

| Character | Voice id | Registered as |
|---|---|---|
| Narrator | `voice-00` | masculine, narration |
| Leo | `voice-01` | masculine, characters |
| Mia | `voice-02` | feminine, characters |
| Grandpa Tom | `voice-03` | masculine, narration |
| Bobo | — | puppy vocalizations are SFX, not spoken lines |

## ✏️ Editing in the browser

The site has a built-in **Edit mode** (button in the controls bar):

- Rewrite any shot **title, video prompt, camera note, SFX/MUSIC/GRAPHICS** inline.
- Edit **dialogue / voiceover lines**, switch the **speaker** (voice) per line, add or remove lines.
- Check **↻** on a line to flag it for re-recording.
- Changes auto-save in your browser (localStorage). **⬇ Export film.json** downloads the
  updated master data — commit it over `data/film.json` (or hand it to the agent) and the
  board + prompt files update from it. Flagged lines are exported with `"rerecord": true`
  so the agent knows exactly which audio clips to regenerate.
- 🗑 **Reset edits** discards local changes and reloads the original data.

Audio clips follow the naming convention `assets/audio/shot_XX_speaker.mp3`
(`speaker` ∈ narrator / leo / mia / grandpa). If you change a line's speaker or text,
flag it ↻ and it will be re-recorded into the right file on the next generation pass.

## Rebuild prompt files

```bash
python3 tools/generate_prompts.py
```
