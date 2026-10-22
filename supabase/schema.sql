-- Rode este arquivo uma vez no Supabase: SQL Editor > New query > colar > Run.

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  casas text[] not null check (cardinality(casas) > 0),
  local text,
  nome text not null,
  tipo text,
  status text not null default 'Ideia'
    check (status in ('Ideia', 'Negociando', 'Confirmado', 'Divulgando', 'Realizado', 'Cancelado')),
  horario text,
  atracoes jsonb not null default '[]'::jsonb,
  entrada text,
  promocao text,
  briefing text,
  obs text,
  criado_por text,
  atualizado_em timestamptz not null default now()
);

create index if not exists eventos_data_idx on public.eventos (data);

create table if not exists public.datas_especiais (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  nome text not null,
  tipo text not null check (tipo in ('feriado', 'ponto_facultativo', 'comercial', 'local'))
);

create index if not exists datas_especiais_data_idx on public.datas_especiais (data);

create or replace function public.marcar_atualizacao() returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists eventos_atualizado on public.eventos;
create trigger eventos_atualizado before update on public.eventos
  for each row execute function public.marcar_atualizacao();

-- Só quem tem login vê e edita. As contas são criadas pelo administrador no painel do Supabase.
alter table public.eventos enable row level security;
alter table public.datas_especiais enable row level security;

drop policy if exists "equipe acessa eventos" on public.eventos;
create policy "equipe acessa eventos" on public.eventos
  for all to authenticated using (true) with check (true);

drop policy if exists "equipe acessa datas" on public.datas_especiais;
create policy "equipe acessa datas" on public.datas_especiais
  for all to authenticated using (true) with check (true);
