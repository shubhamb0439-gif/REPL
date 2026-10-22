---
description: Plan next week's content (posts, carousels, reels, shoot briefs)
argument-hint: [--from YYYY-MM-DD --to YYYY-MM-DD] [focus, e.g. "website design for gyms"]
---
Plan 7 days of content. Arguments: $ARGUMENTS
If `--from`/`--to` are given, plan exactly those dates; otherwise plan next Monday–Sunday.

1. Follow the CLAUDE.md checklist. Check `moments.json` for anything in the range and the 7 days after it.
2. Read `engine/data/plan.json` if it exists — don't duplicate items already planned for these dates, and don't
   repeat hooks used in the last 14 days.
3. Mix for the week: 3 reels (at least 1 is a `shoot` brief the owner films), 2 carousels, 2 posts — one item per day.
   Use playbook posting times. Festivals in range get a warm, light-touch item on the day.
4. If the brand has sub-brands (`engine/brand/brand.json` → `subBrands`), spread items across them only when the
   focus asks for it; otherwise plan for the main brand.
5. Write `engine/out/week-<from-date>/plan.md` as a table: day · time · format · hook · angle.

Final message = this JSON only:
{
  "week": string,
  "items": [{
    "date": "YYYY-MM-DD",
    "time": "HH:MM",                                  // 24h, local
    "format": "post" | "carousel" | "reel" | "shoot",  // reel = motion graphics, shoot = filmed by the owner
    "hook": string,                                   // ≤ 9 words — becomes the item title
    "angle": string,                                  // one line: what the creative says / shows
    "occasion"?: string                               // exact name from moments.json, if tied to one
  }]
}
