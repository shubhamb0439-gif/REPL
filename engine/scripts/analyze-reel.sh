#!/usr/bin/env bash
# Usage: bash engine/scripts/analyze-reel.sh <video.mp4 | URL>
# Prepares a reel for Claude: frames @2fps, metadata, optional transcript.
# Requires: ffmpeg. Optional: yt-dlp (for URLs — only download reels you own or have permission to use), whisper (openai-whisper).
set -euo pipefail
SRC="${1:?video path or URL required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ID="reel-$(date +%Y%m%d-%H%M%S)"
DIR="$ROOT/analysis/$ID"
mkdir -p "$DIR/frames"

# Use bundled ffmpeg if system ffmpeg not available
if command -v ffmpeg >/dev/null 2>&1; then
  FFMPEG=ffmpeg
  FFPROBE=ffprobe
else
  FFMPEG="$ROOT/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe"
  FFPROBE="$FFMPEG"  # ffmpeg can also provide stream info
fi

if [[ "$SRC" =~ ^https?:// ]]; then
  command -v yt-dlp >/dev/null || { echo "yt-dlp not installed — download the reel manually and pass the .mp4" >&2; exit 1; }
  yt-dlp -q -f mp4 -o "$DIR/reel.mp4" "$SRC"
  echo "$SRC" > "$DIR/source.txt"
else
  cp "$SRC" "$DIR/reel.mp4"
fi

# Extract metadata via ffmpeg -i (outputs to stderr)
"$FFMPEG" -i "$DIR/reel.mp4" 2>"$DIR/meta.txt" || true
# Parse metadata into JSON using awk
awk 'BEGIN{d="";w="";h="";f="";b=""}
  /Duration/{match($0,/Duration: ([0-9:\.]+)/,a); d=a[1]}
  /[0-9]+x[0-9]+/{match($0,/([0-9]+)x([0-9]+)/,a); w=a[1]; h=a[2]}
  /[0-9.]+ fps/{match($0,/([0-9.]+) fps/,a); f=a[1]}
  /bitrate:/{match($0,/bitrate: ([0-9]+ [a-z]+\/s)/,a); b=a[1]}
  END{printf "{\"duration\":\"%s\",\"width\":\"%s\",\"height\":\"%s\",\"fps\":\"%s\",\"bitrate\":\"%s\"}\n",d,w,h,f,b}
' "$DIR/meta.txt" > "$DIR/meta.json"

"$FFMPEG" -loglevel error -i "$DIR/reel.mp4" -vf "fps=2,scale=360:-2" "$DIR/frames/f_%03d.jpg"
# scene-change timestamps = cut points
"$FFMPEG" -loglevel info -i "$DIR/reel.mp4" -vf "select='gt(scene,0.3)',showinfo" -f null - 2>"$DIR/scene.txt" || true
grep -o 'pts_time:[0-9.]*' "$DIR/scene.txt" | cut -d: -f2 > "$DIR/cuts.txt" || true

if command -v whisper >/dev/null; then
  whisper "$DIR/reel.mp4" --model base --output_format txt --output_dir "$DIR" >/dev/null 2>&1 && mv "$DIR/reel.txt" "$DIR/transcript.txt" || true
fi

echo "$DIR"
echo "frames: $(ls "$DIR/frames" | wc -l) · cuts: $(wc -l < "$DIR/cuts.txt") · transcript: $([ -f "$DIR/transcript.txt" ] && echo yes || echo no)"
