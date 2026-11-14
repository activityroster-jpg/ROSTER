# How-to videos

Short topic videos for YouTube, made automatically from scripts, so a change to
the platform means re-running the workflow, not re-filming.

- **Make them:** GitHub → Actions → **Make videos** → Run workflow (leave the box
  blank for every video, or type numbers such as `6,7`). It also runs by itself
  when anything in `videos/` changes. Download the finished files from the run's
  **Artifacts → activityroster-videos** (kept 30 days).
- **What you get per video:** the MP4 (1920×1080, logo intro, "Video N of 12"
  card, narration, outro), English captions (`.en.srt`), a thumbnail, and a
  `-youtube.txt` with the title, description, chapters and tags to paste in.
- **Voice:** set one secret under Settings → Secrets and variables → Actions:
  `ELEVENLABS_API_KEY` (recommended; optional variable `ELEVENLABS_VOICE_ID`),
  or `GOOGLE_TTS_API_KEY`, or `AZURE_SPEECH_KEY`. With none, a free preview voice
  is used to check timing. Only the script text is sent. Narration is cached, so
  re-runs only pay for lines that changed. With the ElevenLabs key, a logo sting
  and a music bed (title card and outro only, never under the narration) are
  made once and reused by every video.
- **Scripts:** `videos/scripts/NN-slug.mjs`. Each step is a line to say and what
  happens on screen while it's said. The series list is `videos/series.mjs`.
- **Data:** a made-up centre from `videos/seed.test.ts`, on a throwaway local
  copy of the app. Never staging or production, never real people.

Locally: start the app with the video seed (as the workflow does), then
`DEV_LOG=<dev server log> npm run videos -- --only 6`. Needs ffmpeg
(`pip install imageio-ffmpeg` works).

## Your own voice (Dev Center → Growth → Video voice-overs)

Record your voice over any video instead of the generated one:

1. Pick the video, turn on the microphone (allow it when the browser asks), press **Record from the start**.
2. The video plays silently; the line to say lights up word by word, timed to the original
   narration, with the next line underneath. It stops by itself at the end. Tick "play the
   original voice quietly" if you want a guide (wear headphones so the mic doesn't hear it).
3. Listen back. If your voice sits a touch early or late, nudge it (Voice earlier / later), then
   **Use this recording**.
4. GitHub → Actions → **Apply voiceovers** puts it on the video with ffmpeg (the logo sting and
   closing music stay; the old narration between the first and last line is replaced) and the
   website plays your version within the hour. It starts straight away when the Worker has the
   `GITHUB_ACTIONS_TOKEN` secret (a fine-grained GitHub token for this repository with
   **Actions: Read and write**); without it, the nightly run at 03:35 does it, or press Run workflow.

"Remove my recording" puts the original voice back. If a video is remade by **Make videos**
after you recorded it, the page says "record again", because the screens may have moved.
Recordings and voiced videos live in the private storage bucket, never in the repository.
