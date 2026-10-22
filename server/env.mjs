// Load server/.env (Node 20.12+). Imported first by index.mjs.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'))
} catch {
  /* no .env yet — defaults apply */
}

// Windows: terminals (esp. inside VS Code) keep the PATH from when they were opened, so tools installed
// later (ffmpeg, yt-dlp via winget) are invisible. Merge in the current Machine + User PATH from the registry.
if (process.platform === 'win32') {
  try {
    const fresh = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"],
      { encoding: 'utf8', timeout: 10_000 },
    ).trim()
    const seen = new Set()
    process.env.PATH = [...(process.env.PATH ?? '').split(';'), ...fresh.split(';')]
      .filter((p) => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()))
      .join(';')
  } catch {
    /* keep the inherited PATH */
  }
}
