# Sistema de Orçamentos Unità (app web)

Origem: Artifact no claude.ai (capabilities: db, downloads, assets), versão 12 de 28/09/2026. Código migrado para este repositório em 29/10/2026; dados migrados para o Supabase no mesmo dia; Artifact apagado em 29/10/2026, depois de conferido que os dados não tinham mudado desde o backup.
Modelo do cliente: `assets/modelo-cliente.xlsx`, limpo a partir de "ORC - EXE - TEEN x BRESSER 1 COND. A - R01.xlsx" e publicado em base64 como `modelo-cliente.txt`. Fontes Inter-Regular.ttf e Inter-Bold.ttf publicadas junto (usadas no PDF e como reserva da interface).

## Modelo de dados (banco do artifact)
- Catálogo em chunks por hash FNV-1a do código: cat_insumos/c0..c15, cat_cpus/c0..c23, corpo {m:{codigo: objeto}}.
- Orçamento: orcamentos/<id> (meta) + partes/it0..3, cp0..3, in0..3 + extras/premissas, extras/modelo3d, extras/projetos + projetos/p0..pN (500 linhas cada).
- config/incc {serie:[[AAAA-MM, índice]]}; config/geral.
- Item da EAP: {id, par, pos, k:'e'|'s', cod, desc, det, un, qtd, num}. `num` guarda a numeração herdada do ERP (o botão Renumerar limpa). `det` é o comentário do item (o ícone só aparece quando preenchido).
- Composição: {cod, desc, un, pref, itens:[{t:'i'|'c', cod, coef}]}. Insumo: {cod, desc, un, preco, grp, dt}.
- meta.totais {custo, venda, direto} gravado a cada alteração e na primeira abertura.
- meta.bdi.modo 'unita': adm, assist, ir, iss, pis, cofins, cssl, base[itemIds], beneficio, obs. Também existem os modos 'direto' e 'tcu'. meta.tx {grupos{etapaId:nome}, ind}. meta.inst {titulo, itens}.

## Interface
- Abas: Home (ícone), Orçamento, Indicadores, Documentos, Insumos gerais, Composições, INCC, Importar, Exportar.
- Home: filtro de tipo em um único botão de escolha; colunas centralizadas exceto Orçamento; coluna Ações com editar (só status Em elaboração), nova revisão e excluir.
- Tela Dados do orçamento (view 'dados', sem aba): acessada só pelo lápis de editar na Home. Tem Voltar, Atualizar preços pela base, Descartar e Salvar; avisa ao sair com alterações não salvas.
- Formulário do orçamento (`metaForm`, 06-dados-formacao-preco.js, usado na tela Dados e no popup Novo orçamento): seções Geral, Formação de preço e Planilha do cliente. Geral em quatro grupos: Identificação, Datas e prazo, Localização e características, Quantitativos.
- Orçamento: cabeçalho só com "Nome (Rxx)". Botões da barra todos no padrão branco. Página com altura travada; só a planilha e o painel de composição rolam.
- Painel de composição no Orçamento (classe .panel.orc): cabeçalho compacto com código, nome, unidade e custo unitário direto; sem memorial de cálculo. Na aba Composições o painel mantém o memorial.
- Insumos gerais: sem a coluna "Usado em". Grupo e data de cotação só se alteram aqui.
- Exportar (07-exportar.js, `vExp`): único lugar de exportação. Três blocos:
  - Documento do orçamento: formato Excel ou PDF e conteúdo à escolha em um só arquivo (resumo de preço e indicadores, sintético, analítico, composições, insumos do orçamento, curvas ABC, premissas e exclusões, projetos enviados, modelo 3D) + opção de colunas com BDI no analítico. Escolha lembrada por navegador (localStorage exp_cfg). Padrão: resumo, sintético, analítico.
  - Planilha no modelo do cliente (`exportCliente`, 04-planilha-cliente.js).
  - Bases gerais: Excel de insumos gerais e de composições.
- No Excel, o analítico tem fórmulas ligadas às abas Composições e Insumos quando elas são exportadas juntas; sem elas, vai com valores. Colunas de BDI ficam ocultas quando a opção está desligada. PDF gerado com compressão (tudo marcado no 117: 333 páginas, cerca de 2,1 MB).
- Fonte Inter na interface, no PDF (embutida) e no Excel interno. A planilha do cliente mantém as fontes do modelo original.

