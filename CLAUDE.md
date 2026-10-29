# Sistema de Orçamentos Unità

App web de orçamento de obras do Setor de orçamentos da Unità Engenharia. Roda como Artifact publicado no claude.ai (https://claude.ai/artifact/EfkeyF35kthKkYZ5GNcKEn), com banco compartilhado entre a equipe. Não há backend próprio: o banco, os downloads e o armazenamento de imagens vêm do runtime de Artifacts (`window.claude.use('db' | 'downloads' | 'assets' | 'user')`).

Regras de negócio, modelo de dados e histórico de decisões: `docs/sistema-orcamentos.md`. Ler antes de mexer em cálculo, importação ou exportação.

## Estrutura

```
src/shell.html        <title>, <link> da fonte Inter, todo o CSS e o HTML fixo (cabeçalho, abas, rodapé, modal)
src/js/01..08-*.js    código do app, concatenado em ordem alfabética num único <script> (sem módulos ES, tudo no escopo global)
assets/               modelo-cliente.xlsx (modelo da planilha do cliente) e fontes Inter (PDF e reserva da interface)
dev/mock-claude.js    simulação local de window.claude (banco em localStorage)
dev/serve.mjs         servidor estático para testar dist/local.html
build.mjs             gera dist/
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

O Artifact recebe `dist/index.html` como página (sem esqueleto `<html>`; o claude.ai envolve) e três arquivos de apoio na raiz: `modelo-cliente.txt`, `Inter-Regular.ttf`, `Inter-Bold.ttf`. Capabilities: `db`, `downloads`, `assets`. Publicar sempre na mesma URL para manter o banco compartilhado; uma URL nova nasce com banco vazio.

A publicação é feita por uma sessão do Claude com a ferramenta de Artifacts (claude.ai ou Cowork). Antes de publicar, ler a versão no ar e conferir se alguém publicou por outra sessão.

## Cuidados

- O banco é compartilhado e em produção. Não escrever nele em teste; usar `dist/local.html`.
- Escritas usam `update` com merge aninhado (null apaga a chave). Catálogo e partes do orçamento ficam em chunks de documentos (`putMany`); não mudar o número de chunks (N_INS, N_CPU, N_PART) sem migrar os dados.
- `modelo-cliente.xlsx` foi limpo a partir do arquivo real do cliente (sem Power Query, links externos e calcChain). O script de limpeza original não foi preservado; se o modelo mudar, refazer a limpeza e conferir a saída no Excel/LibreOffice.
- Números com vírgula decimal e ponto de milhar (pt-BR) em toda a interface: usar `fmt`, `money`, `parseNum`.

## Padrões do usuário

- Textos da interface e respostas em português, tom direto. Sem travessão, sem jargão corporativo, sem emoji.
- Não inventar números; declarar fórmula ou premissa antes do valor.
- Identidade visual: #373A36 (principal), #000000, #FE5000 (destaque), #D0D0CE (fundo claro); fonte Inter; logo Unità no cabeçalho e rodapé "© ano Unità Engenharia. Todos os direitos reservados." / "Setor de orçamentos | Unità".
