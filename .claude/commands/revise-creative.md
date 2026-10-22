---
description: Make a targeted change to an existing post, carousel or reel and re-render it
argument-hint: <engine/out/<slug>> <what to change>
---
Revise an existing creative. Arguments: $ARGUMENTS
(The first word is the creative's folder; the rest is the change the user wants.)

**This is an edit, not a redesign.** Change only what was asked; keep everything else exactly as it is.

1. Read the design file in that folder: `spec.json` (post/carousel) or `reel.json` (reel) — and `voice.json` if the
   change touches the voiceover. Read `engine/brand/brand.md` only if the change depends on brand rules.
2. Edit the file with the smallest change that does what was asked (Edit tool, not a full rewrite).
   Placeholders stay as they are: `{{LOGO}}`, `{{IMG:…}}`, `class="logo"`.
   - Reels: if you change a voiceover line, update `voice.json` and re-run
     `node engine/scripts/make-voice.mjs <folder>/voice.json`, then shift the matching animation timing.
   - If the change needs a new AI picture and `--ai-images` was allowed before, you may run
     `node engine/scripts/gen-image.mjs --out <folder>/hero2.png "<prompt>"`.
3. Re-render: `node engine/scripts/render-post.mjs <folder>/spec.json` or
   `node engine/scripts/render-reel.mjs <folder>/reel.json`, then look at the PNG / cover.jpg once.
4. If the user asked to change the caption or hashtags, write the new ones; otherwise leave them out.

Final message = this JSON only:
{ "files": string[], "caption"?: string, "hashtags"?: string[], "headline"?: string, "change": string }
