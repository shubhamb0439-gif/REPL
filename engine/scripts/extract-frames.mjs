import { execSync, spawnSync } from 'child_process';
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const FFMPEG = ffmpegInstaller.path;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
if (!SRC) { console.error('Usage: node extract-frames.mjs <video.mp4>'); process.exit(1); }

const ID = 'reel-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const DIR = join(ROOT, 'analysis', ID);
mkdirSync(join(DIR, 'frames'), { recursive: true });

const destVideo = join(DIR, 'reel.mp4');
copyFileSync(SRC, destVideo);

// Get metadata from ffmpeg -i (outputs to stderr)
const metaRaw = spawnSync(FFMPEG, ['-i', destVideo], { encoding: 'utf8' });
const metaText = metaRaw.stderr || '';

// Parse duration
const durMatch = metaText.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
const duration = durMatch
  ? parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3])
  : null;

// Parse resolution
const resMatch = metaText.match(/(\d{2,5})x(\d{2,5})/);
const width = resMatch ? parseInt(resMatch[1]) : null;
const height = resMatch ? parseInt(resMatch[2]) : null;

// Parse fps
const fpsMatch = metaText.match(/([\d.]+)\s*fps/);
const fps = fpsMatch ? parseFloat(fpsMatch[1]) : null;

// Parse bitrate
const brMatch = metaText.match(/bitrate:\s*([\d.]+)\s*(\w+)\/s/);
const bitrate = brMatch ? `${brMatch[1]} ${brMatch[2]}/s` : null;

const meta = { duration, width, height, fps, bitrate, raw: metaText };
writeFileSync(join(DIR, 'meta.json'), JSON.stringify(meta, null, 2));

// Extract frames at 2 fps, max 360px wide
const framesResult = spawnSync(FFMPEG, [
  '-i', destVideo,
  '-vf', 'fps=2,scale=360:-2',
  join(DIR, 'frames', 'f_%03d.jpg')
], { encoding: 'utf8' });

// Scene-change detection
const sceneResult = spawnSync(FFMPEG, [
  '-i', destVideo,
  '-vf', "select='gt(scene,0.3)',showinfo",
  '-f', 'null', '-'
], { encoding: 'utf8' });

const cuts = [];
const cutRegex = /pts_time:([\d.]+)/g;
let m;
while ((m = cutRegex.exec(sceneResult.stderr)) !== null) {
  cuts.push(parseFloat(m[1]));
}
writeFileSync(join(DIR, 'cuts.txt'), cuts.join('\n'));

const frameCount = spawnSync('ls', [join(DIR, 'frames')], { encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean).length;
console.log(DIR);
console.log(`frames: ${frameCount} · cuts: ${cuts.length} · duration: ${duration?.toFixed(1)}s`);
console.log(JSON.stringify({ dir: DIR, duration, width, height, fps, bitrate, cuts }));
