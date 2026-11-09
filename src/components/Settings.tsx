import { useEffect, useRef, useState } from 'react';
import { Cloud, CloudDownload, CloudUpload, Link2, LogOut, Upload } from 'lucide-react';
import { Modal } from './Modal';
import { useUiStore } from '../store/useUiStore';
import { useTacticaStore } from '../store/useTacticaStore';
import { startTour } from '../lib/tour';
import { cloudEnabled, currentUserEmail, pullWorkspace, pushWorkspace, signInWithEmail, signOut } from '../lib/supabase';
import { useExportActions } from '../hooks/useExportActions';

export function Settings() {
  const open = useUiStore((s) => s.settingsOpen);
  const set = useUiStore((s) => s.set);
  const toast = useUiStore((s) => s.toast);
  const ask = useUiStore((s) => s.ask);
  const importJSON = useTacticaStore((s) => s.importJSON);
  const readOnly = useTacticaStore((s) => s.readOnly);
  const exp = useExportActions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [user, setUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) currentUserEmail().then(setUser).catch(() => setUser(null)); }, [open]);
  const close = () => set({ settingsOpen: false });

  const wrap = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try { await fn(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    const ok = await ask({ title: 'Importar JSON', body: `Se reemplazarán las tácticas actuales por las de «${f.name}». Puedes deshacer con Ctrl/Cmd+Z.`, confirmLabel: 'Importar' });
    if (!ok) return;
    const r = importJSON(await f.text());
    toast(r.ok ? 'Importación correcta' : r.error, r.ok ? 'info' : 'error');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Modal open={open} title="Ajustes" onClose={close} size="md">
      <div className="flex flex-col gap-6">
        <section aria-labelledby="s-tour">
          <h3 id="s-tour" className="text-lg mb-2">Onboarding</h3>
          <button className="btn" onClick={() => { close(); setTimeout(startTour, 50); }}>Reactivar tour de 3 pasos</button>
        </section>

        <section aria-labelledby="s-imp">
          <h3 id="s-imp" className="text-lg mb-2">Importar</h3>
          <p className="text-sm mb-2">JSON exportado por esta app (formato versionado v1). Se valida antes de tocar tus datos.</p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" id="imp-file" onChange={(e) => onFile(e.target.files?.[0])} disabled={readOnly} />
          <label htmlFor="imp-file" className={`btn ${readOnly ? 'line-through' : 'cursor-pointer'}`}><Upload size={16} aria-hidden /> Elegir archivo JSON</label>
        </section>

        <section aria-labelledby="s-cloud">
          <h3 id="s-cloud" className="text-lg mb-2 flex items-center gap-2"><Cloud size={18} aria-hidden /> Nube (Supabase)</h3>
          {!cloudEnabled ? (
            <p className="text-sm border-2 border-dashed border-black p-3">
              Modo local. Para sincronizar entre dispositivos y crear enlaces cortos, define <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> al construir (ver README).
            </p>
          ) : user ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">Sesión: <span className="font-bold">{user}</span></p>
              <div className="flex flex-wrap gap-2">
                <button className="btn" disabled={busy || readOnly} onClick={wrap(async () => { await pushWorkspace(useTacticaStore.getState().tacticas); toast('Subido a la nube'); })}><CloudUpload size={16} aria-hidden /> Subir</button>
                <button className="btn" disabled={busy || readOnly} onClick={wrap(async () => {
                  const r = await pullWorkspace();
                  if (!r) return toast('No hay copia en la nube todavía');
                  const ok = await ask({ title: 'Descargar de la nube', body: `Reemplazar tus ${useTacticaStore.getState().tacticas.length} tácticas locales por ${r.tacticas.length} de la nube (${new Date(r.updatedAt).toLocaleString('es-ES')})?`, confirmLabel: 'Reemplazar' });
                  if (!ok) return;
                  const res = importJSON(JSON.stringify({ tacticas: r.tacticas }));
                  toast(res.ok ? 'Datos descargados' : res.error, res.ok ? 'info' : 'error');
                })}><CloudDownload size={16} aria-hidden /> Descargar</button>
                <button className="btn" disabled={busy} onClick={exp.shortLink}><Link2 size={16} aria-hidden /> Enlace corto</button>
                <button className="btn" disabled={busy} onClick={wrap(async () => { await signOut(); setUser(null); })}><LogOut size={16} aria-hidden /> Salir</button>
              </div>
            </div>
          ) : (
            <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); void wrap(async () => { await signInWithEmail(email); toast('Te enviamos un enlace mágico por email'); })(); }}>
              <label htmlFor="s-email" className="sr-only">Email</label>
              <input id="s-email" type="email" required className="input" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn btn-primary" disabled={busy}>Entrar</button>
            </form>
          )}
        </section>

        <section aria-labelledby="s-keys">
          <h3 id="s-keys" className="text-lg mb-2">Atajos</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt><kbd className="chip">Ctrl/⌘ K</kbd></dt><dd>Comando rápido</dd>
            <dt><kbd className="chip">Ctrl/⌘ Z</kbd></dt><dd>Deshacer (30 acciones)</dd>
            <dt><kbd className="chip">Ctrl/⌘ ⇧ Z</kbd></dt><dd>Rehacer</dd>
            <dt><kbd className="chip">Espacio · flechas · Enter · Esc</kbd></dt><dd>Mover tarjetas con teclado</dd>
          </dl>
        </section>
      </div>
    </Modal>
  );
}
