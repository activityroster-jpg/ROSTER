/**
 * The stock photo library restricts how often it is asked, so blog cover
 * images are pulled one at a time with at least this many seconds between
 * pulls. Shared by the server action (which enforces it) and the admin page
 * (which counts it down between images).
 */
export const COVER_PULL_GAP_S = 20;

/** How many covers one press of "Fetch cover images" works through. */
export const COVER_RUN_SIZE = 10;
