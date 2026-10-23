import { redirect } from "next/navigation";

/** The old admin/instructor chooser: the sign-in page routes by membership itself. Old links still work. */
export default function LoginPage() {
  redirect("/sign-in");
}
