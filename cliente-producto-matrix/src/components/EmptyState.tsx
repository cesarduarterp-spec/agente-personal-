import type { ReactNode } from 'react';

export function EmptyState({ icon, title, children, actions }: { icon?: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card mx-auto my-6 max-w-xl p-6 text-center sm:p-10">
      {icon && <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border-2 border-black bg-yellow">{icon}</div>}
      <h2 className="text-2xl sm:text-3xl">{title}</h2>
      {children && <div className="mx-auto mt-3 max-w-md text-sm">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
