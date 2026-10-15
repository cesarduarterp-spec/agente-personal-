'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

/** Acceso por "magic link" de Supabase (uso personal: solo emails en app_users ven datos). */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => { if (data.session) router.replace('/hoy'); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) router.replace('/hoy'); });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/hoy`, shouldCreateUser: false },
    });
    setState(error ? 'error' : 'sent');
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div className="space-y-3">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Mic className="size-7" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
        <p className="text-muted-foreground">Tu asistente ejecutivo. Hablale por Telegram; mirá todo acá en vivo.</p>
      </div>

      {state === 'sent' ? (
        <p className="rounded-lg border bg-card p-4 text-sm">📬 Te mandamos un link a <b>{email}</b>. Abrilo desde este dispositivo.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="h-12 w-full rounded-md border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" size="lg" className="w-full" disabled={state === 'sending'}>
            {state === 'sending' ? 'Enviando…' : 'Entrar con link mágico'}
          </Button>
          {state === 'error' && <p className="text-sm text-red-600">No se pudo enviar. ¿El email está habilitado?</p>}
        </form>
      )}
    </main>
  );
}
