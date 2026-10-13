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
