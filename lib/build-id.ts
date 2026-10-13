/**
 * The build that is running. The deploy workflows set NEXT_PUBLIC_BUILD_ID to
 * an opaque id for each deploy (the Actions run, never the commit, so it says
 * nothing about which code is live); Next inlines it at build time, so the browser
 * bundle and the server each know which build they came from. A page left
 * open across a deploy compares its own id with /api/version and asks for a
 * reload before a stale save can fail. Local and test builds say "dev".
 */
export const BUILD_ID: string = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
