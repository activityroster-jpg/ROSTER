/** A seed blog article (before a publish date is assigned). */
export interface SeedArticle {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  tags: string[];
  coverEmoji: string;
  /**
   * What the cover photo should show, as a stock-photo search phrase. Specific to
   * the article's subject (a dinghy for a dinghy piece, a yacht for yachting, an
   * office desk for admin, an instructor teaching for staff articles) rather than
   * a generic marine scene.
   */
  imageQuery: string;
  body: string;
}

/** Standard closing note appended to every article (accuracy + CTA). */
export const RYA_NOTE =
  "\n\n> This article is general guidance for the people who run RYA centres and clubs: Principals, Chief Instructors, centre managers and club officers. Schemes, awards and requirements change — always check the latest official RYA guidance and your recognition paperwork before acting. [ActivityRoster](/rya-sailing-school-software) is rostering and compliance software for RYA training centres and clubs: it runs the instructor-type, ratio, supervision and licence checks described here while you build the roster.";
