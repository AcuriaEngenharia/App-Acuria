/* ===================== Tela: Importar ===================== */
const IMP_FIELDS = {
  ins: [['cod', 'Código', 1, /c[oó]d|insumo/i], ['desc', 'Descrição', 1, /descri/i], ['un', 'Unidade', 0, /^un|unid/i], ['preco', 'Preço unitário', 0, /pre[cç]o|valor|custo/i],
    ['grp', 'Grupo / tipo', 0, /grupo|tipo|classe/i], ['dt', 'Data da cotação', 0, /data|cota/i]],
  cpu: [['ccod', 'Código da composição', 1, /(c[oó]d.*(compos|cpu|servi))|(^cpu$)|(^servi[cç]o$)/i], ['cdesc', 'Descrição da composição', 0, /descri.*(compos|servi)/i], ['cun', 'Unidade da composição', 0, /un.*(compos|servi)/i],
    ['icod', 'Código do item', 1, /(c[oó]d.*(item|insumo))|(^insumo$)|(^item$)/i], ['coef', 'Coeficiente', 1, /coef|qtd|quant|[ií]ndice|consumo/i], ['itipo', 'Tipo do item', 0, /tipo/i],
    ['idesc', 'Descrição do item', 0, /descri.*(item|insumo)/i], ['iun', 'Unidade do item', 0, /un.*(item|insumo)/i], ['ipreco', 'Preço do item', 0, /pre[cç]o/i], ['igrp', 'Grupo do item', 0, /grupo/i]]
};
function normGrp(s) {
  const n = norm(s); if (!n) return null;
  if (/mao.de.obra|^mo\b|m\.o\./.test(n)) return 'Mão de obra';
  if (/equip/.test(n)) return 'Equipamento'; if (/servi/.test(n)) return 'Serviços'; if (/verba/.test(n)) return 'Verbas'; if (/mater/.test(n)) return 'Material';
  return null;
}
function normDate(v) {
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
  const s = String(v ?? '').trim(); let r;
  if ((r = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s))) { const y = r[3].length === 2 ? '20' + r[3] : r[3]; return `${y}-${r[2].padStart(2, '0')}-${r[1].padStart(2, '0')}`; }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}
