-- Sistema de Orçamentos Unità · banco no Supabase
-- Rodar inteiro em Supabase > SQL Editor. Pode rodar de novo sem perder dados.
--
-- O app guarda tudo como documentos JSON endereçados por caminho, no mesmo formato
-- do banco do Artifact: "cat_insumos/c3", "orcamentos/<id>", "orcamentos/<id>/partes/it0".
-- A coleção de um documento é o caminho sem o último trecho.
--
-- Acesso: qualquer usuário autenticado lê e grava. Quem pode entrar é controlado no
-- painel (Authentication): deixar "Allow new users to sign up" desligado e cadastrar
-- cada pessoa em Users > Add user (Invite user ou Create new user).

create table if not exists public.documentos (
  caminho text primary key check (caminho ~ '^[^/]+/[^/]+(/[^/]+/[^/]+)*$'),
  colecao text generated always as (regexp_replace(caminho, '/[^/]+$', '')) stored,
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
create index if not exists documentos_colecao on public.documentos (colecao);

-- carimbo de quem gravou e quando
create or replace function public.documentos_carimbo() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(auth.jwt() ->> 'email', new.atualizado_por);
  return new;
end $$;
drop trigger if exists documentos_carimbo on public.documentos;
create trigger documentos_carimbo before insert or update on public.documentos
  for each row execute function public.documentos_carimbo();

-- merge aninhado igual ao do Artifact: objetos são mesclados, null apaga a chave, o resto substitui
create or replace function public.jsonb_mesclar(a jsonb, b jsonb) returns jsonb
language plpgsql immutable as $$
declare
  r jsonb := coalesce(a, '{}'::jsonb);
  k text; v jsonb;
begin
  if jsonb_typeof(r) <> 'object' then r := '{}'::jsonb; end if;
  for k, v in select * from jsonb_each(b) loop
    if jsonb_typeof(v) = 'null' then
      r := r - k;
    elsif jsonb_typeof(v) = 'object' and jsonb_typeof(r -> k) = 'object' then
      r := jsonb_set(r, array[k], public.jsonb_mesclar(r -> k, v));
    else
      r := jsonb_set(r, array[k], v);
    end if;
  end loop;
  return r;
end $$;

-- update do app: mescla no banco, numa única operação (duas pessoas gravando o mesmo bloco não se sobrescrevem).
-- Devolve false se o documento não existe; o app então cria com set.
create or replace function public.documento_atualizar(p_caminho text, p_dados jsonb) returns boolean
language plpgsql security invoker as $$
begin
  update public.documentos set dados = public.jsonb_mesclar(dados, p_dados) where caminho = p_caminho;
  return found;
end $$;

alter table public.documentos enable row level security;
drop policy if exists "documentos ler" on public.documentos;
drop policy if exists "documentos inserir" on public.documentos;
drop policy if exists "documentos alterar" on public.documentos;
drop policy if exists "documentos excluir" on public.documentos;
create policy "documentos ler"     on public.documentos for select to authenticated using (true);
create policy "documentos inserir" on public.documentos for insert to authenticated with check (true);
create policy "documentos alterar" on public.documentos for update to authenticated using (true) with check (true);
create policy "documentos excluir" on public.documentos for delete to authenticated using (true);
revoke all on public.documentos from anon;
revoke execute on function public.documento_atualizar(text, jsonb) from anon, public;
grant execute on function public.documento_atualizar(text, jsonb) to authenticated;

-- tempo real: quem está com a tela aberta recebe as mudanças dos colegas
do $$ begin
  alter publication supabase_realtime add table public.documentos;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- imagens (modelo 3D). Bucket público: o endereço da imagem é aleatório e vai dentro do orçamento.
insert into storage.buckets (id, name, public) values ('imagens', 'imagens', true)
  on conflict (id) do update set public = true;
drop policy if exists "imagens enviar" on storage.objects;
drop policy if exists "imagens excluir" on storage.objects;
create policy "imagens enviar"  on storage.objects for insert to authenticated with check (bucket_id = 'imagens');
create policy "imagens excluir" on storage.objects for delete to authenticated using (bucket_id = 'imagens');
