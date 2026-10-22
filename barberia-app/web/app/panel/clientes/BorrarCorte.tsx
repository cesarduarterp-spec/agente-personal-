"use client";

import { useTransition } from "react";
import { borrarCorte } from "./actions";

export default function BorrarCorte({ corteId, clienteId }: { corteId: string; clienteId: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button disabled={pendiente} className="text-sm text-red-700 underline dark:text-red-400"
      onClick={() => confirm("¿Borrar este corte y sus fotos?") && iniciar(async () => { await borrarCorte(corteId, clienteId); })}>
      Borrar
    </button>
  );
}
