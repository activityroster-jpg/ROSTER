/** A seed blog article (before a publish date is assigned). */
export interface SeedArticle {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  tags: string[];
  coverEmoji: string;
  body: string;
}

/** Standard closing note appended to every article (accuracy + CTA). */
export const RYA_NOTE =
  "\n\n> This article is general guidance for RYA centres and clubs. Schemes, awards and requirements change — always check the latest official RYA guidance and your recognition paperwork before acting. ActivityRoster helps you run the rostering, qualifications and safety-cover side of all of this in one place.";
