import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getEnv } from "@/lib/cf/bindings";
import { voiceoverRows } from "@/lib/videos/voiceover";
import { VoiceoverStudio } from "@/components/admin/VoiceoverStudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Video voice-overs" };

/**
 * Record your own voice over the how-to videos. The video plays silently while
 * the line to say lights up word by word, timed to the original narration; the
 * recording is then put on the video by the "Apply voiceovers" GitHub Action.
 */
export default async function VideoVoiceoversPage() {
  await requirePlatformAdmin();
  const env = getEnv();
  const rows = await voiceoverRows(env.DOCS);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Video voice-overs</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Pick a video, press Record and read the words as they light up: they&rsquo;re timed to the original narration, so your voice lands on the right screen.
          Listen back, nudge the timing if it&rsquo;s a touch early or late, then save. Your voice replaces the old one on the website a few minutes later
          (the logo sting and closing music stay). Headphones help if you switch on the original voice as a guide.
        </p>
      </div>
      <VoiceoverStudio rows={rows} autoApply={Boolean(env.GITHUB_ACTIONS_TOKEN)} />
    </div>
  );
}
