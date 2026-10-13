/**
 * Make the how-to videos: node videos/make.mjs [--only 6,7]
 *
 * For each video with a script in videos/scripts: voice every line, sign in
 * to the local demo centre, record the scripted walk-through, add the logo
 * intro, the "Video N of T" card and the outro, lay the narration over it at
 * the right moments, and write captions, chapters, a thumbnail and a YouTube
 * description. Output: videos/out/<NN-slug>/.
 *
 * Needs the app running locally with the video seed (see the Make videos
 * workflow). Env: VIDEO_BASE (default http://demo.localhost:8788), DEV_LOG
 * (the dev server's log, for the sign-in code), PW_CHROMIUM (optional browser
 * path), and a voice key (see lib/tts.mjs).
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { SERIES, byNumber } from "./series.mjs";
import { voiceLines } from "./lib/tts.mjs";
import { brandAudio } from "./lib/brand-audio.mjs";
import { renderCard, renderThumb, FPS } from "./lib/cards.mjs";
import { OVERLAY, VIEWPORT, SCALE, recordSteps } from "./lib/record.mjs";
import { ffmpeg, durationOf } from "./lib/ffmpeg.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = process.cwd();
const OUT = join(ROOT, "videos", "out");
const WORK = join(ROOT, "videos", ".work");
const BASE = process.env.VIDEO_BASE || "http://demo.localhost:8788";
const LOG = process.env.DEV_LOG || "videos-dev.log";
const PASSWORD = "Manual-Shots-2027!";
const PIN = "4826";
const TOTAL = SERIES.length;
const only = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? new Set(process.argv[i + 1].split(",").map(Number)) : null; })();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const latestCode = () => {
  if (!existsSync(LOG)) return null;
  const all = [...readFileSync(LOG, "utf8").matchAll(/(\d{6}) is your ActivityRoster sign-in code/g)];
  return all.length ? all.at(-1)[1] : null;
};

async function signIn(browser, email, base) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, locale: "en-GB", timezoneId: "Europe/London" });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  page.setDefaultTimeout(240_000);
  await page.goto(`${base}/sign-in`);
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PASSWORD);
  const before = latestCode();
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
  if (page.url().includes("/verify-login")) {
    for (let i = 0; i < 240 && (latestCode() === before || !latestCode()); i++) await sleep(500);
    await page.getByLabel("Code").fill(latestCode());
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Yes, stay signed in/ }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/verify-login"));
  }
  if (page.url().includes("/pin")) {
    await page.locator('input[inputmode="numeric"]').first().fill(PIN);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/pin"));
  }
  return page;
}

const ts = (s, sep = ",") => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`; };
const chapterTs = (s) => { const t = Math.floor(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

/** Captions: each line split into readable cues (sentences packed up to ~84 characters, two lines each), timed by their share of the words. */
function chunkLine(text) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [text];
  const pieces = [];
  for (const sen of sentences) {
    if (sen.length <= 84) { pieces.push(sen); continue; }
    // A long sentence breaks at commas or colons, else between words.
    let cur = "";
    for (const part of sen.split(/(?<=[,:;])\s+/)) {
      if ((cur + " " + part).trim().length > 84 && cur) { pieces.push(cur.trim()); cur = part; } else cur = `${cur} ${part}`;
    }
    if (cur.trim()) pieces.push(cur.trim());
  }
  const out = [];
  for (const p of pieces.flatMap((p) => (p.length > 84 ? p.match(/.{1,80}(\s|$)/g).map((x) => x.trim()) : [p]))) {
    const last = out[out.length - 1];
    if (last && (last + " " + p).length <= 84) out[out.length - 1] = `${last} ${p}`; else out.push(p);
  }
  // Never leave a tiny last cue on its own.
  if (out.length > 1 && out[out.length - 1].length < 24) { const t = out.pop(); out[out.length - 1] += ` ${t}`; }
  return out;
}
const wrap2 = (c) => { if (c.length <= 42) return c; const mid = Math.floor(c.length / 2); let at = c.lastIndexOf(" ", mid); const after = c.indexOf(" ", mid); if (at < 0 || (after > 0 && after - mid < mid - at)) at = after; return at > 0 ? `${c.slice(0, at)}\n${c.slice(at + 1)}` : c; };
function captions(lines, starts, durations) {
  const cues = [];
  lines.forEach((text, i) => {
    const chunks = chunkLine(text);
    const total = chunks.reduce((n, c) => n + c.length, 0);
    let at = starts[i];
    for (const c of chunks) {
      const len = durations[i] * (c.length / total);
      cues.push({ from: at, to: at + len, text: wrap2(c) });
      at += len;
    }
  });
  return cues.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join("\n");
}

