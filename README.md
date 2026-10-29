# Sistema de Orçamentos Unità

App web de orçamento de obras (EAP, composições, insumos, formação de preço, documentos e exportações em Excel e PDF), publicado como Artifact no claude.ai com banco compartilhado pela equipe do Setor de orçamentos.

Para testar localmente (precisa do Node 18 ou mais novo e de internet para as bibliotecas):

```
node build.mjs
node dev/serve.mjs
```

e abrir http://localhost:8765/. O teste local usa um banco simulado guardado no navegador, separado do banco real.

Orientações para o Claude Code em `CLAUDE.md`; regras de negócio em `docs/sistema-orcamentos.md`.

© Unità Engenharia. Setor de orçamentos | Unità
