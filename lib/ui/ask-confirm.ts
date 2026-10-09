"use client";

/**
 * "Are you sure?" as a box on the page, not the browser's confirm() popup:
 * some browsers, installed web apps and phone webviews block that popup
 * without telling anyone, so the button seemed to do nothing (equipment
 * delete, 9 Oct). Resolves true for the confirm button, false otherwise.
 */
export function askConfirm(message: string, confirmLabel = "Yes, go ahead"): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "w-full max-w-md rounded-card border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-navy/40";
    const box = document.createElement("div");
    box.className = "p-5";
    const text = document.createElement("p");
    text.className = "text-sm text-navy";
    text.textContent = message;
    const row = document.createElement("div");
    row.className = "mt-5 flex items-center justify-end gap-2";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50";
    cancel.textContent = "Cancel";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90";
    ok.textContent = confirmLabel;
    row.appendChild(cancel);
    row.appendChild(ok);
    box.appendChild(text);
    box.appendChild(row);
    dialog.appendChild(box);
    document.body.appendChild(dialog);
    let answered = false;
    const done = (v: boolean) => {
      if (answered) return;
      answered = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(v);
    };
    ok.addEventListener("click", () => done(true));
    cancel.addEventListener("click", () => done(false));
    dialog.addEventListener("cancel", (e) => { e.preventDefault(); done(false); });
    dialog.showModal();
    ok.focus();
  });
}
