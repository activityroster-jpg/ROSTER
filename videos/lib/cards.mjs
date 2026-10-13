import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ffmpeg } from "./ffmpeg.mjs";

const CARD = pathToFileURL(join(process.cwd(), "videos", "assets", "card.html")).href;
export const FPS = 30;
const W = 1920, H = 1080;

/** Render an animated card (intro or outro) frame by frame into an MP4 segment. Returns its length in seconds. */
export async function renderCard(browser, params, outFile, workDir) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${CARD}?${new URLSearchParams(params)}`);
  await page.evaluate(() => window.__ready);
  const seconds = await page.evaluate(() => window.__duration);
  const dir = join(workDir, `card-${params.mode}`);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const frames = Math.round(seconds * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.__seek(t), f / FPS);
    await page.screenshot({ path: join(dir, `${String(f).padStart(5, "0")}.png`) });
  }
  await ctx.close();
  await ffmpeg(["-framerate", String(FPS), "-i", join(dir, "%05d.png"), "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(FPS), outFile]);
  return frames / FPS;
}

/** A still 1280×720 thumbnail, with a screenshot from the video set into it. */
export async function renderThumb(browser, params, outFile) {
  const ctx = await browser.newContext({ viewport: { width: 1280 * 1.5, height: 720 * 1.5 }, deviceScaleFactor: 1 / 1.5 });
  const page = await ctx.newPage();
  await page.goto(`${CARD}?${new URLSearchParams({ ...params, mode: "thumb" })}`);
  await page.evaluate(() => window.__ready);
  await page.screenshot({ path: outFile });
  await ctx.close();
}
