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
-- quando o documento foi criado (usado para voltar um orçamento a um momento anterior)
alter table public.documentos add column if not exists criado_em timestamptz not null default now();
grant select, insert, update, delete on public.documentos to authenticated;

-- carimbo de quem gravou e quando
create or replace function public.documentos_carimbo() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then new.criado_em := old.criado_em; else new.criado_em := now(); end if;
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

-- ===================== Histórico de versões =====================
-- Antes de cada alteração ou exclusão, a versão anterior do documento vai para
-- documentos_historico. Como o app grava sozinho a cada edição, as gravações seguidas
-- da mesma pessoa no mesmo documento viram uma versão a cada 30 minutos; troca de
-- autor, exclusão e restauração sempre guardam. Versões com mais de 90 dias são apagadas.
create table if not exists public.documentos_historico (
  id             bigint generated always as identity primary key,
  caminho        text        not null,
  dados          jsonb       not null,
  criado_em      timestamptz,
  atualizado_em  timestamptz not null,
  atualizado_por text,
  operacao       text        not null,  -- alteracao | exclusao | antes_restauracao
  arquivado_em   timestamptz not null default now(),
  arquivado_por  text
);
create index if not exists documentos_historico_caminho on public.documentos_historico (caminho, arquivado_em desc);

create or replace function public.documentos_arquiva() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ultimo  timestamptz;
  forcado boolean := coalesce(current_setting('orc.arquivar', true), '') = 'sim';
begin
  if tg_op = 'UPDATE' then
    if new.dados is not distinct from old.dados then return null; end if;
    select max(h.arquivado_em) into ultimo from documentos_historico h where h.caminho = old.caminho;
    if not forcado
       and old.atualizado_por is not distinct from new.atualizado_por
       and ultimo is not null and ultimo > now() - interval '30 minutes' then
      return null;
    end if;
  end if;
  insert into documentos_historico (caminho, dados, criado_em, atualizado_em, atualizado_por, operacao, arquivado_por)
  values (old.caminho, old.dados, old.criado_em, old.atualizado_em, old.atualizado_por,
          case when forcado then 'antes_restauracao' when tg_op = 'DELETE' then 'exclusao' else 'alteracao' end,
          coalesce(auth.jwt() ->> 'email', current_user));
  delete from documentos_historico where caminho = old.caminho and arquivado_em < now() - interval '90 days';
  return null;
end $$;
drop trigger if exists documentos_arquiva on public.documentos;
create trigger documentos_arquiva after update or delete on public.documentos
  for each row execute function public.documentos_arquiva();

-- o histórico só é lido; quem grava é o gatilho acima
alter table public.documentos_historico enable row level security;
revoke all on public.documentos_historico from anon, authenticated;
grant select on public.documentos_historico to authenticated;
drop policy if exists "historico ler" on public.documentos_historico;
create policy "historico ler" on public.documentos_historico for select to authenticated using (true);

-- lista das versões, sem o conteúdo, com o orçamento a que pertencem
create or replace view public.documentos_versoes with (security_invoker = true) as
select h.id,
       h.caminho,
       case when h.caminho like 'orcamentos/%' then split_part(h.caminho, '/', 2) end as orcamento,
       coalesce(h.dados ->> 'nome', h.caminho) as nome,
       h.atualizado_em,
       h.atualizado_por,
       h.operacao,
       h.arquivado_em,
       pg_size_pretty(pg_column_size(h.dados)::bigint) as tamanho
  from public.documentos_historico h;
grant select on public.documentos_versoes to authenticated;

-- Restaurar um documento para uma versão (recria se foi excluído). A versão atual vai
-- para o histórico antes, então a restauração também pode ser desfeita.
create or replace function public.restaurar_versao(p_id bigint) returns text
language plpgsql security invoker set search_path = public as $$
declare h documentos_historico;
begin
  select * into h from documentos_historico where id = p_id;
  if not found then raise exception 'Versão % não encontrada no histórico', p_id; end if;
  perform set_config('orc.arquivar', 'sim', true);
  insert into documentos (caminho, dados) values (h.caminho, h.dados)
    on conflict (caminho) do update set dados = excluded.dados;
  perform set_config('orc.arquivar', '', true);
  return format('%s restaurado para a versão de %s (%s)', h.caminho,
    to_char(h.atualizado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), coalesce(h.atualizado_por, '?'));
end $$;
revoke all on function public.restaurar_versao(bigint) from public, anon;
grant execute on function public.restaurar_versao(bigint) to authenticated;

-- Voltar um conjunto de documentos ao que eram num momento: um orçamento inteiro
-- ('orcamentos/<id>': dados, itens, composições, insumos, extras e projetos) ou o
-- catálogo ('cat_insumos', 'cat_cpus'). Para cada documento usa a primeira versão
-- guardada depois do momento; documentos criados depois dele são excluídos; os que
-- não mudaram ficam como estão. Como as versões são guardadas a cada 30 minutos,
-- o resultado é o estado guardado mais próximo do momento pedido.
-- O estado atual vai para o histórico antes, então dá para desfazer.
create or replace function public.restaurar_ate(p_prefixo text, p_momento timestamptz) returns text
language plpgsql security invoker set search_path = public as $$
declare
  c text; h documentos_historico; d documentos;
  nr int := 0; ne int := 0;
begin
  if coalesce(p_prefixo, '') = '' then raise exception 'Informe o prefixo, por exemplo orcamentos/<id> ou cat_insumos'; end if;
  perform set_config('orc.arquivar', 'sim', true);
  for c in
    select caminho from documentos where caminho = p_prefixo or left(caminho, length(p_prefixo) + 1) = p_prefixo || '/'
    union
    select caminho from documentos_historico where caminho = p_prefixo or left(caminho, length(p_prefixo) + 1) = p_prefixo || '/'
  loop
    select * into h from documentos_historico where caminho = c and arquivado_em >= p_momento order by arquivado_em, id limit 1;
    if found then
      if h.criado_em is not null and h.criado_em > p_momento then
        delete from documentos where caminho = c; if found then ne := ne + 1; end if;
      else
        insert into documentos (caminho, dados) values (c, h.dados)
          on conflict (caminho) do update set dados = excluded.dados;
        nr := nr + 1;
      end if;
    else
      select * into d from documentos where caminho = c;
      if found and d.criado_em > p_momento then delete from documentos where caminho = c; ne := ne + 1; end if;
    end if;
  end loop;
  perform set_config('orc.arquivar', '', true);
  return format('%s documentos restaurados e %s excluídos (criados depois de %s)', nr, ne,
    to_char(p_momento at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'));
end $$;
revoke all on function public.restaurar_ate(text, timestamptz) from public, anon;
grant execute on function public.restaurar_ate(text, timestamptz) to authenticated;
