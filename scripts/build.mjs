// Build entrypoint for `npm run build`.
//
// OpenNext builds the Next.js app by invoking `npm run build` itself, so this
// script must NOT call OpenNext unconditionally or it recurses forever. We use
// an env-var guard:
//   - first entry (guard unset):  run the OpenNext Cloudflare build, setting the
//                                  guard so the nested `npm run build` it spawns
//                                  runs the plain Next build instead.
//   - nested entry (guard set):   run `next build`.
//
// Net effect: a single `npm run build` produces the .open-next bundle with no
// recursion — and Cloudflare Workers Builds can keep its default build command
// (`npm run build`) with no dashboard changes.
import { execSync } from "node:child_process";

const NESTED = "OPEN_NEXT_BUILD_ACTIVE";
const run = (cmd, env) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

try {
  if (process.env[NESTED]) {
    run("next build");
  } else {
    run("opennextjs-cloudflare build", { [NESTED]: "1" });
  }
} catch (err) {
  process.exit(err.status ?? 1);
}