## Regras
- Nome do orçamento é composto: Empreendimento - Cliente, sem revisão (`nomeOrc`). Onde é preciso identificar a versão usa-se `idOrc` = código · nome · revisão.
- Coluna Item editável (`moverParaNumero`, 08-acoes-eventos-init.js): o número digitado define etapa-pai (prefixo) e posição (último segmento). O item vai com tudo que está abaixo dele; se o número passa do fim do grupo, vai para o último lugar. Recusa pai inexistente, pai que é serviço e etapa dentro dela mesma. A numeração volta a ser sequencial nos grupos de origem e destino e em tudo abaixo deles. Aviso com Desfazer.
- Data-base = data do INCC-DI, digitada MM/AA, com o índice da série ao lado.
- Custo total = custo raso (diretos + indiretos). Custo direto = custo raso menos a etapa de indiretos (meta.tx.ind ou etapa com "INDIRET" no nome).
- Encargos sociais removidos do sistema inteiro: preço do insumo é o preço cadastrado.
- Unidade da composição só muda na aba Composições; grupo e cotação do insumo só na aba Insumos gerais.
- Novo orçamento pode duplicar um existente (copia meta, partes, extras e projetos).
- Campos numéricos apagam o valor ao receber o clique; se o campo sair vazio, volta o valor anterior (seletor `ZERA_SEL`).
- Formação de preço Unità: Subtotal 01 = custo raso; + adm% e + assist% sobre S1 = S2; impostos = t × base ÷ (1 − t), com base = MO indireta CLT + MO direta; S3 = preço de venda. Benefício fiscal: t2 = t − ISS, gera S4.
- Importação da planilha do cliente: coeficiente = qtd do insumo ÷ qtd do serviço (analítico com 6 casas). No 117, custo raso R$ 64.742.710,74 contra R$ 64.742.711,09 no arquivo (diferença de R$ 0,35 pelo arredondamento das quantidades).
- Planilha do cliente: gerada sobre o modelo (JSZip), mantendo estilos, logos e caixas de título; conferida contra o original no LibreOffice sem diferenças nas abas de resumo, sintético, analítico e premissas.

## Estado do banco (28/09/2026)
- O orçamento 117 foi importado como R01 (16 etapas, 739 serviços, 394 CPUs, 622 insumos, 182 premissas, 29 exclusões, 2.477 projetos, 383 meses de INCC, imagem 3D). Depois o banco passou a ter apenas a R02 (id mulgejm0w35kh3); a R01 (orc117r01) não existe mais.
- Numeração herdada do ERP no 117: 45 dos 928 itens diferem da sequência automática (ex.: 04.01.051, 03.02.01.221).
- Na R02 o insumo IM00031 (Sarrafo 2x15cm) chegou a ficar com preço R$ 1.000.000,00 (era R$ 5,00). Conferido em 29/10/2026: já estava de volta a R$ 5,00 no catálogo e no orçamento; custo raso R$ 64.742.579,58, direto R$ 52.872.928,52, venda R$ 71.201.059,85.

## Versão web (Vercel + Supabase)
- Iniciada em 29/10/2026. O app não muda: `web/supabase-claude.js` implementa o mesmo `window.claude` (db, downloads, assets, user) sobre o Supabase.
- Banco: tabela `documentos` (caminho, colecao, dados jsonb). `update` vira a função `documento_atualizar`, que faz o merge aninhado no próprio banco (`jsonb_mesclar`, null apaga a chave), então duas pessoas gravando o mesmo bloco não se sobrescrevem. Tempo real pelo Supabase Realtime.
- Imagens no bucket público `imagens` (nome aleatório). Login por e-mail e senha, qualquer domínio, cadastro só pelo painel (signup desligado).
- Migração: backup do banco do Artifact em 29/10/2026 (63 documentos e a imagem do modelo 3D), importado pela página `/importar`. Conferido no Supabase: 63 documentos, totais do 117 R02 iguais aos do Artifact.
- Histórico de versões: gatilho guarda a versão anterior de cada documento (a cada 30 min por pessoa e documento, sempre em troca de autor, exclusão e restauração), por 90 dias. `restaurar_ate(prefixo, momento)` volta um orçamento inteiro ou o catálogo; `restaurar_versao(id)` volta um bloco. Coluna `criado_em` em `documentos` permite excluir na restauração os blocos criados depois do momento.
- Grupo dos insumos inferido pelo prefixo do código na importação (IM material, IS serviços, IP mão de obra/verba).
