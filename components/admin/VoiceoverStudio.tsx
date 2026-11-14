"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { karaokeAt, parseVtt, type Cue } from "@/lib/learn/karaoke";
import type { VoiceoverRow, VoiceStatus } from "@/lib/videos/voiceover";

type Phase = "pick" | "loading" | "ready" | "countdown" | "recording" | "review" | "saving";

const STATUS: Record<VoiceStatus, { label: string; tone: string }> = {
  none: { label: "Original voice", tone: "bg-slate-100 text-slate-600" },
  recorded: { label: "Recorded · being added", tone: "bg-amber/15 text-amber" },
  voiced: { label: "Your voice ✓", tone: "bg-starboard/15 text-starboard" },
  stale: { label: "Video remade · record again", tone: "bg-port/10 text-port" },
};
const fmtWhen = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The recording format this browser makes: WebM/Opus in Chrome and Firefox, MP4/AAC in Safari. */
function recorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

export function VoiceoverStudio({ rows, autoApply }: { rows: VoiceoverRow[]; autoApply: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<string | null>(null);
  const row = rows.find((r) => r.file === file) ?? null;
  const [phase, setPhase] = useState<Phase>("pick");
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [t, setT] = useState(0);
  const [count, setCount] = useState(3);
  const [guide, setGuide] = useState(false);
  const [level, setLevel] = useState(0);
  const [micReady, setMicReady] = useState(false);
  const [take, setTake] = useState<{ url: string; blob: Blob | null; offsetMs: number; saved: boolean } | null>(null);
  const [nudgeMs, setNudgeMs] = useState(0);
  const [stalled, setStalled] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const video = useRef<HTMLVideoElement>(null);
  const voice = useRef<HTMLAudioElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const offset = useRef<number | null>(null);
  const discard = useRef(false);
  const meterStop = useRef<() => void>(() => {});

  // Time display: follow the video every frame while it plays.
  useEffect(() => {
    let raf = 0;
    const tick = () => { if (video.current) setT(video.current.currentTime); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Release the microphone and object URLs when leaving the page.
  useEffect(() => () => { stream.current?.getTracks().forEach((tr) => tr.stop()); meterStop.current(); }, []);
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => () => { if (take?.url.startsWith("blob:")) URL.revokeObjectURL(take.url); }, [take]);

  /** Load the ORIGINAL video whole (so it never pauses to buffer mid-take) and its captions. */
  const open = useCallback(async (f: string) => {
    setFile(f); setErr(null); setNote(null); setTake(null); setNudgeMs(0); setStalled(false); setConfirmRemove(false);
    setPhase("loading"); setLoaded(0); setCues([]);
    try {
      const [vtt, res] = await Promise.all([fetch(`/api/videos/${f}.vtt`).then((r) => (r.ok ? r.text() : "")), fetch(`/api/videos/${f}.mp4?v=original`)]);
      if (!res.ok || !res.body) throw new Error("This video isn't on the website yet. Publish it with a deploy first.");
      const total = Number(res.headers.get("content-length") ?? 0);
      const reader = res.body.getReader();
      const parts: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value); got += value.byteLength;
        if (total) setLoaded(Math.round((got / total) * 100));
      }
      setCues(parseVtt(vtt));
      setVideoUrl(URL.createObjectURL(new Blob(parts as BlobPart[], { type: "video/mp4" })));
      setPhase("ready");
    } catch (e) {
      setErr((e as Error).message || "The video didn't load.");
      setPhase("pick");
    }
  }, []);

  /** Ask for the microphone and show a level meter, so a dead mic is caught before a take. */
  const enableMic = async () => {
    setErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      stream.current = s;
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      let raf = 0;
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(1, peak / 100));
        raf = requestAnimationFrame(loop);
      };
      loop();
      meterStop.current = () => { cancelAnimationFrame(raf); void ctx.close(); };
      setMicReady(true);
    } catch {
      setErr("The microphone wasn't allowed. Click the padlock in the address bar, allow the microphone for this site, and try again.");
    }
  };

  const record = () => {
    const v = video.current;
    if (!v || !stream.current) return;
    setErr(null); setNote(null); setTake(null); setNudgeMs(0); setStalled(false);
    v.pause(); v.currentTime = 0;
    setPhase("countdown"); setCount(3);
    let n = 3;
    const timer = window.setInterval(() => {
      n -= 1;
      if (n > 0) { setCount(n); return; }
      window.clearInterval(timer);
      const mime = recorderMime();
      let rec: MediaRecorder;
      try { rec = new MediaRecorder(stream.current!, mime ? { mimeType: mime, audioBitsPerSecond: 128_000 } : undefined); }
      catch { setErr("This browser can't record audio. Use Chrome, Edge or Safari."); setPhase("ready"); return; }
      recorder.current = rec; chunks.current = []; offset.current = null; discard.current = false;
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        v.pause();
        if (discard.current) { setPhase("ready"); return; }
        const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
        setTake({ url: URL.createObjectURL(blob), blob, offsetMs: Math.round(offset.current ?? 0), saved: false });
        v.currentTime = 0;
        setPhase("review");
      };
      // The video starts once the recorder is running; the gap is trimmed off when the voice is added.
      rec.onstart = () => {
        startedAt.current = performance.now();
        v.muted = !guide; v.volume = guide ? 0.15 : 1;
        const first = () => { if (offset.current == null) offset.current = performance.now() - startedAt.current; };
        v.addEventListener("playing", first, { once: true });
        // A video that won't play would leave the microphone running over a still frame: stop and say so.
        v.play().catch(() => {
          discard.current = true;
          if (rec.state === "recording") rec.stop();
          setErr("The video wouldn't play in this browser, so nothing was recorded. Try Chrome, Edge or Safari.");
        });
      };
      rec.start(1000);
      setPhase("recording");
    }, 1000);
  };

  // While recording: stop at the end of the video; warn if it ever paused to load.
  useEffect(() => {
    const v = video.current;
    if (!v || phase !== "recording") return;
    const end = () => { if (recorder.current?.state === "recording") recorder.current.stop(); };
    const wait = () => setStalled(true);
    v.addEventListener("ended", end);
    v.addEventListener("waiting", wait);
    return () => { v.removeEventListener("ended", end); v.removeEventListener("waiting", wait); };
  }, [phase]);

  const stopAndDiscard = () => { discard.current = true; if (recorder.current?.state === "recording") recorder.current.stop(); };

  // Review: the video plays silently with the recording kept in step with it.
  const voiceAt = useCallback((vt: number) => Math.max(0, vt + ((take?.offsetMs ?? 0) + nudgeMs) / 1000), [take, nudgeMs]);
  useEffect(() => {
    const v = video.current, a = voice.current;
    if (!v || !a || phase !== "review") return;
    v.muted = true;
    const sync = () => { a.currentTime = voiceAt(v.currentTime); };
    const play = () => { sync(); void a.play(); };
    const pause = () => a.pause();
    v.addEventListener("play", play); v.addEventListener("pause", pause); v.addEventListener("seeked", sync); v.addEventListener("ended", pause);
    const drift = window.setInterval(() => { if (!v.paused && Math.abs(a.currentTime - voiceAt(v.currentTime)) > 0.12) sync(); }, 500);
    return () => { v.removeEventListener("play", play); v.removeEventListener("pause", pause); v.removeEventListener("seeked", sync); v.removeEventListener("ended", pause); window.clearInterval(drift); a.pause(); };
  }, [phase, voiceAt]);

  const listenSaved = () => {
    if (!row?.take) return;
    setErr(null); setNudgeMs(0);
    setTake({ url: `/api/admin/voiceover?file=${encodeURIComponent(row.file)}&r=${encodeURIComponent(row.take.recordedAt)}`, blob: null, offsetMs: row.take.offsetMs, saved: true });
    if (video.current) { video.current.pause(); video.current.currentTime = 0; }
    setPhase("review");
  };

  const runNote = (run: string) =>
    run === "started" ? "Saved. Your voice goes on the video in about five minutes; this page shows ‘Your voice ✓’ when it's done (reload to check)."
      : run === "no-token" ? "Saved. It goes on the video in tonight's run, or straight away from GitHub → Actions → Apply voiceovers → Run workflow."
        : "Saved, but the run that adds it couldn't be started. It goes on tonight, or start it from GitHub → Actions → Apply voiceovers.";

  const call = async (init: RequestInit, url = "/api/admin/voiceover") => {
    const res = await fetch(url, init);
    if (res.redirected || res.status === 401 || res.status === 403) throw new Error("Your Dev Center session has timed out. Reload the page and enter your PIN.");
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; run?: string };
    if (!res.ok || !j.ok) throw new Error(j.error ?? "That didn't save. Try again.");
    return j;
  };

  const save = async () => {
    if (!take?.blob || !file) return;
    setPhase("saving"); setErr(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("offsetMs", String(take.offsetMs + nudgeMs));
      fd.set("audio", take.blob, "take");
      const j = await call({ method: "POST", body: fd });
      setNote(runNote(j.run ?? "failed"));
      setTake({ ...take, saved: true, offsetMs: take.offsetMs + nudgeMs }); setNudgeMs(0);
      router.refresh();
    } catch (e) { setErr((e as Error).message); }
    setPhase("review");
  };

  const applyAgain = async () => {
    if (!file) return;
    setErr(null);
    try { const fd = new FormData(); fd.set("file", file); fd.set("action", "apply"); const j = await call({ method: "POST", body: fd }); setNote(runNote(j.run ?? "failed")); }
    catch (e) { setErr((e as Error).message); }
  };

  const remove = async () => {
    if (!file) return;
    setErr(null);
    try { await call({ method: "DELETE" }, `/api/admin/voiceover?file=${encodeURIComponent(file)}`); setNote("Removed. The original voice plays on the website again."); setTake(null); setConfirmRemove(false); setPhase("ready"); router.refresh(); }
    catch (e) { setErr((e as Error).message); }
  };

  const frame = karaokeAt(cues, t);
  const busy = phase === "countdown" || phase === "recording" || phase === "saving";

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      {/* The videos and where each stands */}
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.file}>
            <button type="button" disabled={busy} onClick={() => void open(r.file)} className={`w-full rounded-lg border px-3 py-2 text-left disabled:opacity-50 ${r.file === file ? "border-teal bg-teal/5" : "border-slate-200 bg-white hover:border-teal"}`}>
              <span className="block text-sm font-semibold text-navy">{r.n ? `${r.n}. ` : ""}{r.title}</span>
              <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS[r.status].tone}`}>{STATUS[r.status].label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="min-w-0 space-y-4">
        {!file ? <p className="rounded-card border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Choose a video on the left to start.</p> : null}
        {phase === "loading" ? <p className="text-sm text-slate-600">Loading the video… {loaded ? `${loaded}%` : ""}</p> : null}

        {file && videoUrl && phase !== "loading" ? (
          <>
            <div className="relative overflow-hidden rounded-card bg-navy">
              <video ref={video} src={videoUrl} controls={phase === "ready" || phase === "review"} playsInline muted onError={() => setErr("This browser can't play the video. Use Chrome, Edge or Safari.")} className="aspect-video w-full" />
              {phase === "countdown" ? <div className="absolute inset-0 flex items-center justify-center bg-navy/70 font-display text-8xl font-bold text-white">{count}</div> : null}
              {phase === "recording" ? <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-port px-3 py-1 text-xs font-semibold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />Recording {mmss(t)}</span> : null}
            </div>

            {/* The prompt: the line to say now, lit word by word, and the one after it */}
            <div className="min-h-[8.5rem] rounded-card bg-navy px-6 py-5 text-center" aria-live="off">
              {frame.current ? (
                <p className="font-display text-2xl font-semibold leading-snug md:text-3xl">
                  {frame.current.words.map((w, i) => (
                    // One layer per word, filled left to right as it's said (a gradient clipped to the letters).
                    <span key={i}>
                      <span style={{ backgroundImage: `linear-gradient(90deg, #4fd1c5 ${w.progress * 100}%, rgba(255,255,255,0.35) ${w.progress * 100}%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{w.word}</span>{" "}
                    </span>
                  ))}
                </p>
              ) : frame.next ? (
                <p className="font-display text-xl font-semibold text-white/80">{frame.until != null && frame.until < 3 ? `Get ready… ${Math.ceil(frame.until)}` : cues.length && frame.index === 0 ? "Title card: the first line is coming up" : "Pause"}</p>
              ) : (
                <p className="font-display text-xl font-semibold text-white/80">{cues.length ? "That's the last line" : "This video has no captions to prompt from."}</p>
              )}
              {frame.next ? <p className="mt-3 text-sm text-white/50">Next: {frame.next.text}</p> : null}
              {cues.length ? <p className="mt-2 text-[11px] uppercase tracking-wide text-white/30">Line {Math.min(frame.index + 1, cues.length)} of {cues.length}</p> : null}
            </div>

            {err ? <p className="rounded-lg border border-port/30 bg-port/5 px-3 py-2 text-sm text-port">{err}</p> : null}
            {note ? <p className="rounded-lg border border-starboard/30 bg-starboard/5 px-3 py-2 text-sm text-navy">{note}</p> : null}

            {phase === "ready" ? (
              <div className="flex flex-wrap items-center gap-3 rounded-card border border-slate-200 bg-white p-4">
                {!micReady ? (
                  <button type="button" onClick={() => void enableMic()} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Turn on the microphone</button>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs text-slate-500" title="Microphone level">
                      Mic <span className="h-2 w-28 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-starboard transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} /></span>
                    </div>
                    <button type="button" onClick={record} className="flex items-center gap-2 rounded-lg bg-port px-5 py-2.5 text-sm font-semibold text-white"><span className="h-2.5 w-2.5 rounded-full bg-white" />Record from the start</button>
                  </>
                )}
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  Play the original voice quietly as a guide (headphones only)
                </label>
                {row?.take ? <button type="button" onClick={listenSaved} className="text-sm font-medium text-teal hover:underline">Listen to your saved recording</button> : null}
              </div>
            ) : null}

            {phase === "recording" || phase === "countdown" ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-600">Read the lit words as they appear. It stops by itself at the end of the video.</p>
                <button type="button" onClick={stopAndDiscard} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">Stop and start again</button>
                {stalled ? <p className="w-full text-sm text-amber">The video paused to load during this take, so the timing may be off. Record it again if it sounds out of step.</p> : null}
              </div>
            ) : null}

            {phase === "review" || phase === "saving" ? (
              <div className="space-y-3 rounded-card border border-slate-200 bg-white p-4">
                <audio ref={voice} src={take?.url} preload="auto" />
                <p className="text-sm text-slate-600">Press play on the video to hear {take?.saved ? "the saved recording" : "your take"} over it. Early or late? Nudge it, then listen again.</p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-500">Timing</span>
                  <button type="button" onClick={() => setNudgeMs((n) => n - 50)} className="rounded border border-slate-300 px-2 py-1">Voice later</button>
                  <span className="w-20 text-center tabular-nums text-navy">{nudgeMs === 0 ? "as recorded" : `${nudgeMs > 0 ? "+" : ""}${(nudgeMs / 1000).toFixed(2)}s`}</span>
                  <button type="button" onClick={() => setNudgeMs((n) => n + 50)} className="rounded border border-slate-300 px-2 py-1">Voice earlier</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {take && !take.saved ? (
                    <button type="button" disabled={phase === "saving"} onClick={() => void save()} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{phase === "saving" ? "Saving…" : "Use this recording"}</button>
                  ) : null}
                  {take?.saved && nudgeMs !== 0 ? <p className="text-xs text-slate-500">To keep a timing change on a saved recording, record it again (or save the new take).</p> : null}
                  <button type="button" disabled={phase === "saving"} onClick={() => { setTake(null); setPhase("ready"); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700">{take?.saved ? "Back" : "Record again"}</button>
                </div>
              </div>
            ) : null}

            {row?.take && (phase === "ready" || phase === "review") ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>Saved recording: {fmtWhen(row.take.recordedAt)}{row.applied?.recordedAt === row.take.recordedAt ? ` · on the website since ${fmtWhen(row.applied.appliedAt)}` : " · not on the website yet"}</span>
                {row.status === "stale" ? <span className="font-medium text-port">The video was remade after this recording ({fmtWhen(row.originalAt)}), so record it again.</span> : null}
                {row.status === "recorded" ? <button type="button" onClick={() => void applyAgain()} className="font-medium text-teal hover:underline">{autoApply ? "Add it to the video now" : "Try adding it now"}</button> : null}
                {confirmRemove ? (
                  <span className="flex items-center gap-2">Back to the original voice? <button type="button" onClick={() => void remove()} className="font-semibold text-port hover:underline">Yes, remove mine</button><button type="button" onClick={() => setConfirmRemove(false)} className="hover:underline">Cancel</button></span>
                ) : <button type="button" onClick={() => setConfirmRemove(true)} className="font-medium text-port hover:underline">Remove my recording</button>}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
