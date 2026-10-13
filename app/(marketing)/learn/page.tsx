import { LearningCenter } from "@/components/marketing/LearningCenter";
import { VIDEOS, videoUrl } from "@/lib/learn/videos";

const SITE = "https://activityroster.com";
/** The how-to series as structured data, so search engines can show the videos. */
const VIDEO_LD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "ActivityRoster how-to videos",
  itemListElement: VIDEOS.map((v, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "VideoObject",
      name: v.title,
      description: v.description,
      thumbnailUrl: `${SITE}${videoUrl(v, "png")}`,
      contentUrl: `${SITE}${videoUrl(v, "mp4")}`,
      uploadDate: "2026-10-14",
      duration: v.duration,
      url: `${SITE}/learn?topic=${v.sections[0]}`,
    },
  })),
};

export const metadata = {
  title: "Learning Centre",
  description:
    "Step-by-step guides to every part of ActivityRoster: setup, courses, instructors, certs, availability, rostering, the weekly roster, billing, admin and data.",
  alternates: { canonical: "/learn" },
};

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const sp = await searchParams;
  const topic = typeof sp.topic === "string" ? sp.topic : undefined;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(VIDEO_LD).replace(/</g, "\\u003c") }} />
      <LearningCenter initialTopic={topic} />
    </>
  );
}
