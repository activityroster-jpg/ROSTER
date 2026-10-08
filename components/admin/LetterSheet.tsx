import type { MarketingProspect } from "@/lib/db/schema";
import { LETTER_SENDER } from "@/lib/marketing";
import { COMPANY } from "@/lib/config";

/*
 * Envelope window geometry, in millimetres from the top-left of the A4 sheet
 * (standard DL/C5 window). The address is left-aligned inside the window so
 * every letter starts at the same spot; the window's slack absorbs the fold.
 */
export const WINDOW = { left: 18, top: 48, width: 90, height: 45 };
export const SHEET_PAD = 16;
const BODY_TOP = WINDOW.top + WINDOW.height + 8 - SHEET_PAD;

/** Shared print + layout rules for one or many letter sheets. */
export function LetterStyles() {
  return (
    <style>{`
      @page { size: A4; margin: 0; }
      .letter-sheet { width: 210mm; min-height: 297mm; margin: 0 auto 8mm; background: #fff; position: relative; padding: ${SHEET_PAD}mm; break-after: page; }
      .letter-sheet:last-child { break-after: auto; margin-bottom: 0; }
      .window-zone { position: absolute; top: ${WINDOW.top}mm; left: ${WINDOW.left}mm; width: ${WINDOW.width}mm; height: ${WINDOW.height}mm; display: flex; align-items: center; justify-content: flex-start; }
      .window-guide { outline: 1px dashed #c7d2e0; outline-offset: 0; }
      .window-address { font-size: 11pt; line-height: 1.3; text-align: left; max-width: ${WINDOW.width}mm; }
      .letter-body { margin-top: ${BODY_TOP}mm; font-size: 11pt; line-height: 1.4; color: #111; }
      .sign-line { width: 65mm; border-bottom: 1px solid #111; }
      .letter-legal { position: absolute; left: ${SHEET_PAD}mm; right: ${SHEET_PAD}mm; bottom: 9mm; font-size: 7.5pt; line-height: 1.35; color: #666; text-align: center; }
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; min-height: 0 !important; height: auto !important; background: #fff !important; }
        .no-print { display: none !important; }
        body * { min-height: 0 !important; visibility: hidden !important; }
        .letters-doc, .letters-doc * { visibility: visible !important; }
        .letters-doc { position: absolute !important; top: 0 !important; left: 0 !important; width: 210mm !important; margin: 0 !important; }
        .letter-sheet { margin: 0 !important; box-shadow: none !important; height: 297mm !important; min-height: 297mm !important; overflow: hidden !important; }
        .window-guide { outline: none !important; }
      }
    `}</style>
  );
}

/** One A4 window-envelope letter to a prospect. */
export function LetterSheet({ p }: { p: MarketingProspect }) {
  const addressLines = [p.name, p.addressLine1, p.addressLine2, p.city, p.postcode, p.country].filter(Boolean) as string[];
  const greetingName = p.contactName || (p.contactRole ? `${p.contactRole}` : "Principal");
  const senderAddr = [LETTER_SENDER.line1, LETTER_SENDER.line2, LETTER_SENDER.city, LETTER_SENDER.postcode].filter(Boolean);

  return (
    <div className="letter-sheet text-[11pt] text-slate-900 shadow-lg">
      <div style={{ position: "absolute", top: "20mm", right: "20mm", textAlign: "right" }}>
        <p style={{ fontWeight: 700 }}>{LETTER_SENDER.name}</p>
        {LETTER_SENDER.tagline ? <p style={{ fontSize: "9pt", color: "#555" }}>{LETTER_SENDER.tagline}</p> : null}
        {senderAddr.map((l, i) => <p key={i} style={{ fontSize: "9pt" }}>{l}</p>)}
        {LETTER_SENDER.email ? <p style={{ fontSize: "9pt" }}>{LETTER_SENDER.email}</p> : null}
        {LETTER_SENDER.website ? <p style={{ fontSize: "9pt" }}>{LETTER_SENDER.website}</p> : null}
      </div>

      <div className="window-zone window-guide">
        <div className="window-address">
          {addressLines.map((l, i) => <div key={i} style={{ fontWeight: i === 0 ? 600 : 400 }}>{l}</div>)}
        </div>
      </div>

      <div className="letter-body">
        <p>Dear {greetingName},</p>
        <p style={{ marginTop: "6mm" }}>
          I&apos;m writing to introduce <strong>ActivityRoster</strong>, a staff-rostering and compliance tool built
          specifically for RYA training centres and clubs like {p.name}.
        </p>
        <p style={{ marginTop: "4mm" }}>
          It handles the parts of running a centre that spreadsheets make painful: rostering instructors across
          youth and adult courses while automatically checking RYA ratios, safety-boat cover and each
          instructor&apos;s qualifications and tickets; tracking DBS, first aid and safeguarding expiry; letting
          staff submit availability, log hours and request leave from their phone; and producing a clean weekly
          roster you can print or share in seconds.
        </p>
        <p style={{ marginTop: "4mm" }}>
          No two centres are run quite the same way, so ActivityRoster is built to be shaped around you — we&apos;re
          happy to tailor it to how {p.name} actually works, from your own course types and qualification rules to
          the way your roster and reports look. If there&apos;s something specific you need, just ask.
        </p>
        <p style={{ marginTop: "4mm" }}>
          Centres are up and running in a weekend — you can even import your existing courses straight from a
          spreadsheet or calendar. It&apos;s a single, simple subscription, and the best way to see if it fits is
          to try it: the first month is completely free, with no card required, so you can set up {p.name} and run a
          real week before you decide.
        </p>
        <p style={{ marginTop: "4mm" }}>
          If this sounds useful, I&apos;d welcome a short call, or you can start your free month and look around for
          yourself at {LETTER_SENDER.website}.
        </p>
        <p style={{ marginTop: "6mm" }}>Kind regards,</p>
        <div style={{ marginTop: "10mm" }} className="sign-line" />
        <p style={{ marginTop: "2mm", fontWeight: 600 }}>{LETTER_SENDER.signOffName}</p>
        <p style={{ fontSize: "9pt", color: "#555" }}>{LETTER_SENDER.name}</p>
        <p style={{ marginTop: "6mm", fontWeight: 700 }}>{LETTER_SENDER.website}</p>
      </div>
      {/* What the Companies Act asks a business letter to show. */}
      <p className="letter-legal">{COMPANY.name} is a trading name of {COMPANY.legalLine}</p>
    </div>
  );
}
