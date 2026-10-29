# Sistema de Orçamentos Unità

App web de orçamento de obras do Setor de orçamentos da Unità Engenharia, com banco compartilhado entre a equipe. Site https://teste01-woad.vercel.app (Vercel), banco no Supabase (projeto `djbxyriievywikbuogqs`).

O app nasceu como Artifact no claude.ai e continua usando só a interface daquele runtime (`window.claude.use('db' | 'downloads' | 'assets' | 'user')`). Hoje ela tem duas implementações:

- Produção: `web/supabase-claude.js` entrega o `window.claude` com login e banco no Supabase (tabela `documentos`, um documento por linha, endereçado pelo caminho).
- Teste local: `dev/mock-claude.js`, banco no localStorage.

O Artifact original foi apagado em 29/10/2026, depois da migração dos dados. Se o app passar a usar algo novo do runtime, implementar nas duas.

Regras de negócio, modelo de dados e histórico de decisões: `docs/sistema-orcamentos.md`. Ler antes de mexer em cálculo, importação ou exportação.

## Estrutura

```
src/shell.html        <title>, <link> da fonte Inter, todo o CSS e o HTML fixo (cabeçalho, abas, rodapé, modal)
src/js/01..08-*.js    código do app, concatenado em ordem alfabética num único <script> (sem módulos ES, tudo no escopo global)
assets/               modelo-cliente.xlsx (modelo da planilha do cliente) e fontes Inter (PDF e reserva da interface)
dev/mock-claude.js    simulação local de window.claude (banco em localStorage)
dev/serve.mjs         servidor estático para testar dist/local.html
web/                  versão web: supabase-claude.js (login + banco), config.js, importar.html, vendor/supabase.js
supabase/schema.sql   banco (tabela documentos, merge aninhado jsonb_mesclar, RLS, tempo real, bucket imagens, histórico de versões)
supabase/teste/       teste do schema num Postgres limpo (GitHub Actions: .github/workflows/teste-banco.yml)
vercel.json           a Vercel roda node build.mjs e publica dist/site
build.mjs             gera dist/site/ (site), dist/local.html (teste local) e dist/index.html (corpo da página no formato Artifact, sem uso hoje)
docs/                 documentação funcional
```

Módulos (a ordem importa só para código executado no carregamento; funções são içadas):

| Arquivo | Conteúdo |
|---|---|
| 01-base.js | utilidades, estado `S`, banco em chunks, cálculo (`computeBudget`, `compUnit`), UI base (`render`, abas), telas Home (`vOrcs`) e Orçamento (`vPlan`) |
| 02-composicoes-insumos-indicadores.js | editor de composição (`compEditor`), seletor, operações na EAP, Insumos gerais (`vIns`), Composições (`vCpus`), Indicadores e curvas ABC |
| 03-importar-exportar-bases.js | aba Importar, utilidades de exportação (`saveFile`, estilos Excel, `pdfFonte`), Excel das bases |
| 04-planilha-cliente.js | geração da planilha no modelo do cliente sobre `modelo-cliente.xlsx` (JSZip, edição do XML) e tokens das premissas |
| 05-documentos-incc.js | extras do orçamento (premissas, projetos, modelo 3D), série INCC, importação da planilha do cliente, telas Documentos e INCC |
| 06-dados-formacao-preco.js | formação de preço Unità (`precoUnita`), formulário do orçamento (`metaForm`), tela Dados (`vDados`) |
| 07-exportar.js | aba Exportar (`vExp`) e geradores únicos de Excel (`gerarExcel`) e PDF (`gerarPdf`) |
| 08-acoes-eventos-init.js | objeto de ações (`data-act`), eventos globais (click, change, input, focus, teclado), mover item pelo número, `init()` |

Padrão da UI: cada tela é uma função `vNome()` que devolve HTML em string; `render()` redesenha `#app`. Botões chamam ações por `data-act="nome"`; campos editáveis usam `data-f="escopo.campo"` e são tratados no handler de `change`.

## Comandos

```
node build.mjs          monta dist/ (valida a sintaxe com node --check)
node dev/serve.mjs      abre http://localhost:8765/ com o banco simulado
```

As bibliotecas (ExcelJS, SheetJS, jsPDF, jspdf-autotable, JSZip) são carregadas sob demanda de cdn.jsdelivr.net (`loadLib` em 01-base.js); o teste local precisa de internet.

## Publicação

A Vercel publica a partir do GitHub (orcamentosunita/teste01), rodando `node build.mjs` e servindo `dist/site`; o merge no `main` publica no site. Toda mudança vai num branch com Pull Request; o link de teste (preview) da Vercel usa o mesmo banco do Supabase, então os dados são reais. Não fazer merge sem pedido explícito do usuário. Dados de configuração do Supabase em `web/config.js`; mudanças no banco em `supabase/schema.sql`, que precisa poder rodar de novo sem perder dados, e que o usuário roda no SQL Editor do Supabase.

## Cuidados

- O banco do Supabase é compartilhado e em produção. Não escrever nele em teste; usar `dist/local.html`.
- Histórico de versões (`documentos_historico`, 90 dias) e restauração (`restaurar_ate`, `restaurar_versao`) estão no `schema.sql`; como usar no README.
- Backups com dados reais (`*backup*.json`) nunca vão ao repositório.
- Escritas usam `update` com merge aninhado (null apaga a chave). Catálogo e partes do orçamento ficam em chunks de documentos (`putMany`); não mudar o número de chunks (N_INS, N_CPU, N_PART) sem migrar os dados.
- `modelo-cliente.xlsx` foi limpo a partir do arquivo real do cliente (sem Power Query, links externos e calcChain). O script de limpeza original não foi preservado; se o modelo mudar, refazer a limpeza e conferir a saída no Excel/LibreOffice.
- Números com vírgula decimal e ponto de milhar (pt-BR) em toda a interface: usar `fmt`, `money`, `parseNum`.

## Padrões do usuário

- Textos da interface e respostas em português, tom direto. Sem travessão, sem jargão corporativo, sem emoji.
- Não inventar números; declarar fórmula ou premissa antes do valor.
- Identidade visual: #373A36 (principal), #000000, #FE5000 (destaque), #D0D0CE (fundo claro); fonte Inter; logo Unità no cabeçalho e rodapé "© ano Unità Engenharia. Todos os direitos reservados." / "Setor de orçamentos | Unità".
