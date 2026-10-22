---
description: Create a static post or carousel from the Brand Brain and render it to PNG
argument-hint: <topic> [--occasion "Diwali"] [--carousel] [--assets "engine/uploads/a.jpg,engine/uploads/b.png"]
---
Create an Instagram **post** (or a 5-slide **carousel** if `--carousel` is present) about: $ARGUMENTS

**Work fast — this runs unattended with a time limit.** Read only brand.md, style.json, playbook.md (and any guideline
files / `--assets` images they point to). Don't open old specs or scripts, and don't use python — to vary from recent
posts, just look at the folder names in `engine/out/`. Decide the design quickly, write spec.json in one go, render,
check, done.

Steps:
1. Follow the "Always, before creating anything" checklist in CLAUDE.md.
2. If `--assets` is present, Read each image to see what it shows (product shot, team photo, screenshot…) and build
   the design around it. Write copy that matches what's in the image.
3. **Design it yourself — don't reuse a stock layout.** Write the creative as HTML/CSS in the spec's `html` field
   (post) or in each slide's `html` (carousel). The canvas is 1080×1350; your HTML fills `.frame` (position:relative).
   - Brand: colours are CSS vars `var(--primary) var(--secondary) var(--accent) var(--bg)`; follow `brand.md`
     guidelines and any guideline files it lists. Fonts: Inter and Unbounded are loaded; add Google Fonts by name in
     `"fonts": ["Space Grotesk"]` if the brand guidelines or the idea call for it.
   - Logo: `<img class="logo" src="{{LOGO}}">` — transparent and cropped, works on any background. The `.logo`
     class sets its size from Brand Brain (Logo size) — don't override height/width. Use it on every post and on the
     first + last carousel slide, with clear space around it (≥ 60px from edges). Never redraw it as text.
   - Uploaded images: `<img src="{{IMG:engine/uploads/…}}">` (object-fit: cover, add a gradient for text contrast).
   - Vary the composition from post to post — glance at the recent folder names in `engine/out/` and pick a
     different structure than those topics likely used. Pick an idea that fits the message: big type, stat callout, before/after split, chat/phone mock-up,
     checklist, quote card, UI screenshot frame, bold photo crop… Use real hierarchy (one focal point), generous
     margins (≥ 80px), ≤ 3 text sizes, high contrast. Text must read at phone size (body ≥ 32px).
   - Carousels: slide 1 is a thumb-stopping hook, slides 2–4 deliver, slide 5 is the CTA; keep one visual system
     across slides (same margins, type, accent) with a progress cue.
   - The old fixed layouts still work (omit `html`, set `layout`: bold | split | minimal | festive | photo) — use
     them only as a fallback if a custom design keeps failing.
3b. **AI pictures (only if `--ai-images` is in the arguments).** You can't draw photos or rich illustrations in HTML,
   so when a real picture would clearly make this post stronger — a scene, a product in use, a person/situation, a
   mood shot, a 3D-style object — generate ONE (max 2 for carousels/reels):
   `node engine/scripts/gen-image.mjs --out engine/out/<slug>/hero.png --size portrait "<prompt>"`
   (`--size landscape|square` also work; ~15–40s.) Prompt: describe only the picture — subject, setting, lighting,
   camera/style, and the brand colour mood (e.g. "deep navy and electric blue"). Never ask for text, words, numbers,
   logos or UI labels — RYPL adds the real headline and logo on top in HTML. Then use it as
   `{{IMG:engine/out/<slug>/hero.png}}` (object-fit: cover, plus a gradient where text sits). Skip it for pure
   typography / stat / checklist ideas, and if the script fails just design without it.
4. Write the spec to `engine/out/<slug>/spec.json` where `<slug>` is a short kebab-case name + today's date.
   This is the complete format — you don't need to look at the renderer, template or samples:
   ```json
   {
     "format": "post",
     "fonts": ["Space Grotesk"],
     "html": "<div style=\"position:absolute;inset:0;background:var(--bg);padding:90px;display:flex;flex-direction:column;justify-content:space-between;font-family:'Space Grotesk'\"><img class=\"logo\" src=\"{{LOGO}}\"><div><div style=\"font-size:30px;letter-spacing:.2em;color:var(--primary)\">KICKER</div><h1 style=\"font-size:104px;line-height:.95;margin-top:24px\">Headline here</h1><p style=\"font-size:38px;margin-top:32px;opacity:.75\">One supporting line.</p></div><div style=\"font-size:32px;color:var(--primary)\">CTA →</div></div>"
   }
   ```
   Carousel: `{ "format": "carousel", "fonts": [...], "slides": [{ "html": "…" }, …5] }`. Body text is white by default.
   Decide the design once, then write it — don't redesign after writing.
5. Render: `node engine/scripts/render-post.mjs engine/out/<slug>/spec.json`
   (creates `post.png` or `slide-1.png … slide-5.png` in the same folder).
6. Look at the rendered PNG — for a carousel, slide 1 and the slide with the most text. Fix overflow, clipping,
   weak contrast or a logo that's missing / too small, and re-render (max 2 retries).

Final message = this JSON only:
{
  "format": "post" | "carousel",
  "headline": string,          // ≤ 9 words
  "sub": string,               // one sentence
  "cta": string,
  "caption": string,           // full caption with line breaks, no hashtags
  "hashtags": string[],
  "layout": "bold" | "split" | "minimal" | "festive" | "photo",
  "slides": [{ "title": string, "body": string, "image"?: string }],   // carousel only, 5 items
  "postTime": string,          // e.g. "Fri · 8:00 PM" from playbook
  "rationale": string[],       // cite playbook rules, e.g. "Rule #1: pain-point hook"
  "files": string[],           // rendered PNG paths
  "publish": "auto"
}
