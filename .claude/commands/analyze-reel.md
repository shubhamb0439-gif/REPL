---
description: Break down a reel's hook, pacing, payoff and retention, and say how to fix it
argument-hint: <video path or URL>
---
Analyse this reel: $ARGUMENTS

Steps:
1. Prepare it: `bash engine/scripts/analyze-reel.sh "$ARGUMENTS"` → prints the analysis folder
   (frames at 2 fps in `frames/`, `transcript.txt` if Whisper is installed, `meta.json` from ffprobe).
   If it fails because a tool is missing (ffmpeg, ffprobe, yt-dlp), do NOT try to install anything (no pip/winget/npm).
   Stop and reply with one plain sentence: which tool is missing and that the user should run
   `winget install Gyan.FFmpeg` / `winget install yt-dlp.yt-dlp` and restart RYPL. If a URL download fails for
   another reason (private reel, login required), say so and suggest uploading the .mp4 instead.
2. Look at the frames in order (Read each image). Note: hook (first 3 frames), cut points, on-screen text,
   when the payoff/result appears, and whether the last frame loops into the first.
   For reels over 15s, read all of the first 6 frames, then every 2nd frame, plus the last 2.
3. If `engine/data/performance.json` has real retention / watch-time data for this reel, use it.
   Otherwise ESTIMATE the curve from structure and say so in `title`.
   If the user dropped a screenshot of Instagram's retention graph in the folder (`retention.png`), read it and use it.
4. Compare to the viral benchmark: ~75% retained at 3s, ~50% at the end for 15s reels.
5. Save the result to `<analysis folder>/analysis.json`.

Final message = this JSON only:
{
  "title": string,
  "score": number,                                   // 0–100 viral potential
  "curve": [{ "s": number, "you": number, "viral": number }],  // every 0.5s, % retained
  "drops": [{ "s": number, "why": string }],         // s must match a curve point
  "metrics": [{ "label": string, "value": string, "verdict": "good"|"ok"|"bad" }],
  "fixes": string[]                                  // 3–5, concrete and ordered by impact
}