async function makeVideo(browser, meta, script) {
  const name = `${String(meta.n).padStart(2, "0")}-${meta.slug}`;
  const work = join(WORK, name);
  const out = join(OUT, name);
  rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true }); mkdirSync(out, { recursive: true });
  const steps = script.steps;
  console.log(`\n▶ Video ${meta.n} of ${TOTAL}: ${meta.title} (${steps.length} lines)`);

  // 1. Voice
  const voice = await voiceLines(steps.map((s) => s.say));
  console.log(`  voice: ${voice.provider.label}; narration ${voice.lines.reduce((n, l) => n + l.seconds, 0).toFixed(1)}s`);

  // 2. Record (a script can use another made-up centre: host "newcentre" → newcentre.localhost)
  const base = script.host ? BASE.replace("//demo.", `//${script.host}.`) : BASE;
  const page = await signIn(browser, script.who ?? "sam@demo.example", base);
  for (const path of script.warm ?? []) { await page.goto(`${base}${path}`); await page.waitForLoadState("networkidle").catch(() => {}); }
  await page.goto(`${base}${script.start}`); await page.waitForLoadState("networkidle").catch(() => {});
  if (script.prepare) await script.prepare(page);
  await sleep(800);
  const thumbAt = Math.max(0, steps.findIndex((s) => s.thumb));
  const warnings = [];
  const guarded = steps.map((s, i) => ({ ...s, do: s.do ? async (h) => { try { await s.do(h); } catch (e) { warnings.push(`line ${i + 1}: ${String(e).split("\n")[0]}`); console.log(`  ⚠ line ${i + 1}: ${String(e).split("\n")[0]}`); } } : undefined }));
  // VIDEO_DRY=1: play the steps quickly and report what didn't work, without making the video.
  const dry = Boolean(process.env.VIDEO_DRY);
  const rec = await recordSteps(page, guarded, voice.lines.map((l) => (dry ? 0.2 : l.seconds)), { base, workDir: work, thumbAt });
  if (dry) { await page.screenshot({ path: join(work, "end.png") }).catch(() => {}); }
  await page.context().close();
  if (dry) { console.log(warnings.length ? `  ${warnings.length} warning(s)` : "  all steps ran"); return { name, warnings }; }
  console.log(`  recorded ${rec.frames.length} frames, ${rec.end.toFixed(1)}s`);

  // 3. Main segment from the timed frames
  const list = rec.frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (rec.frames[i + 1]?.t ?? rec.end) - f.t).toFixed(4)}`).join("\n") + `\nfile '${rec.frames.at(-1).file}'\n`;
  writeFileSync(join(work, "frames.txt"), list);
  const main = join(work, "main.mp4");
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", join(work, "frames.txt"), "-vf", `scale=1920:1080:flags=lanczos,fps=${FPS},format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", String(FPS), main]);

  // 4. Intro and outro cards
  const next = meta.extra ? null : byNumber(meta.n + 1);
  const intro = join(work, "intro.mp4"), outro = join(work, "outro.mp4");
  const introLen = await renderCard(browser, { mode: "intro", n: meta.n, total: TOTAL, title: meta.title, ...(meta.extra ? { extra: 1 } : {}) }, intro, work);
  await renderCard(browser, { mode: "outro", n: meta.n, total: TOTAL, ...(meta.extra ? { extra: 1 } : next ? { next: next.title, nextN: next.n } : {}) }, outro, work);
  const mainLen = await durationOf(main);

  // 5. Picture: intro + walk-through + outro
  const picture = join(work, "picture.mp4");
  await ffmpeg(["-i", intro, "-i", main, "-i", outro, "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p[v]", "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", String(FPS), picture]);
  const total = await durationOf(picture);

  // 6. Sound: narration at each line's moment, the logo sting on the intro and
  //    the music bed under the title card and outro, levelled for YouTube.
  const starts = rec.marks.map((m) => introLen + m);
  const final = join(out, `${name}.mp4`);
  const voiced = voice.lines.map((l, i) => ({ ...l, at: starts[i] })).filter((l) => l.file);
  const brand = await brandAudio();
  const outroStart = introLen + mainLen, outroLen = total - outroStart;
  const fmt = "aformat=sample_rates=48000:channel_layouts=stereo";
  const inputs = [];
  const chains = [];
  const add = (file, chain) => { inputs.push("-i", file); const idx = inputs.length / 2; chains.push(`[${idx}:a]${fmt},${chain}[s${chains.length}]`); };
  for (const l of voiced) add(l.file, `adelay=${Math.round(l.at * 1000)}:all=1`);
  if (brand.sting) add(brand.sting, "volume=0.75,adelay=120:all=1");
  // A script can ask for the music bed quietly under the narration too (the homepage explainer).
  if (brand.music && script.musicUnder) {
    add(brand.music, `aloop=loop=-1:size=2147483647,atrim=0:${mainLen.toFixed(3)},asetpts=PTS-STARTPTS,volume=0.07,afade=t=in:st=0:d=1.5,afade=t=out:st=${Math.max(0, mainLen - 2.5).toFixed(3)}:d=2.5,adelay=${Math.round(introLen * 1000)}:all=1`);
  }
  if (brand.music) {
    add(brand.music, `atrim=0:${introLen.toFixed(3)},asetpts=PTS-STARTPTS,volume=0.30,afade=t=in:st=0:d=0.6,afade=t=out:st=${Math.max(0, introLen - 1.4).toFixed(3)}:d=1.4`);
    add(brand.music, `atrim=0:${outroLen.toFixed(3)},asetpts=PTS-STARTPTS,volume=0.30,afade=t=in:st=0:d=0.8,afade=t=out:st=${Math.max(0, outroLen - 1.6).toFixed(3)}:d=1.6,adelay=${Math.round(outroStart * 1000)}:all=1`);
  }
  if (chains.length) {
    const mix = `${chains.map((_, i) => `[s${i}]`).join("")}amix=inputs=${chains.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11[aout]`;
    await ffmpeg(["-i", picture, ...inputs, "-filter_complex", `${chains.join(";")};${mix}`, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", final]);
  } else {
    await ffmpeg(["-i", picture, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", "-movflags", "+faststart", final]);
  }
  if (brand.sting || brand.music) console.log(`  sound: ${[brand.sting && "logo sting", brand.music && "music bed"].filter(Boolean).join(" + ")}`);

  // 7. Captions, thumbnail, chapters and description
  const srt = captions(steps.map((s) => s.say), starts, voice.lines.map((l) => l.seconds));
  writeFileSync(join(out, `${name}.en.srt`), srt);
  // The same captions for the website's player (WebVTT: a header, and dots in the timestamps).
  writeFileSync(join(out, `${name}.en.vtt`), `WEBVTT\n\n${srt.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2")}`);
  if (rec.thumb) {
    copyFileSync(rec.thumb, join(work, "shot.png"));
    await renderThumb(browser, { n: meta.n, total: TOTAL, title: meta.title, ...(meta.extra ? { extra: 1 } : {}), shot: pathToFileURL(join(work, "shot.png")).href }, join(out, `${name}-thumbnail.png`));
  }
  const chapters = [`0:00 Intro`, ...steps.map((s, i) => (s.chapter ? `${chapterTs(starts[i])} ${s.chapter}` : null)).filter(Boolean), `${chapterTs(introLen + mainLen)} What's next`];
  const yt = [
    `TITLE`, meta.extra ? `${meta.title} | Staff rostering for sailing and watersports centres` : `${meta.title} | ActivityRoster how-to ${meta.n} of ${TOTAL}`, ``,
    `DESCRIPTION`, script.description.trim(), ``,
    `Chapters`, ...chapters, ``,
    `Step-by-step guide: https://activityroster.com/learn?topic=${meta.learn}`,
    `Start your free month: https://activityroster.com`, ``,
    meta.extra ? `ActivityRoster: staff rostering for RYA sailing and watersports centres. The how-to series walks through each part step by step.` : `This is video ${meta.n} of ${TOTAL} in the ActivityRoster how-to series: staff rostering for RYA sailing and watersports centres.${next ? ` Next: ${next.title}.` : ""}`,
    `The centre, people and courses shown are made up.`, ``,
    `TAGS`, (script.tags ?? []).concat(["ActivityRoster", "sailing centre rostering", "RYA instructor scheduling", "watersports staff rota"]).join(", "), ``,
    `CAPTIONS: upload ${name}.en.srt as English subtitles.`,
    `THUMBNAIL: ${name}-thumbnail.png`,
    `VOICE: ${voice.provider.label}${brand.music || brand.sting ? " · music and sting: ElevenLabs" : ""}`,
  ].join("\n");
  writeFileSync(join(out, `${name}-youtube.txt`), yt + "\n");
  if (warnings.length) writeFileSync(join(out, `${name}-warnings.txt`), warnings.join("\n") + "\n");
  console.log(`  ✓ ${final} (${(await durationOf(final)).toFixed(1)}s)${warnings.length ? `, ${warnings.length} warning(s)` : ""}`);
  return { name, warnings };
}

const scripts = readdirSync(join(ROOT, "videos", "scripts")).filter((f) => /^\d\d-.*\.mjs$/.test(f)).sort();
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const made = [];
for (const file of scripts) {
  const n = Number(file.slice(0, 2));
  if (only && !only.has(n)) continue;
  const meta = byNumber(n);
  if (!meta) throw new Error(`${file}: no video ${n} in series.mjs`);
  const script = (await import(pathToFileURL(join(ROOT, "videos", "scripts", file)).href)).default;
  made.push(await makeVideo(browser, meta, script));
}
await browser.close();
console.log(`\nMade ${made.length} video(s) in videos/out.`);
if (made.some((m) => m.warnings.length)) console.log("Some steps didn't find what they were looking for: see the -warnings.txt files.");
