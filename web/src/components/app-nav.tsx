'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { CalendarDays, CalendarRange, Sun, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/hoy', label: 'Hoy', icon: Sun },
  { href: '/semana', label: 'Semana', icon: CalendarRange },
  { href: '/mes', label: 'Mes', icon: CalendarDays },
] as const;

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

/** Móvil: barra inferior fija. Escritorio (md+): barra lateral. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Bottom Tab Bar (móvil) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 backdrop-blur-lg md:hidden">
        <ul className="mx-auto flex max-w-md items-stretch justify-around">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link href={href} className={cn('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                  {active && <motion.span layoutId="tab-dot" className="absolute top-0 h-0.5 w-10 rounded-full bg-accent" />}
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sidebar (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r p-4 md:flex">
        <p className="mb-6 px-3 text-lg font-semibold tracking-tight">Agenda</p>
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium', active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60')}>
              <Icon className="size-4" /> {label}
            </Link>
          );
        })}
        {BOT && (
          <a href={`https://t.me/${BOT}`} className="mt-auto flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
            <Mic className="size-4" /> Hablar con el asistente
          </a>
        )}
      </aside>
    </>
  );
}

/** Botón flotante "voice-first": abre el chat del bot de Telegram para grabar un audio. */
export function VoiceFab() {
  if (!BOT) return null;
  return (
    <motion.a
      href={`https://t.me/${BOT}`}
      whileTap={{ scale: 0.9 }}
      aria-label="Grabar nota de voz para el asistente"
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-black/20 md:hidden"
    >
      <Mic className="size-6" />
    </motion.a>
  );
}
