import { landingBySlug, type Landing } from "@/lib/seo/landings";
import { guideBySlug, type Guide } from "@/lib/seo/guides";

/**
 * What each blog category leads to: the software pages and guides a Principal
 * or centre manager reading that category is most likely to want next. Every
 * article links out through this, so the hundred posts point at the ten pages
 * written for what buyers search, with the page's own name as the link text.
 * Keys are the seed categories (lib/blog/seed/batch-*.ts); a hand-written post
 * with another category gets the pillar pages.
 */
export const CATEGORY_LINKS: Record<string, { landings: string[]; guides: string[] }> = {
  "Starting & running a centre": {
    landings: ["rya-sailing-school-software", "sailing-centre-management-software"],
    guides: ["rya-sailing-school-compliance-checklist", "how-many-instructors-do-i-need-for-an-rya-course"],
  },
  "Compliance & safety": {
    landings: ["sailing-school-compliance-software", "rya-qualification-tracking-software"],
    guides: ["rya-recognition-inspection-what-to-have-ready", "how-to-prevent-expired-qualifications-being-rostered"],
  },
  "Instructors & staff": {
    landings: ["rya-instructor-management-software", "sailing-instructor-scheduling-software"],
    guides: ["how-long-do-rya-instructor-qualifications-last", "how-to-manage-freelance-sailing-instructors"],
  },
  "Course delivery": {
    landings: ["rya-staff-rostering-software", "watersports-staff-scheduling"],
    guides: ["how-many-instructors-do-i-need-for-an-rya-course", "how-to-build-a-sailing-school-staff-rota"],
  },
  "Marketing & promoting courses": {
    landings: ["rya-sailing-school-software", "sailing-centre-management-software"],
    guides: ["how-to-build-a-sailing-school-staff-rota", "sailing-school-staff-scheduling-spreadsheet-template"],
  },
  "Growth & community": {
    landings: ["sailing-club-duty-roster", "sailing-centre-management-software"],
    guides: ["how-to-run-a-sailing-club-duty-rota", "how-should-a-sailing-school-manage-instructor-availability"],
  },
  "Operations & admin": {
    landings: ["sailing-school-rostering-software", "sailing-centre-management-software"],
    guides: ["how-to-build-a-sailing-school-staff-rota", "sailing-school-staff-scheduling-spreadsheet-template"],
  },
  "Digital & data": {
    landings: ["sailing-school-rostering-software", "rya-sailing-school-software"],
    guides: ["sailing-school-staff-scheduling-spreadsheet-template", "how-should-a-sailing-school-manage-instructor-availability"],
  },
};

const FALLBACK = CATEGORY_LINKS["Starting & running a centre"]!;

/** The pages and guides to show under an article, resolved and in order. */
export function relatedForCategory(category: string): { landings: Landing[]; guides: Guide[] } {
  const links = CATEGORY_LINKS[category] ?? FALLBACK;
  return {
    landings: links.landings.map((s) => landingBySlug(s)).filter((l): l is Landing => Boolean(l)),
    guides: links.guides.map((s) => guideBySlug(s)).filter((g): g is Guide => Boolean(g)),
  };
}
