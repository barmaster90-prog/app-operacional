-- Rode este arquivo uma vez no Supabase: SQL Editor > New query > colar > Run.

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  casas text[] not null check (cardinality(casas) > 0),
  local text,
  nome text not null,
  tipo text,
  status text not null default 'Ideia'
    check (status in ('Ideia', 'Negociando', 'Confirmado')),
  horario text,
  atracoes jsonb not null default '[]'::jsonb,
  entrada text,
  promocao text,
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

-- Material para a agência construir a arte (um por evento).
create table if not exists public.materiais (
  evento_id uuid primary key references public.eventos (id) on delete cascade,
  descricao text,
  ideia text,
  links_fotos jsonb not null default '[]'::jsonb, -- [{ artista, url }]
  logotipo text,
  referencia text,
  importante text,
  anexos jsonb not null default '[]'::jsonb,
  em_producao boolean not null default false,
  em_producao_por text,
  em_producao_em timestamptz
);

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
alter table public.materiais enable row level security;

drop policy if exists "equipe acessa eventos" on public.eventos;
create policy "equipe acessa eventos" on public.eventos
  for all to authenticated using (true) with check (true);

drop policy if exists "equipe acessa datas" on public.datas_especiais;
create policy "equipe acessa datas" on public.datas_especiais
  for all to authenticated using (true) with check (true);

drop policy if exists "equipe acessa materiais" on public.materiais;
create policy "equipe acessa materiais" on public.materiais
  for all to authenticated using (true) with check (true);

-- Imagens anexadas ao material ficam num bucket privado.
insert into storage.buckets (id, name, public) values ('materiais', 'materiais', false)
  on conflict (id) do nothing;

drop policy if exists "equipe acessa imagens" on storage.objects;
create policy "equipe acessa imagens" on storage.objects
  for all to authenticated using (bucket_id = 'materiais') with check (bucket_id = 'materiais');
