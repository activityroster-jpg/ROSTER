import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PrintButton } from "@/components/office/PrintButton";
import { LETTER_SENDER } from "@/lib/marketing";

export const dynamic = "force-dynamic";

/*
 * Envelope window geometry, in millimetres from the top-left of the A4 sheet.
 * Measured against a standard DL/C5 window envelope. If your envelopes differ,
 * these four numbers are the only thing to change.
 *
 *   left/top  — the top-left corner of the physical window on the printed page.
 *   width/height — the size of the window aperture.
 *
 * We DON'T fill the window with text. The folded letter can slide ~15mm in any
 * direction inside the envelope, so we centre a compact address block inside the
 * window and let the margin absorb that movement. With the window at 90×45mm and
 * the address centred, roughly:
 *   • horizontal slack: (90 − address width)/2  — comfortably >15mm for a normal address
 *   • vertical slack:   (45 − address height)/2 — ~10mm for a 5-line address
 * so a healthy shift either way still leaves the whole address showing.
 */
const WINDOW = { left: 20, top: 48, width: 90, height: 45 };
const BODY_TOP = WINDOW.top + WINDOW.height + 10; // keep the letter body clear of the window

export default async function ProspectLetterPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const platform = new PlatformRepository(await getDb());
  const p = await platform.prospectById(id);
  if (!p) notFound();

  const addressLines =[p.name, p.addressLine1, p.addressLine2, p.city, p.postcode, p.country].filter(Boolean) as string[];
  const greetingName = p.contactName || (p.contactRole ? `${p.contactRole}` : "Principal");
  const senderAddr = [LETTER_SENDER.line1, LETTER_SENDER.line2, LETTER_SENDER.city, LETTER_SENDER.postcode].filter(Boolean);

  return (
    <>
      {/* Print rules: A4 sheet, address block sits centred in the envelope window zone. */}
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .letter-sheet { box-shadow: none !important; margin: 0 !important; }
          .window-guide { display: none !important; }
        }
        .letter-sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; position: relative; padding: 20mm; }
        /* The physical window aperture. On screen we draw a faint dashed guide so you can eyeball the fit; it never prints. */
        .window-zone {
          position: absolute;
          top: ${WINDOW.top}mm; left: ${WINDOW.left}mm;
          width: ${WINDOW.width}mm; height: ${WINDOW.height}mm;
          display: flex; align-items: center; justify-content: center;
        }
        .window-guide { outline: 1px dashed #c7d2e0; outline-offset: 0; }
        /* Compact, centred address — the margin around it absorbs ~15mm of letter shift each way. */
        .window-address { font-size: 11pt; line-height: 1.3; text-align: left; max-width: ${WINDOW.width - 24}mm; }
        .letter-body { margin-top: ${BODY_TOP}mm; font-size: 11pt; line-height: 1.5; color: #111; }
        .sign-line { width: 65mm; border-bottom: 1px solid #111; }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2">
        <div>
          <p className="text-sm font-semibold text-navy">Letter to {p.name}</p>
          <p className="text-xs text-slate-500">Prints on A4 · the recipient address is centred in a standard DL/C5 window so it stays visible even if the folded letter shifts ~1.5cm inside the envelope. The dashed window guide is screen-only and won&apos;t print. Use &ldquo;Save as PDF&rdquo; to keep a copy.</p>
        </div>
        <PrintButton label="Print / save as PDF" />
      </div>

      <div className="letter-sheet text-[11pt] text-slate-900 shadow-lg">
        {/* Sender block, top-right */}
        <div style={{ position: "absolute", top: "20mm", right: "20mm", textAlign: "right" }}>
          <p style={{ fontWeight: 700 }}>{LETTER_SENDER.name}</p>
          {LETTER_SENDER.tagline ? <p style={{ fontSize: "9pt", color: "#555" }}>{LETTER_SENDER.tagline}</p> : null}
          {senderAddr.map((l, i) => <p key={i} style={{ fontSize: "9pt" }}>{l}</p>)}
          {LETTER_SENDER.email ? <p style={{ fontSize: "9pt" }}>{LETTER_SENDER.email}</p> : null}
          {LETTER_SENDER.website ? <p style={{ fontSize: "9pt" }}>{LETTER_SENDER.website}</p> : null}
        </div>

        {/* Recipient address — centred within the envelope window so it tolerates shift */}
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
            rota you can print or share in seconds.
          </p>
          <p style={{ marginTop: "4mm" }}>
            No two centres are run quite the same way, so ActivityRoster is built to be shaped around you — we&apos;re
            happy to tailor it to how {p.name} actually works, from your own course types and qualification rules to
            the way your rota and reports look. If there&apos;s something specific you need, just ask.
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

          <p style={{ marginTop: "8mm" }}>Kind regards,</p>
          {/* Space to sign by hand, with a line to sign on */}
          <div style={{ marginTop: "16mm" }} className="sign-line" />
          <p style={{ marginTop: "2mm", fontWeight: 600 }}>{LETTER_SENDER.signOffName}</p>
          <p style={{ fontSize: "9pt", color: "#555" }}>{LETTER_SENDER.name}</p>
        </div>
      </div>
    </>
  );
}
