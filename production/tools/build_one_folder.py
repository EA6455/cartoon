#!/usr/bin/env python3
"""Build the one-folder delivery view: production/film/

Everything in ONE folder, part by part (shot 01 → 48):
each shot's PICTURE first, followed by ALL of its AUDIO lines.
Also writes _LIST.txt — the ordered manifest of the whole film.

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

os.makedirs(FILM_DIR, exist_ok=True)

# start clean (files only, keep it flat)
for name in os.listdir(FILM_DIR):
    p = os.path.join(FILM_DIR, name)
    if os.path.isfile(p):
        os.remove(p)

out = [
    "THE SECRET MAP IN THE TREEHOUSE — ONE-FOLDER VIEW",
    "==================================================",
    "Order: part by part (shot 01 -> 48).",
    "Each part: PICTURE first, then ALL AUDIO lines for that picture.",
    "Keyframe naming : shot_XX.jpg",
    "Audio naming    : shot_XX_<speaker>.mp3  (narrator / leo / mia / grandpa)",
    "",
]

pics = clips = 0
missing = []

for act in film["acts"]:
    out.append("")
    out.append(f"ACT {act['id']} — {act['title'].upper()}  ({act['time']})")
    out.append("-" * 58)
    for s in act["shots"]:
        sid = f"shot_{s['id']:02d}"
        out.append("")
        out.append(f"{sid.upper()}  —  {s['title']}  [{s['timecode']}]")

        # 1) the picture
        kf_src = os.path.join(ROOT, "assets", "keyframes", f"{sid}.jpg")
        if os.path.exists(kf_src):
            shutil.copy2(kf_src, os.path.join(FILM_DIR, f"{sid}.jpg"))
            pics += 1
            out.append(f"    [PICTURE]  {sid}.jpg")
        else:
            missing.append(f"{sid}.jpg")

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
                    shutil.copy2(a_src, os.path.join(FILM_DIR, f"{sid}_{slug}.mp3"))
                    clips += 1
                    out.append(f"    [AUDIO]    {sid}_{slug}.mp3   ({SPEAKER_NAMES[slug]})")
                else:
                    missing.append(f"{sid}_{slug}.mp3")

out += [
    "",
    "-" * 58,
    f"TOTALS: {pics} pictures, {clips} audio clips",
]
if missing:
    out.append(f"MISSING: {', '.join(missing)}")
else:
    out.append("STATUS: COMPLETE — nothing missing")

with open(os.path.join(FILM_DIR, "_LIST.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(out) + "\n")

print(f"Built {FILM_DIR}")
print(f"  pictures : {pics}/48")
print(f"  audio    : {clips}")
print(f"  missing  : {missing or 'none'}")
