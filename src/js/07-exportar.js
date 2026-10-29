/* ===================== Tela: Exportar ===================== */
const EXP_SEC = [
  ['resumo', 'Resumo de preço e indicadores', 'Formação do preço, custo por m², por UH e custo por etapa'],
  ['sintetico', 'Orçamento sintético', 'Etapas e subetapas com total e participação'],
  ['analitico', 'Orçamento analítico', 'Todos os serviços com quantidade, custo unitário e total'],
  ['comps', 'Composições de custo unitário', 'Insumos e coeficientes de cada composição usada'],
  ['insumos', 'Insumos do orçamento', 'Preço, grupo e data da cotação de cada insumo usado'],
  ['abc', 'Curvas ABC', 'Serviços e insumos em ordem de peso no custo'],
  ['premissas', 'Premissas e exclusões', 'Textos com os valores do orçamento já aplicados'],
  ['projetos', 'Projetos enviados', 'Relação de documentos recebidos para o orçamento'],
  ['modelo3d', 'Modelo 3D', 'Imagem e link do modelo']
];
function expState() {
  if (!S.exp) {
    let sv = null; try { sv = JSON.parse(localStorage.getItem('exp_cfg') || 'null'); } catch { }
    S.exp = { fmt: (sv && sv.fmt) || 'xlsx', sec: new Set((sv && sv.sec) || ['resumo', 'sintetico', 'analitico']), bdi: !!(sv && sv.bdi) };
  }
  return S.exp;
}
function expSave() { try { localStorage.setItem('exp_cfg', JSON.stringify({ fmt: S.exp.fmt, sec: [...S.exp.sec], bdi: S.exp.bdi })); } catch { } }
function vExp() {
  const E = expState(), cur = S.cur, meta = cur && S.orcs.get(cur.id);
  const n = EXP_SEC.filter(([k]) => E.sec.has(k)).length;
  const seg = (v, l) => `<button class="btn${E.fmt === v ? ' primary' : ''}" data-act="expFmt" data-v="${v}">${l}</button>`;
  const secs = EXP_SEC.map(([k, l, d]) => `<label class="exp-opt${E.sec.has(k) ? ' on' : ''}"><input type="checkbox" data-f="exp.sec" data-k="${k}"${E.sec.has(k) ? ' checked' : ''}${meta ? '' : ' disabled'}><span><b>${l}</b><span class="muted">${d}</span></span></label>`).join('');
  const docCard = meta ? `<div class="card pad stack">
      <div class="row" style="justify-content:space-between"><div><h2 style="margin:0">Documento do orçamento</h2><p class="muted" style="margin:2px 0 0">${esc(idOrc(meta))}</p></div>
        <div class="row"><span class="lbl">Formato</span><div class="seg">${seg('xlsx', 'Excel')}${seg('pdf', 'PDF')}</div></div></div>
      <div class="row" style="gap:8px"><span class="lbl">Conteúdo</span><span class="spacer"></span><button class="btn sm ghost" data-act="expAll">Marcar tudo</button><button class="btn sm ghost" data-act="expNone">Limpar</button></div>
      <div class="exp-grid">${secs}</div>
      <label class="row" style="gap:6px"><input type="checkbox" data-f="exp.bdi"${E.bdi ? ' checked' : ''}> Incluir no analítico as colunas de preço com BDI</label>
      <div class="row"><span class="muted">${n ? `${n} ${n > 1 ? 'partes' : 'parte'} em um só arquivo ${E.fmt === 'pdf' ? 'PDF' : 'Excel'}.` : 'Marque ao menos uma parte.'}</span><span class="spacer"></span>
        <button class="btn primary" data-act="expGo"${n ? '' : ' disabled'}>${E.fmt === 'pdf' ? ICON.pdf : ICON.xls} Gerar ${E.fmt === 'pdf' ? 'PDF' : 'Excel'}</button></div></div>
    <div class="card pad row" style="justify-content:space-between;margin-top:12px"><div><h2 style="margin:0">Planilha no modelo do cliente</h2><p class="muted" style="margin:2px 0 0">Excel no formato de envio ao cliente, com todas as abas do modelo (resumo, sintético, analítico, premissas, projetos e modelo 3D).</p></div>
      <button class="btn" data-act="xlsCli">${ICON.xls} Gerar planilha do cliente</button></div>`
    : `<div class="card empty">Abra um orçamento na lista (ícone da casa) para exportar o orçamento.<div style="margin-top:12px"><button class="btn primary" data-act="tab" data-v="orcs">Ver orçamentos</button></div></div>`;
  return `<div class="page-head"><div><h1>Exportar</h1><p>Todas as exportações do sistema em um só lugar.</p></div></div>
    ${docCard}
    <div class="card pad row" style="justify-content:space-between;margin-top:12px"><div><h2 style="margin:0">Bases gerais</h2><p class="muted" style="margin:2px 0 0">Cadastro completo de insumos gerais e de composições, fora de qualquer orçamento.</p></div>
      <div class="row"><button class="btn" data-act="insXls">${ICON.xls} Insumos gerais</button><button class="btn" data-act="cpuXls">${ICON.xls} Composições</button></div></div>`;
}
async function exportarPacote() {
  const E = expState(); const sec = new Set(EXP_SEC.map(x => x[0]).filter(k => E.sec.has(k)));
  if (!sec.size || !S.cur) return;
  if ((sec.has('premissas') || sec.has('projetos') || sec.has('modelo3d')) && !S.cur.extras) { toast('Carregando documentos do orçamento…'); await loadExtras(S.cur.id); }
  const opt = { bdi: E.bdi };
  try { if (E.fmt === 'pdf') await gerarPdf(sec, opt); else await gerarExcel(sec, opt); }
  catch (e) { console.error(e); toast(`Falha ao gerar o ${E.fmt === 'pdf' ? 'PDF' : 'Excel'}: ${e.message}`, 'err'); }
}
async function img3d() {
  const md = (S.cur.extras || {}).modelo3d || {}; if (!md.imagem || !md.imagem.url) return null;
  try { return await imageToPng(md.imagem.url, 8522340 / 6183086); } catch (e) { console.warn(e); return null; }
}
const nomeArq = (m, ext) => safeName(`Orçamento ${m.codigo} ${nomeOrc(m)} ${m.revisao || ''}`).slice(0, 120) + '.' + ext;

