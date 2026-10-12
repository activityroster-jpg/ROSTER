/**
 * The build that is running. The deploy workflows set NEXT_PUBLIC_BUILD_ID to
 * the commit being deployed; Next inlines it at build time, so the browser
 * bundle and the server each know which build they came from. A page left
 * open across a deploy compares its own id with /api/version and asks for a
 * reload before a stale save can fail. Local and test builds say "dev".
 */
export const BUILD_ID: string = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
