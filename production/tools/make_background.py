#!/usr/bin/env python3
"""
Procedural background-sound generator for
THE SECRET MAP IN THE TREEHOUSE (full 10:00 timeline)

Synthesizes 9 per-act ambience beds + one full-length master track.
Pure numpy synthesis (no samples, no external assets):

  Act I    0:00-0:45  treehouse afternoon  breeze, songbirds, soft wood tapping
  Act II   0:45-1:40  cottage porch        breeze, wind chimes, sparrows
  Act III  1:40-3:00  whispering forest    deep wind, leaf rustle, distant owl
  Act IV   3:00-4:20  river crossing       roaring rapids, splashes
  Act V    4:20-6:00  cavern puzzle        low rumble, echoing drips
  Act VI   6:00-7:15  collapse & escape    rumble, rockfalls, escape to open air
  Act VII  7:15-8:45  meadow dusk          crickets, evening breeze
  Act VIII 8:45-9:35  porch at night       crickets, wind chimes, owl
  Act IX   9:35-10:00 midnight mystery     crickets fade, magical drone + pulse

Output: production/assets/audio/bg/
  act_01 .. act_09, background_full   (.mp3 if lameenc available, else .wav)

Re-run:  python3 tools/make_background.py
"""
import os
import wave

import numpy as np

SR = 44100
RNG = np.random.default_rng(1968)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets", "audio", "bg")
os.makedirs(OUT, exist_ok=True)

try:
    import lameenc
    EXT = ".mp3"
except ImportError:
    lameenc = None
    EXT = ".wav"

# ---------------- helpers ----------------

def sec(n):
    return int(round(n * SR))

def fft_filter(x, gain):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1.0 / SR)
    return np.fft.irfft(X * gain(f), len(x))

def lowpass(x, fc, order=2.0):
    fc = max(fc, 1.0)
    return fft_filter(x, lambda f: 1.0 / (1.0 + (f / fc) ** (2 * order)))

def highpass(x, fc, order=2.0):
    fc = max(fc, 1.0)
    r = lambda f: (f / fc) ** (2 * order) / (1.0 + (f / fc) ** (2 * order))
    return fft_filter(x, r)

def bandpass(x, lo, hi):
    return highpass(lowpass(x, hi), lo)

def slow_env(dur, rate=0.25, depth=0.7, base=1.0):
    """slowly wandering envelope for gusts/swells"""
    n = max(2, int(dur * rate))
    pts = base * (1.0 - depth * RNG.random(n))
    t = np.linspace(0, dur, n)
    return np.interp(np.arange(sec(dur)) / SR, t, pts)

def place(buf, at_sec, clip):
    i = sec(at_sec)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(clip))
    buf[i:j] += clip[: j - i]

def rms(x):
    return float(np.sqrt(np.mean(x ** 2)) + 1e-12)

# ---------------- sound layers ----------------

def breeze(dur, fc=600):
    x = lowpass(RNG.standard_normal(sec(dur)), fc)
    x *= slow_env(dur, 0.2, 0.7, base=0.8)
    return x / rms(x)

def leaves(dur):
    x = bandpass(RNG.standard_normal(sec(dur)), 1500, 6500)
    x *= slow_env(dur, 0.35, 0.85, base=0.35)
    return x / rms(x)

def bird_chirp():
    dur = RNG.uniform(0.10, 0.2)
    reps = int(RNG.integers(2, 5))
    out = np.zeros(sec(reps * (dur + 0.09)))
    f0 = RNG.uniform(2300, 3800)
    for r in range(reps):
        t = np.arange(sec(dur)) / SR
        f = f0 * (1.0 + 0.3 * t / dur) * RNG.uniform(0.96, 1.04)
        ph = 2 * np.pi * np.cumsum(f) / SR
        s = np.sin(ph) * np.hanning(len(t))
        place(out, r * (dur + 0.09), s)
    return out * RNG.uniform(0.5, 1.0)

def songbirds(dur, density=0.25):
    buf = np.zeros(sec(dur))
    for tt in RNG.uniform(0, dur, max(1, int(dur * density))):
        place(buf, tt, bird_chirp())
    if rms(buf) < 1e-9:
        return buf
    return buf / rms(buf)

