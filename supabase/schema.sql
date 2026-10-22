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
  atracoes jsonb not null default '[]'::jsonb, -- só os nomes: [{ nome }]
  entrada text,
  promocao text,
  criado_por text,
  atualizado_em timestamptz not null default now()
);

create index if not exists eventos_data_idx on public.eventos (data);

-- Valores das atrações (cachê e observações). Só a Gestão lê e grava.
create table if not exists public.financeiro (
  evento_id uuid primary key references public.eventos (id) on delete cascade,
  atracoes jsonb not null default '[]'::jsonb -- [{ nome, cache, obs }]
);

-- Perfil de cada login. Toda conta nova entra como Produção; a Gestão muda o papel aqui.
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  papel text not null default 'producao' check (papel in ('gestao', 'producao'))
);

create or replace function public.criar_perfil() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome) values (new.id, split_part(new.email, '@', 1))
    on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_conta on auth.users;
create trigger ao_criar_conta after insert on auth.users
  for each row execute function public.criar_perfil();

create or replace function public.e_gestao() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'gestao');
$$;

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

-- Regras de acesso: todo login lê a agenda e o material; só a Gestão grava e vê valores.
alter table public.eventos enable row level security;
alter table public.financeiro enable row level security;
alter table public.perfis enable row level security;
alter table public.datas_especiais enable row level security;
alter table public.materiais enable row level security;

drop policy if exists "equipe acessa eventos" on public.eventos;
drop policy if exists "equipe acessa datas" on public.datas_especiais;
drop policy if exists "equipe acessa materiais" on public.materiais;
drop policy if exists "equipe acessa imagens" on storage.objects;

drop policy if exists "equipe lê eventos" on public.eventos;
create policy "equipe lê eventos" on public.eventos for select to authenticated using (true);
drop policy if exists "gestão grava eventos" on public.eventos;
create policy "gestão grava eventos" on public.eventos for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

drop policy if exists "só gestão vê valores" on public.financeiro;
create policy "só gestão vê valores" on public.financeiro for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

drop policy if exists "cada um lê perfis" on public.perfis;
create policy "cada um lê perfis" on public.perfis for select to authenticated using (true);
drop policy if exists "gestão grava perfis" on public.perfis;
create policy "gestão grava perfis" on public.perfis for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

drop policy if exists "equipe lê datas" on public.datas_especiais;
create policy "equipe lê datas" on public.datas_especiais for select to authenticated using (true);
drop policy if exists "gestão grava datas" on public.datas_especiais;
create policy "gestão grava datas" on public.datas_especiais for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

drop policy if exists "equipe lê materiais" on public.materiais;
create policy "equipe lê materiais" on public.materiais for select to authenticated using (true);
drop policy if exists "gestão grava materiais" on public.materiais;
create policy "gestão grava materiais" on public.materiais for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

-- A Produção só pode marcar ou desmarcar "em produção", por esta função.
create or replace function public.marcar_producao(p_evento uuid, p_valor boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare
  quem text;
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  select coalesce(nome, 'equipe') into quem from public.perfis where id = auth.uid();
  insert into public.materiais (evento_id, em_producao, em_producao_por, em_producao_em)
    values (p_evento, p_valor, case when p_valor then quem end, case when p_valor then now() end)
  on conflict (evento_id) do update set
    em_producao = excluded.em_producao,
    em_producao_por = excluded.em_producao_por,
    em_producao_em = excluded.em_producao_em;
end $$;

revoke all on function public.marcar_producao(uuid, boolean) from public, anon;
grant execute on function public.marcar_producao(uuid, boolean) to authenticated;

-- Imagens anexadas ao material ficam num bucket privado.
insert into storage.buckets (id, name, public) values ('materiais', 'materiais', false)
  on conflict (id) do nothing;

drop policy if exists "equipe vê imagens" on storage.objects;
create policy "equipe vê imagens" on storage.objects for select to authenticated
  using (bucket_id = 'materiais');
drop policy if exists "gestão grava imagens" on storage.objects;
create policy "gestão grava imagens" on storage.objects for all to authenticated
  using (bucket_id = 'materiais' and public.e_gestao())
  with check (bucket_id = 'materiais' and public.e_gestao());
