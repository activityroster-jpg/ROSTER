export const dynamic = "force-dynamic";

export default function NoAccessPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl font-semibold text-navy">No access to this centre</h1>
      <p className="mt-2 text-slate-600">
        Your account isn&apos;t a member of this centre. If you think this is a mistake, ask the centre admin to
        invite you.
      </p>
    </div>
  );
}
