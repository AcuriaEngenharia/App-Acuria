/* ===================== Extras do orçamento (premissas, projetos, modelo 3D) e INCC ===================== */
const EXP = id => `orcamentos/${id}/extras`;
async function loadExtras(id) {
  const ex = { premissas: { secoes: [], exclusoes: [], exclusoesIntro: '' }, modelo3d: { link: '', imagem: null }, projetos: {}, projetosRows: [] };
  if (S.db) {
    try {
      const snap = await S.db.collection(EXP(id)).get();
      for (const d of snap.docs) { const b = d.data() || {}; if (d.id === 'premissas') ex.premissas = { secoes: [], exclusoes: [], exclusoesIntro: '', ...b }; if (d.id === 'modelo3d') ex.modelo3d = { link: '', imagem: null, ...b }; if (d.id === 'projetos') ex.projetos = b; }
      const pj = await S.db.collection(`orcamentos/${id}/projetos`).get();
      ex.projetosRows = pj.docs.sort((a, b) => (+a.id.slice(1)) - (+b.id.slice(1))).flatMap(d => (d.data() || {}).rows || []);
    } catch (e) { console.warn(e); }
  }
  if (S.cur && S.cur.id === id) { S.cur.extras = ex; schedule(); }
  return ex;
}
function saveExtra(key, body) { if (!S.cur) return; S.cur.extras[key] = body; return saveDoc(`${EXP(S.cur.id)}/${key}`, body); }
async function saveProjetosRows(id, rows, info, oldN = 0) {
  const CH = 500; const n = Math.ceil(rows.length / CH);
  for (let i = 0; i < n; i++) await saveDoc(`orcamentos/${id}/projetos/p${i}`, { rows: rows.slice(i * CH, (i + 1) * CH) });
  if (S.db) for (let i = n; i < oldN; i++) { try { await S.db.doc(`orcamentos/${id}/projetos/p${i}`).delete(); } catch { } }
  await saveDoc(`${EXP(id)}/projetos`, { ...(info || {}), _n: n, total: rows.length });
}
async function loadIncc() { if (S.incc) return S.incc; if (!S.db) { S.incc = []; return S.incc; } try { const s = await S.db.doc('config/incc').get(); S.incc = (s.exists && s.data().serie) || []; } catch { S.incc = []; } return S.incc; }
function inccDe(mes) { const x = (S.incc || []).find(p => p[0] === mes); return x ? +x[1] : null; }
function saveIncc(serie) { S.incc = [...serie].sort((a, b) => b[0].localeCompare(a[0])); return saveDoc('config/incc', { serie: S.incc }); }

