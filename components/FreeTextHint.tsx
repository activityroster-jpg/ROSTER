/**
 * The one-line reminder under every free-text box that ends up in a record
 * (compliance P1-G): notes, reasons and messages are kept, often in the change
 * log, and read by other people, so they should carry facts about the roster
 * and never health details or anything about a child or a third party.
 */
export function FreeTextHint({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-snug text-slate-400 ${className}`}>
      Keep this to the facts about the roster. No health details, and nothing about a child or anyone else; it is kept on record.
    </p>
  );
}
