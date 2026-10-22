---
description: Write a ready-to-film brief for a reel you shoot yourself
argument-hint: <idea or topic> [--occasion "Diwali"]
---
Write a **shoot brief** for a reel the founder will film on a phone. Topic: $ARGUMENTS

Steps:
1. Follow the "Always, before creating anything" checklist in CLAUDE.md.
2. Check `engine/analysis/` for recent competitor/viral breakdowns and borrow their *structure*, never their content.
3. Keep it filmable in under 30 minutes with one person and a phone.

Final message = this JSON only:
{
  "format": "shoot",
  "headline": string, "sub": string, "cta": string,
  "caption": string, "hashtags": string[], "layout": "bold",
  "brief": {
    "concept": string,
    "hook": { "line": string, "onScreen": string, "visual": string },
    "beats": [{ "time": "0–2s", "action": string, "say": string }],
    "shots": string[],
    "audio": string,          // say if a trending sound is recommended
    "length": "12–15s",
    "props": string[]
  },
  "postTime": string, "rationale": string[],
  "publish": "manual"
}
