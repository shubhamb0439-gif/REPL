---
description: Learn the brand from a website (and Instagram captions) and propose a Brand Brain profile
argument-hint: <website URL>
---
Learn this business from its website: $ARGUMENTS

1. Run `node engine/scripts/fetch-site.mjs "<url>"`. It renders the site in a real browser (works for React / 3D /
   JavaScript sites), follows up to 4 key internal pages, and prints the path of a JSON file — Read that file.
   It contains each page's visible text and the colours actually used (with where they're used: buttons, headings…).
   Only if the script fails or every page has almost no text, fall back to WebFetch on the homepage.
2. If `engine/data/performance.json` exists, read the captions there — they show how the brand actually talks on
   Instagram. Also read `engine/brand/brand.json` (current profile) so you can keep anything the user wrote that
   the site doesn't contradict.
3. Work out the **main brand** (the company) and its **products / product lines**. Each distinct product with its own
   name and audience becomes a sub-brand (e.g. a company "Acme" with products "Acme Pay" and "Shipfast").
   Services the main company sells directly stay as main-brand services.
4. Only use facts from the site or captions. Never invent prices, client names, numbers or claims. If something isn't
   stated, leave the field out rather than guessing.
   Colours: take them from the `colors` list in the fetched JSON. primary = the most-used non-neutral colour on
   buttons/links/headings; bg = the page background; secondary/accent = the next distinct brand colours (skip
   near-black/near-white/greys unless the brand is clearly monochrome). Never pick colours yourself or copy them from
   the current profile — if the list has no usable colours, omit `colors`.
5. If the website couldn't be fetched or has no real content, say so first in `notes`, and don't present the current
   profile as if it came from the site.
6. Products that are their own named offering (e.g. "Recipto", "RYPL") are sub-brands even if the main brand also
   lists them as services — list each one in `subBrands` and keep `services` for what the main company does itself.

Final message = this JSON only:
{
  "name": string,
  "tagline": string,                 // their own line if they have one, ≤ 10 words
  "about": string,                   // 2–3 sentences: what the company does, for whom
  "services": string[],              // what the main brand sells / does
  "audience": string,
  "tone": string[],                  // 3–5 adjectives inferred from site + captions
  "avoid": string[],                 // 2–4 things that would be off-brand
  "cta": string,                     // their main call to action
  "handle"?: string,
  "colors"?: { "primary": "#RRGGBB", "secondary": "#RRGGBB", "accent": "#RRGGBB", "bg": "#RRGGBB" },
  "subBrands": [{ "name": string, "tagline": string, "about": string, "services": string[], "audience": string, "cta": string }],
  "sources": string[],               // URLs you actually read
  "notes": string                    // one or two lines: anything uncertain the user should check
}
