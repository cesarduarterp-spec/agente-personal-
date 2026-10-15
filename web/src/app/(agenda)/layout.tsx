import { AuthGate } from '@/components/auth-gate';
import { AppNav, VoiceFab } from '@/components/app-nav';
import { TasksProvider } from '@/lib/tasks-store';

export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <TasksProvider>
        <div className="md:flex">
          <AppNav />
          <main className="mx-auto w-full max-w-2xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pb-12">
            {children}
          </main>
        </div>
        <VoiceFab />
      </TasksProvider>
    </AuthGate>
  );
}
