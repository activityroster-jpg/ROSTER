import { spawn, spawnSync } from "node:child_process";

/** The ffmpeg to use: $FFMPEG, then ffmpeg on the PATH, then the one bundled with the imageio-ffmpeg Python package. */
function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  if (spawnSync("ffmpeg", ["-version"]).status === 0) return "ffmpeg";
  const py = process.env.PYTHON || "python3";
  const r = spawnSync(py, ["-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  throw new Error("ffmpeg not found: install it, or `pip install imageio-ffmpeg`, or set FFMPEG");
}
export const FFMPEG = findFfmpeg();

/** Run ffmpeg; rejects with the tail of its log on failure. */
export function ffmpeg(args, { quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ["-hide_banner", "-y", ...(quiet ? ["-loglevel", "error"] : []), ...args]);
    let err = "";
    p.stderr.on("data", (d) => { err += d; });
    p.on("close", (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg failed (${code}): ${err.slice(-1500)}`))));
  });
}

/** Seconds of a media file, read from ffmpeg's own report. */
export async function durationOf(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr);
  if (!m) throw new Error(`Couldn't read the length of ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}
