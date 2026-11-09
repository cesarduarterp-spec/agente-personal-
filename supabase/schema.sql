-- Táctica Aterrizada · esquema Supabase
-- Ejecuta este archivo en Supabase → SQL Editor.

-- 1) Copia en la nube por usuario
create table if not exists public.workspaces (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  v          int  not null default 1,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;

drop policy if exists "workspace propio: leer" on public.workspaces;
create policy "workspace propio: leer" on public.workspaces
  for select using (auth.uid() = user_id);
drop policy if exists "workspace propio: insertar" on public.workspaces;
create policy "workspace propio: insertar" on public.workspaces
  for insert with check (auth.uid() = user_id);
drop policy if exists "workspace propio: actualizar" on public.workspaces;
create policy "workspace propio: actualizar" on public.workspaces
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Enlaces cortos de solo lectura (cualquiera con el id puede leer)
create table if not exists public.shared_snapshots (
  id         text primary key check (char_length(id) between 6 and 16),
  v          int  not null default 1,
  data       jsonb not null check (pg_column_size(data) < 500000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.shared_snapshots enable row level security;

drop policy if exists "snapshots: lectura pública" on public.shared_snapshots;
create policy "snapshots: lectura pública" on public.shared_snapshots
  for select using (true);
drop policy if exists "snapshots: crear autenticado" on public.shared_snapshots;
create policy "snapshots: crear autenticado" on public.shared_snapshots
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "snapshots: borrar propios" on public.shared_snapshots;
create policy "snapshots: borrar propios" on public.shared_snapshots
  for delete using (created_by = auth.uid());
