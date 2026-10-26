/** Esqueleto mientras se hidrata desde localStorage o desde ?s=. */
export function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando tu matriz…</span>
      <div className="grid grid-cols-2 gap-0 border-2 border-black sm:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse border-black p-3 even:bg-heat1 sm:border-r-2">
            <div className="h-2 w-16 bg-black" />
            <div className="mt-3 h-4 w-20 bg-black" />
          </div>
        ))}
      </div>
      <div className="grid animate-pulse grid-cols-6 border-2 border-black">
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} className={`h-14 border-b-2 border-r-2 border-black ${i % 7 === 0 ? 'bg-yellow' : i % 5 === 0 ? 'bg-heat1' : 'bg-white'}`} />
        ))}
      </div>
    </div>
  );
}
