"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoTurno } from "./actions";

export default function Acciones({ turnoId, estado }: { turnoId: string; estado: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const ir = (nuevo: "confirmado" | "completado" | "ausente" | "cancelado", confirmar?: string) => {
    if (confirmar && !confirm(confirmar)) return;
    setError(null);
    iniciar(async () => {
      const r = await cambiarEstadoTurno(turnoId, nuevo);
      if (!r.ok) setError(r.error ?? "Error");
      else router.refresh();
    });
  };
  const b = "underline disabled:opacity-50";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
      {estado === "confirmado" ? (
        <>
          <button disabled={pendiente} className={b} onClick={() => ir("completado")}>Realizado</button>
          <button disabled={pendiente} className={b} onClick={() => ir("ausente")}>No vino</button>
          <button disabled={pendiente} className={`${b} text-red-700 dark:text-red-400`} onClick={() => ir("cancelado", "¿Cancelar este turno? Se le avisa al cliente por mail.")}>Cancelar</button>
        </>
      ) : (
        <button disabled={pendiente} className={b} onClick={() => ir("confirmado")}>Volver a confirmado</button>
      )}
      {error && <span role="alert" className="text-red-700 dark:text-red-400">{error}</span>}
    </div>
  );
}