PENTA = [440.0, 523.25, 587.33, 659.25, 783.99, 880.0]

def chime_note(freq):
    dur = 3.5
    t = np.arange(sec(dur)) / SR
    x = (np.sin(2 * np.pi * freq * t)
         + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t)
         + 0.15 * np.sin(2 * np.pi * freq * 5.4 * t))
    x *= np.exp(-t * 1.1)
    k = max(1, sec(0.01))
    x[:k] *= np.linspace(0, 1, k)
    return x

def windchimes(dur, density=0.12):
    buf = np.zeros(sec(dur))
    for tt in RNG.uniform(0, dur, max(1, int(dur * density))):
        place(buf, tt, chime_note(float(RNG.choice(PENTA))) * RNG.uniform(0.35, 1.0))
    if rms(buf) < 1e-9:
        return buf
    return buf / rms(buf)

def wood_taps(dur):
    """Leo's toy mallet on floorboards (first third of the act)"""
    buf = np.zeros(sec(dur))
    t = 0.8
    while t < dur * 0.33:
        n = sec(0.06)
        knock = np.sin(2 * np.pi * 190 * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 45)
        knock += lowpass(RNG.standard_normal(n), 1500) * 0.4 * np.exp(-np.arange(n) / SR * 60)
        place(buf, t, knock * 0.8)
        t += RNG.uniform(0.55, 1.1)
    if rms(buf) < 1e-9:
        return buf
    return buf / rms(buf)

def rapids(dur):
    a = lowpass(RNG.standard_normal(sec(dur)), 2200)
    b = bandpass(RNG.standard_normal(sec(dur)), 2500, 7000) * 0.45
    x = a + b
    x *= slow_env(dur, 0.15, 0.25, base=0.95)
    return x / rms(x)

def splash():
    dur = RNG.uniform(0.25, 0.5)
    x = bandpass(RNG.standard_normal(sec(dur)), 800, 6500)
    t = np.arange(len(x)) / SR
    x *= np.exp(-t * 8)
    return x

def splashes(dur, density=0.25):
    buf = np.zeros(sec(dur))
    for tt in RNG.uniform(0, dur, max(1, int(dur * density))):
        place(buf, tt, splash() * RNG.uniform(0.4, 1.0))
    if rms(buf) < 1e-9:
        return buf
    return buf / rms(buf)

def rumble(dur, fc=110):
    x = lowpass(RNG.standard_normal(sec(dur)), fc, order=1.5)
    x *= slow_env(dur, 0.12, 0.6, base=0.8)
    return x / rms(x)

def drip():
    f = RNG.uniform(900, 2100)
    dur = 0.3
    t = np.arange(sec(dur)) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 14)
    out = np.zeros(sec(0.95))
    place(out, 0.0, x)
    place(out, 0.22, x * 0.4)
    place(out, 0.45, x * 0.15)
    return out

def drips(dur, density=0.35):
    buf = np.zeros(sec(dur))
    for tt in RNG.uniform(0, dur, max(1, int(dur * density))):
        place(buf, tt, drip() * RNG.uniform(0.4, 1.0))
    if rms(buf) < 1e-9:
        return buf
    return buf / rms(buf)

def thump(f=70.0):
    dur = 0.5
    t = np.arange(sec(dur)) / SR
    return np.sin(2 * np.pi * f * t * (1 - 0.3 * t)) * np.exp(-t * 7)

def rockfall_burst():
    dur = RNG.uniform(0.4, 0.8)
    n = lowpass(RNG.standard_normal(sec(dur)), 900)
    t = np.arange(len(n)) / SR
    env = np.exp(-t * 5)
    k = max(1, sec(0.02))
    env[:k] = np.linspace(0, 1, k)
    th = thump(float(RNG.uniform(55, 95))) * 0.8
    if len(th) < len(n):
        th = np.pad(th, (0, len(n) - len(th)))
    else:
        th = th[: len(n)]
    return n * env + th

