/**
 * Reading a 6-digit code back from the clipboard, so someone who copied it from
 * their email can land back in the app and not retype it. Inside the app the
 * native Clipboard plugin reads it (iOS shows its small "pasted from Mail"
 * notice); in a browser `navigator.clipboard` works only from a tap, so the
 * silent read on return simply finds nothing and the Paste button still works.
 */
interface ClipboardPlugin { read: () => Promise<{ value?: string; type?: string }> }
const plugin = (): ClipboardPlugin | undefined =>
  typeof window !== "undefined"
    ? (window as unknown as { Capacitor?: { Plugins?: { Clipboard?: ClipboardPlugin } } }).Capacitor?.Plugins?.Clipboard
    : undefined;

export async function readClipboardText(): Promise<string | null> {
  const native = plugin();
  if (native) {
    try { return (await native.read()).value ?? null; } catch { return null; }
  }
  try { return await navigator.clipboard.readText(); } catch { return null; }
}

/** The first 6-digit number in some text, or null. */
export function codeInText(text: string | null | undefined): string | null {
  const m = (text ?? "").match(/(?<!\d)(\d{6})(?!\d)/);
  return m ? m[1]! : null;
}

/** Read the clipboard and return a 6-digit code if one is there. */
export async function readCodeFromClipboard(): Promise<string | null> {
  return codeInText(await readClipboardText());
}
