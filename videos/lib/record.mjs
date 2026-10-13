import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Records a scripted walk-through of the app at 1920×1080. Frames come from
 * Chrome's own screencast (sharper than a screen recording), each with its
 * time, so the composer can rebuild the video at exact timings. A drawn
 * cursor and click ripple show where the mouse goes; highlight() rings the
 * thing being talked about.
 */
export const VIEWPORT = { width: 1440, height: 810 }; // × 4/3 = 1920×1080
export const SCALE = 4 / 3;

/** Injected into every page: the visible cursor, click ripple and highlight ring. */
export const OVERLAY = `(() => {
  const css = \`
    #__cur{position:fixed;inset:auto;left:0;top:0;margin:0;padding:0;border:0;background:transparent;overflow:visible;width:26px;height:26px;z-index:2147483647;pointer-events:none;transition:transform .06s linear;}
    #__cur svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
    .__rip{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid #3f9fe0;animation:__rip .55s ease-out forwards}
    @keyframes __rip{to{transform:scale(4.2);opacity:0}}
    .__hl{position:fixed;inset:auto;margin:0;padding:0;background:transparent;overflow:visible;z-index:2147483645;pointer-events:none;border:4px solid #f5a524;border-radius:12px;box-shadow:0 0 0 6000px rgba(10,46,82,.18),0 0 24px rgba(245,165,36,.55);transition:all .35s ease;opacity:0}
    nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}\`;
  const add = () => {
    if (document.getElementById('__cur')) return;
    const s = document.createElement('style'); s.textContent = css; document.documentElement.appendChild(s);
    const c = document.createElement('div'); c.id = '__cur'; c.setAttribute('popover', 'manual');
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#fff" stroke="#0a2e52" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c); try { c.showPopover(); } catch {}
    // Modal dialogs sit in the browser's top layer: re-show the cursor and ring after one opens so they stay above it.
    new MutationObserver(() => { for (const el of [document.getElementById('__cur'), document.querySelector('.__hl')]) { if (el && document.querySelector('dialog[open]')) { try { el.hidePopover(); el.showPopover(); } catch {} } } }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['open'], childList: true });
    const p = JSON.parse(sessionStorage.getItem('__cur') || '[720,420]');
    c.style.transform = 'translate(' + p[0] + 'px,' + p[1] + 'px)';
  };
  document.addEventListener('mousemove', (e) => { add(); const c = document.getElementById('__cur'); c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; sessionStorage.setItem('__cur', JSON.stringify([e.clientX, e.clientY])); }, true);
  document.addEventListener('mousedown', (e) => { const r = document.createElement('div'); r.className = '__rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.documentElement.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
  window.__highlight = (rect) => {
    let h = document.querySelector('.__hl');
    if (!h) { h = document.createElement('div'); h.className = '__hl'; h.setAttribute('popover', 'manual'); document.documentElement.appendChild(h); }
    try { h.hidePopover(); } catch {} try { h.showPopover(); } catch {}
    const cur = document.getElementById('__cur'); if (cur) { try { cur.hidePopover(); cur.showPopover(); } catch {} }
    if (!rect) { h.style.opacity = 0; return; }
    const pad = 8; h.style.left = (rect.x - pad) + 'px'; h.style.top = (rect.y - pad) + 'px'; h.style.width = (rect.width + pad * 2) + 'px'; h.style.height = (rect.height + pad * 2) + 'px'; h.style.opacity = 1;
  };
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The helpers a script's steps use. */
export function helpers(page, base) {
  let pos = { x: 720, y: 420 };
  const center = async (target) => {
    // The first visible match: pages often carry a hidden copy (the phone layout, a closed tab).
    const loc = (typeof target === "string" ? page.locator(target) : target).filter({ visible: true }).first();
    await loc.waitFor({ state: "visible", timeout: 60_000 });
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    return { loc, x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
  };
  const glide = async (x, y, ms = 650) => {
    const steps = Math.max(8, Math.round(ms / 16));
    const from = { ...pos };
    for (let i = 1; i <= steps; i++) {
      const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // ease in-out
      await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
      await sleep(ms / steps);
    }
    pos = { x, y };
  };
  return {
    page,
    wait: sleep,
    goto: async (path) => { await page.goto(`${base}${path}`, { waitUntil: "load" }); await page.waitForLoadState("networkidle").catch(() => {}); await sleep(400); },
    point: async (target, ms) => { const c = await center(target); await glide(c.x, c.y, ms); return c.loc; },
    click: async (target, ms) => { const c = await center(target); await glide(c.x, c.y, ms); await sleep(120); await page.mouse.down(); await sleep(70); await page.mouse.up(); await sleep(250); return c.loc; },
    /** Click into a field and type, key by key, so the viewer sees it written. */
    type: async (target, text, delay = 55) => { const c = await center(target); await glide(c.x, c.y); await sleep(100); await page.mouse.down(); await sleep(60); await page.mouse.up(); await c.loc.fill(""); await page.keyboard.type(text, { delay }); await sleep(250); return c.loc; },
    /** Choose an option in a <select> (pointing at it first). */
    select: async (target, value) => { const c = await center(target); await glide(c.x, c.y); await sleep(150); await c.loc.selectOption(value); await sleep(300); return c.loc; },
    highlight: async (target) => { const c = await center(target); await page.evaluate((r) => window.__highlight(r), c.box); },
    unhighlight: async () => { await page.evaluate(() => window.__highlight(null)); },
    scrollTo: async (target) => { const loc = (typeof target === "string" ? page.locator(target) : target).filter({ visible: true }).first(); await loc.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" })); await sleep(700); },
    scrollTop: async () => { await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(600); },
  };
}

/**
 * Run the steps while recording. Each step lasts at least as long as its
 * narration (plus a breath); its action plays during the narration. Returns
 * the frames and when each step started, in seconds from the first frame.
 */
export async function recordSteps(page, steps, durations, { base, workDir, thumbAt }) {
  const dir = join(workDir, "frames");
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let n = 0;
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = join(dir, `${String(n++).padStart(6, "0")}.jpg`);
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  const h = helpers(page, base);
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  // Nudge a repaint so the first frame exists, then start the clock from it.
  await page.mouse.move(721, 421); await page.mouse.move(720, 420);
  while (!frames.length) await sleep(20);
  const t0 = frames[0].t;
  const marks = [];
  let thumb = null;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const start = Date.now() / 1000;
    marks.push(start - t0);
    if (s.do) await s.do(h);
    if (thumbAt === i) { thumb = join(workDir, "thumb-shot.png"); await page.screenshot({ path: thumb }); }
    const left = start + durations[i] + (s.pause ?? 0.45) - Date.now() / 1000;
    if (left > 0) await sleep(left * 1000);
  }
  await sleep(600);
  const end = Date.now() / 1000 - t0;
  await cdp.send("Page.stopScreencast");
  return { frames: frames.map((f) => ({ file: f.file, t: f.t - t0 })), marks, end, thumb };
}