def rockfalls(dur, t0, t1, density_ramp=(0.08, 0.5)):
    buf = np.zeros(sec(dur))
    t = t0
    while t < t1:
        frac = (t - t0) / max(t1 - t0, 1e-6)
        dens = density_ramp[0] + (density_ramp[1] - density_ramp[0]) * frac
        place(buf, t, rockfall_burst() * RNG.uniform(0.5, 1.0))
        t += RNG.uniform(0.6, 1.6) * (1.0 / max(dens * 6, 0.3))
    if rms(buf) < 1e-9:
        return buf
    return buf / rms(buf)

def cricket_train():
    n_pulse = int(RNG.integers(3, 6))
    train = np.zeros(sec(0.45))
    for k in range(n_pulse):
        n = sec(0.03)
        s = np.sin(2 * np.pi * 4400 * np.arange(n) / SR) * np.hanning(n)
        place(train, k * 0.075, s)
    return train

def crickets(dur, individuals=4, fade_in=True, fade_out=True):
    buf = np.zeros(sec(dur))
    for _ in range(individuals):
        one = np.zeros(sec(dur))
        t = RNG.uniform(0.3, 1.5)
        f = RNG.uniform(4100, 4800)
        while t < dur - 0.8:
            tr = cricket_train()
            tt = np.arange(len(tr)) / SR
            tr = np.sin(2 * np.pi * f * tt) * tr  # tune pitch
            place(one, t, tr * RNG.uniform(0.5, 1.0))
            t += RNG.uniform(0.5, 1.7)
        buf += one * RNG.uniform(0.5, 1.0)
    # gentle global fades
    k = max(1, sec(2.0))
    if fade_in:
        buf[:k] *= np.linspace(0, 1, k)
    if fade_out:
        buf[-k:] *= np.linspace(1, 0, k)
    if rms(buf) < 1e-9:
        return buf
    return buf / rms(buf)

def owl_call():
    def hoot(f, dur=0.35):
        t = np.arange(sec(dur)) / SR
        vib = 1.0 + 0.012 * np.sin(2 * np.pi * 6 * t)
        return np.sin(2 * np.pi * f * vib * t) * np.hanning(len(t))
    out = np.zeros(sec(1.4))
    place(out, 0.0, hoot(360))
    place(out, 0.55, hoot(320))
    return out

def owls(dur, calls=2):
    buf = np.zeros(sec(dur))
    for tt in RNG.uniform(dur * 0.2, dur * 0.9, calls):
        place(buf, tt, owl_call() * RNG.uniform(0.6, 1.0))
    if rms(buf) < 1e-9:
        return buf
    return buf / rms(buf)

def drone(dur):
    t = np.arange(sec(dur)) / SR
    x = (np.sin(2 * np.pi * 110 * t)
         + np.sin(2 * np.pi * 110.7 * t)
         + 0.7 * np.sin(2 * np.pi * 165 * t)
         + 0.5 * np.sin(2 * np.pi * 220.4 * t))
    swell = np.linspace(0.25, 1.0, len(t)) ** 1.5
    pulse = 0.85 + 0.15 * np.sin(2 * np.pi * 0.5 * t)
    return x * swell * pulse

def shimmer_rise(dur=3.0):
    t = np.arange(sec(dur)) / SR
    f = 500.0 * (2.0 ** (t / dur))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.linspace(0, 1, len(t)) ** 2

# ---------------- act beds ----------------

def mix(dur, layers, target_rms):
    """layers = [(weight, callable(dur)->signal), ...]"""
    buf = np.zeros(sec(dur))
    for w, fn in layers:
        s = fn(dur)
        if len(s) < len(buf):
            s = np.pad(s, (0, len(buf) - len(s)))
        buf += w * s[: len(buf)]
    buf = buf / rms(buf) * target_rms
    peak = np.max(np.abs(buf))
    if peak > 0.92:
        buf = np.tanh(buf * 1.2) / 1.2  # soft limiting
    k = max(1, sec(0.7))
    buf[:k] *= np.linspace(0, 1, k)
    buf[-k:] *= np.linspace(1, 0, k)
    return buf

