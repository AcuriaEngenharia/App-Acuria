# Sistema de Orçamentos

App web de orçamento de obras (EAP, composições, insumos, formação de preço, documentos e exportações em Excel e PDF) do Setor de orçamentos.

Site: https://teste01-woad.vercel.app, com login por e-mail e senha e o banco no Supabase (projeto `djbxyriievywikbuogqs`). O sistema nasceu como Artifact no claude.ai; os dados foram migrados para o Supabase e o Artifact foi apagado em 29/10/2026.

| Arquivo | Função |
|---|---|
| `src/` | O sistema (shell HTML/CSS e módulos JS) |
| `web/supabase-claude.js` | Login e camada que liga o app ao Supabase (banco, imagens, downloads) |
| `web/config.js` | Endereço e chave pública (publishable) do Supabase. Nunca colocar a chave secret/service_role |
| `web/importar.html` | Importação de um backup (`/importar`) |
| `web/vendor/supabase.js` | Biblioteca do Supabase (2.118.0) |
| `supabase/schema.sql` | Tabela `documentos`, regras de acesso, tempo real, bucket `imagens` e histórico de versões |
| `supabase/teste/`, `.github/workflows/teste-banco.yml` | Teste automático do `schema.sql` |
| `vercel.json` | Publicação: a Vercel roda `node build.mjs` e publica `dist/site` |

## Teste local

Precisa do Node 18 ou mais novo e de internet para as bibliotecas:

```
node build.mjs
node dev/serve.mjs
```

e abrir http://localhost:8765/. O teste local usa um banco simulado guardado no navegador, separado do banco real.

## Configuração do Supabase (uma vez)

1. Criar o projeto no Supabase.
2. SQL Editor: rodar o `supabase/schema.sql` inteiro (pode rodar de novo sem perder dados).
3. Authentication > Sign In / Providers: desligar **Allow new users to sign up**. Só entra quem for cadastrado.
4. Authentication > URL Configuration: em Site URL, o endereço do site na Vercel; em Redirect URLs, o mesmo endereço com `/**` no fim (links de convite e de nova senha).
5. Project Settings > Data API e API Keys: copiar a URL e a chave publishable para o `web/config.js`.

## Usuários

Qualquer e-mail pode ter acesso, mas só quem for cadastrado: Supabase > Authentication > Users > **Invite user** (a pessoa recebe um e-mail para criar a senha) ou **Add user > Create new user** (você define a senha e marca Auto Confirm User). Para tirar o acesso, excluir o usuário na mesma tela.

## Histórico de versões

Antes de cada alteração ou exclusão, o banco guarda a versão anterior em `documentos_historico`: uma versão a cada 30 minutos de edição da mesma pessoa no mesmo bloco, e sempre que outra pessoa assume ou algo é excluído. As versões ficam 90 dias.

Cada orçamento é gravado em vários blocos (dados, itens, composições, insumos, extras e projetos), então o normal é voltar o orçamento inteiro a um momento (Supabase > SQL Editor):

```sql
-- 1. achar o orçamento e os momentos com versões guardadas
select caminho, dados ->> 'nome' as nome from documentos where colecao = 'orcamentos';
select arquivado_em, atualizado_por, operacao, caminho
  from documentos_versoes where orcamento = '<id>' order by arquivado_em desc;

-- 2. voltar o orçamento ao que era no momento escolhido (horário de Brasília)
select restaurar_ate('orcamentos/<id>', '2026-10-29 14:00 -03');
```

O mesmo vale para o catálogo: `restaurar_ate('cat_insumos', ...)` e `restaurar_ate('cat_cpus', ...)`. Um orçamento excluído também volta assim, com um momento anterior à exclusão.

Para um único bloco: `select restaurar_versao(<id da versão>);`.

O estado atual é guardado no histórico antes de restaurar, então a restauração pode ser desfeita do mesmo jeito. Quem estiver com o sistema aberto recebe a versão restaurada na hora.

## Backup

O backup dos dados migrados do Artifact fica fora do repositório (pasta "backup orcamentos (NAO enviar ao GitHub)"). Para restaurar um backup: entrar no site, abrir `/importar`, escolher o arquivo e clicar em Importar. As imagens vão junto.

Backups com dados (`*backup*.json`) não devem entrar neste repositório; o `.gitignore` já os bloqueia.

Orientações para o Claude Code em `CLAUDE.md`; regras de negócio em `docs/sistema-orcamentos.md`.

© Unità Engenharia. Setor de orçamentos | Unità
