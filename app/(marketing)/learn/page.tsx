import { LearningCenter } from "@/components/marketing/LearningCenter";

export const metadata = {
  title: "Learning Centre — ActivityRoster",
  description:
    "Step-by-step guides to every part of ActivityRoster: setup, courses, instructors, certs, availability, rostering, the weekly roster, billing, admin and data.",
};

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const sp = await searchParams;
  const topic = typeof sp.topic === "string" ? sp.topic : undefined;
  return <LearningCenter initialTopic={topic} />;
}
