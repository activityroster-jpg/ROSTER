import { SECURITY_CONTACT } from "@/lib/legal";
import { apexDomain } from "@/lib/config";

export const dynamic = "force-static";

/** RFC 9116 security.txt: how to report a vulnerability. Expires is refreshed by the yearly review. */
export function GET() {
  const apex = apexDomain();
  const body = [
    `Contact: mailto:${SECURITY_CONTACT}`,
    `Contact: https://${apex}/trust`,
    `Expires: 2027-10-01T00:00:00.000Z`,
    `Preferred-Languages: en`,
    `Canonical: https://${apex}/.well-known/security.txt`,
    `Policy: https://${apex}/trust`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
