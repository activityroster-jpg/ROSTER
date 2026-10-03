import type { WorkingTimePack } from "@/lib/domain/working-time";

/**
 * Built-in rule packs. Figures follow the compliance spec's default table;
 * each band lists the fields NOT yet confirmed against the official source, and
 * a pack is `verified` only when every figure has been. Conor can edit a pack
 * in the Dev Center (stored in the rule_pack table) without a code change; the
 * built-in copy below is the fallback and the record of where it started.
 */
export const BUILTIN_PACKS: Record<string, WorkingTimePack> = {
  gb: {
    key: "gb",
    name: "Great Britain (England, Scotland, Wales)",
    version: "2026-10-03",
    verified: false,
    schoolLeaving: "gb",
    volunteersCovered: false,
    citations: [
      { label: "GOV.UK: Child employment", url: "https://www.gov.uk/child-employment" },
      { label: "Children and Young Persons Act 1933 s.18 (as amended) and local byelaws", url: "https://www.legislation.gov.uk/ukpga/Geo5/23-24/12/section/18" },
      { label: "Working Time Regulations 1998 (young workers)", url: "https://www.legislation.gov.uk/uksi/1998/1833" },
    ],
    bands: [
      {
        id: "gb-child", label: "children of school age (GB)", minAge: 13, maxAge: 16, until: "schoolLeaving",
        termTime: { maxHoursPerDay: 2, maxHoursPerWeek: 12, maxHoursSchoolDay: 2, maxHoursSaturday: 8, maxHoursSunday: 2 },
        holiday: { maxHoursPerDay: 8, maxHoursPerWeek: 35, maxHoursSunday: 2 },
        earliestStart: "07:00", latestFinish: "19:00",
        breakMinutes: 60, breakAfterHours: 4,
        dailyRestHours: null, weeklyRestDays: null, weeklyRestHours: null,
        annualBreak: "2 consecutive weeks off work during the school holidays each year",
        paperwork: "Council work permit applied for within 1 week of starting, plus written parental consent",
        unverified: ["dailyRestHours", "weeklyRestHours", "maxHoursSaturday"],
        notes: "Figures come from council byelaws, near-identical across England and Wales; Scottish councils and Scottish school-leaving dates need separate checking. Under-13s may not be employed.",
      },
      {
        id: "gb-young", label: "young workers (16–17, past school-leaving age)", minAge: 15, maxAge: 17, from: "schoolLeaving",
        termTime: { maxHoursPerDay: 8, maxHoursPerWeek: 40 },
        holiday: { maxHoursPerDay: 8, maxHoursPerWeek: 40 },
        earliestStart: "06:00", latestFinish: "22:00",
        breakMinutes: 30, breakAfterHours: 4.5,
        dailyRestHours: 12, weeklyRestHours: 48,
        annualBreak: null, paperwork: null,
        unverified: ["earliestStart", "latestFinish"],
        notes: "Working Time Regulations: 8 hours a day, 40 a week, no averaging; night work normally barred between 22:00 and 06:00 (exact window to verify).",
      },
    ],
    adults: { maxHoursPerWeekAveraged: 48, breakMinutes: 20, breakAfterHours: 6, dailyRestHours: 11, weeklyRestHours: 24, notes: "48 hours averaged over 17 weeks; workers may opt out in writing. 24 hours' rest a week or 48 a fortnight." },
  },
  ni: {
    key: "ni",
    name: "Northern Ireland",
    version: "2026-10-03",
    verified: false,
    schoolLeaving: "ni",
    volunteersCovered: true,
    citations: [
      { label: "nibusinessinfo: employing workers of compulsory school age", url: "https://www.nibusinessinfo.co.uk/content/employing-workers-compulsory-school-age" },
      { label: "Employment of Children Regulations (Northern Ireland) 1996", url: "https://www.legislation.gov.uk/nisr/1996/477/made/data.html" },
    ],
    bands: [
      {
        id: "ni-child", label: "children of school age (NI)", minAge: 13, maxAge: 16, until: "schoolLeaving",
        termTime: { maxHoursPerDay: 2, maxHoursPerWeek: null, maxHoursSchoolDay: 2, maxHoursSaturday: null, maxHoursSunday: 2 },
        holiday: { maxHoursPerDay: 7, maxHoursPerWeek: 37 },
        earliestStart: "07:00", latestFinish: "19:00",
        breakMinutes: 60, breakAfterHours: 4,
        dailyRestHours: null, weeklyRestDays: null,
        annualBreak: "2 weeks off work during the school holidays each year",
        paperwork: "Written parental consent and an Education Authority child employment permit",
        unverified: ["maxHoursPerWeek", "earliestStart", "latestFinish", "dailyRestHours", "weeklyRestHours"],
        notes: "NI child employment rules cover paid and unpaid work, so volunteer status never switches these checks off.",
      },
      {
        id: "ni-young", label: "young workers (16–17, past school-leaving age)", minAge: 15, maxAge: 17, from: "schoolLeaving",
        termTime: { maxHoursPerDay: 8, maxHoursPerWeek: 40 },
        holiday: { maxHoursPerDay: 8, maxHoursPerWeek: 40 },
        earliestStart: "06:00", latestFinish: "22:00",
        breakMinutes: 30, breakAfterHours: 4.5,
        dailyRestHours: 12, weeklyRestHours: 48,
        annualBreak: null, paperwork: null,
        unverified: ["earliestStart", "latestFinish"],
      },
    ],
    adults: { maxHoursPerWeekAveraged: 48, breakMinutes: 20, breakAfterHours: 6, dailyRestHours: 11, weeklyRestHours: 24, notes: "As Great Britain (Working Time Regulations (NI) 2016)." },
  },
  ie: {
    key: "ie",
    name: "Ireland",
    version: "2026-10-03",
    verified: false,
    schoolLeaving: "ie",
    volunteersCovered: false,
    citations: [
      { label: "Protection of Young Persons (Employment) Act 1996", url: "https://www.irishstatutebook.ie/eli/1996/act/16/enacted/en/html" },
      { label: "WRC summary poster", url: "https://workplacerelations.ie/en/publications_forms/protection_of_young_persons_employment_act_-_poster.pdf" },
    ],
    bands: [
      {
        id: "ie-child", label: "children aged 15 (Ireland)", minAge: 14, maxAge: 15,
        termTime: { maxHoursPerDay: null, maxHoursPerWeek: 8 },
        holiday: { maxHoursPerDay: 7, maxHoursPerWeek: 35 },
        earliestStart: "08:00", latestFinish: "20:00",
        breakMinutes: 30, breakAfterHours: 4,
        dailyRestHours: 14, weeklyRestDays: 2,
        annualBreak: "At least 21 days off work during the summer holidays",
        paperwork: "Written parental permission; record start and finish times; give a summary of the Act within 1 month",
        unverified: [],
        notes: "Light work only during term (max 8 hours a week); 14-year-olds may do light work in the holidays only.",
      },
      {
        id: "ie-young", label: "young persons aged 16–17 (Ireland)", minAge: 16, maxAge: 17,
        termTime: { maxHoursPerDay: 8, maxHoursPerWeek: 40 },
        holiday: { maxHoursPerDay: 8, maxHoursPerWeek: 40 },
        earliestStart: "06:00", latestFinish: "22:00", latestFinishNoSchoolNextDay: "23:00",
        breakMinutes: 30, breakAfterHours: 4.5,
        dailyRestHours: 12, weeklyRestDays: 2,
        annualBreak: null,
        paperwork: "Record start and finish times; give a summary of the Act within 1 month",
        unverified: [],
      },
    ],
    adults: { maxHoursPerWeekAveraged: 48, breakMinutes: 15, breakAfterHours: 4.5, dailyRestHours: 11, weeklyRestHours: 24, notes: "Organisation of Working Time Act 1997: 15 minutes after 4.5 hours, 30 after 6; 48 hours averaged over 4 months." },
  },
};

/** Which pack a centre's jurisdiction uses; null means "no verified pack yet, checks not active". */
export function packKeyFor(jurisdiction: string | null | undefined): keyof typeof BUILTIN_PACKS | null {
  switch (jurisdiction) {
    case "england": case "wales": case "scotland": return "gb";
    case "northern_ireland": return "ni";
    case "ireland": return "ie";
    default: return null;
  }
}
