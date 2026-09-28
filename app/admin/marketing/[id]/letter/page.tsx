import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PrintButton } from "@/components/office/PrintButton";
import { LETTER_SENDER } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export default async function ProspectLetterPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const platform = new PlatformRepository(await getDb());
  const p = await platform.prospectById(id);
  if (!p) notFound();

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const addressLines = [p.name, p.addressLine1, p.addressLine2, p.city, p.postcode, p.country].filter(Boolean) as string[];
  const greetingName = p.contactName || (p.contactRole ? `${p.contactRole}` : "Principal");
  const senderAddr = [LETTER_SENDER.line1, LETTER_SENDER.line2, LETTER_SENDER.city, LETTER_SENDER.postcode].filter(Boolean);

  return (
    <>
      {/* Print rules: A4 sheet, address block sits in the C5 window zone. */}
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .letter-sheet { box-shadow: none !important; margin: 0 !important; }
        }
        .letter-sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; position: relative; padding: 20mm; }
        /* Blake Purely Everyday C5 window: ~90×45mm, ~20mm from left, ~45mm from top. */
        .window-address { position: absolute; top: 45mm; left: 20mm; width: 90mm; height: 45mm; font-size: 11pt; line-height: 1.35; }
        .letter-body { margin-top: 78mm; font-size: 11pt; line-height: 1.5; color: #111; }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2">
        <div>
          <p className="text-sm font-semibold text-navy">Letter to {p.name}</p>
          <p className="text-xs text-slate-500">Prints on A4 · recipient address is positioned for a Blake Purely Everyday C5 (162×229mm) window envelope. Use &ldquo;Save as PDF&rdquo; to keep a copy.</p>
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

        {/* Recipient address — shows through the envelope window */}
        <div className="window-address">
          {addressLines.map((l, i) => <div key={i} style={{ fontWeight: i === 0 ? 600 : 400 }}>{l}</div>)}
        </div>

        <div className="letter-body">
          <p>{today}</p>
          <p style={{ marginTop: "8mm" }}>Dear {greetingName},</p>

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
            Centres are up and running in a weekend — you can even import your existing courses straight from a
            spreadsheet or calendar. It&apos;s a single, simple subscription, and the first month is free.
          </p>
          <p style={{ marginTop: "4mm" }}>
            If this sounds useful, I&apos;d welcome a short call or you can see it for yourself at {LETTER_SENDER.website}.
          </p>

          <p style={{ marginTop: "8mm" }}>Kind regards,</p>
          <p style={{ marginTop: "10mm", fontWeight: 600 }}>{LETTER_SENDER.signOffName}</p>
          <p style={{ fontSize: "9pt", color: "#555" }}>{LETTER_SENDER.name}</p>
        </div>
      </div>
    </>
  );
}
