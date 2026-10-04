import type { Metadata } from "next";
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
        <p className="mt-2 text-slate-600">Tell us whether you run a centre or work at one, then sign in with your email. We&rsquo;ll take you to your centre.</p>
      </div>
      <LoginChooser />
    </section>
  );
}
