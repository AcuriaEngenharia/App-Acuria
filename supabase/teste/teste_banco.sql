-- Teste do schema.sql: gravação com merge, acesso, histórico de versões e restauração.
-- Roda depois de supabase_simulado.sql e schema.sql. Qualquer falha interrompe com erro.
\set ON_ERROR_STOP on

create function pg_temp.como(email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('email', email)::text, false)
$$;
create function pg_temp.confere(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

-- ---------- gravação e merge ----------
select pg_temp.como('ana@exemplo.com');
set role authenticated;
insert into documentos (caminho, dados) values ('orcamentos/o1', '{"nome":"Obra 1","totais":{"custo":100,"venda":120},"tx":{"a":1}}');
select documento_atualizar('orcamentos/o1', '{"totais":{"custo":110},"tx":{"a":null,"b":2}}') as ok \gset
select documento_atualizar('orcamentos/nao_existe', '{"x":1}') as nao \gset
reset role;
select pg_temp.confere(:'ok' = 't', 'update em documento existente');
select pg_temp.confere(:'nao' = 'f', 'update em documento inexistente devolve false');
select pg_temp.confere((select dados from documentos where caminho = 'orcamentos/o1')
  = '{"nome":"Obra 1","totais":{"custo":110,"venda":120},"tx":{"b":2}}'::jsonb, 'merge aninhado: mescla objetos e null apaga a chave');
select pg_temp.confere((select colecao from documentos where caminho = 'orcamentos/o1') = 'orcamentos', 'coleção calculada pelo caminho');
select pg_temp.confere((select atualizado_por from documentos where caminho = 'orcamentos/o1') = 'ana@exemplo.com', 'carimbo de quem gravou');

-- caminho precisa ter número par de trechos (coleção/documento)
do $$ begin
  insert into documentos (caminho) values ('orcamentos');
  raise exception 'FALHOU: aceitou caminho de coleção';
exception when check_violation then raise notice 'ok: recusa caminho de coleção'; end $$;

-- ---------- acesso ----------
set role anon;
do $$ begin
  perform 1 from documentos;
  raise exception 'FALHOU: anon leu documentos';
exception when insufficient_privilege then raise notice 'ok: sem login não lê documentos'; end $$;
do $$ begin
  perform documento_atualizar('orcamentos/o1', '{}');
  raise exception 'FALHOU: anon chamou documento_atualizar';
exception when insufficient_privilege then raise notice 'ok: sem login não grava'; end $$;
reset role;

-- ---------- histórico ----------
-- gravações seguidas da mesma pessoa viram uma versão só (o merge acima já guardou a primeira)
select pg_temp.como('ana@exemplo.com');
set role authenticated;
update documentos set dados = dados || '{"v":2}' where caminho = 'orcamentos/o1';
update documentos set dados = dados || '{"v":3}' where caminho = 'orcamentos/o1';
update documentos set dados = dados || '{"v":3}' where caminho = 'orcamentos/o1';
reset role;
select pg_temp.confere((select count(*) from documentos_historico where caminho = 'orcamentos/o1') = 1, 'gravações seguidas da mesma pessoa viram uma versão');
select pg_temp.confere((select dados -> 'totais' ->> 'custo' from documentos_historico where caminho = 'orcamentos/o1') = '100', 'a versão guardada é a de antes da edição');

-- passados 30 minutos, guarda de novo
update documentos_historico set arquivado_em = now() - interval '31 minutes';
set role authenticated;
update documentos set dados = dados || '{"v":4}' where caminho = 'orcamentos/o1';
reset role;
select pg_temp.confere((select count(*) from documentos_historico where caminho = 'orcamentos/o1') = 2, 'nova versão depois de 30 minutos');

-- troca de autor guarda na hora
select pg_temp.como('bruno@exemplo.com');
set role authenticated;
update documentos set dados = dados || '{"v":5}' where caminho = 'orcamentos/o1';
reset role;
select pg_temp.confere((select count(*) from documentos_historico where caminho = 'orcamentos/o1') = 3, 'troca de autor guarda versão');

-- usuário comum lê o histórico mas não altera
set role authenticated;
select count(*) as n from documentos_versoes where orcamento = 'o1' \gset
do $$ begin
  delete from documentos_historico;
  raise exception 'FALHOU: usuário apagou o histórico';
exception when insufficient_privilege then raise notice 'ok: usuário não apaga o histórico'; end $$;
reset role;
select pg_temp.confere(:n = 3, 'lista de versões por orçamento');

-- ---------- restaurar um documento ----------
select id as vid from documentos_historico where caminho = 'orcamentos/o1' order by id limit 1 \gset
set role authenticated;
select restaurar_versao(:vid);
reset role;
select pg_temp.confere((select dados -> 'totais' ->> 'custo' from documentos where caminho = 'orcamentos/o1') = '100', 'restaurar_versao volta o conteúdo');
select pg_temp.confere((select operacao from documentos_historico where caminho = 'orcamentos/o1' order by id desc limit 1) = 'antes_restauracao', 'estado anterior guardado antes de restaurar');

-- ---------- voltar um orçamento inteiro a um momento ----------
-- o2 com dois blocos criados há 2 horas; o momento é 1 hora atrás; depois disso
-- um bloco é alterado, outro criado e outro excluído
select pg_temp.como('ana@exemplo.com');
set role authenticated;
insert into documentos (caminho, dados) values
  ('orcamentos/o2', '{"nome":"Obra 2"}'),
  ('orcamentos/o2/partes/it0', '{"m":{"a":{"qtd":1}}}'),
  ('orcamentos/o2/partes/it1', '{"m":{"b":{"qtd":2}}}');
reset role;
alter table documentos disable trigger documentos_carimbo;
update documentos set criado_em = now() - interval '2 hours' where caminho like 'orcamentos/o2%';
alter table documentos enable trigger documentos_carimbo;
select now() - interval '1 hour' as momento \gset
select pg_temp.como('bruno@exemplo.com');
set role authenticated;
update documentos set dados = '{"m":{"a":{"qtd":99}}}' where caminho = 'orcamentos/o2/partes/it0';
insert into documentos (caminho, dados) values ('orcamentos/o2/extras/premissas', '{"x":1}');
delete from documentos where caminho = 'orcamentos/o2/partes/it1';
-- outro orçamento com prefixo parecido não pode ser afetado
insert into documentos (caminho, dados) values ('orcamentos/o20', '{"nome":"Obra 20"}');
select restaurar_ate('orcamentos/o2', :'momento');
reset role;
select pg_temp.confere((select dados -> 'm' -> 'a' ->> 'qtd' from documentos where caminho = 'orcamentos/o2/partes/it0') = '1', 'bloco alterado volta ao momento');
select pg_temp.confere(exists (select 1 from documentos where caminho = 'orcamentos/o2/partes/it1'), 'bloco excluído é recriado');
select pg_temp.confere(not exists (select 1 from documentos where caminho = 'orcamentos/o2/extras/premissas'), 'bloco criado depois do momento é excluído');
select pg_temp.confere((select dados ->> 'nome' from documentos where caminho = 'orcamentos/o2') = 'Obra 2', 'bloco sem mudança fica como está');
select pg_temp.confere(exists (select 1 from documentos where caminho = 'orcamentos/o20'), 'outro orçamento com prefixo parecido não é afetado');
select pg_temp.confere((select count(*) from documentos_historico where caminho like 'orcamentos/o2/%' and operacao = 'antes_restauracao') = 2,
  'restauração guarda o estado anterior dos blocos que mudou');

-- ---------- limpeza de 90 dias ----------
update documentos_historico set arquivado_em = now() - interval '91 days' where caminho = 'orcamentos/o1';
select pg_temp.como('carla@exemplo.com');
set role authenticated;
update documentos set dados = dados || '{"v":6}' where caminho = 'orcamentos/o1';
reset role;
select pg_temp.confere((select count(*) from documentos_historico where caminho = 'orcamentos/o1') = 1, 'versões com mais de 90 dias são apagadas');

\echo 'Todos os testes passaram.'
