"use client";

import { useState } from "react";

export default function CopiarMails({ mails }: { mails: string[] }) {
  const [estado, setEstado] = useState<"" | "ok" | "error">("");
  async function copiar() {
    try {
      await navigator.clipboard.writeText(mails.join(", "));
      setEstado("ok");
    } catch {
      setEstado("error");
    }
    setTimeout(() => setEstado(""), 2500);
  }
  return (
    <button type="button" onClick={copiar} disabled={mails.length === 0} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700">
      {estado === "ok" ? `✓ ${mails.length} mails copiados` : estado === "error" ? "No se pudo copiar" : `Copiar ${mails.length} mails`}
    </button>
  );
}
