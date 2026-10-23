"use client";

import { useState } from "react";

// Encabezado con logo + nombre. Un logo cuadrado va al lado del nombre; un logo ancho
// (ya trae el nombre escrito) se muestra solo, como banner, y el nombre queda para lectores de pantalla.
export default function CabeceraMarca({
  nombre, logo, alto = 64, children,
}: { nombre: string; logo: string | null; alto?: number; children?: React.ReactNode }) {
  const [ancho, setAncho] = useState(false);

  if (!logo) {
    return (
      <header>
        <h1 className="text-2xl font-semibold">{nombre}</h1>
        {children}
      </header>
    );
  }
  return (
    <header className={ancho ? "flex flex-col gap-2" : "flex items-center gap-4"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={(el) => {
          // si la imagen ya cargó antes de que React se enganchara, onLoad no se dispara
          if (el?.complete && el.naturalWidth) setAncho(el.naturalWidth / el.naturalHeight > 1.8);
        }}
        src={logo}
        alt={ancho ? "" : `Logo de ${nombre}`}
        style={{ height: alto }}
        className="w-auto max-w-full shrink-0 self-start rounded-xl object-contain"
        onLoad={(e) => setAncho(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight > 1.8)}
      />
      <div>
        <h1 className={ancho ? "sr-only" : "text-2xl font-semibold"}>{nombre}</h1>
        {children}
      </div>
    </header>
  );
}
