---
description: Create a motion-graphics reel (custom animated design, rendered to MP4)
argument-hint: <topic> [--occasion "Diwali"] [--assets "engine/uploads/a.jpg"]
---
Create a 9:16 **motion-graphics reel** about: $ARGUMENTS
Length: if the brief asks for one (e.g. "25 sec"), use it (max 60s); otherwise 12–15s.

**Work fast — this runs unattended with a time limit.** Everything you need is in this file: don't read
`render-reel.mjs`, `reel.html` or old reel specs, and don't use python. To vary from recent reels, just look at the
folder names in `engine/out/`. Write `reel.json` in one go, render once, check the cover, fix only real problems.

Steps:
1. Follow the "Always, before creating anything" checklist in CLAUDE.md. If `--assets` is present, Read each image
   and build scenes around them.
2. Script 4–6 beats (up to 8 for reels over 20s). Beat 1 is the hook (≤ 1.5s, pattern interrupt, no logo). Show the outcome by ~4s (playbook #2).
   End on a frame that loops back into the hook (playbook #5). Logo + CTA in the last ~2s.
3. **Design and animate it yourself** — every reel should look different. Write `engine/out/<slug>/reel.json`:
   ```json
   { "duration": 12, "fonts": ["Space Grotesk"], "html": "<div id='s1'>…</div>…", "script": "window.tl = gsap.timeline({ paused: true }); tl.from('#s1 h1', { y: 140, opacity: 0, duration: .6, ease: 'power4.out' }) …" }
   ```
   - Stage is 1080×1920. Put all key text inside `<div class="safe">` regions (or the same insets: top 240px,
     bottom 440px, left 80px, right 160px) — Instagram's UI covers the rest.
   - `script` must create ONE paused GSAP timeline on `window.tl` covering the whole `duration` (pad the end with
     `tl.to({}, { duration: … })`). GSAP 3 core is loaded. Animate with transforms/opacity/clip-path/scale; no
     `setTimeout`, `requestAnimationFrame`, CSS keyframe animations or video — the renderer seeks the timeline
     frame by frame.
   - Brand: CSS vars `var(--primary) var(--secondary) var(--accent) var(--bg)`; logo `<img class="logo" src="{{LOGO}}">` (size set by Brand Brain — don't override)
     (transparent, cropped); uploaded images `{{IMG:engine/uploads/…}}`.
   - Motion ideas: kinetic type (word-by-word slams, masked reveals), counters ticking up, a phone/chat mock-up
     with messages popping in, before/after wipes, UI cards stacking, scale punches on the key word. Cut every
     ~1–1.5s in the first 5s. Big type (headlines ≥ 96px), one idea per beat, high contrast.
   - Vary from the last reels in `engine/out/` — different layout, type and motion style.
   - **Music** — compose an original bed in `"music"` (synthesised by `engine/scripts/make-music.mjs`, royalty-free):
     ```json
     "music": { "bpm": 120, "style": "house", "chords": ["Am", "F", "C", "G"], "hits": [1.5, 4.0, 10.0], "energy": 0.85, "intro": 0 }
     ```
     Pick the style for the mood: `house` (upbeat, confident), `pop` (bright, friendly), `trap` (bold, punchy),
     `lofi` (calm, founder-story), `cinematic` (big reveals, launches), `ambient` (soft, festive/emotional).
     Minor chords feel tense/serious, major feel warm/positive. Optional `drums` overrides (16-step strings per
     bar, e.g. `"kick": "x...x...x...x..."`), `layers` ({ pad, bass, arp, drums, lead }), `intro` = bars before
     drums enter (keep 0 so the hook hits immediately).
     **Sync the edit to the music:** one beat = 60/bpm seconds (0.5s at 120 bpm). Start scenes on beats or bars,
     and put `hits` exactly on the 2–3 biggest moments (hook payoff, the outcome reveal, the CTA) — the music
     drops an impact there. Omit `music` only for a deliberately silent reel.
3b. **AI pictures (only if `--ai-images` is in the arguments).** You can't draw photos or rich illustrations in HTML,
   so when a real picture would clearly make this reel stronger — a scene, a product in use, a person/situation, a
   mood shot, a 3D-style object — generate ONE (max 2 for carousels/reels):
   `node engine/scripts/gen-image.mjs --out engine/out/<slug>/hero.png --size portrait "<prompt>"`
   (`--size landscape|square` also work; ~15–40s.) Prompt: describe only the picture — subject, setting, lighting,
   camera/style, and the brand colour mood (e.g. "deep navy and electric blue"). Never ask for text, words, numbers,
   logos or UI labels — RYPL adds the real headline and logo on top in HTML. Then use it as
   `{{IMG:engine/out/<slug>/hero.png}}` (object-fit: cover, plus a gradient where text sits). Skip it for pure
   typography / stat / checklist ideas, and if the script fails just design without it.
   In reels, animate pictures with slow scale/pan (Ken Burns) or masked reveals.
3c. **Voiceover** — add one if `--voiceover` is in the arguments or the brief asks for voice / voiceover /
   narration. Do it BEFORE animating, so scenes follow the voice:
   - Write `engine/out/<slug>/voice.json`:
     `{ "voice": "ash", "style": "Warm, confident, conversational. Indian English accent. Medium pace.", "lines": [{ "t": 0.3, "text": "…" }, …] }`
     Short, spoken-English lines (≤ 12 words each), one per beat; write numbers as words ("eleven forty-seven PM").
     Voices: ash/echo/onyx (male), coral/nova/shimmer/sage (female), alloy/verse (neutral). Match the brand tone.
   - Run `node engine/scripts/make-voice.mjs engine/out/<slug>/voice.json` — it prints each line's real start/end.
   - Time the animation to those numbers (the on-screen text for a line appears as it's spoken), make
     `duration` ≥ last line end + 1s, and set `"voiceover": true` in reel.json. Keep the music (it ducks
     automatically under the voice); use calmer music energy (≤ 0.7) under narration.
   - If make-voice fails, carry on without voice and mention it in the rationale.
4. Render: `node engine/scripts/render-reel.mjs engine/out/<slug>/reel.json`
   → `reel.mp4` (with music) + `cover.jpg`. Look at `cover.jpg`; if the script errors or the cover looks wrong, fix and re-render
   (max 2 retries).
5. Fallback only if custom rendering keeps failing: the Remotion template
   (`cd engine/remotion && npx remotion render src/index.ts RippleReel ../out/<slug>/reel.mp4 --props=../out/<slug>/spec.json`).

Final message = this JSON only:
{
  "format": "reel",
  "headline": string, "sub": string, "cta": string,
  "caption": string, "hashtags": string[], "layout": "bold",
  "scenes": [{ "t": "0.0s", "text": string, "motion": string }],
  "postTime": string, "rationale": string[],
  "files": ["engine/out/<slug>/reel.mp4", "engine/out/<slug>/cover.jpg"],
  "publish": "auto"
}
