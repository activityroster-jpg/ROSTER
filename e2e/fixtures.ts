/** Made-up people and a course for the browser tests (local database only). */
const monday = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); // next Monday
  return d.toISOString().slice(0, 10);
})();

export const E2E = {
  slug: "e2e",
  base: process.env.E2E_BASE ?? "http://e2e.localhost:8787",
  owner: "owner@e2e.example",
  instructor: "kim@e2e.example",
  password: "Browser-Test-2027!",
  pin: "4826",
  course: "Browser test course",
  day: monday,
};