/* ---------- Excel ---------- */
async function gerarExcel(sec, opt) {
  const B = computeBudget(), m = B.meta; toast('Gerando Excel…');
  await loadLib('exceljs');
  const X = xlStyles(), F = (o = {}) => ({ name: 'Inter', size: 10, ...o });
  const wb = new ExcelJS.Workbook(); wb.creator = 'Setor de orçamentos | Unità'; wb.created = new Date();
  const logo = await logoPng(); const img = logo ? wb.addImage({ base64: logo, extension: 'png' }) : null;
  const add = name => { const ws = wb.addWorksheet(name); ws.properties.defaultRowHeight = 15; xlFooter(ws); return ws; };
  const topo = (ws, col, titulo, linha2) => {
    if (img != null) ws.addImage(img, { tl: { col: 0.15, row: 0.1 }, ext: { width: 40, height: 40 } });
    ws.getCell(col + '1').value = titulo; ws.getCell(col + '1').font = X.title;
    ws.getCell(col + '2').value = linha2 || `${idOrc(m)} · ${m.status || ''}`; ws.getCell(col + '2').font = F({ bold: true });
  };
  // cria as abas na ordem escolhida
  const W = {};
  if (sec.has('resumo')) W.R = add('Resumo');
  if (sec.has('sintetico')) W.S = add('Sintético');
  if (sec.has('analitico')) W.P = add('Analítico');
  if (sec.has('comps')) W.C = add('Composições');
  if (sec.has('insumos')) W.I = add('Insumos');
  const { comps, ins } = reachable(B); const ctx = B.ctx; const k1 = 1 + B.bdi;
  // Insumos
  const insRow = new Map();
  if (W.I) {
    const ws = W.I; ws.columns = [{ width: 14 }, { width: 60 }, { width: 7 }, { width: 14 }, { width: 14 }, { width: 13 }];
    xlHeader(ws, 1, ['Código', 'Descrição', 'Un', 'Preço unit.', 'Grupo', 'Data cotação']);
    ins.forEach((x, i) => { const r = i + 2; insRow.set(x.cod, r); const row = ws.getRow(r); row.values = [x.cod, x.desc, x.un, +x.preco || 0, x.grp || '', x.dt ? new Date(x.dt + 'T12:00:00') : '']; row.getCell(4).numFmt = XF.price; row.getCell(6).numFmt = 'dd/mm/yyyy'; });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  // Composições
  const totRow = new Map();
  if (W.C) {
    const ws = W.C; ws.columns = [{ width: 12 }, { width: 14 }, { width: 60 }, { width: 7 }, { width: 13 }, { width: 15 }, { width: 15 }];
    xlHeader(ws, 1, ['Tipo', 'Código', 'Descrição', 'Un', 'Coeficiente', 'Preço unit.', 'Subtotal']);
    let r = 3; const lay = [];
    for (const c of comps) { const n = (c.itens || []).length; lay.push([c, r]); totRow.set(c.cod, r + 1 + n); r = r + 1 + n + 2; }
    for (const [c, st] of lay) {
      const h = ws.getRow(st); h.values = ['Composição', c.cod, c.desc, c.un]; for (let k = 1; k <= 7; k++) { h.getCell(k).fill = X.band; h.getCell(k).font = F({ bold: true }); }
      const its = c.itens || [];
      its.forEach((it, i) => {
        const rr = st + 1 + i; const row = ws.getRow(rr); let desc = '', un = '', f, res;
        if (it.t === 'c') { const a = S.cur.comps.get(it.cod); desc = a ? a.desc : '(não encontrada)'; un = a ? a.un : ''; f = totRow.has(it.cod) ? `G${totRow.get(it.cod)}` : null; res = compUnit(ctx, it.cod); }
        else { const x = S.cur.ins.get(it.cod); desc = x ? x.desc : '(não encontrado)'; un = x ? x.un : ''; f = insRow.has(it.cod) ? `Insumos!D${insRow.get(it.cod)}` : null; res = insPrice(ctx, it.cod); }
        row.values = [it.t === 'c' ? 'Comp. aux.' : 'Insumo', it.cod, desc, un, +it.coef || 0, f ? { formula: f, result: res } : res, { formula: `E${rr}*F${rr}`, result: (+it.coef || 0) * res }];
        row.getCell(5).numFmt = XF.coef; row.getCell(6).numFmt = XF.price; row.getCell(7).numFmt = XF.price;
      });
      const t = ws.getRow(totRow.get(c.cod));
      t.getCell(3).value = its.length ? 'Custo unitário' : 'Custo unitário (informado)';
      t.getCell(7).value = its.length ? { formula: `SUM(G${st + 1}:G${st + its.length})`, result: compUnit(ctx, c.cod) } : (+c.pref || 0);
      t.getCell(3).font = t.getCell(7).font = F({ bold: true }); t.getCell(7).numFmt = XF.price;
    }
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  // Analítico
  const rows = B.rows; let first = 0, tot = 0;
  if (W.P) {
    const ws = W.P;
    ws.columns = [{ width: 12 }, { width: 12 }, { width: 62 }, { width: 24 }, { width: 6 }, { width: 13 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 9 }, { width: 3 }];
    topo(ws, 'C', 'Orçamento analítico');
    ws.getCell('C3').value = `Data-base ${m.inccData ? mmaa(m.inccData) : '-'} · INCC-DI ${fmt(+m.incc || 0, 3, 3)}${opt.bdi ? ' · BDI ' + pctf(B.bdi) : ''}`;
    const H0 = 5; first = H0 + 1; tot = first + rows.length;
    xlHeader(ws, H0, ['Item', 'Código', 'Descrição', 'Comentário', 'Un', 'Qtde', 'Custo unit.', 'Custo total', 'Unit. c/ BDI', 'Total c/ BDI', '%', 'T']);
    const BDI = W.R ? 'Resumo!$C$11' : String(B.bdi);
    rows.forEach((rw, i) => {
      const rr = first + i, v = rw.v, row = ws.getRow(rr);
      const pctF = { formula: `IF($H$${tot}=0,0,H${rr}/$H$${tot})`, result: B.total ? rw.total / B.total : 0 };
      if (v.k === 'e') {
        let end = i; while (end + 1 < rows.length && rows[end + 1].depth > rw.depth) end++;
        const a = rr + 1, z = first + end;
        const sf = col => end > i ? { formula: `SUMIF(L${a}:L${z},"S",${col}${a}:${col}${z})`, result: col === 'H' ? rw.total : rw.total * k1 } : 0;
        row.values = [rw.n, 'Etapa', '   '.repeat(rw.depth) + v.desc, v.det || '', '', '', '', sf('H'), '', sf('J'), pctF, 'E'];
        for (let k = 1; k <= 11; k++) { row.getCell(k).font = F({ bold: true }); if (rw.depth === 0) row.getCell(k).fill = X.band; }
      } else {
        const g = v.cod && totRow.has(v.cod) ? { formula: `'Composições'!G${totRow.get(v.cod)}`, result: rw.unit } : rw.unit;
        row.values = [rw.n, v.cod || '', '   '.repeat(rw.depth) + v.desc, v.det || '', (v.cod && S.cur.comps.get(v.cod) || {}).un || v.un || '', +v.qtd || 0, g,
        { formula: `F${rr}*G${rr}`, result: rw.total }, { formula: `G${rr}*(1+${BDI})`, result: rw.unit * k1 }, { formula: `F${rr}*I${rr}`, result: rw.total * k1 }, pctF, 'S'];
      }
      row.getCell(6).numFmt = XF.qty; [7, 8, 9, 10].forEach(k => row.getCell(k).numFmt = XF.money); row.getCell(11).numFmt = XF.pct;
    });
    const t = ws.getRow(tot);
    t.values = ['', '', 'TOTAL GERAL', '', '', '', '', { formula: `SUMIF(L${first}:L${tot - 1},"S",H${first}:H${tot - 1})`, result: B.total }, '', { formula: `SUMIF(L${first}:L${tot - 1},"S",J${first}:J${tot - 1})`, result: B.venda }, 1, ''];
    for (let k = 1; k <= 11; k++) { t.getCell(k).font = X.head.font; t.getCell(k).fill = X.head.fill; }
    t.getCell(8).numFmt = t.getCell(10).numFmt = XF.money; t.getCell(11).numFmt = XF.pct;
    ws.getColumn(12).hidden = true; if (!opt.bdi) { ws.getColumn(9).hidden = true; ws.getColumn(10).hidden = true; }
    ws.views = [{ state: 'frozen', ySplit: H0 }];
  }
  const refTot = (i, val) => W.P ? { formula: `'Analítico'!H${first + i}`, result: val } : val;
  // Sintético
  if (W.S) {
    const ws = W.S; ws.columns = [{ width: 12 }, { width: 70 }, { width: 18 }, { width: 10 }];
    topo(ws, 'B', 'Orçamento sintético');
    xlHeader(ws, 4, ['Item', 'Descrição', 'Custo total', '%']); let r = 5;
    rows.forEach((rw, i) => {
      if (rw.v.k !== 'e') return; const row = ws.getRow(r++);
      row.values = [rw.n, '   '.repeat(rw.depth) + rw.v.desc, refTot(i, rw.total), B.total ? rw.total / B.total : 0];
      row.getCell(3).numFmt = XF.money; row.getCell(4).numFmt = XF.pct;
      if (rw.depth === 0) for (let k = 1; k <= 4; k++) { row.getCell(k).font = F({ bold: true }); row.getCell(k).fill = X.band; }
    });
    const t = ws.getRow(r); t.values = ['', 'TOTAL GERAL', W.P ? { formula: `'Analítico'!H${tot}`, result: B.total } : B.total, 1];
    for (let k = 1; k <= 4; k++) { t.getCell(k).font = X.head.font; t.getCell(k).fill = X.head.fill; } t.getCell(3).numFmt = XF.money; t.getCell(4).numFmt = XF.pct;
    ws.views = [{ state: 'frozen', ySplit: 4 }];
  }
  // Resumo
  if (W.R) {
    const ws = W.R; ws.columns = [{ width: 8 }, { width: 46 }, { width: 22 }, { width: 70 }];
    topo(ws, 'B', 'Resumo do orçamento', idOrc(m));
    [['Empreendimento', m.empreendimento], ['Cliente', m.cliente], ['Fase', m.tipo], ['Status', m.status], ['Data-base', m.inccData ? `${mmaa(m.inccData)} · INCC-DI ${fmt(+m.incc || 0, 3, 3)}` : '']].forEach(([l, v], i) => { ws.getCell('B' + (4 + i)).value = l; ws.getCell('C' + (4 + i)).value = v || ''; });
    ws.getCell('B11').value = 'BDI equivalente'; ws.getCell('C11').value = B.bdi; ws.getCell('C11').numFmt = XF.pct;
    const ind = [['Custo direto (custo raso)', W.P ? { formula: `'Analítico'!H${tot}`, result: B.total } : B.total, XF.money], ['Preço de venda', { formula: `C13*(1+C11)`, result: B.venda }, XF.money],
    ['Área construída (m²)', +m.areaConst || 0, XF.money], ['Custo por m² de área construída', { formula: 'IF(C15>0,C13/C15,0)', result: m.areaConst ? B.total / m.areaConst : 0 }, XF.money],
    ['Área privativa (m²)', +m.areaPriv || 0, XF.money], ['Custo por m² de área privativa', { formula: 'IF(C17>0,C13/C17,0)', result: m.areaPriv ? B.total / m.areaPriv : 0 }, XF.money],
    ['Unidades (UH)', +m.uh || 0, '#,##0'], ['Custo por UH', { formula: 'IF(C19>0,C13/C19,0)', result: m.uh ? B.total / m.uh : 0 }, XF.money],
    ['Prazo de execução (meses)', +m.prazo || 0, '#,##0.0'], ['Preço de venda médio mensal', { formula: 'IF(C21>0,C14/C21,0)', result: m.prazo ? B.venda / m.prazo : 0 }, XF.money]];
    ind.forEach(([l, v, f], i) => { const rr = 13 + i; ws.getCell('B' + rr).value = l; const c = ws.getCell('C' + rr); c.value = v; c.numFmt = f; if (i < 2) { c.font = F({ bold: true }); ws.getCell('B' + rr).font = F({ bold: true }); } });
    ws.getCell('B24').value = 'Custo por etapa'; ws.getCell('B24').font = F({ bold: true, color: { argb: 'FF373A36' } });
    let er = 25; rows.forEach((rw, i) => { if (rw.depth !== 0) return; ws.getCell('A' + er).value = rw.n; ws.getCell('B' + er).value = rw.v.desc; const c = ws.getCell('C' + er); c.value = refTot(i, rw.total); c.numFmt = XF.money; const p = ws.getCell('D' + er); p.value = { formula: `IF($C$13=0,0,C${er}/$C$13)`, result: B.total ? rw.total / B.total : 0 }; p.numFmt = XF.pct; p.alignment = { horizontal: 'left' }; er++; });
    if (B.ps) {
      const p = B.ps, b = m.bdi || {}; er += 1; ws.getCell('B' + er).value = 'Formação do preço'; ws.getCell('B' + er).font = F({ bold: true, color: { argb: 'FF373A36' } }); er++;
      [['Subtotal 01 (custo raso)', p.S1, 1], [`Taxa de administração ${fmt(+b.adm || 0, 2, 4)}%`, p.adm], [`Assistência técnica ${fmt(+b.assist || 0, 2, 4)}%`, p.assist], ['Subtotal 02', p.S2, 1],
      [`Impostos ${pctf(p.t)} × base ${money(p.base)} ÷ (1 − ${pctf(p.t)})`, p.imp], ['Subtotal 03 (preço de venda)', p.S3, 1], [`Com benefício fiscal (sem ISS): impostos ${money(p.imp2)}`, p.S4]]
        .forEach(([l, v, bold]) => { ws.getCell('B' + er).value = l; const c = ws.getCell('C' + er); c.value = v; c.numFmt = XF.money; if (bold) { c.font = F({ bold: true }); ws.getCell('B' + er).font = F({ bold: true }); } er++; });
    }
  }
  // Curvas ABC
  if (sec.has('abc')) {
    const I = indicators(B);
    const sheet = (name, l, s) => {
      const ws = add(name);
      ws.columns = [{ width: 6 }, { width: 12 }, { width: 14 }, { width: 60 }, { width: 7 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 9 }, { width: 10 }, { width: 8 }];
      xlHeader(ws, 1, ['#', s ? 'Item' : 'Grupo', 'Código', 'Descrição', 'Un', 'Qtde', s ? 'Custo unit.' : 'Preço unit.', 'Total', '%', '% acum.', 'Classe']);
      l.forEach((x, i) => { const r = ws.getRow(i + 2); r.values = [i + 1, s ? x.n : x.grp, x.cod, x.desc, x.un, x.q, x.pu, x.total, x.p, x.acc, x.cls]; r.getCell(6).numFmt = XF.qty; r.getCell(7).numFmt = XF.price; r.getCell(8).numFmt = XF.money; r.getCell(9).numFmt = XF.pct; r.getCell(10).numFmt = XF.pct; });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    };
    sheet('ABC serviços', I.servs, true); sheet('ABC insumos', I.ins, false);
  }
  // Premissas
  if (sec.has('premissas')) {
    const ex = S.cur.extras || {}; const pr = ex.premissas || {}; const tk = tokens(m, B);
    const ws = add('Premissas'); ws.columns = [{ width: 10 }, { width: 110 }];
    topo(ws, 'B', 'Premissas e exclusões'); let r = 4;
    for (const s of pr.secoes || []) {
      const h = ws.getRow(r++); h.values = [s.n || '', s.t || '']; for (let k = 1; k <= 2; k++) { h.getCell(k).font = F({ bold: true }); h.getCell(k).fill = X.band; }
      for (const it of s.itens || []) { const row = ws.getRow(r++); row.values = [it.n || '', resolveTokens(it.t || '', tk)]; row.getCell(2).alignment = { wrapText: true, vertical: 'top' }; row.getCell(1).alignment = { vertical: 'top' }; }
      r++;
    }
    if ((pr.exclusoes || []).length || pr.exclusoesIntro) {
      const h = ws.getRow(r++); h.values = ['', 'EXCLUSÕES']; for (let k = 1; k <= 2; k++) { h.getCell(k).font = F({ bold: true }); h.getCell(k).fill = X.band; }
      if (pr.exclusoesIntro) { const row = ws.getRow(r++); row.values = ['', resolveTokens(pr.exclusoesIntro, tk)]; row.getCell(2).alignment = { wrapText: true }; }
      (pr.exclusoes || []).forEach((t, i) => { const row = ws.getRow(r++); row.values = [i + 1, resolveTokens(t, tk)]; row.getCell(2).alignment = { wrapText: true, vertical: 'top' }; row.getCell(1).alignment = { vertical: 'top', horizontal: 'left' }; });
    }
  }
  // Projetos enviados
  if (sec.has('projetos')) {
    const ex = S.cur.extras || {}; const pj = ex.projetos || {}; const ws = add('Projetos');
    ws.columns = [{ width: 26 }, { width: 9 }, { width: 8 }, { width: 50 }, { width: 10 }, { width: 14 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 18 }];
    topo(ws, 'D', pj.titulo || 'Projetos enviados');
    ws.getCell('D3').value = [pj.plataforma && `Plataforma: ${pj.plataforma}`, (pj.dataIni || pj.dataFim) && `Período: ${pj.dataIni || ''} a ${pj.dataFim || ''}`, pj.emissor && `Emissor: ${pj.emissor}`, pj.emissao && `Emissão: ${pj.emissao}`].filter(Boolean).join(' · ');
    xlHeader(ws, 5, ['Código', 'Extensão', 'Revisão', 'Título', 'Tamanho', 'Data de cadastro', 'Cadastrado por', 'Última atualização', 'Status', 'Projeto', 'Disciplina']);
    (ex.projetosRows || []).forEach((rw, i) => { ws.getRow(6 + i).values = rw.slice(0, 11); });
    ws.views = [{ state: 'frozen', ySplit: 5 }];
  }
  // Modelo 3D
  if (sec.has('modelo3d')) {
    const md = (S.cur.extras || {}).modelo3d || {}; const ws = add('Modelo 3D'); ws.columns = [{ width: 4 }, { width: 120 }];
    topo(ws, 'B', 'Modelo 3D');
    ws.getCell('B3').value = md.link ? { text: md.link, hyperlink: md.link } : 'Sem link cadastrado.';
    const png = await img3d();
    if (png) { const id = wb.addImage({ buffer: png, extension: 'png' }); ws.addImage(id, { tl: { col: 1, row: 4 }, ext: { width: 900, height: Math.round(900 * 6183086 / 8522340) } }); }
    else ws.getCell('B5').value = 'Sem imagem cadastrada.';
  }
  const buf = await wb.xlsx.writeBuffer();
  await saveFile(nomeArq(m, 'xlsx'), new Blob([buf]));
}

/* ---------- PDF ---------- */
async function gerarPdf(sec, opt) {
  const B = computeBudget(), m = B.meta; toast('Gerando PDF…');
  await loadLib('jspdf'); await loadLib('autotable');
  const { jsPDF } = window.jspdf; const atp = window.jspdf_autotable || window['jspdf-autotable']; if (!jsPDF.API.autoTable && atp && atp.applyPlugin) atp.applyPlugin(jsPDF);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const FN = await pdfFonte(doc);
  const logo = await logoPng(); const W = doc.internal.pageSize.getWidth(), Hh = doc.internal.pageSize.getHeight();
  const k1 = 1 + B.bdi; let title = '';
  const header = () => {
    if (logo) doc.addImage(logo, 'PNG', 12, 8, 12, 12);
    doc.setFont(FN, 'bold'); doc.setFontSize(13); doc.setTextColor(55, 58, 54); doc.text(title, 28, 13);
    doc.setFont(FN, 'normal'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0); doc.text(`${idOrc(m)} · ${m.status || ''}`, 28, 18);
    doc.setFontSize(8); doc.setTextColor(55, 58, 54);
    doc.text(`Custo direto R$ ${money(B.total)}${opt.bdi || sec.has('resumo') ? `   BDI ${pctf(B.bdi)}   Preço de venda R$ ${money(B.venda)}` : ''}`, W - 12, 13, { align: 'right' });
    doc.text(`Data-base ${m.inccData ? mmaa(m.inccData) : '-'} · INCC-DI ${fmt(+m.incc || 0, 3, 3)}`, W - 12, 18, { align: 'right' });
    doc.setDrawColor(254, 80, 0); doc.setLineWidth(0.6); doc.line(12, 22.5, W - 12, 22.5);
  };
  const footer = () => {
    doc.setDrawColor(208, 208, 206); doc.setLineWidth(0.3); doc.line(12, Hh - 11, W - 12, Hh - 11);
    doc.setFont(FN, 'normal'); doc.setFontSize(7.5); doc.setTextColor(55, 58, 54);
    doc.text(`© ${YEAR} Unità Engenharia. Todos os direitos reservados.`, 12, Hh - 7);
    doc.text('Setor de orçamentos | Unità', W / 2, Hh - 7, { align: 'center' });
    doc.text(`Página ${doc.internal.getNumberOfPages()} de {tp}`, W - 12, Hh - 7, { align: 'right' });
  };
  const base = { startY: 28, margin: { top: 26, bottom: 15, left: 12, right: 12 }, styles: { font: FN, fontSize: 7.4, cellPadding: 1.1, textColor: [0, 0, 0], lineColor: [208, 208, 206], lineWidth: 0.1 }, headStyles: { fillColor: [55, 58, 54], textColor: 255, fontStyle: 'bold' }, footStyles: { fillColor: [55, 58, 54], textColor: 255, fontStyle: 'bold' }, didDrawPage: () => { header(); footer(); } };
  let primeira = true;
  const parte = t => { title = t; if (!primeira) doc.addPage(); primeira = false; };
  const rows = B.rows;
  if (sec.has('resumo')) {
    parte('Resumo de preço e indicadores');
    const et = rows.filter(r => r.depth === 0).map(r => [r.n, r.v.desc, money(r.total), B.total ? pctf(r.total / B.total) : '']);
    doc.autoTable({ ...base, startY: 28, head: [['Item', 'Etapa', 'Custo direto', '%']], body: et, foot: [['', 'TOTAL', money(B.total), '100,00%']], showFoot: 'lastPage', columnStyles: { 0: { cellWidth: 20 }, 2: { halign: 'right', cellWidth: 40 }, 3: { halign: 'right', cellWidth: 22 } } });
    const ac = +m.areaConst || 0, ap = +m.areaPriv || 0, uh = +m.uh || 0;
    const kp = [['Custo direto (custo raso)', 'R$ ' + money(B.total)], ['BDI equivalente', pctf(B.bdi)], ['Preço de venda', 'R$ ' + money(B.venda)], ['Custo por m² de área construída', ac ? 'R$ ' + money(B.total / ac) + ` (${fmt(ac)} m²)` : '-'], ['Custo por m² de área privativa', ap ? 'R$ ' + money(B.total / ap) + ` (${fmt(ap)} m²)` : '-'], ['Custo por UH', uh ? 'R$ ' + money(B.total / uh) + ` (${fmt(uh, 0, 0)} UH)` : '-']];
    doc.autoTable({ ...base, startY: doc.lastAutoTable.finalY + 8, head: [['Indicador', 'Valor']], body: kp, tableWidth: 150, columnStyles: { 1: { halign: 'right' } } });
    if (B.ps) {
      const p = B.ps, b = m.bdi || {};
      const fp = [['Subtotal 01 (custo raso)', money(p.S1)], [`Taxa de administração ${fmt(+b.adm || 0, 2, 4)}%`, money(p.adm)], [`Assistência técnica ${fmt(+b.assist || 0, 2, 4)}%`, money(p.assist)], ['Subtotal 02', money(p.S2)],
      [`Impostos ${pctf(p.t)} × base ${money(p.base)} ÷ (1 − ${pctf(p.t)})`, money(p.imp)], ['Subtotal 03 (preço de venda)', money(p.S3)], [`Com benefício fiscal (sem ISS): impostos ${money(p.imp2)}`, money(p.S4)]];
      doc.autoTable({ ...base, startY: doc.lastAutoTable.finalY + 8, head: [['Formação do preço', 'R$']], body: fp, tableWidth: 150, columnStyles: { 1: { halign: 'right', cellWidth: 40 } }, didParseCell: d => { if (d.section === 'body' && /^Subtotal/.test(fp[d.row.index][0])) d.cell.styles.fontStyle = 'bold'; } });
    }
  }
  if (sec.has('sintetico')) {
    parte('Orçamento sintético');
    const et = rows.filter(r => r.v.k === 'e'); const dp = et.map(r => r.depth);
    doc.autoTable({
      ...base, head: [['Item', 'Descrição', 'Custo total', '%']], body: et.map(r => [r.n, '  '.repeat(r.depth) + r.v.desc, money(r.total), B.total ? pctf(r.total / B.total) : '']),
      foot: [['', 'TOTAL GERAL', money(B.total), '100,00%']], showFoot: 'lastPage', columnStyles: { 0: { cellWidth: 24 }, 2: { halign: 'right', cellWidth: 40 }, 3: { halign: 'right', cellWidth: 22 } },
      didParseCell: d => { if (d.section === 'body' && dp[d.row.index] === 0) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [208, 208, 206]; } if (d.section !== 'body' && d.column.index >= 2) d.cell.styles.halign = 'right'; }
    });
  }
  if (sec.has('analitico')) {
    parte('Orçamento analítico');
    const wb = opt.bdi;
    const head = wb ? [['Item', 'Código', 'Descrição', 'Un', 'Qtde', 'Custo unit.', 'Custo total', 'Unit. c/ BDI', 'Total c/ BDI', '%']] : [['Item', 'Código', 'Descrição', 'Un', 'Qtde', 'Custo unit.', 'Custo total', '%']];
    const body = rows.map(r => {
      const v = r.v, e = v.k === 'e', ind = '  '.repeat(r.depth), p = B.total ? pctf(r.total / B.total) : '';
      const un = (v.cod && S.cur.comps.get(v.cod) || {}).un || v.un || '';
      const b0 = e ? [r.n, '', ind + v.desc, '', '', '', money(r.total)] : [r.n, v.cod || '', ind + v.desc, un, fmt(+v.qtd || 0, 2, 4), money(r.unit), money(r.total)];
      return wb ? [...b0, e ? '' : money(r.unit * k1), money(r.total * k1), p] : [...b0, p];
    });
    const ed = rows.map(r => r.v.k === 'e' ? r.depth : -1);
    const foot = wb ? [['', '', 'TOTAL GERAL', '', '', '', money(B.total), '', money(B.venda), '100,00%']] : [['', '', 'TOTAL GERAL', '', '', '', money(B.total), '100,00%']];
    const nc = wb ? [4, 5, 6, 7, 8, 9] : [4, 5, 6, 7];
    const cs = { 0: { cellWidth: 20 }, 1: { cellWidth: 20 }, 3: { cellWidth: 10 } }; nc.forEach(c => cs[c] = { halign: 'right', cellWidth: c === 9 || (!wb && c === 7) ? 15 : 24 });
    doc.autoTable({ ...base, head, body, foot, showFoot: 'lastPage', columnStyles: cs, didParseCell: d => { if (d.section === 'body') { const x = ed[d.row.index]; if (x >= 0) { d.cell.styles.fontStyle = 'bold'; if (x === 0) d.cell.styles.fillColor = [208, 208, 206]; } } if (d.section !== 'body' && nc.includes(d.column.index)) d.cell.styles.halign = 'right'; } });
  }
  const { comps, ins } = reachable(B); const ctx = B.ctx;
  if (sec.has('comps')) {
    parte('Composições de custo unitário');
    const bd = [], kinds = [];
    for (const c of comps) {
      bd.push([c.cod, c.desc, c.un, '', '', '']); kinds.push('h');
      for (const it of c.itens || []) { const x = it.t === 'c' ? S.cur.comps.get(it.cod) : S.cur.ins.get(it.cod); const pu = it.t === 'c' ? compUnit(ctx, it.cod) : insPrice(ctx, it.cod); bd.push([it.cod, (it.t === 'c' ? '[aux] ' : '') + (x ? x.desc : '(não encontrado)'), x ? x.un : '', fmt(+it.coef || 0, 5, 5), fmt(pu, 2, 4), fmt((+it.coef || 0) * pu, 2, 4)]); kinds.push('i'); }
      bd.push(['', (c.itens || []).length ? 'Custo unitário' : 'Custo unitário (informado)', '', '', '', money(compUnit(ctx, c.cod))]); kinds.push('t');
    }
    doc.autoTable({ ...base, head: [['Código', 'Descrição', 'Un', 'Coeficiente', 'Preço unit.', 'Subtotal']], body: bd, columnStyles: { 0: { cellWidth: 24 }, 2: { cellWidth: 12 }, 3: { halign: 'right', cellWidth: 24 }, 4: { halign: 'right', cellWidth: 26 }, 5: { halign: 'right', cellWidth: 26 } }, didParseCell: d => { if (d.section !== 'body') return; const k = kinds[d.row.index]; if (k === 'h') { d.cell.styles.fillColor = [208, 208, 206]; d.cell.styles.fontStyle = 'bold'; } if (k === 't') d.cell.styles.fontStyle = 'bold'; } });
  }
  if (sec.has('insumos')) {
    parte('Insumos do orçamento');
    doc.autoTable({ ...base, head: [['Código', 'Descrição', 'Un', 'Preço unit.', 'Grupo', 'Data cotação']], body: ins.map(x => [x.cod, x.desc, x.un, fmt(+x.preco || 0, 2, 4), x.grp || '', x.dt ? fmtDate(x.dt) : '']), columnStyles: { 0: { cellWidth: 24 }, 2: { cellWidth: 12 }, 3: { halign: 'right', cellWidth: 26 }, 4: { cellWidth: 34 }, 5: { cellWidth: 26 } } });
  }
  if (sec.has('abc')) {
    const I = indicators(B);
    const tab = (l, s) => doc.autoTable({ ...base, head: [['#', s ? 'Item' : 'Grupo', 'Código', 'Descrição', 'Un', 'Qtde', s ? 'Custo unit.' : 'Preço unit.', 'Total', '%', '% acum.', 'Classe']], body: l.map((x, i) => [i + 1, s ? x.n : x.grp, x.cod, x.desc, x.un, fmt(x.q, 2, 4), fmt(x.pu, 2, 4), money(x.total), pctf(x.p), pctf(x.acc), x.cls]), columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 22 }, 2: { cellWidth: 20 }, 4: { cellWidth: 10 }, 5: { halign: 'right', cellWidth: 20 }, 6: { halign: 'right', cellWidth: 22 }, 7: { halign: 'right', cellWidth: 26 }, 8: { halign: 'right', cellWidth: 14 }, 9: { halign: 'right', cellWidth: 16 }, 10: { halign: 'center', cellWidth: 13 } } });
    parte('Curva ABC de serviços'); tab(I.servs, true);
    parte('Curva ABC de insumos'); tab(I.ins, false);
  }
  if (sec.has('premissas')) {
    parte('Premissas e exclusões');
    const pr = (S.cur.extras || {}).premissas || {}; const tk = tokens(m, B); const bd = [], kinds = [];
    for (const s of pr.secoes || []) { bd.push([s.n || '', s.t || '']); kinds.push('h'); for (const it of s.itens || []) { bd.push([it.n || '', resolveTokens(it.t || '', tk)]); kinds.push('i'); } }
    if ((pr.exclusoes || []).length || pr.exclusoesIntro) { bd.push(['', 'EXCLUSÕES']); kinds.push('h'); if (pr.exclusoesIntro) { bd.push(['', resolveTokens(pr.exclusoesIntro, tk)]); kinds.push('i'); } (pr.exclusoes || []).forEach((t, i) => { bd.push([String(i + 1), resolveTokens(t, tk)]); kinds.push('i'); }); }
    if (!bd.length) { bd.push(['', 'Nenhuma premissa cadastrada.']); kinds.push('i'); }
    doc.autoTable({ ...base, styles: { ...base.styles, fontSize: 8 }, head: [['Nº', 'Texto']], body: bd, columnStyles: { 0: { cellWidth: 16 } }, didParseCell: d => { if (d.section === 'body' && kinds[d.row.index] === 'h') { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [208, 208, 206]; } } });
  }
  if (sec.has('projetos')) {
    const ex = S.cur.extras || {}; const pj = ex.projetos || {};
    parte(pj.titulo ? `Projetos enviados · ${pj.titulo}` : 'Projetos enviados');
    const info = [pj.plataforma && `Plataforma: ${pj.plataforma}`, (pj.dataIni || pj.dataFim) && `Período: ${pj.dataIni || ''} a ${pj.dataFim || ''}`, pj.emissor && `Emissor: ${pj.emissor}`, pj.emissao && `Emissão: ${pj.emissao}`].filter(Boolean).join('   ·   ');
    const rs = (ex.projetosRows || []).map(r => r.slice(0, 11));
    doc.autoTable({ ...base, startY: info ? 32 : 28, styles: { ...base.styles, fontSize: 6.2, cellPadding: 0.8 }, head: [['Código', 'Ext.', 'Rev.', 'Título', 'Tamanho', 'Cadastro', 'Cadastrado por', 'Atualização', 'Status', 'Projeto', 'Disciplina']], body: rs.length ? rs : [['', '', '', 'Nenhum documento listado.', '', '', '', '', '', '', '']], didDrawPage: d => { header(); footer(); if (info && d.pageNumber === 1) { doc.setFont(FN, 'normal'); doc.setFontSize(8); doc.setTextColor(55, 58, 54); doc.text(info, 12, 28.5); } } });
  }
  if (sec.has('modelo3d')) {
    parte('Modelo 3D'); header(); footer();
    const md = (S.cur.extras || {}).modelo3d || {}; const png = await img3d();
    doc.setFont(FN, 'normal'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
    if (md.link) doc.textWithLink(md.link, 12, 29, { url: md.link }); else doc.text('Sem link cadastrado.', 12, 29);
    if (png) { const aw = W - 24, ah = Hh - 11 - 34 - 4, r = 8522340 / 6183086; let w = aw, h = w / r; if (h > ah) { h = ah; w = h * r; } doc.addImage(png, 'PNG', (W - w) / 2, 33, w, h); }
    else doc.text('Sem imagem cadastrada.', 12, 36);
  }
  if (typeof doc.putTotalPages === 'function') { doc.setFont(FN, 'normal'); doc.putTotalPages('{tp}'); }
  await saveFile(nomeArq(m, 'pdf'), new Blob([doc.output('arraybuffer')]));
}