/* ===================== Leitura da planilha do cliente (formato Unità) ===================== */
const serialISO = v => (typeof v === 'number' && v > 1000) ? new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10) : '';
function grupoPorCodigo(cod, desc) { const p = String(cod).slice(0, 2).toUpperCase(); if (p === 'IS') return 'Serviços'; if (p === 'IE') return 'Equipamento'; if (p === 'IP') return /indiret|verba/i.test(desc) ? 'Verbas' : 'Mão de obra'; return 'Material'; }
function wsCells(ws) { const rg = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1'); return rg; }
function cv(ws, addr) { const c = ws[addr]; return c ? c.v : undefined; }
function ctext(ws, addr) { const c = ws[addr]; if (!c) return ''; return String(c.w != null && c.t !== 'n' ? c.w : c.v).trim(); }
function splitAmp(f) { const parts = []; let cur = '', q = false, d = 0; for (const ch of f) { if (ch === '"') q = !q; if (!q && ch === '(') d++; if (!q && ch === ')') d--; if (!q && d === 0 && ch === '&') { parts.push(cur); cur = ''; continue; } cur += ch; } parts.push(cur); return parts.map(s => s.trim()); }
function formulaToTokens(f, cached, refTok) {
  try {
    let out = '';
    for (const p of splitAmp(f.replace(/^=/, ''))) {
      const lit = /^"([\s\S]*)"$/.exec(p); if (lit) { out += lit[1].replace(/""/g, '"'); continue; }
      const m = /(?:'([^']+)'|([A-Za-zÀ-ú0-9_]+))!\$?([A-Z]+)\$?(\d+)/.exec(p); if (!m) return cached;
      const key = ((m[1] || m[2]) + '!' + m[3] + m[4]).toUpperCase(); const tk = refTok[key]; if (!tk) return cached; out += '{' + tk + '}';
    }
    return out;
  } catch { return cached; }
}
async function lerPlanilhaCliente(buf, fileName) {
  await loadLib('xlsx');
  const wb = XLSX.read(buf, { type: 'array', cellFormula: true, cellNF: true, cellDates: false });
  const find = pre => { const n = wb.SheetNames.find(s => norm(s).startsWith(norm(pre))); return n ? { name: n, ws: wb.Sheets[n] } : null; };
  const S_ = { rc: find('RESUMO DE CUSTOS'), tx: find('RESUMO DE PREÇO'), snt: find('ORC SNT'), anl: find('ORC ANL'), ind: find('RESUMO DOS INDIRETOS'), inst: find('CUSTO DE INSTALA'), m3d: find('MODELO 3D'), prem: find('PREMISSAS'), proj: find('PROJETOS'), incc: find('INCC') };
  if (!S_.snt || !S_.anl) throw new Error('A planilha não tem as abas ORC SNT e ORC ANL.');
  const warn = []; const R = { warn, file: fileName, meta: {}, items: [], comps: new Map(), ins: new Map() };
  /* resumo de custos: dados do empreendimento */
  const info = {}; const refTok = {};
  const LBL = { 'empreendimento': ['empreendimento', 'empreendimento'], 'cliente': ['cliente', 'cliente'], 'endereco': ['endereco', null], 'cidade/estado': ['cidade', null], 'metodo construtivo': ['metodo', null], 'area construida': ['areaConst', 'ac'], 'area privativa total': ['areaPriv', 'ap'], 'area media privativa': [null, 'area_media'], 'area do terreno': ['areaTerreno', 'terreno'], 'fase orcamentaria': ['fase', null], 'prazo de execucao': ['prazo', 'prazo'], 'tipologia': ['tipologia', 'tipologia'], 'numero de unidades': ['uh', 'uh'], 'numero de torres': ['torres', 'torres'], 'no de elevadores': ['elevadores', 'elevadores'], 'total de vagas': ['vagas', 'vagas'], 'data incc base': ['inccData', 'incc_data'], 'incc base': ['incc', 'incc'] };
  if (S_.rc) {
    const ws = S_.rc.ws; const rg = wsCells(ws);
    for (let r = 0; r <= Math.min(rg.e.r, 60); r++) for (let c = 0; c <= 8; c++) {
      const a = XLSX.utils.encode_cell({ r, c }); const t = ws[a]; if (!t || typeof t.v !== 'string' || !/:\s*$/.test(t.v)) continue;
      const key = norm(t.v).replace(/[º°]/g, 'o').replace(/:\s*$/, '').replace(/\s+/g, ' ').trim(); const L = LBL[key]; if (!L) continue;
      for (let c2 = c + 1; c2 <= c + 3; c2++) { const a2 = XLSX.utils.encode_cell({ r, c: c2 }); const x = ws[a2]; if (x && x.v !== '' && x.v != null) { if (L[0]) info[L[0]] = x.v; if (L[1]) refTok[(S_.rc.name + '!' + a2).toUpperCase()] = L[1]; break; } }
    }
    const f8 = cv(ws, 'F8'), g8 = cv(ws, 'G8'); if (typeof f8 === 'number') info.elaboracao = serialISO(f8); if (g8 != null) info.revisaoNum = +g8 || 0;
  }
  const up = s => String(s ?? '').trim();
  const fase = up(info.fase).toLowerCase(); const tipo = TIPOS_ORC.find(t => norm(t) === norm(fase)) || (fase ? fase[0].toUpperCase() + fase.slice(1) : 'Executivo');
  const inccIso = serialISO(info.inccData);
  const abrev = (S_.snt.name.split('|')[1] || '').trim();
  Object.assign(R.meta, {
    empreendimento: up(info.empreendimento), cliente: up(info.cliente), endereco: up(info.endereco), cidade: up(info.cidade), metodo: up(info.metodo), tipologia: up(info.tipologia),
    torres: +info.torres || 0, elevadores: +info.elevadores || 0, vagas: +info.vagas || 0, prazo: +info.prazo || 0, uh: +info.uh || 0, areaConst: +info.areaConst || 0, areaPriv: +info.areaPriv || 0, areaTerreno: +info.areaTerreno || 0,
    inccData: inccIso.slice(0, 7), incc: +info.incc || 0, dataBase: inccIso, elaboracao: info.elaboracao || '', revisaoNum: info.revisaoNum || 0, revisao: 'R' + String(info.revisaoNum || 0).padStart(2, '0'),
    tipo, status: 'Enviado', abrev, encargos: 0
  });
  /* sintético: estrutura da EAP */
  const rows = ws => { const rg = wsCells(ws); let h = -1; for (let r = 0; r <= Math.min(rg.e.r, 40); r++) if (norm(ctext(ws, 'A' + (r + 1))) === 'nivel' || norm(ctext(ws, 'C' + (r + 1))) === 'item') { h = r + 1; break; } if (h < 0) throw new Error('Cabeçalho NÍVEL/ITEM não encontrado em ' + ws); const out = []; for (let r = h + 1; r <= rg.e.r + 1; r++) { const g = c => cv(ws, c + r); if (g('A') == null && g('B') == null && g('C') == null && g('D') == null) continue; out.push({ lv: +g('A') || 0, ipla: up(g('B')), item: g('C') == null ? '' : up(g('C')), cod: up(g('D')), desc: up(g('E')), un: up(g('F')), q: +g('G') || 0, pu: +g('H') || 0, tot: +g('I') || 0 }); } return out; };
  const snt = rows(S_.snt.ws), anl = rows(S_.anl.ws);
  const byNum = new Map(); const stack = []; const posBy = new Map(); let fileTotal = 0;
  for (const x of snt) {
    if (!x.item || x.item.startsWith('00')) continue;
    const isE = norm(x.cod) === 'item'; const lv = x.lv; stack.length = lv;
    const par = lv > 0 ? (stack[lv - 1] || null) : null; const parId = par ? par.id : '';
    const pos = (posBy.get(parId) || 0) + 1; posBy.set(parId, pos);
    const it = isE ? { id: uid(), par: parId, pos, k: 'e', desc: x.desc, det: '', num: x.item } : { id: uid(), par: parId, pos, k: 's', cod: x.cod, desc: x.desc, det: '', un: x.un, qtd: x.q, num: x.item };
    stack[lv] = it; R.items.push(it); byNum.set(x.item, it); if (lv === 0) fileTotal += x.tot;
  }
  R.fileTotal = fileTotal;
  /* analítico: composições e insumos */
  const svcCodes = new Set(snt.filter(x => x.item && norm(x.cod) !== 'item').map(x => x.cod));
  let curSvc = null; const kids = new Map();
  for (const x of anl) { if (x.item) { curSvc = norm(x.cod) === 'item' ? null : x; if (curSvc) kids.set(x.item, { svc: x, ch: [] }); } else if (curSvc && x.ipla === curSvc.item) kids.get(curSvc.item).ch.push(x); }
  let conflitos = 0;
  for (const { svc, ch } of kids.values()) {
    if (svc.item.startsWith('00') || !ch.length) continue;
    const q = svc.q; if (!q) { warn.push(`${svc.item} ${svc.cod}: quantidade zero, coeficientes não puderam ser calculados.`); }
    const itens = ch.map(c => ({ t: /^CP[UL]\d/i.test(c.cod) || svcCodes.has(c.cod) ? 'c' : 'i', cod: c.cod, coef: q ? c.q / q : 0 }));
    const exC = R.comps.get(svc.cod);
    if (exC && !exC._aux) { const o = exC.itens; if (o.length !== itens.length || o.some((a, i) => a.cod !== itens[i].cod || Math.abs(a.coef - itens[i].coef) > 1e-6 * Math.max(1, a.coef))) conflitos++; }
    else R.comps.set(svc.cod, { cod: svc.cod, desc: svc.desc, un: svc.un, pref: 0, itens });
    ch.forEach((c, i) => {
      if (itens[i].t === 'c') { if (!R.comps.has(c.cod)) R.comps.set(c.cod, { cod: c.cod, desc: c.desc, un: c.un, pref: c.pu, itens: [], _aux: true }); }
      else if (!R.ins.has(c.cod)) R.ins.set(c.cod, { cod: c.cod, desc: c.desc, un: c.un, preco: c.pu, grp: grupoPorCodigo(c.cod, c.desc), dt: '', enc: false });
      else if (Math.abs(R.ins.get(c.cod).preco - c.pu) > 1e-9) warn.push(`Insumo ${c.cod} com preços diferentes no analítico (${c.pu} e ${R.ins.get(c.cod).preco}); mantido o primeiro.`);
    });
  }
  for (const c of R.comps.values()) delete c._aux;
  for (const it of R.items) if (it.k === 's' && !R.comps.has(it.cod)) { const s = snt.find(x => x.item && x.cod === it.cod); R.comps.set(it.cod, { cod: it.cod, desc: it.desc, un: it.un, pref: s ? s.pu : 0, itens: [] }); warn.push(`${it.cod}: sem itens no analítico, entrou com preço de referência.`); }
  if (conflitos) warn.push(`${conflitos} serviço(s) com a mesma CPU e itens diferentes; ficou a primeira ocorrência.`);
  /* indiretos, grupos do resumo de preço e taxas */
  const indNames = new Map(); let indNums = [];
  if (S_.ind) { const ws = S_.ind.ws; const rg = wsCells(ws); for (let r = 1; r <= rg.e.r + 1; r++) { const b = ctext(ws, 'B' + r), c = ctext(ws, 'C' + r); if (/^\d+(\.\d+)+$/.test(b) && c) { indNames.set(norm(c), b); indNums.push(b); } } }
  const indEtapa = indNums.length ? byNum.get(indNums[0].split('.').slice(0, -1).join('.')) : null;
  const bdi = { modo: 'unita', adm: 0, assist: 0, ir: 0, iss: 0, pis: 0, cofins: 0, cssl: 0, base: [], beneficio: false, obs: '' }; const tx = { grupos: {}, ind: indEtapa ? indEtapa.id : '' };
  if (S_.tx) {
    const ws = S_.tx.ws; const rg = wsCells(ws); let mode = ''; const rcNum = r => ctext(S_.rc.ws, 'B' + r);
    const txNames = {};
    for (let r = 1; r <= rg.e.r + 1; r++) {
      const bc = ws['B' + r]; const b = bc ? bc.v : null; const bt = typeof b === 'string' ? norm(b) : ''; const z = bc && bc.z ? norm(bc.z) : '';
      if (typeof b === 'string') txNames[r] = b;
      if (bt.startsWith('custos diretos')) { mode = 'dir'; continue; } if (bt.startsWith('total custo direto')) { mode = ''; continue; }
      if (bt.startsWith('custos indiretos')) { mode = 'ind'; continue; } if (bt.startsWith('total  custo indireto') || bt.startsWith('total custo indireto')) { mode = ''; continue; }
      if (bt.startsWith('inicio da obra')) { const mm = /(\d{2})\/(\d{2})\/(\d{4})/.exec(b); if (mm) R.meta.inicioObra = `${mm[3]}-${mm[2]}-${mm[1]}`; }
      if (bt.startsWith('obs')) bdi.obs = b;
      if (mode === 'dir' && typeof b === 'string') {
        const d = ws['D' + r]; const f = d && d.f ? d.f : '';
        const nums = []; for (const mm of f.matchAll(/F(\d+)(?::F(\d+))?/g)) { const a = +mm[1], z2 = +(mm[2] || mm[1]); for (let k = a; k <= z2; k++) nums.push(rcNum(k)); }
        nums.forEach(nu => { const e = byNum.get(nu); if (e) tx.grupos[e.id] = b.trim(); });
      }
      if (typeof b === 'number' && /administra/.test(z)) bdi.adm = round(b * 100, 6);
      if (typeof b === 'number' && /assist/.test(z)) bdi.assist = round(b * 100, 6);
      const tax = { 'ir:': 'ir', 'iss:': 'iss', 'pis:': 'pis', 'cofins:': 'cofins', 'cssl:': 'cssl', 'csll:': 'cssl' }[bt];
      if (tax && !bdi['_' + tax]) { bdi[tax] = round((+cv(ws, 'C' + r) || 0) * 100, 6); bdi['_' + tax] = 1; }
      if (/impostos/.test(z) && !bdi._base) {
        const d = ws['D' + r]; const f = d && d.f ? d.f : ''; bdi._base = 1; const names = [...f.matchAll(/VLOOKUP\("([^"]+)"/gi)].map(x => x[1]);
        for (const mm of f.matchAll(/\bD(\d+)\b/g)) if (txNames[+mm[1]]) names.push(txNames[+mm[1]]);
        names.forEach(nm => { const num = indNames.get(norm(nm)); const it = num && byNum.get(num); if (it && !bdi.base.includes(it.id)) bdi.base.push(it.id); });
      }
    }
    ['ir', 'iss', 'pis', 'cofins', 'cssl', 'base'].forEach(k => delete bdi['_' + k]);
    refTok[(S_.tx.name + '!B35').toUpperCase()] = 'taxa_adm'; refTok[(S_.tx.name + '!B36').toUpperCase()] = 'taxa_assist'; refTok[(S_.tx.name + '!B40').toUpperCase()] = 'impostos';
  }
  R.meta.bdi = bdi; R.meta.tx = tx;
  /* instalações */
  if (S_.inst) { const ws = S_.inst.ws; const rg = wsCells(ws); const itens = []; for (let r = 1; r <= rg.e.r + 1; r++) { const b = ctext(ws, 'B' + r); if (/^\d+(\.\d+)+$/.test(b) && byNum.get(b)) itens.push(byNum.get(b).id); } R.meta.inst = { titulo: ctext(ws, 'B5') || 'INFRAESTRUTURA + UNIDADES', itens }; }
  /* premissas e exclusões */
  const prem = { secoes: [], exclusoes: [], exclusoesIntro: '' };
  if (S_.prem) {
    const ws = S_.prem.ws; const rg = wsCells(ws); let mode = 'p', sec = null;
    for (let r = 1; r <= rg.e.r + 1; r++) {
      const bc = ws['B' + r], cc = ws['C' + r]; const b = bc ? bc.v : null; const ctxt = cc ? (cc.f ? formulaToTokens(cc.f, String(cc.v ?? ''), refTok) : String(cc.v ?? '')) : ''; const has = ctxt.trim() !== '';
      if (typeof b === 'string' && norm(b).startsWith('premissas gerais')) { mode = 'p'; continue; }
      if (typeof b === 'string' && norm(b) === 'exclusoes') { mode = 'x'; continue; }
      if (mode === 'p') {
        if (typeof b === 'number' && has) { sec = { n: String(b), t: ctxt.trim(), itens: [] }; prem.secoes.push(sec); }
        else if (typeof b === 'string' && /^\d+(\.\d+)+$/.test(b.trim()) && has) { if (!sec) prem.secoes.push(sec = { n: '0', t: 'GERAL', itens: [] }); sec.itens.push({ n: b.trim(), t: ctxt }); }
      } else {
        if (typeof b === 'string' && b.trim() && !has && !prem.exclusoesIntro) prem.exclusoesIntro = b.trim();
        else if (typeof b === 'number' && has) prem.exclusoes.push(ctxt);
      }
    }
  }
  R.premissas = prem;
  /* projetos enviados */
  const proj = { info: {}, rows: [] };
  if (S_.proj) {
    const ws = S_.proj.ws; const rg = wsCells(ws); let h = -1;
    for (let r = 1; r <= Math.min(rg.e.r + 1, 60); r++) {
      const b = ctext(ws, 'B' + r), c = ctext(ws, 'C' + r);
      if (/^plataforma:/i.test(b)) proj.info.plataforma = b.replace(/^plataforma:\s*/i, ''); if (/^data inicial:/i.test(b)) proj.info.dataIni = b.replace(/^data inicial:\s*/i, ''); if (/^data final:/i.test(b)) proj.info.dataFim = b.replace(/^data final:\s*/i, '');
      if (/^emissor:/i.test(c)) proj.info.emissor = c.replace(/^emissor:\s*/i, ''); else if (/^data de emiss/i.test(c)) proj.info.emissao = c.replace(/^data de emiss[aã]o:\s*/i, ''); else if (c && h < 0 && r > 12 && !proj.info.titulo && !/^c[oó]digo$/i.test(b)) proj.info.titulo = c;
      if (/^c[oó]digo$/i.test(b) && /extens/i.test(c)) { h = r; break; }
    }
    if (h > 0) for (let r = h + 1; r <= rg.e.r + 1; r++) { const vals = 'BCDEFGHIJKL'.split('').map(c => { const x = ws[c + r]; return x ? String(x.w != null && x.t !== 'n' ? x.w : x.v) : ''; }); if (vals.every(v => !v.trim())) continue; proj.rows.push(vals); }
  }
  R.projetos = proj;
  /* modelo 3D */
  R.modelo3d = { link: '', imagem: null };
  if (S_.m3d) {
    const ws = S_.m3d.ws; for (const a in ws) { if (a[0] === '!') continue; const c = ws[a]; if (c.l && c.l.Target && /^https?:/i.test(c.l.Target)) R.modelo3d.link = c.l.Target; else if (typeof c.v === 'string' && /^https?:\/\//i.test(c.v.trim()) && !R.modelo3d.link) R.modelo3d.link = c.v.trim(); }
    try { R.modelo3dImg = await imagemDaAba(buf, S_.m3d.name); } catch (e) { console.warn(e); }
  }
  /* INCC */
  R.incc = [];
  if (S_.incc) { const ws = S_.incc.ws; const rg = wsCells(ws); for (let r = 1; r <= rg.e.r + 1; r++) { const d = cv(ws, 'B' + r), i = cv(ws, 'C' + r); if (typeof d === 'number' && d > 20000 && typeof i === 'number') R.incc.push([serialISO(d).slice(0, 7), i]); } }
  if (!R.meta.incc && R.meta.inccData) { const x = R.incc.find(p => p[0] === R.meta.inccData); if (x) R.meta.incc = x[1]; }
  R.base = fileName ? fileName.replace(/\.[^.]+$/, '') : '';
  return R;
}
async function imagemDaAba(buf, sheetName) {
  await loadLib('jszip'); const z = await JSZip.loadAsync(buf); const rd = p => z.file(p) ? z.file(p).async('string') : Promise.resolve('');
  const wbx = await rd('xl/workbook.xml'); const rels = await rd('xl/_rels/workbook.xml.rels');
  const sm = new RegExp(`<sheet name="${XL.esc(sheetName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*r:id="(rId\\d+)"`).exec(wbx); if (!sm) return null;
  const tgt = (new RegExp(`Id="${sm[1]}"[^>]*Target="([^"]+)"`).exec(rels) || [])[1]; if (!tgt) return null;
  const sp = 'xl/' + tgt.replace(/^\/?xl\//, ''); const srel = await rd(sp.replace('worksheets/', 'worksheets/_rels/') + '.rels');
  const dm = /Target="\.\.\/drawings\/(drawing\d+\.xml)"/.exec(srel); if (!dm) return null;
  const drel = await rd('xl/drawings/_rels/' + dm[1] + '.rels');
  let best = null; for (const mm of drel.matchAll(/Target="\.\.\/media\/([^"]+)"/g)) { const f = z.file('xl/media/' + mm[1]); if (!f) continue; const b = await f.async('uint8array'); if (!best || b.length > best.bytes.length) best = { name: mm[1], bytes: b }; }
  if (!best || best.bytes.length < 30000) return null;
  const ext = best.name.split('.').pop().toLowerCase(); return new Blob([best.bytes], { type: ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg' });
}
function resumoImport(R) {
  const ctxComps = R.comps, ctxIns = R.ins; const ctx = makeCtx(ctxComps, ctxIns, 0);
  const tot = R.items.filter(i => i.k === 's').reduce((s, i) => s + (+i.qtd || 0) * compUnit(ctx, i.cod), 0);
  return { tot, etapas: R.items.filter(i => i.k === 'e' && !i.par).length, servicos: R.items.filter(i => i.k === 's').length };
}
async function aplicarImportCliente(R, opt) {
  const id = uid(); const now = new Date().toISOString(); const r0 = resumoImport(R);
  const meta = { ...R.meta, id, codigo: opt.codigo, nome: opt.nome, criado: now, atualizado: now, totais: { custo: round(r0.tot), venda: 0 } };
  S.orcs.set(id, meta);
  await saveDoc('orcamentos/' + id, meta);
  await putMany(P(id), 'it', N_PART, R.items.map(v => [v.id, v]));
  await putMany(P(id), 'cp', N_PART, [...R.comps.values()].map(v => [v.cod, v]));
  await putMany(P(id), 'in', N_PART, [...R.ins.values()].map(v => [v.cod, v]));
  await saveDoc(`${EXP(id)}/premissas`, R.premissas);
  let img = null;
  if (R.modelo3dImg && opt.assets) { try { const a = await opt.assets.upload(R.modelo3dImg); img = { id: a.id, url: a.url }; } catch (e) { console.warn(e); R.warn.push('A imagem do modelo 3D não pôde ser enviada.'); } }
  await saveDoc(`${EXP(id)}/modelo3d`, { link: R.modelo3d.link || '', imagem: img });
  await saveProjetosRows(id, R.projetos.rows, R.projetos.info);
  if (opt.base) { const ins = [...R.ins.values()].map(x => { const o = S.ins.get(x.cod); return o && o.dt ? { ...x, dt: o.dt } : x; }); await putCatIns(ins); await putCatCpu([...R.comps.values()]); }
  if (opt.incc && R.incc.length) { await loadIncc(); const map = new Map((S.incc || []).map(p => [p[0], p[1]])); R.incc.forEach(p => map.set(p[0], p[1])); await saveIncc([...map]); }
  return id;
}

/* ===================== Tela: Documentos do orçamento ===================== */
const TOKENS_AJUDA = '{prazo} {incc} {incc_data} {torres} {tipologia} {uh} {area_media} {elevadores} {vagas} {taxa_adm} {taxa_assist} {impostos} {empreendimento} {cliente}';
function vDocs() {
  const cur = S.cur; if (!cur.loaded) return loading('documentos');
  if (!cur.extras) { if (!cur._exLoading) { cur._exLoading = true; loadExtras(cur.id); } return loading('documentos'); }
  const meta = S.orcs.get(cur.id) || {}; const ex = cur.extras; const tab = S.docTab || 'prem';
  const B = computeBudget(); S.lastB = B; const tk = tokens(meta, B);
  const tabs = [['prem', 'Premissas e exclusões'], ['proj', `Projetos enviados (${ex.projetosRows.length})`], ['m3d', 'Modelo 3D']].map(([k, l]) => `<button class="btn${tab === k ? ' primary' : ''}" data-act="docTab" data-v="${k}">${l}</button>`).join('');
  let body = '';
  if (tab === 'prem') {
    const pr = ex.premissas;
    const ta = (id, f, val, extra = '') => `<textarea class="cell" id="${id}" data-f="${f}" ${extra} rows="${Math.max(1, Math.ceil(String(val || '').length / 110))}" style="resize:vertical;min-height:28px;font:inherit"${dis()}>${esc(val || '')}</textarea>`;
    body = `<p class="muted" style="margin:0 0 10px">Valores do orçamento entram com os marcadores ${esc(TOKENS_AJUDA)}. A prévia abaixo de cada item mostra o texto como sai na planilha do cliente.</p>
    ${(pr.secoes || []).map((s, si) => `<div class="card" style="margin-bottom:10px"><div class="toolbar"><input class="cell" style="width:60px" data-f="pr.sn" data-s="${si}" value="${esc(s.n)}"${dis()}><input class="cell" style="flex:1;font-weight:700" data-f="pr.st" data-s="${si}" value="${esc(s.t)}"${dis()}>
      <button class="btn sm ghost" data-act="prItem" data-s="${si}"${dis()}>+ Item</button><button class="x" data-act="prSecDel" data-s="${si}" title="Excluir seção"${dis()}>×</button></div>
      <div class="pad stack" style="gap:8px">${(s.itens || []).map((it, ii) => `<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><input class="cell" style="width:70px" data-f="pr.in" data-s="${si}" data-i="${ii}" value="${esc(it.n)}"${dis()}>
        <div style="flex:1;min-width:0">${ta(`pr-${si}-${ii}`, 'pr.it', it.t, `data-s="${si}" data-i="${ii}"`)}${/\{\w+\}/.test(it.t) ? `<div class="muted" style="font-size:11.5px;margin-top:3px">${esc(resolveTokens(it.t, tk))}</div>` : ''}</div>
        <button class="x" data-act="prItemDel" data-s="${si}" data-i="${ii}"${dis()}>×</button></div>`).join('') || '<span class="muted">Sem itens.</span>'}</div></div>`).join('')}
    <div class="row" style="margin-bottom:18px"><button class="btn" data-act="prSec"${dis()}>+ Seção de premissas</button></div>
    <div class="card"><div class="pad stack" style="gap:8px"><h2>Exclusões</h2><input class="cell" data-f="pr.xi" value="${esc(pr.exclusoesIntro || '')}" placeholder="Texto de abertura"${dis()}>
    ${(pr.exclusoes || []).map((t, i) => `<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="muted" style="width:26px;text-align:right">${i + 1}</span><div style="flex:1;min-width:0">${ta(`px-${i}`, 'pr.x', t, `data-i="${i}"`)}</div><button class="x" data-act="prXDel" data-i="${i}"${dis()}>×</button></div>`).join('')}
    <div><button class="btn sm" data-act="prX"${dis()}>+ Exclusão</button></div></div></div>`;
  } else if (tab === 'proj') {
    const pj = ex.projetos || {}; const q = S.q.proj || '';
    const rows = ex.projetosRows.filter(r => matchQ(q, ...r)); const show = rows.slice(0, 400);
    const f = (k, l) => `<label class="fld"><span class="lbl">${l}</span><input data-f="pj.${k}" value="${esc(pj[k] || '')}"${dis()}></label>`;
    body = `<div class="card pad stack"><div class="form">${f('plataforma', 'Plataforma')}${f('dataIni', 'Data inicial')}${f('dataFim', 'Data final')}${f('titulo', 'Título do relatório')}${f('emissor', 'Emissor')}${f('emissao', 'Data de emissão')}</div>
      <div class="row"><label class="btn"${S.readOnly ? ' hidden' : ''}>Importar relatório (.xlsx)<input type="file" id="pj-file" accept=".xlsx,.xls" hidden></label><span class="muted">Aceita o relatório de arquivos do AUTODOC ou a aba PROJETOS ENVIADOS de uma planilha para o cliente.</span><span class="spacer"></span>
      <input class="search" id="q-proj" data-live="proj" placeholder="Filtrar documentos…" value="${esc(q)}"></div></div>
      <div class="card" style="margin-top:12px"><div class="tbl-wrap tall"><table class="grid"><thead><tr>${['Código', 'Extensão', 'Revisão', 'Título', 'Tamanho', 'Data de cadastro', 'Cadastrado por', 'Última atualização', 'Status', 'Projeto', 'Disciplina'].map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${show.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="11" class="empty">Nenhum documento listado.</td></tr>'}</tbody></table></div>
      ${rows.length > 400 ? `<div class="check">Mostrando 400 de ${rows.length}. A planilha do cliente leva todos.</div>` : ''}</div>`;
  } else {
    const md = ex.modelo3d || {};
    body = `<div class="card pad stack"><label class="fld"><span class="lbl">Link de visualização do modelo</span><input data-f="m3.link" value="${esc(md.link || '')}" placeholder="https://"${dis()}></label>
      <div class="row"><label class="btn"${S.readOnly ? ' hidden' : ''}>${md.imagem ? 'Trocar imagem' : 'Enviar imagem'}<input type="file" id="m3-file" accept="image/png,image/jpeg" hidden></label>${md.imagem ? `<button class="btn ghost" data-act="m3Del"${dis()}>Remover imagem</button>` : ''}<span class="muted">A imagem entra na aba MODELO 3D, ajustada ao quadro do modelo.</span></div>
      ${md.imagem ? `<img src="${esc(md.imagem.url || ('/_blob/' + md.imagem.id))}" alt="Vista do modelo 3D" style="max-width:100%;border:1px solid var(--line);border-radius:3px;background:#FFFFFF">` : '<div class="drop muted">Nenhuma imagem do modelo.</div>'}</div>`;
  }
  return `<div class="page-head"><div><h1>Documentos do orçamento</h1><p>${esc(idOrc(meta))}</p></div></div>
    <div class="row" style="margin-bottom:12px">${tabs}</div>${body}`;
}

/* ===================== Tela: INCC ===================== */
function vIncc() {
  if (!S.incc) { loadIncc().then(schedule); return loading('INCC'); }
  const s = S.incc; const m = S.cur ? S.orcs.get(S.cur.id) : null;
  const rows = s.slice(0, 480).map((x, i) => { const nx = s[i + 1], y = s[i + 12]; return `<tr><td>${esc(mesAno(x[0]))}</td><td class="num"><input class="cell num" id="incc-${x[0]}" data-f="incc.v" data-k="${x[0]}" value="${fmt(+x[1], 3, 3)}" style="width:110px"${dis()}></td><td class="num">${nx ? pctf(x[1] / nx[1] - 1) : '–'}</td><td class="num">${y ? pctf(x[1] / y[1] - 1) : '–'}</td><td><button class="x" data-act="inccDel" data-k="${x[0]}"${dis()}>×</button></td></tr>`; }).join('');
  return `<div class="page-head"><div><h1>INCC-DI</h1><p>${s.length} meses na série${m && m.inccData ? ` · orçamento aberto usa ${mesAno(m.inccData)} = ${fmt(+m.incc || 0, 3, 3)}` : ''}</p></div>
    <div class="row"><input type="month" id="incc-mes" class="search" style="width:auto"${dis()}><input id="incc-val" class="search" style="width:120px" placeholder="Índice"${dis()}><button class="btn primary" data-act="inccAdd"${dis()}>Adicionar mês</button>
    <label class="btn"${S.readOnly ? ' hidden' : ''}>Importar planilha<input type="file" id="incc-file" accept=".xlsx,.xls" hidden></label></div></div>
    <div class="card" style="max-width:640px"><div class="tbl-wrap tall"><table class="grid"><thead><tr><th>Mês</th><th class="num">Índice</th><th class="num">% mês</th><th class="num">% 12 meses</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">Série vazia. Importe a aba INCC de uma planilha para o cliente ou adicione os meses.</td></tr>'}</tbody></table></div></div>`;
}
