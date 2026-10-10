/** Staff profile: what this person can do in the centre. */
export function AccessCard({ linked, role }: { linked: boolean; role: string | null }) {
  return (
    <div className="text-sm">
      {!linked ? <p className="text-xs text-slate-500">Not signed up yet: invite them and their account links to this record.</p>
        : role === "owner" || role === "admin" ? <p className="text-xs text-slate-500">{role === "owner" ? "Superadmin: runs the centre and pays for it." : "Office admin: what they can reach is set under Instructors → Office access."}</p>
        : <p className="text-xs text-slate-500">Instructor app: their shifts, availability, confirmations, certs and hours. Senior instructors and volunteers are instructors too; office access is granted separately under Instructors → Office access.</p>}
    </div>
  );
}
