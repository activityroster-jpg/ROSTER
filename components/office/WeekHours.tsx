/** "12.5 h" rostered this week, beside a person's name (roster People × days, availability grid). */
export function WeekHours({ minutes }: { minutes: number }) {
  const h = Math.round((minutes / 60) * 10) / 10;
  return <span title="Hours rostered this week" className={`ml-2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${h > 0 ? "bg-navy/10 text-navy" : "bg-slate-100 text-slate-400"}`}>{h} h</span>;
}
