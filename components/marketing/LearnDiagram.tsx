/**
 * Small inline-SVG diagrams for the Learning Centre. Each uses currentColor via
 * text-* classes so it stays legible on the light marketing canvas and scales
 * cleanly. Purely decorative support for the prose — every diagram has a title.
 */

function Frame({ title, children, viewBox = "0 0 400 150" }: { title: string; children: React.ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} role="img" aria-label={title} className="h-auto w-full max-w-xl rounded-lg border border-slate-100 bg-slate-50/50 p-2">
      <title>{title}</title>
      {children}
    </svg>
  );
}

const box = "fill-white";

export function LearnDiagram({ id }: { id: string }) {
  switch (id) {
    // Onboarding: 4-step flow
    case "getting-started":
      return (
        <Frame title="The four onboarding steps: how you run, courses, team, finish">
          {["How you run", "Courses", "Team", "Finish"].map((label, i) => (
            <g key={label}>
              <rect x={10 + i * 98} y={55} width={82} height={40} rx={8} className={`${box} stroke-teal`} strokeWidth={1.5} />
              <circle cx={26 + i * 98} cy={75} r={9} className="fill-teal" />
              <text x={26 + i * 98} y={79} textAnchor="middle" className="fill-white text-[11px] font-bold">{i + 1}</text>
              <text x={40 + i * 98} y={79} className="fill-navy text-[10px] font-semibold">{label}</text>
              {i < 3 ? <path d={`M${92 + i * 98} 75 h6`} className="stroke-slate-400" strokeWidth={1.5} markerEnd="url(#ar)" /> : null}
            </g>
          ))}
          <defs><marker id="ar" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" className="fill-slate-400" /></marker></defs>
        </Frame>
      );

    // Course → many sessions
    case "courses":
      return (
        <Frame title="A course is one thing made of many sessions across days and times">
          <rect x={10} y={55} width={110} height={40} rx={8} className={`${box} stroke-navy`} strokeWidth={1.5} />
          <text x={65} y={72} textAnchor="middle" className="fill-navy text-[11px] font-bold">Kids Camp</text>
          <text x={65} y={85} textAnchor="middle" className="fill-slate-400 text-[9px]">1 course</text>
          {[["Sat AM", "amber"], ["Sat PM", "amber"], ["Mon EV", "teal"], ["Wed AM", "teal"]].map(([label, tone], i) => (
            <g key={i}>
              <path d={`M120 75 C 150 75, 160 ${40 + i * 25}, 190 ${40 + i * 25}`} className="stroke-slate-300" strokeWidth={1.2} fill="none" />
              <rect x={190} y={30 + i * 25} width={90} height={20} rx={5} className={`${box} ${tone === "amber" ? "stroke-amber" : "stroke-teal"}`} strokeWidth={1.3} />
              <text x={235} y={44 + i * 25} textAnchor="middle" className="fill-navy text-[9px] font-medium">{label}</text>
            </g>
          ))}
          <text x={300} y={78} className="fill-slate-400 text-[9px]">4 sessions</text>
        </Frame>
      );

    // Rostering: the checks moat
    case "rostering":
      return (
        <Frame title="Assigning an instructor runs fit, conflict and ratio checks" viewBox="0 0 400 170">
          <rect x={150} y={10} width={100} height={26} rx={6} className={`${box} stroke-navy`} strokeWidth={1.5} />
          <text x={200} y={27} textAnchor="middle" className="fill-navy text-[10px] font-semibold">Assign instructor</text>
          {[["Qualified & in-date?", 55], ["Not double-booked?", 90], ["Ratio & safety cover?", 125]].map(([label, y], i) => (
            <g key={i}>
              <path d={`M200 ${i === 0 ? 36 : (55 + (i - 1) * 35 + 20)} V ${Number(y)}`} className="stroke-slate-300" strokeWidth={1.2} />
              <rect x={110} y={Number(y)} width={180} height={22} rx={6} className={`${box} stroke-teal`} strokeWidth={1.3} />
              <text x={200} y={Number(y) + 15} textAnchor="middle" className="fill-navy text-[10px]">{label as string}</text>
              <text x={300} y={Number(y) + 15} className="fill-starboard text-[10px] font-bold">✓</text>
            </g>
          ))}
          <text x={200} y={162} textAnchor="middle" className="fill-slate-400 text-[9px]">Any block can be overridden with a recorded reason</text>
        </Frame>
      );

    // Availability grid
    case "availability":
      return (
        <Frame title="Availability grid: free, maybe or busy per slot, with rostered markers">
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
            <text key={d} x={70 + i * 62} y={30} textAnchor="middle" className="fill-slate-400 text-[9px] font-semibold">{d}</text>
          ))}
          {["Sam", "Alex", "Jo"].map((name, r) => (
            <g key={name}>
              <text x={40} y={54 + r * 30} textAnchor="end" className="fill-navy text-[9px] font-medium">{name}</text>
              {[0, 1, 2, 3, 4].map((cix) => {
                const kinds = [
                  ["s", "s", "a", "b", "s"], ["a", "b", "s", "s", "a"], ["s", "s", "s", "b", "b"],
                ] as const;
                const k = kinds[r]![cix];
                const cls = k === "s" ? "fill-starboard" : k === "a" ? "fill-amber" : "fill-port";
                const op = k === "s" ? 0.18 : k === "a" ? 0.2 : 0.18;
                const tcls = k === "s" ? "fill-starboard" : k === "a" ? "fill-amber" : "fill-port";
                return (
                  <g key={cix}>
                    <rect x={48 + cix * 62} y={42 + r * 30} width={44} height={20} rx={4} className={cls} opacity={op} />
                    <text x={70 + cix * 62} y={56 + r * 30} textAnchor="middle" className={`${tcls} text-[10px] font-bold`}>{k === "s" ? "✓" : k === "a" ? "~" : "✕"}</text>
                    {r === 0 && cix === 2 ? <circle cx={86 + cix * 62} cy={46 + r * 30} r={2.4} className="fill-navy" /> : null}
                  </g>
                );
              })}
            </g>
          ))}
          <text x={200} y={140} textAnchor="middle" className="fill-slate-400 text-[8px]">✓ free · ~ maybe · ✕ busy · • already rostered</text>
        </Frame>
      );

    // Bulk assign: one to many
    case "bulk":
      return (
        <Frame title="Bulk assign: one instructor onto many courses in one pass">
          <circle cx={50} cy={75} r={22} className={`${box} stroke-teal`} strokeWidth={1.5} />
          <text x={50} y={72} textAnchor="middle" className="fill-navy text-[9px] font-bold">Alex</text>
          <text x={50} y={83} textAnchor="middle" className="fill-slate-400 text-[8px]">SI</text>
          {["Camp A", "Camp B", "Club", "Taster"].map((label, i) => (
            <g key={label}>
              <path d={`M72 75 C 130 75, 150 ${35 + i * 28}, 200 ${35 + i * 28}`} className="stroke-slate-300" strokeWidth={1.2} fill="none" markerEnd="url(#ar2)" />
              <rect x={200} y={26 + i * 28} width={110} height={20} rx={5} className={`${box} stroke-teal`} strokeWidth={1.3} />
              <text x={255} y={40 + i * 28} textAnchor="middle" className="fill-navy text-[9px] font-medium">{label}</text>
            </g>
          ))}
          <defs><marker id="ar2" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" className="fill-slate-400" /></marker></defs>
        </Frame>
      );

    // Admin security: login + PIN
    case "admin-security":
      return (
        <Frame title="Every admin login: password, then a 4-digit PIN">
          {[["Password", "teal"], ["4-digit PIN", "navy"], ["Admin panel", "starboard"]].map(([label, tone], i) => (
            <g key={label as string}>
              <rect x={20 + i * 130} y={55} width={110} height={40} rx={8} className={`${box} ${tone === "teal" ? "stroke-teal" : tone === "navy" ? "stroke-navy" : "stroke-starboard"}`} strokeWidth={1.5} />
              <text x={75 + i * 130} y={79} textAnchor="middle" className="fill-navy text-[10px] font-semibold">{label as string}</text>
              {i < 2 ? <path d={`M130 ${75 + 0} h ${18 + 130 - 130} `} className="stroke-slate-400" strokeWidth={1.5} markerEnd="url(#ar3)" transform={`translate(${i * 130},0)`} /> : null}
            </g>
          ))}
          <text x={200} y={120} textAnchor="middle" className="fill-slate-400 text-[8px]">Too many wrong PINs → temporary lock-out</text>
          <defs><marker id="ar3" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" className="fill-slate-400" /></marker></defs>
        </Frame>
      );

    default:
      return null;
  }
}