def bed_collapse(dur):
    buf = np.zeros(sec(dur))
    open_air = dur - 10.0
    # rumble swelling until the escape
    r = rumble(dur, 100) * np.concatenate([
        np.linspace(0.5, 1.6, sec(open_air)),
        np.linspace(1.2, 0.05, sec(dur - open_air))])
    buf += r
    buf += rockfalls(dur, 1.0, open_air, (0.06, 0.55)) * 1.4
    # escape into open air: distant river + returning birds
    tail = np.zeros(sec(dur))
    n = sec(dur - open_air)
    tail_part = rapids(dur - open_air) * 0.5 + songbirds(dur - open_air, 0.15) * 0.4
    tail[sec(open_air):sec(open_air) + len(tail_part)] += tail_part
    buf += tail
    buf = buf / rms(buf) * 0.10
    peak = np.max(np.abs(buf))
    if peak > 0.92:
        buf = np.tanh(buf * 1.2) / 1.2
    k = max(1, sec(0.7))
    buf[:k] *= np.linspace(0, 1, k)
    buf[-k:] *= np.linspace(1, 0, k)
    return buf

ACTS = [
    ("act_01", 45.0, 0.075, [
        (1.0, lambda d: breeze(d)),
        (0.55, lambda d: songbirds(d, 0.30)),
        (0.5, wood_taps),
    ]),
    ("act_02", 55.0, 0.070, [
        (0.9, lambda d: breeze(d, 500)),
        (0.5, lambda d: windchimes(d, 0.12)),
        (0.4, lambda d: songbirds(d, 0.18)),
    ]),
    ("act_03", 80.0, 0.085, [
        (1.2, lambda d: lowpass(breeze(d), 350)),
        (0.8, leaves),
        (0.3, lambda d: songbirds(d, 0.10)),
        (0.35, lambda d: owls(d, 2)),
    ]),
    ("act_04", 80.0, 0.110, [
        (1.6, rapids),
        (0.8, lambda d: splashes(d, 0.28)),
        (0.3, lambda d: breeze(d, 400)),
    ]),
    ("act_05", 100.0, 0.090, [
        (1.0, lambda d: rumble(d, 110)),
        (0.6, lambda d: drips(d, 0.35)),
        (0.22, lambda d: bandpass(breeze(d), 300, 900)),
    ]),
    ("act_06", 75.0, None, None),  # custom: collapse & escape
    ("act_07", 90.0, 0.055, [
        (0.9, lambda d: crickets(d, 4)),
        (0.7, lambda d: breeze(d, 450)),
        (0.25, lambda d: songbirds(d, 0.07)),
    ]),
    ("act_08", 50.0, 0.055, [
        (1.0, lambda d: crickets(d, 4)),
        (0.35, lambda d: windchimes(d, 0.08)),
        (0.3, lambda d: owls(d, 1)),
    ]),
    ("act_09", 25.0, 0.095, [
        (0.55, lambda d: crickets(d, 2, fade_out=True)),
        (0.95, drone),
        (0.5, lambda d: np.pad(shimmer_rise(3.0), (sec(dur := 25.0) - sec(3.0), 0))),
    ]),
]

# ---------------- output ----------------

def save(name, x):
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767.0).astype("<i2")
    path = os.path.join(OUT, name + EXT)
    if lameenc is not None:
        enc = lameenc.Encoder()
        enc.set_bit_rate(128)
        enc.set_in_sample_rate(SR)
        enc.set_channels(1)
        enc.set_quality(2)
        data = enc.encode(pcm.tobytes()) + enc.flush()
        with open(path, "wb") as f:
            f.write(data)
    else:
        with wave.open(path, "wb") as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(SR)
            f.writeframes(pcm.tobytes())
    return path, len(pcm) / SR

def main():
    beds = []
    for name, dur, target, layers in ACTS:
        print(f"synthesizing {name} ({dur:.0f}s) ...", flush=True)
        if name == "act_06":
            bed = bed_collapse(dur)
        else:
            bed = mix(dur, layers, target)
        beds.append(bed)
        path, n = save(name, bed)
        print(f"  -> {os.path.basename(path)}  ({n:.1f}s)")

    print("synthesizing background_full (10:00 master) ...", flush=True)
    full = np.concatenate(beds)
    assert abs(len(full) / SR - 600.0) < 1.5, f"timeline mismatch: {len(full)/SR:.1f}s"
    path, n = save("background_full", full)
    print(f"  -> {os.path.basename(path)}  ({n:.1f}s)")
    print("DONE — outputs in", OUT)

if __name__ == "__main__":
    main()
