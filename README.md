# Sistema de Orçamentos Unità

App web de orçamento de obras (EAP, composições, insumos, formação de preço, documentos e exportações em Excel e PDF) do Setor de orçamentos.

O mesmo código roda de duas formas:

- **Versão web (Vercel + Supabase)**: https://teste01-woad.vercel.app, com login por e-mail e senha e o banco no Supabase (projeto `djbxyriievywikbuogqs`).
- **Artifact no claude.ai** (versão de origem): https://claude.ai/artifact/EfkeyF35kthKkYZ5GNcKEn, com o banco do próprio Artifact.

| Arquivo | Função |
|---|---|
| `src/` | O sistema (shell HTML/CSS e módulos JS) |
| `web/supabase-claude.js` | Login e camada que liga o app ao Supabase (banco, imagens, downloads) |
| `web/config.js` | Endereço e chave pública (publishable) do Supabase. Nunca colocar a chave secret/service_role |
| `web/importar.html` | Importação de um backup (`/importar`) |
| `web/vendor/supabase.js` | Biblioteca do Supabase (2.118.0) |
| `supabase/schema.sql` | Tabela `documentos`, regras de acesso, tempo real e bucket `imagens` |
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

## Migração dos dados do Artifact

O backup com os dados do Artifact fica fora do repositório (pasta "backup orcamentos (NAO enviar ao GitHub)"). Depois de configurar o Supabase e publicar, entrar no site, abrir `/importar`, escolher o arquivo e clicar em Importar. A imagem do modelo 3D é enviada junto.

Backups com dados (`*backup*.json`) não devem entrar neste repositório; o `.gitignore` já os bloqueia.

Orientações para o Claude Code em `CLAUDE.md`; regras de negócio em `docs/sistema-orcamentos.md`.

© Unità Engenharia. Setor de orçamentos | Unità
