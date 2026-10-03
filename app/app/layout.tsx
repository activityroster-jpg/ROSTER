import { Logo } from "@/components/Logo";

export const metadata = {
  title: "ActivityRoster app",
  robots: { index: false, follow: false },
};

/**
 * The mobile app's shell screens (sign in, create account, join a centre,
 * switch centre). Served on the apex domain so the native wrapper has one
 * origin; once a centre is selected the ordinary /portal takes over.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-canvas">
      <header className="bg-navy px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
        <Logo variant="onDark" size="md" />
        <p className="mt-1 text-sm text-white/70">Instructor app</p>
      </header>
      <main className="flex-1 px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</main>
    </div>
  );
}
