"use client";

export type Franja = { dia_semana: number; desde: string; hasta: string };

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN = [1, 2, 3, 4, 5, 6, 0]; // semana que empieza el lunes
const campo = "rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

// Horario semanal: cada día se activa y puede tener varias franjas (ej: 9 a 14 y 17 a 20).
export default function HorarioSemanal({ rangos, onChange }: { rangos: Franja[]; onChange: (r: Franja[]) => void }) {
  const deDia = (d: number) => rangos.map((r, i) => ({ r, i })).filter(({ r }) => r.dia_semana === d);

  const alternar = (d: number, activo: boolean) =>
    onChange(activo ? [...rangos, { dia_semana: d, desde: "09:00", hasta: "14:00" }, { dia_semana: d, desde: "17:00", hasta: "20:00" }]
                    : rangos.filter((r) => r.dia_semana !== d));
  const editar = (i: number, parche: Partial<Franja>) => onChange(rangos.map((r, j) => (j === i ? { ...r, ...parche } : r)));
  const quitar = (i: number) => onChange(rangos.filter((_, j) => j !== i));
  const agregar = (d: number) => {
    const ultima = deDia(d).at(-1)?.r;
    onChange([...rangos, { dia_semana: d, desde: ultima ? ultima.hasta : "09:00", hasta: "20:00" }]);
  };
  // copia las franjas de un día a todos los días que ya están activos
  const copiarATodos = (d: number) => {
    const modelo = deDia(d).map(({ r }) => r);
    const activos = ORDEN.filter((x) => x !== d && deDia(x).length > 0);
    onChange([...rangos.filter((r) => !activos.includes(r.dia_semana)), ...activos.flatMap((x) => modelo.map((m) => ({ ...m, dia_semana: x })))]);
  };

  return (
    <div className="flex flex-col gap-3">
      {ORDEN.map((d) => {
        const franjas = deDia(d);
        return (
          <div key={d} className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={franjas.length > 0} onChange={(e) => alternar(d, e.target.checked)} /> {DIAS[d]}
              {franjas.length === 0 && <span className="text-sm font-normal text-zinc-500">No atiendo</span>}
            </label>
            {franjas.map(({ r, i }) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                <input type="time" value={r.desde} onChange={(e) => editar(i, { desde: e.target.value })} className={`${campo} min-w-0`} aria-label={`${DIAS[d]} desde`} />
                <span>a</span>
                <input type="time" value={r.hasta} onChange={(e) => editar(i, { hasta: e.target.value })} className={`${campo} min-w-0`} aria-label={`${DIAS[d]} hasta`} />
                {franjas.length > 1 && <button type="button" aria-label="Quitar franja" onClick={() => quitar(i)}>✕</button>}
              </div>
            ))}
            {franjas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <button type="button" className="underline" onClick={() => agregar(d)}>+ Agregar otra franja</button>
                <button type="button" className="underline" onClick={() => copiarATodos(d)}>Copiar a los demás días</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