const cleanCode = v => String(v ?? '').trim();
function guessMap() {
  const I = S.imp; const hdr = (I.rows[I.hdr] || []).map(h => String(h ?? '').trim()); const used = new Set(); I.map = {};
  for (const [k, , , re] of IMP_FIELDS[I.target]) { let idx = -1; if (re) idx = hdr.findIndex((h, i) => !used.has(i) && h && re.test(h)); if (idx >= 0) used.add(idx); I.map[k] = idx; }
}
async function impLoadFile(file) {
  try { await loadLib('xlsx'); } catch (e) { toast(e.message, 'err'); return; }
  try {
    const buf = await file.arrayBuffer(); const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    S.imp.file = file.name; S.imp.wb = wb; S.imp.sheet = wb.SheetNames[0]; impLoadSheet();
  } catch (e) { console.error(e); toast('Não consegui ler o arquivo. Use .xlsx, .xls ou .csv.', 'err'); }
}
function impLoadSheet() {
  const I = S.imp; const ws = I.wb.Sheets[I.sheet];
  I.rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  I.hdr = Math.max(0, I.rows.slice(0, 40).findIndex(r => r.filter(c => String(c).trim() !== '').length >= 3));
  I.defGrp = I.defGrp || 'Material'; guessMap(); render();
}
function impParse() {
  const I = S.imp; const res = { ins: new Map(), comps: new Map(), warn: [], newIns: 0, updIns: 0, newC: 0, updC: 0 };
  if (!I.rows) return res;
  const has = f => I.map[f] >= 0; const g = (r, f) => has(f) ? r[I.map[f]] : '';
  const warn = m => { if (res.warn.length < 200) res.warn.push(m); };
  const body = I.rows.slice(I.hdr + 1);
  if (I.target === 'ins') {
    body.forEach((r, j) => {
      const line = I.hdr + 2 + j; const cod = cleanCode(g(r, 'cod')); const desc = String(g(r, 'desc') ?? '').trim();
      if (!cod && !desc) return; if (!cod || !desc) { warn(`Linha ${line}: sem código ou descrição, ignorada.`); return; }
      const ex = S.ins.get(cod); const o = ex ? clone(ex) : { cod, desc, un: '', preco: 0, grp: I.defGrp, dt: '', enc: false };
      o.desc = desc;
      if (has('un')) o.un = String(g(r, 'un')).trim();
      if (has('preco')) { const p = parseNum(g(r, 'preco')); if (Number.isFinite(p)) o.preco = p; else if (String(g(r, 'preco')).trim()) warn(`Linha ${line}: preço "${g(r, 'preco')}" não reconhecido.`); }
      if (has('grp')) o.grp = normGrp(g(r, 'grp')) || o.grp || I.defGrp;
      if (has('dt')) o.dt = normDate(g(r, 'dt')) || o.dt || '';
      if (!res.ins.has(cod)) ex ? res.updIns++ : res.newIns++;
      res.ins.set(cod, o);
    });
  } else {
    let cc = null;
    body.forEach((r, j) => {
      const line = I.hdr + 2 + j; const c = cleanCode(g(r, 'ccod'));
      if (c) cc = c; if (!cc) return;
      let o = res.comps.get(cc);
      if (!o) { const ex = S.cpus.get(cc); o = { cod: cc, desc: ex ? ex.desc : cc, un: ex ? ex.un : 'un', pref: ex ? (+ex.pref || 0) : 0, itens: [] }; res.comps.set(cc, o); ex ? res.updC++ : res.newC++; }
      const cd = String(g(r, 'cdesc') ?? '').trim(), cu = String(g(r, 'cun') ?? '').trim();
      if (c && cd) o.desc = cd; if (c && cu) o.un = cu;
      const ic = cleanCode(g(r, 'icod')); if (!ic) return;
      const coef = parseNum(g(r, 'coef')); if (!Number.isFinite(coef)) { warn(`Linha ${line}: coeficiente inválido para ${ic}.`); return; }
      const tp = String(g(r, 'itipo') ?? '');
      o.itens.push({ t: /comp|cpu|aux/i.test(tp) ? 'c' : /insumo|mat|m[aã]o|equip/i.test(tp) ? 'i' : null, cod: ic, coef });
      const idesc = String(g(r, 'idesc') ?? '').trim();
      if (idesc && !S.ins.has(ic) && !/comp|cpu|aux/i.test(tp)) {
        const grp = normGrp(g(r, 'igrp')) || I.defGrp || 'Material'; const p = parseNum(g(r, 'ipreco'));
        res.ins.set(ic, { cod: ic, desc: idesc, un: String(g(r, 'iun') ?? '').trim() || 'un', preco: Number.isFinite(p) ? p : 0, grp, dt: '', enc: grp === 'Mão de obra' });
      }
    });
    for (const o of res.comps.values()) for (const it of o.itens) {
      if (!it.t) it.t = (res.comps.has(it.cod) || S.cpus.has(it.cod)) ? 'c' : 'i';
      if (it.t === 'i' && !S.ins.has(it.cod) && !res.ins.has(it.cod)) warn(`${o.cod}: insumo ${it.cod} não existe na base (entra com preço zero).`);
      if (it.t === 'c' && !res.comps.has(it.cod) && !S.cpus.has(it.cod)) warn(`${o.cod}: composição auxiliar ${it.cod} não existe na base.`);
      if (it.t === 'c' && it.cod === o.cod) warn(`${o.cod}: a composição referencia a si mesma.`);
    }
    res.newIns = res.ins.size;
  }
  return res;
}
function chunkOverflow(coll, n, cur, add) {
  const chunks = {};
  const put = (k, v) => { const i = hash(k) % n; (chunks[i] = chunks[i] || {})[k] = v; };
  for (const [k, v] of cur) put(k, v); for (const [k, v] of add) put(k, v);
  return Object.entries(chunks).filter(([, m]) => JSON.stringify(m).length > 245000).map(([i]) => coll + '/c' + i);
}
function vImpOrc() {
  const I = S.imp; const R = I.orc;
  let step2 = '';
  if (R) {
    const r0 = resumoImport(R); const m = R.meta; const dif = r0.tot - R.fileTotal;
    const kb = (l, v, s) => `<div class="kbox"><div class="lbl">${l}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
    const B0 = { total: r0.tot, byId: new Map() }; const itemsById = new Map(R.items.map(i => [i.id, i]));
    const ctx = makeCtx(R.comps, R.ins, 0); const base = (m.bdi.base || []).reduce((s, id) => { const it = itemsById.get(id); return s + (it ? (+it.qtd || 0) * compUnit(ctx, it.cod) : 0); }, 0);
    const pc = x => (+x || 0) / 100; const b = m.bdi; const S2 = r0.tot * (1 + pc(b.adm) + pc(b.assist)); const t = pc(b.ir) + pc(b.iss) + pc(b.pis) + pc(b.cofins) + pc(b.cssl); const S3 = S2 + (t < 1 ? t * base / (1 - t) : 0);
    step2 = `<div class="card pad stack"><div class="row"><h2>2. Conferir e importar</h2><span class="spacer"></span><span class="muted">${esc(R.file)}</span></div>
      <div class="kgrid">${kb('Empreendimento', esc(m.empreendimento || '-'), esc([m.cliente, m.cidade].filter(Boolean).join(' · ')))}${kb('Estrutura', `${r0.etapas} etapas`, `${r0.servicos} serviços · ${R.comps.size} composições · ${R.ins.size} insumos`)}
        ${kb('Custo raso recalculado', brl(r0.tot), `No arquivo: ${brl(R.fileTotal)} · diferença ${brl(dif)}`)}${kb('Preço de venda', brl(S3), `adm. ${fmt(b.adm)}% · assist. ${fmt(b.assist)}% · impostos ${fmt(t * 100)}% sobre ${brl(base)}`)}
        ${kb('Documentos', `${R.premissas.secoes.reduce((s, x) => s + x.itens.length, 0)} premissas`, `${R.premissas.exclusoes.length} exclusões · ${R.projetos.rows.length} projetos · ${R.incc.length} meses de INCC${R.modelo3dImg ? ' · imagem do modelo 3D' : ''}`)}</div>
      ${Math.abs(dif) >= 0.01 ? `<p class="muted" style="margin:0;font-size:11.5px">A diferença vem do arredondamento das quantidades de insumo no analítico (6 casas), usadas para recalcular os coeficientes: coeficiente = quantidade do insumo ÷ quantidade do serviço.</p>` : ''}
      <div class="form"><label class="fld"><span class="lbl">Código do orçamento *</span><input id="io-cod" value=""></label><label class="fld wide"><span class="lbl">Nome do orçamento *</span><input id="io-nome" value="${esc(R.base)}"></label></div>
      <label class="row"><input type="checkbox" id="io-base" checked> Atualizar a base de composições e insumos com as deste arquivo (${R.comps.size} CPUs, ${R.ins.size} insumos)</label>
      <label class="row"><input type="checkbox" id="io-incc" checked> Atualizar a série INCC-DI com a aba INCC</label>
      ${R.warn.length ? `<details><summary class="warn">${R.warn.length} aviso(s)</summary><ul class="muted">${R.warn.slice(0, 80).map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}
      <p class="muted" style="margin:0;font-size:11.5px">Grupo dos insumos definido pelo prefixo do código (IM material, IS serviços, IP mão de obra ou verba indireta), porque o arquivo não traz essa coluna. Ajuste depois na aba Insumos se precisar.</p>
      <div class="row"><span class="spacer"></span><button class="btn" data-act="impReset">Cancelar</button><button class="btn primary" data-act="impOrcDo"${S.readOnly ? ' disabled' : ''}>Importar orçamento</button></div></div>`;
  }
  return step2;
}
function vImp() {
  const I = S.imp; const F = IMP_FIELDS[I.target] || IMP_FIELDS.ins;
  const tgt = (v, t, d) => `<label class="${I.target === v ? 'on' : ''}"><input type="radio" name="impt" data-act="impTarget" data-v="${v}"${I.target === v ? ' checked' : ''}><span><b>${t}</b><br><span class="muted">${d}</span></span></label>`;
  let step2 = '';
  if (I.target === 'orc') step2 = vImpOrc();
  else if (I.rows) {
    const R = impParse(); I._res = R;
    const hdr = I.rows[I.hdr] || []; const cols = hdr.map((h, i) => `<option value="${i}">${esc(String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ''))} · ${esc(String(h).slice(0, 40))}</option>`).join('');
    const maps = F.map(([k, l, req]) => `<label class="fld"><span class="lbl">${l}${req ? ' *' : ''}</span><select data-f="imp.map" data-k="${k}"><option value="-1">(não usar)</option>${cols.replace(`value="${I.map[k]}"`, `value="${I.map[k]}" selected`)}</select></label>`).join('');
    let prev = '';
    if (I.target === 'ins') {
      prev = `<table class="grid"><thead><tr><th>Código</th><th>Descrição</th><th>Un</th><th class="num">Preço</th><th>Grupo</th><th>Cotação</th><th></th></tr></thead><tbody>${[...R.ins.values()].slice(0, 12).map(o => `<tr><td class="c-cod">${esc(o.cod)}</td><td>${esc(o.desc)}</td><td>${esc(o.un)}</td><td class="num">${money(o.preco)}</td><td>${esc(o.grp)}</td><td>${fmtDate(o.dt)}</td><td>${S.ins.has(o.cod) ? '<span class="chip">atualiza</span>' : '<span class="chip acc">novo</span>'}</td></tr>`).join('')}</tbody></table>`;
    } else {
      prev = `<table class="grid"><thead><tr><th>Composição</th><th>Descrição</th><th>Un</th><th class="num">Itens</th><th>Primeiros itens</th><th></th></tr></thead><tbody>${[...R.comps.values()].slice(0, 12).map(o => `<tr><td class="c-cod">${esc(o.cod)}</td><td>${esc(o.desc)}</td><td>${esc(o.un)}</td><td class="num">${o.itens.length}</td><td class="muted">${o.itens.slice(0, 4).map(it => `${esc(it.cod)} (${it.t === 'c' ? 'aux' : 'ins'}) × ${fmt(it.coef, 2, 5)}`).join(', ')}</td><td>${S.cpus.has(o.cod) ? '<span class="chip">substitui</span>' : '<span class="chip acc">nova</span>'}</td></tr>`).join('')}</tbody></table>`;
    }
    const n = I.target === 'ins' ? R.ins.size : R.comps.size;
    const resumo = I.target === 'ins' ? `${R.newIns} novos e ${R.updIns} atualizados` : `${R.newC} novas e ${R.updC} substituídas${R.ins.size ? `, com ${R.ins.size} insumos novos criados a partir do arquivo` : ''}`;
    step2 = `<div class="card pad stack"><div class="row"><h2>2. Conferir colunas</h2><span class="spacer"></span><span class="muted">${esc(I.file)}</span></div>
      <div class="form"><label class="fld"><span class="lbl">Aba</span><select data-f="imp.sheet">${I.wb.SheetNames.map(s => `<option${s === I.sheet ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="fld"><span class="lbl">Linha do cabeçalho</span><input data-f="imp.hdr" value="${I.hdr + 1}"></label>
      <label class="fld"><span class="lbl">Grupo padrão (quando vazio)</span><select data-f="imp.defGrp">${GRUPOS.map(g => `<option${g === I.defGrp ? ' selected' : ''}>${g}</option>`).join('')}</select></label></div>
      <div class="map-grid">${maps}</div>
      <h3>Prévia</h3><div class="tbl-wrap" style="max-height:340px">${prev}</div>
      ${R.warn.length ? `<details><summary class="warn">${R.warn.length}${R.warn.length >= 200 ? '+' : ''} aviso(s)</summary><ul class="muted">${R.warn.slice(0, 60).map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}
      <div class="row"><span><b>${n}</b> ${I.target === 'ins' ? 'insumos' : 'composições'} prontos para importar: ${resumo}.</span><span class="spacer"></span>
      <button class="btn" data-act="impReset">Cancelar</button><button class="btn primary" data-act="impDo"${n && !S.readOnly ? '' : ' disabled'}>Importar para a base</button></div></div>`;
  }
  return `<div class="page-head"><div><h1>Importar base</h1><p>Carregue uma planilha exportada do sistema atual ou montada no Excel. Registros com o mesmo código são atualizados.</p></div></div>
  <div class="stack"><div class="card pad stack"><h2>1. O que você vai importar</h2>
    <div class="radio">${tgt('orc', 'Orçamento completo', 'Planilha para o cliente no modelo Unità (sintético, analítico, resumos, premissas, projetos, INCC). Cria o orçamento e alimenta a base.')}${tgt('ins', 'Insumos', 'Uma linha por insumo: código, descrição, unidade, preço, grupo, data da cotação.')}${tgt('cpu', 'Composições (CPU)', 'Uma linha por item: código da composição, código do item e coeficiente. O código da composição pode vir só na primeira linha do bloco.')}</div>
    <div class="drop"><input type="file" id="imp-file" accept=".xlsx,.xls,.xlsm,.csv"><p class="muted" style="margin:8px 0 0">.xlsx, .xls ou .csv${I.target === 'orc' ? '' : ` · <button class="btn sm ghost" data-act="impTpl">Baixar modelo de ${I.target === 'ins' ? 'insumos' : 'composições'}</button>`}</p></div>
    ${I.target === 'cpu' ? '<p class="muted" style="margin:0">Importe os insumos antes das composições. Uma composição que já existe na base tem os itens substituídos pelos do arquivo.</p>' : ''}
  </div>${step2}</div>`;
}

/* ===================== Exportações ===================== */
const safeName = s => String(s).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
async function saveFile(filename, data) {
  if (!S.dl) { toast('O download não está disponível nesta visualização.', 'err'); return; }
  try { await S.dl.save({ filename, data }); toast('Arquivo salvo: ' + filename); }
  catch (e) { if (e && e.code === 'declined') return; toast('Não foi possível salvar o arquivo (' + ((e && e.code) || 'erro') + ').', 'err'); }
}
function reachable(B) {
  const comps = [], seen = new Set(), insSet = new Set();
  const visit = cod => { if (seen.has(cod)) return; const c = S.cur.comps.get(cod); if (!c) return; seen.add(cod); comps.push(c); for (const it of c.itens || []) it.t === 'c' ? visit(it.cod) : insSet.add(it.cod); };
  B.rows.forEach(r => { if (r.v.k === 's' && r.v.cod) visit(r.v.cod); });
  const ins = [...insSet].map(c => S.cur.ins.get(c)).filter(Boolean).sort((a, b) => a.cod.localeCompare(b.cod, 'pt-BR', { numeric: true }));
  return { comps, ins };
}
const XF = { money: '#,##0.00', qty: '#,##0.00###', coef: '0.00000', price: '#,##0.00###', pct: '0.00%' };
function xlStyles() {
  const fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + c } });
  return {
    font: { name: 'Inter', size: 10 }, head: { font: { name: 'Inter', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }, fill: fill('373A36') },
    band: fill('D0D0CE'), title: { name: 'Inter', size: 14, bold: true, color: { argb: 'FFFE5000' } }, fill
  };
}
function xlHeader(ws, row, labels) { const X = xlStyles(); const r = ws.getRow(row); labels.forEach((l, i) => { const c = r.getCell(i + 1); c.value = l; c.font = X.head.font; c.fill = X.head.fill; c.alignment = { vertical: 'middle' }; }); r.height = 18; }
function xlFooter(ws) { ws.headerFooter = { oddFooter: `&L© ${YEAR} Unità Engenharia. Todos os direitos reservados.&CSetor de orçamentos | Unità&RPágina &P de &N` }; ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }; }
/* Fonte Inter embutida no PDF (arquivos publicados junto do app); sem eles, cai para Helvetica */
let _interPdf = null;
async function pdfFonte(doc) {
  try {
    if (!_interPdf) {
      const b64 = async f => { const r = await fetch(f); if (!r.ok) throw new Error(f); const u = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
      _interPdf = { r: await b64('Inter-Regular.ttf'), b: await b64('Inter-Bold.ttf') };
    }
    doc.addFileToVFS('Inter-Regular.ttf', _interPdf.r); doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
    doc.addFileToVFS('Inter-Bold.ttf', _interPdf.b); doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
    return 'Inter';
  } catch (e) { console.warn('Inter indisponível no PDF', e); return 'helvetica'; }
}
async function exportInsXlsx() {
  try { await loadLib('exceljs'); } catch (e) { toast(e.message, 'err'); return; }
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Insumos'); xlFooter(ws);
  ws.columns = [{ width: 14 }, { width: 64 }, { width: 7 }, { width: 14 }, { width: 14 }, { width: 13 }];
  xlHeader(ws, 1, ['Código', 'Descrição', 'Unidade', 'Preço unitário', 'Grupo', 'Data da cotação']);
  [...S.ins.values()].sort((a, b) => a.cod.localeCompare(b.cod, 'pt-BR', { numeric: true })).forEach((x, i) => { const r = ws.getRow(i + 2); r.values = [x.cod, x.desc, x.un, +x.preco || 0, x.grp, x.dt ? new Date(x.dt + 'T12:00:00') : '']; r.getCell(4).numFmt = XF.price; r.getCell(6).numFmt = 'dd/mm/yyyy'; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await saveFile(`Base de insumos ${today()}.xlsx`, new Blob([await wb.xlsx.writeBuffer()]));
}
async function exportCpuXlsx() {
  try { await loadLib('exceljs'); } catch (e) { toast(e.message, 'err'); return; }
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Composições'); xlFooter(ws); const ctx = catCtx();
  ws.columns = [{ width: 16 }, { width: 50 }, { width: 10 }, { width: 14 }, { width: 13 }, { width: 12 }, { width: 50 }, { width: 14 }];
  xlHeader(ws, 1, ['Código da composição', 'Descrição da composição', 'Unidade da composição', 'Código do item', 'Coeficiente', 'Tipo do item', 'Descrição do item', 'Custo unit. comp.']);
  let r = 2;
  [...S.cpus.values()].sort((a, b) => a.cod.localeCompare(b.cod, 'pt-BR', { numeric: true })).forEach(c => {
    const its = c.itens && c.itens.length ? c.itens : [null];
    its.forEach((it, i) => {
      const x = it ? (it.t === 'c' ? S.cpus.get(it.cod) : S.ins.get(it.cod)) : null; const row = ws.getRow(r++);
      row.values = [c.cod, i === 0 ? c.desc : '', i === 0 ? c.un : '', it ? it.cod : '', it ? +it.coef : '', it ? (it.t === 'c' ? 'Composição' : 'Insumo') : '', x ? x.desc : '', i === 0 ? compUnit(ctx, c.cod) : ''];
      row.getCell(5).numFmt = XF.coef; row.getCell(8).numFmt = XF.price;
    });
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await saveFile(`Base de composições ${today()}.xlsx`, new Blob([await wb.xlsx.writeBuffer()]));
}
async function impTemplate() {
  try { await loadLib('xlsx'); } catch (e) { toast(e.message, 'err'); return; }
  const aoa = S.imp.target === 'ins'
    ? [['Código', 'Descrição', 'Unidade', 'Preço unitário', 'Grupo', 'Data da cotação'], ['IM00001', 'Sarrafo em madeira Pinus 2,5x7cm - (NBR 11700)', 'm', 2.2, 'Material', '17/11/2022'], ['IS00154', 'Montagem de gabarito para locação de obra', 'm', 65, 'Serviços', '15/09/2025']]
    : [['Código da composição', 'Descrição da composição', 'Unidade da composição', 'Código do item', 'Coeficiente', 'Tipo do item'], ['CPU00001', 'FABRICAÇÃO DE GABARITO', 'm', 'CPU00312', 0.02545, 'Composição'], ['', '', '', 'IM00001', 1.24667, 'Insumo'], ['', '', '', 'IS00154', 1, 'Insumo']];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Modelo');
  await saveFile(`Modelo de importação de ${S.imp.target === 'ins' ? 'insumos' : 'composições'}.xlsx`, new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]));
}
