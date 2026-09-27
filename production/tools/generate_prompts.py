#!/usr/bin/env python3
"""Generate ready-to-paste per-shot prompt files (production/prompts/shot_XX.txt)
from the master batch data (production/data/film.json).

Each file contains: shot header, global style anchor, the shot's video prompt,
camera direction, voiceover / dialogue lines, SFX / music / graphics cues and
the global negative prompt — formatted for pasting into external AI video
generators (Veo, Sora, Kling, Runway, Pika, ...).
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

with open(os.path.join(ROOT, "data", "film.json"), encoding="utf-8") as f:
    film = json.load(f)

outdir = os.path.join(ROOT, "prompts")
os.makedirs(outdir, exist_ok=True)

count = 0
for act in film["acts"]:
    for s in act["shots"]:
        lines = [
            f"SHOT {s['id']:02d} — {s['title'].upper()}  [{s['timecode']}]",
            f"ACT {act['id']}: {act['title'].upper()} ({act['time']})",
            "",
            "[STYLE ANCHOR]",
            film["style_anchor"],
            "",
            "[VIDEO PROMPT]",
            s["video_prompt"],
            "",
            "[CAMERA]",
            s["camera"],
        ]
        if s.get("voiceover"):
            lines.append("")
            for v in s["voiceover"]:
                lines.append(f"[VOICEOVER - {v['speaker']}]: \"{v['text']}\"")
        if s.get("dialogue"):
            lines.append("")
            for d in s["dialogue"]:
                lines.append(f"[DIALOGUE - {d['speaker']}]: \"{d['text']}\"")
        lines += ["", f"[SFX]: {s['sfx']}"]
        if s.get("music"):
            lines.append(f"[MUSIC]: {s['music']}")
        if s.get("graphics"):
            lines.append(f"[GRAPHICS]: {s['graphics']}")
        lines += ["", "[NEGATIVE PROMPT]", film["negative_prompt"]]

        path = os.path.join(outdir, f"shot_{s['id']:02d}.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        count += 1

print(f"Wrote {count} prompt files to {outdir}")
