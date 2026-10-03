import type { Metadata } from "next";
import { apexDomain } from "@/lib/config";
import { LoginChooser } from "@/components/marketing/LoginChooser";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your ActivityRoster centre: the office for centre admins, or the instructor portal.",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <h1 className="font-display text-3xl font-bold text-navy">Sign in</h1>
        <p className="mt-2 text-slate-600">Every centre has its own address. Tell us which one is yours and whether you run it or work there, and we&rsquo;ll take you to the right door.</p>
      </div>
      <LoginChooser apex={apexDomain()} />
    </section>
  );
}
