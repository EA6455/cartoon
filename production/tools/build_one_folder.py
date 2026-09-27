#!/usr/bin/env python3
"""Build the one-folder delivery view: production/film/

ONE folder, split into 48 part-folders (shot_01/ … shot_48/).
Each part-folder contains, in order:
    1. the PICTURE   — shot_XX.jpg
    2. ALL its AUDIO — shot_XX_<speaker>.mp3 (narrator / leo / mia / grandpa)
Also writes _LIST.txt at the film/ root — the ordered manifest of the film.

Re-run any time assets change:
    python3 tools/build_one_folder.py
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FILM_DIR = os.path.join(ROOT, "film")

SPEAKER_SLUGS = {
    "NARRATOR": ["narrator"],
    "LEO": ["leo"],
    "MIA": ["mia"],
    "GRANDPA_TOM": ["grandpa"],
    "LEO_AND_MIA": ["leo", "mia"],
    "BOBO": []
}
SPEAKER_NAMES = {
    "narrator": "Narrator",
    "leo": "Leo",
    "mia": "Mia",
    "grandpa": "Grandpa Tom"
}

with open(os.path.join(ROOT, "data", "film.json"), encoding="utf-8") as f:
    film = json.load(f)

# start completely clean
if os.path.isdir(FILM_DIR):
    shutil.rmtree(FILM_DIR)
os.makedirs(FILM_DIR)

out = [
    "THE SECRET MAP IN THE TREEHOUSE — ONE FOLDER, 48 PARTS",
    "=======================================================",
    "Layout: film/shot_01/ … film/shot_48/  (one folder per part)",
    "Each part-folder: PICTURE first, then ALL AUDIO lines for that picture.",
    "Picture naming : shot_XX/shot_XX.jpg",
    "Audio naming   : shot_XX/shot_XX_<speaker>.mp3  (narrator / leo / mia / grandpa)",
    "Background     : background/act_01..09.mp3  (per-act ambience bed)",
    "                 background/background_full.mp3  (full 10:00 score)",
    "",
]

pics = clips = 0
missing = []

for ai, act in enumerate(film["acts"], 1):
    out.append("")
    out.append(f"ACT {act['id']} — {act['title'].upper()}  ({act['time']})")
    out.append("-" * 58)
    bg_name = f"act_{ai:02d}.mp3"
    if os.path.exists(os.path.join(ROOT, "assets", "audio", "bg", bg_name)):
        out.append(f"    [BACKGROUND] background/{bg_name}   (this act's ambience)")
    for s in act["shots"]:
        sid = f"shot_{s['id']:02d}"
        part_dir = os.path.join(FILM_DIR, sid)
        os.makedirs(part_dir, exist_ok=True)

        out.append("")
        out.append(f"{sid.upper()}  —  {s['title']}  [{s['timecode']}]")

        # 1) the picture
        kf_src = os.path.join(ROOT, "assets", "keyframes", f"{sid}.jpg")
        if os.path.exists(kf_src):
            shutil.copy2(kf_src, os.path.join(part_dir, f"{sid}.jpg"))
            pics += 1
            out.append(f"    [PICTURE]  {sid}/{sid}.jpg")
        else:
            missing.append(f"{sid}/{sid}.jpg")

        # 2) all audio lines for this picture
        lines = [
            *(l for l in s.get("voiceover", [])),
            *(l for l in s.get("dialogue", []))
        ]
        if not lines:
            out.append("    [AUDIO]    (no spoken lines — SFX / music only)")
        for l in lines:
            slugs = SPEAKER_SLUGS.get(l["speaker"], [])
            if not slugs:
                out.append(f"    [AUDIO]    ({l['speaker']} — puppy vocalization, SFX only)")
                continue
            for slug in slugs:
                a_src = os.path.join(ROOT, "assets", "audio", f"{sid}_{slug}.mp3")
                if os.path.exists(a_src):
                    shutil.copy2(a_src, os.path.join(part_dir, f"{sid}_{slug}.mp3"))
                    clips += 1
                    out.append(f"    [AUDIO]    {sid}/{sid}_{slug}.mp3   ({SPEAKER_NAMES[slug]})")
                else:
                    missing.append(f"{sid}/{sid}_{slug}.mp3")

# background sound: per-act ambience beds + full master score
bg_src_dir = os.path.join(ROOT, "assets", "audio", "bg")
bg_count = 0
if os.path.isdir(bg_src_dir):
    bg_dst = os.path.join(FILM_DIR, "background")
    shutil.copytree(bg_src_dir, bg_dst)
    bg_count = len([f for f in os.listdir(bg_dst) if f.lower().endswith((".mp3", ".wav"))])

out += [
    "",
    "-" * 58,
    f"TOTALS: {pics} pictures, {clips} audio clips, 48 part-folders, {bg_count} background tracks",
]
if missing:
    out.append(f"MISSING: {', '.join(missing)}")
else:
    out.append("STATUS: COMPLETE — nothing missing")

with open(os.path.join(FILM_DIR, "_LIST.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(out) + "\n")

print(f"Built {FILM_DIR}")
print(f"  part-folders : 48")
print(f"  pictures     : {pics}/48")
print(f"  audio clips  : {clips}")
print(f"  missing      : {missing or 'none'}")
