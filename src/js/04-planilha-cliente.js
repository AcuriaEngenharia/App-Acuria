/* ===================== Planilha para o cliente (modelo Unità, gerada sobre o arquivo-modelo) ===================== */
const XL = {
  esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''),
  colN: c => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0),
  serial(iso) { if (!iso) return null; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); if (!y) return null; return (Date.UTC(y, (m || 1) - 1, d || 1) - Date.UTC(1899, 11, 30)) / 864e5; },
  q: name => `'${String(name).replace(/'/g, "''")}'`,
  parse(xml) {
    const i0 = xml.indexOf('<sheetData'), gt = xml.indexOf('>', i0), selfClose = xml[gt - 1] === '/';
    const i1 = selfClose ? gt + 1 : xml.indexOf('</sheetData>');
    const head = xml.slice(0, i0), tail = xml.slice(selfClose ? gt + 1 : i1 + 12);
    const sd = selfClose ? '' : xml.slice(gt + 1, i1);
    const rows = new Map(); const re = /<row ([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g; let m;
    while ((m = re.exec(sd))) {
      const attrs = m[1]; const r = +/(?:^|\s)r="(\d+)"/.exec(attrs)[1]; const cells = new Map(); const inner = m[3] || '';
      const rc = /<c r="([A-Z]+)(\d+)"([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g; let c;
      while ((c = rc.exec(inner))) { const s = /\bs="(\d+)"/.exec(c[3]); cells.set(c[1], { s: s ? s[1] : null, raw: c[0] }); }
      rows.set(r, { attrs, cells });
    }
    return { head, tail, rows };
  },
  cell(ref, s, v) {
    const sa = s != null ? ` s="${s}"` : '';
    if (v == null || v === '') return `<c r="${ref}"${sa}/>`;
    if (typeof v === 'object' && v.f != null) {
      const f = `<f>${XL.esc(v.f)}</f>`; const res = v.v;
      if (typeof res === 'string') return `<c r="${ref}"${sa} t="str">${f}<v>${XL.esc(res)}</v></c>`;
      if (typeof res === 'number' && isFinite(res)) return `<c r="${ref}"${sa}>${f}<v>${res}</v></c>`;
      return `<c r="${ref}"${sa}>${f}</c>`;
    }
    if (typeof v === 'number') return isFinite(v) ? `<c r="${ref}"${sa}><v>${v}</v></c>` : `<c r="${ref}"${sa}/>`;
    return `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${XL.esc(v)}</t></is></c>`;
  },
  row(tpl, r, vals = {}, opt = {}) {
    let attrs = tpl.attrs.replace(/(?:^|\s)r="\d+"/, ' ').replace(/\s*spans="[^"]*"/, '');
    if (opt.ht != null) attrs = attrs.replace(/\s*ht="[^"]*"/, '').replace(/\s*customHeight="[^"]*"/, '') + ` ht="${opt.ht}" customHeight="1"`;
    if (opt.show) attrs = attrs.replace(/\s*hidden="1"/, '').replace(/\s*outlineLevel="\d+"/, '').replace(/\s*collapsed="1"/, '');
    const cols = new Set([...tpl.cells.keys(), ...Object.keys(vals)]);
    const out = [...cols].sort((a, b) => XL.colN(a) - XL.colN(b)).map(col => {
      const t = tpl.cells.get(col); const s = t ? t.s : null;
      if (col in vals) return XL.cell(col + r, s, vals[col]);
      if (opt.keep && t) return t.raw.replace(/ r="[A-Z]+\d+"/, ` r="${col}${r}"`);
      return XL.cell(col + r, s, null);
    }).join('');
    return `<row r="${r}" ${attrs.trim()}>${out}</row>`;
  },
  build(P, rows, lastRow, lastCol, merges, extra = {}) {
    let head = P.head.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${lastCol}${lastRow}"/>`);
    if (extra.noFreezeSelection) head = head.replace(/<selection [^>]*\/>/g, '<selection activeCell="A1" sqref="A1"/>');
    let tail = P.tail;
    const mc = merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
    if (/<mergeCells[\s\S]*?<\/mergeCells>/.test(tail)) tail = tail.replace(/<mergeCells[\s\S]*?<\/mergeCells>/, mc);
    else if (mc) tail = tail.replace(/(<phoneticPr|<conditionalFormatting|<dataValidations|<hyperlinks|<printOptions|<pageMargins)/, mc + '$1');
    if (extra.cf) tail = tail.replace(/sqref="A10:I\d+"/g, `sqref="A10:I${Math.max(lastRow, 10)}"`);
    return head + '<sheetData>' + rows.join('') + '</sheetData>' + tail;
  },
  headMerges(P, below) { const ms = [...P.tail.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g)]; return ms.filter(m => +m[4] < below).map(m => `${m[1]}${m[2]}:${m[3]}${m[4]}`); },
  htFor(text, perLine, base = 13.8, min1 = null) { const n = Math.max(1, Math.ceil(String(text || '').length / perLine)); return n === 1 ? min1 : +(base * n).toFixed(1); }
};
const RC = "'RESUMO DE CUSTOS (ORC)'", TXN = "'RESUMO DE PREÇO (TX)'", INDN = "'RESUMO DOS INDIRETOS'";
function limparIndireto(s) { return String(s || '').replace(/\s*-\s*\(\s*INDIRETO\s*\)\s*$/i, '').trim(); }
function mesAno(iso) { if (!iso) return ''; const [y, m] = iso.split('-'); return `${m}/${y}`; }
function tokens(meta, B) {
  const b = meta.bdi || {}; const uh = +meta.uh || 0, ap = +meta.areaPriv || 0;
  const t = ['ir', 'iss', 'pis', 'cofins', 'cssl'].reduce((s, k) => s + (+b[k] || 0), 0);
  const two = n => String(Math.round(+n || 0)).padStart(2, '0');
  return {
    incc_data: mesAno(meta.inccData || (meta.dataBase || '').slice(0, 7)), incc: (+meta.incc || 0).toFixed(3).replace('.', ','), torres: two(meta.torres), tipologia: meta.tipologia || '',
    uh: String(uh), area_media: uh ? (ap / uh).toFixed(2).replace('.', ',') : '0,00', elevadores: two(meta.elevadores), vagas: two(meta.vagas), prazo: String(+meta.prazo || 0),
    taxa_adm: fmt(+b.adm || 0, 0, 2), taxa_assist: fmt(+b.assist || 0, 0, 2), impostos: fmt(t, 0, 2), empreendimento: meta.empreendimento || meta.nome || '', cliente: meta.cliente || '',
    ac: fmt(+meta.areaConst || 0), ap: fmt(ap), terreno: fmt(+meta.areaTerreno || 0)
  };
}
function resolveTokens(text, tk) { return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (k in tk ? tk[k] : m)); }
async function imageToPng(url, aspect) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const W = 1600, H = Math.round(W / aspect); const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  const s = Math.min(W / img.width, H / img.height); const w = img.width * s, h = img.height * s; g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); return new Uint8Array(await blob.arrayBuffer());
}

async function gerarPlanilhaCliente(ext) {
  const B = computeBudget(); const m = B.meta; const ps = B.ps || precoUnita(B, m); const cur = S.cur;
  await loadLib('jszip');
  const tplBuf = ext && ext.template ? ext.template : Uint8Array.from(atob((await (await fetch('modelo-cliente.txt')).text()).trim()), ch => ch.charCodeAt(0)).buffer;
  const zip = await JSZip.loadAsync(tplBuf);
  const rd = p => zip.file(p).async('string');
  const wbx = await rd('xl/workbook.xml');
  const sheets = [...wbx.matchAll(/<sheet name="([^"]+)" sheetId="\d+"(?: state="\w+")? r:id="(rId\d+)"\/>/g)].map(x => ({ name: x[1].replace(/&amp;/g, '&'), rid: x[2] }));
  const rels = await rd('xl/_rels/workbook.xml.rels');
  sheets.forEach(s => { s.path = 'xl/' + new RegExp(`Id="${s.rid}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${s.rid}"`).exec(rels).slice(1).find(Boolean); });
  const byPre = pre => sheets.find(s => s.name.startsWith(pre));
  const sh = { tx: byPre('RESUMO DE PREÇO'), rc: byPre('RESUMO DE CUSTOS'), snt: byPre('ORC SNT'), anl: byPre('ORC ANL'), ind: byPre('RESUMO DOS INDIRETOS'), inst: byPre('CUSTO DE INSTALA'), m3d: byPre('MODELO 3D'), prem: byPre('PREMISSAS'), proj: byPre('PROJETOS'), incc: byPre('INCC') };
  const abrev = (m.abrev || [m.cliente, m.empreendimento || m.nome].filter(Boolean).join(' - ')).replace(/[\\/?*[\]:]/g, '-').slice(0, 21).trim();
  const SNTN = ('ORC SNT | ' + abrev).slice(0, 31), ANLN = ('ORC ANL | ' + abrev).slice(0, 31);
  const SN = XL.q(SNTN), AN = XL.q(ANLN);
  const P = {}; for (const k in sh) P[k] = XL.parse(await rd(sh[k].path));
  const emp = m.empreendimento || m.nome || '', cli = m.cliente || '';
  const titulo = { f: `${RC}!D11&"  |  "&${RC}!D12`, v: `${emp}  |  ${cli}` };
  const revN = +(m.revisaoNum ?? parseInt(String(m.revisao || '').replace(/\D/g, ''), 10)) || 0;
  const revF = { f: `${RC}!G8`, v: revN };
  const tk = tokens(m, B);
  const k1 = 1 + B.bdi;
  const out = {};
  const keepRows = (Pp, upto, patch = {}) => { const a = []; for (const [r, t] of [...Pp.rows].sort((x, y) => x[0] - y[0])) if (r <= upto) a.push(XL.row(t, r, patch[r] || {}, { keep: true })); return a; };

  /* ---------- ORC SNT e ORC ANL ---------- */
  const params = [[0, '00', 'Item', 'INFORMAÇÕES E PARÂMETROS', '', '', ''], [1, '00.01', 'ORC00000', 'PROPOSTAS UTILIZADAS', 'VB', 1], [1, '00.02', 'ORC00001', 'UNIDADES HABITACIONAIS', 'un', +m.uh || 0],
  [1, '00.03', 'ORC00002', 'ÁREA PRIVATIVA TOTAL (UH)', 'm²', +m.areaPriv || 0], [1, '00.04', 'ORC00005', 'ÁREA CONSTRUÍDA', 'm²', +m.areaConst || 0], [1, '00.05', 'ORC00006', 'ÁREA DO TERRENO', 'm²', +m.areaTerreno || 0], [1, '00.06', 'ORC00007', 'PRAZO DE EXECUÇÃO', 'mês', +m.prazo || 0]];
  const sntRow = new Map();
  const tabHead = () => {
    return { 2: { I: revF }, 3: { I: { f: `${RC}!$F$8`, v: XL.serial(m.elaboracao) } }, 4: { I: { f: `${RC}!$F$18`, v: XL.serial((m.inccData || '') + '-01') } }, 5: { I: { f: `${RC}!$F$19`, v: +m.incc || 0 } },
      6: { E: { f: `${RC}!$D$11&"  |  "&${RC}!$D$12`, v: `${emp}  |  ${cli}` }, I: { f: `${RC}!$F$12`, v: +m.prazo || 0 } }, 7: { E: { f: `${RC}!$D$13&" - "&${RC}!$D$14`, v: `${m.endereco || ''} - ${m.cidade || ''}` } } };
  };
  function tabRows(Pp, analitico) {
    const proto = Pp.rows.get(18) || Pp.rows.get(11); const rows = []; let r = 10;
    const put = (lv, ipla, item, cod, desc, un, q, pu, tot) => {
      const ht = String(desc || '').length > (analitico ? 92 : 98) ? (String(desc).length > 190 ? 41.4 : 27.6) : null;
      rows.push(XL.row(proto, r, { A: lv, B: ipla, C: item, D: cod, E: desc, F: un || '', G: q === '' || q == null ? '' : q, H: pu === '' || pu == null ? '' : pu, I: tot }, ht ? { ht } : {})); return r++;
    };
    params.forEach(p => put(p[0], p[1], p[1], p[2], p[3], p[4], p[5] ?? '', '', 0));
    for (const rw of B.rows) {
      const v = rw.v;
      if (v.k === 'e') { const rr = put(rw.depth, rw.n, rw.n, 'Item', v.desc, '', '', '', rw.total); if (!analitico) sntRow.set(v.id, rr); continue; }
      const rr = put(rw.depth, rw.n, rw.n, v.cod || '', v.desc, v.un, +v.qtd || 0, rw.unit, rw.total); if (!analitico) sntRow.set(v.id, rr);
      if (analitico && v.cod) {
        const c = cur.comps.get(v.cod); const q = +v.qtd || 0;
        for (const it of (c && c.itens) || []) {
          if (it.t === 'c') { const a = cur.comps.get(it.cod) || {}; const pu = compUnit(B.ctx, it.cod); put(rw.depth, rw.n, '', it.cod, a.desc || '', a.un || '', (+it.coef || 0) * q, pu, (+it.coef || 0) * q * pu); }
          else { const x = cur.ins.get(it.cod) || {}; const pu = insPrice(B.ctx, it.cod); put(rw.depth, rw.n, '', it.cod, x.desc || '', x.un || '', (+it.coef || 0) * q, pu, (+it.coef || 0) * q * pu); }
        }
      }
    }
    return { rows, last: r - 1 };
  }
  for (const [key, analitico] of [['snt', false], ['anl', true]]) {
    const Pp = P[key]; const hr = tabHead();
    const head = keepRows(Pp, 9, hr);
    const T = tabRows(Pp, analitico);
    const last = T.last;
    head[6] = XL.row(Pp.rows.get(7), 7, { ...hr[7], I: { f: `SUMIF(A10:A${last},0,I10:I${last})`, v: B.total } }, { keep: true });
    out[key] = { xml: XL.build(Pp, [...head, ...T.rows], last, 'J', XL.headMerges(Pp, 10), { cf: true }), last };
  }
  const sntI = id => `${SN}!I${sntRow.get(id)}`;

  /* ---------- RESUMO DE CUSTOS (ORC) ---------- */
  {
    const Pp = P.rc; const etapas = B.rows.filter(r => r.depth === 0);
    const up = s => String(s || '').toUpperCase();
    const hdr = {
      8: { F: XL.serial(m.elaboracao) ?? '', G: revN },
      11: { D: emp, F: up(m.tipo) }, 12: { D: cli, F: { f: `${SN}!G16`, v: +m.prazo || 0 } }, 13: { D: m.endereco || '', F: m.tipologia || '' },
      14: { D: m.cidade || '', F: { f: `${SN}!G12`, v: +m.uh || 0 } }, 15: { D: up(m.metodo), F: +m.torres || 0 }, 16: { D: { f: `${SN}!G14`, v: +m.areaConst || 0 }, F: +m.elevadores || 0 },
      17: { D: { f: `${SN}!G13`, v: +m.areaPriv || 0 }, F: +m.vagas || 0 }, 18: { D: { f: 'IF(F14=0,0,D17/F14)', v: m.uh ? m.areaPriv / m.uh : 0 }, F: XL.serial((m.inccData || '') + '-01') ?? '' },
      19: { D: { f: `${SN}!G15`, v: +m.areaTerreno || 0 }, F: { f: `IFERROR(VLOOKUP($F$18,INCC!$B$7:$C$2000,2,FALSE),${+m.incc || 0})`, v: +m.incc || 0 } }
    };
    const rows = keepRows(Pp, 21, hdr); let r = 22; const merges = XL.headMerges(Pp, 22);
    const first = r, n = etapas.length, tot = first + n;
    etapas.forEach((e, i) => {
      const proto = Pp.rows.get(i === 0 ? 22 : i === n - 1 ? 37 : (i % 2 ? 23 : 24));
      rows.push(XL.row(proto, r, { B: e.n, C: { f: `${SN}!E${sntRow.get(e.v.id)}`, v: e.v.desc }, F: { f: `${SN}!I${sntRow.get(e.v.id)}`, v: e.total }, G: { f: `IF($F$${tot}=0,0,F${r}/$F$${tot})`, v: B.total ? e.total / B.total : 0 } }));
      r++;
    });
    const T = { 38: { B: 'TOTAL', F: { f: `SUM(F${first}:F${tot - 1})`, v: B.total } }, 39: { B: 'R$/UH', F: { f: `IF(F14=0,0,F${tot}/F14)`, v: m.uh ? B.total / m.uh : 0 } }, 40: { B: 'R$/M² PRIVATIVO', F: { f: `IF(D17=0,0,F${tot}/D17)`, v: m.areaPriv ? B.total / m.areaPriv : 0 } }, 41: { B: 'R$/M² CONSTRUÇÃO', F: { f: `IF(D16=0,0,F${tot}/D16)`, v: m.areaConst ? B.total / m.areaConst : 0 } } };
    for (const tr of [38, 39, 40, 41, 42, 43, 44]) { rows.push(XL.row(Pp.rows.get(tr), r, T[tr] || {}, { keep: !T[tr] })); if (tr <= 41) merges.push(`B${r}:E${r}`); r++; }
    out.rc = { xml: XL.build(Pp, rows, r - 1, 'J', merges), last: r - 1, tot, etapaRow: new Map(etapas.map((e, i) => [e.v.id, first + i])) };
  }
  const rcF = id => `${RC}!F${out.rc.etapaRow.get(id)}`;

  /* ---------- Grupos e indiretos ---------- */
  const tx = m.tx || {}; const etapas0 = B.rows.filter(r => r.depth === 0);
  const indId = tx.ind && B.byId.has(tx.ind) ? tx.ind : ((etapas0.find(e => /INDIRET/i.test(e.v.desc)) || {}).v || {}).id;
  const grupos = []; for (const e of etapas0) { if (e.v.id === indId) continue; const g = ((tx.grupos || {})[e.v.id] || e.v.desc).trim(); let G = grupos.find(x => x.nome === g); if (!G) grupos.push(G = { nome: g, etapas: [] }); G.etapas.push(e); }
  const indRows = indId ? B.rows.filter(r => r.parent && r.parent.v.id === indId) : [];

  /* ---------- RESUMO DOS INDIRETOS ---------- */
  const indLine = new Map();
  {
    const Pp = P.ind; const rows = keepRows(Pp, 10, { 7: { B: titulo }, 8: { D: revF } }); let r = 11; const n = Math.max(indRows.length, 1);
    for (let i = 0; i < n; i++) {
      const rw = indRows[i]; const proto = Pp.rows.get(i === 0 ? 11 : 12);
      rows.push(XL.row(proto, r, rw ? { B: rw.n, C: limparIndireto(rw.v.desc), D: { f: sntI(rw.v.id), v: rw.total } } : { B: '', C: 'Sem custos indiretos', D: 0 }));
      if (rw) indLine.set(rw.v.id, r); r++;
    }
    const tr = r; rows.push(XL.row(Pp.rows.get(20), r++, { D: { f: `SUM(D11:D${tr - 1})`, v: indRows.reduce((s, x) => s + x.total, 0) } }, { keep: true }));
    rows.push(XL.row(Pp.rows.get(21), r++, {}, { keep: true }));
    rows.push(XL.row(Pp.rows.get(22), r++, { D: { f: `${RC}!F12`, v: +m.prazo || 0 } }, { keep: true }));
    rows.push(XL.row(Pp.rows.get(23), r++, { D: { f: `IF(D${tr + 2}=0,0,D${tr}/D${tr + 2})`, v: m.prazo ? indRows.reduce((s, x) => s + x.total, 0) / m.prazo : 0 } }, { keep: true }));
    rows.push(XL.row(Pp.rows.get(24), r++, {}, { keep: true }));
    out.ind = { xml: XL.build(Pp, rows, r - 1, 'E', XL.headMerges(Pp, 10)), last: r - 1, tot: tr };
  }

  /* ---------- RESUMO DE PREÇO (TX) ---------- */
  {
    const Pp = P.tx; const b = m.bdi || {}; const pc = x => (+x || 0) / 100; const R = n => Pp.rows.get(n);
    const inicio = m.inicioObra ? `INÍCIO DA OBRA: ${fmtDate(m.inicioObra)}` : 'INÍCIO DA OBRA: a definir';
    const rows = keepRows(Pp, 13, { 8: { B: titulo }, 9: { D: revF }, 11: { B: inicio }, 12: { B: { f: `${RC}!F12`, v: +m.prazo || 0 } } });
    let r = 14; const merges = XL.headMerges(Pp, 14); const put = (n, vals = {}, opt = {}) => { rows.push(XL.row(R(n), r, vals, opt)); return r++; };
    put(14, {}, { keep: true });
    const g0 = r; grupos.forEach((G, i) => { const n = grupos.length; const f = G.etapas.map(e => rcF(e.v.id)).join('+'); put(n === 1 ? 15 : i === 0 ? 15 : i === n - 1 ? 17 : 16, { B: G.nome, D: { f, v: G.etapas.reduce((s, e) => s + e.total, 0) } }); });
    if (!grupos.length) put(15, { B: 'CUSTO DIRETO', D: 0 });
    const dirTot = B.total - indRows.reduce((s, x) => s + x.total, 0);
    const rDir = put(18, { B: 'TOTAL CUSTO DIRETO -->>', D: { f: `SUM($D$${g0}:$D$${r - 1})`, v: dirTot } }, { keep: true });
    put(19, {}, { keep: true }); put(20, {}, { keep: true });
    const i0 = r; const txInd = new Map();
    const nI = Math.max(indRows.length, 1);
    for (let i = 0; i < nI; i++) { const rw = indRows[i]; const lr = rw ? indLine.get(rw.v.id) : 11; const rr = put(i === 0 ? 21 : i === nI - 1 ? 29 : 22, { B: { f: `${INDN}!C${lr}`, v: rw ? limparIndireto(rw.v.desc) : 'Sem custos indiretos' }, D: { f: `${INDN}!D${lr}`, v: rw ? rw.total : 0 } }); if (rw) txInd.set(rw.v.id, rr); }
    const indTot = indRows.reduce((s, x) => s + x.total, 0);
    const rInd = put(30, { B: 'TOTAL  CUSTO INDIRETO-->>', D: { f: `SUM($D$${i0}:$D$${r - 1})`, v: indTot } }, { keep: true });
    put(31, {}, { keep: true });
    const rS1 = put(32, { D: { f: `$D$${rDir}+$D$${rInd}`, v: ps.S1 }, E: { f: `IF(ROUND(D${r},2)=ROUND(${RC}!$F$${out.rc.tot},2),"","⚠️")`, v: '' } }, { keep: true });
    put(33, {}, { keep: true });
    const rAh = put(34, {}, { keep: true }); merges.push(`E${rAh}:E${rAh + 1}`);
    const rAdm = put(35, { B: pc(b.adm), D: { f: `$B$${r}*$D$${rS1}`, v: ps.adm } });
    const rAs = put(36, { B: pc(b.assist), D: { f: `$B$${r}*$D$${rS1}`, v: ps.assist } });
    const rS2 = put(37, { D: { f: `$D$${rS1}+$D$${rAdm}+$D$${rAs}`, v: ps.S2 } }, { keep: true });
    put(38, {}, { keep: true }); put(39, {}, { keep: true });
    const baseRefs = (b.base || []).filter(id => B.byId.has(id)).map(id => txInd.has(id) ? `D${txInd.get(id)}` : sntI(id));
    const baseF = baseRefs.length ? baseRefs.join('+') : '0';
    const rImp = r; put(40, { B: { f: `SUM(C${r + 1}:C${r + 5})`, v: ps.t }, D: { f: `B${r}*((${baseF})/(1-B${r}))`, v: ps.imp }, E: '' }, { keep: true });
    const taxes = [['IR:', b.ir], ['ISS:', b.iss], ['PIS:', b.pis], ['COFINS:', b.cofins], ['CSSL:', b.cssl]];
    const rTax = r; taxes.forEach(([l, v], i) => put(41 + i, { B: l, C: pc(v) }));
    const rS3 = put(46, { D: { f: `($D$${rS2}+$D$${rImp})`, v: ps.S3 } }, { keep: true });
    put(47, {}, { keep: true });
    const show = !!b.beneficio; const o = { keep: true, show };
    put(48, {}, o);
    const rB = put(49, { B: { f: `B${rImp}-C${rTax + 1}`, v: ps.t2 }, D: { f: `B${r}*(${baseF})/(1-B${r})`, v: ps.imp2 } }, o);
    put(50, { D: { f: `D${rB}-D${rImp}`, v: ps.desc } }, o);
    put(51, { D: { f: `($D$${rS2}+D${rB})`, v: ps.S4 } }, o);
    const rObs = put(52, { B: b.obs || 'OBS.: O desconto acima fica condicionado à aceitação por parte da prefeitura do município de São Paulo do ISS recolhido pela obra sem o referido valor, caso a CND do ISS seja negada por falta de recolhimento, será responsabilidade da CONTRANTE custear o recolhimento de ISS complementar até o limite do valor descontado corrigido.' }, o);
    put(53, {}, o); put(54, {}, o); put(55, {}, o); merges.push(`B${rObs}:D${rObs + 3}`);
    put(56, {}, o);
    put(57, { C: { f: `${RC}!F18`, v: XL.serial((m.inccData || '') + '-01') }, D: { f: `${RC}!F19`, v: +m.incc || 0 } }, { keep: true, show: true });
    put(58, {}, { keep: true }); put(59, {}, { keep: true }); put(60, {}, { keep: true });
    const div = (a, b2) => b2 ? a / b2 : 0;
    put(61, { B: { f: `IF(${RC}!F14=0,0,D${rS1}/${RC}!F14)`, v: div(ps.S1, m.uh) }, C: { f: `IF(${RC}!D17=0,0,D${rS1}/${RC}!D17)`, v: div(ps.S1, m.areaPriv) }, D: { f: `IF(${RC}!D16=0,0,D${rS1}/${RC}!D16)`, v: div(ps.S1, m.areaConst) } });
    put(62, {}, { keep: true }); put(63, {}, { keep: true }); put(64, {}, { keep: true });
    put(65, { B: { f: `IF(${RC}!F14=0,0,D${rS3}/${RC}!F14)`, v: div(ps.S3, m.uh) }, C: { f: `IF(${RC}!D17=0,0,D${rS3}/${RC}!D17)`, v: div(ps.S3, m.areaPriv) }, D: { f: `IF(${RC}!D16=0,0,D${rS3}/${RC}!D16)`, v: div(ps.S3, m.areaConst) } });
    put(66, {}, { keep: true });
    out.tx = { xml: XL.build(Pp, rows, r - 1, 'E', merges), last: r - 1 };
  }

  /* ---------- CUSTO DE INSTALAÇÕES ---------- */
  {
    const Pp = P.inst; const inst = m.inst || {}; const ids = (inst.itens || []).filter(id => B.byId.has(id)).sort((a, b) => B.byId.get(a).idx - B.byId.get(b).idx);
    const rows = keepRows(Pp, 11, { 5: { B: inst.titulo || 'INFRAESTRUTURA + UNIDADES' }, 8: { B: titulo }, 9: { D: revF } }); let r = 12; const n = Math.max(ids.length, 1); let sum = 0;
    for (let i = 0; i < n; i++) { const rw = B.byId.get(ids[i]); const proto = Pp.rows.get(i === 0 ? 12 : i === n - 1 ? 19 : 13); if (rw) sum += rw.total; rows.push(XL.row(proto, r++, rw ? { B: rw.n, C: rw.v.desc, D: { f: sntI(rw.v.id), v: rw.total } } : { B: '-', C: 'Nenhum item selecionado', D: 0 })); }
    const tr = r; rows.push(XL.row(Pp.rows.get(20), r++, { D: { f: 'SUBTOTAL(109,INSTALAÇÕES[CUSTO TOTAL])', v: sum } }, { keep: true }));
    rows.push(XL.row(Pp.rows.get(22), r++, { D: { f: `${RC}!F14`, v: +m.uh || 0 } }, { keep: true }));
    rows.push(XL.row(Pp.rows.get(23), r++, { D: { f: `IF(D${tr + 1}=0,0,D${tr}/D${tr + 1})`, v: m.uh ? sum / m.uh : 0 } }, { keep: true }));
    out.inst = { xml: XL.build(Pp, rows, r - 1, 'E', XL.headMerges(Pp, 11)), last: r - 1, tabEnd: tr - 1 };
  }

  /* ---------- MODELO 3D ---------- */
  const ex = (ext && ext.extras) || S.cur.extras || {};
  const md = ex.modelo3d || {};
  {
    const Pp = P.m3d; const rows = keepRows(Pp, 16, { 7: { B: titulo }, 8: { B: revF }, 16: { C: md.link || '' } });
    out.m3d = { xml: XL.build(Pp, rows, 16, 'F', XL.headMerges(Pp, 99)) };
  }

  /* ---------- PREMISSAS E EXCLUSÕES ---------- */
  {
    const Pp = P.prem; const pr = ex.premissas || { secoes: [], exclusoes: [] }; const R = n => Pp.rows.get(n);
    const rows = keepRows(Pp, 9, { 7: { B: titulo }, 8: { B: revF } }); let r = 10; const merges = XL.headMerges(Pp, 10);
    const put = (n, vals, opt = {}) => { rows.push(XL.row(R(n), r, vals, opt)); return r++; };
    const ht = t => XL.htFor(t, 108, 13.8, null);
    put(10, { B: 'PREMISSAS GERAIS' });
    for (const sec of pr.secoes || []) {
      put(20, { B: isNaN(+sec.n) ? sec.n : +sec.n, C: sec.t });
      const its = sec.itens || []; its.forEach((it, i) => { const txt = resolveTokens(it.t, tk); const h = ht(txt); put(i === its.length - 1 ? 209 : 13, { B: it.n, C: txt }, h ? { ht: h } : {}); });
    }
    put(210, {}); put(211, { B: 'EXCLUSÕES' }); put(212, { B: pr.exclusoesIntro || 'Não fazem parte do escopo considerado os itens relacionados abaixo:' });
    const exs = pr.exclusoes || []; exs.forEach((t, i) => { const txt = resolveTokens(t, tk); const h = ht(txt); put(i === exs.length - 1 ? 241 : 213, { B: i + 1, C: txt }, h ? { ht: h } : {}); });
    out.prem = { xml: XL.build(Pp, rows, r - 1, 'D', merges), last: r - 1 };
  }

  /* ---------- PROJETOS ENVIADOS ---------- */
  {
    const Pp = P.proj; const pj = ex.projetos || {}; const pr = ex.projetosRows || [];
    const rows = keepRows(Pp, 19, { 7: { B: titulo }, 8: { B: revF }, 10: { B: pj.plataforma ? 'Plataforma: ' + pj.plataforma : 'Plataforma: -' }, 11: { B: 'Data inicial: ' + (pj.dataIni || '-') }, 12: { B: 'Data final: ' + (pj.dataFim || '-') }, 16: { C: pj.titulo || '' }, 17: { C: pj.emissor ? 'Emissor: ' + pj.emissor : '' }, 18: { C: pj.emissao ? 'Data de emissão: ' + pj.emissao : '' } });
    let r = 20; const proto = Pp.rows.get(20); const cols = 'BCDEFGHIJKL'.split('');
    for (const x of pr) { const vals = {}; cols.forEach((c, i) => vals[c] = x[i] == null ? '' : String(x[i])); rows.push(XL.row(proto, r++, vals)); }
    out.proj = { xml: XL.build(Pp, rows, Math.max(r - 1, 19), 'O', XL.headMerges(Pp, 99)), last: r - 1 };
  }

  /* ---------- INCC ---------- */
  {
    const Pp = P.incc; const serie = [...(((ext && ext.incc) || S.incc) || [])].sort((a, b) => b[0].localeCompare(a[0]));
    const rows = keepRows(Pp, 6); let r = 7; const proto = Pp.rows.get(7);
    serie.forEach((x, i) => { const nx = serie[i + 1], y12 = serie[i + 12]; rows.push(XL.row(proto, r, { B: XL.serial(x[0] + '-01'), C: +x[1], D: { f: `IFERROR((C${r}/C${r + 1})-1,"-")`, v: nx ? x[1] / nx[1] - 1 : '-' }, E: { f: `IFERROR((C${r}/C${r + 12})-1,"-")`, v: y12 ? x[1] / y12[1] - 1 : '-' } })); r++; });
    if (!serie.length) rows.push(XL.row(proto, r++, { B: '', C: '', D: '', E: '' }));
    out.incc = { xml: XL.build(Pp, rows, r - 1, 'F', []), last: r - 1 };
  }

  /* ---------- Gravação no pacote ---------- */
  for (const k in out) zip.file(sh[k].path, out[k].xml);
  const tbl = async (sheetKey, refFn) => {
    const srels = await rd(sh[sheetKey].path.replace('worksheets/', 'worksheets/_rels/') + '.rels').catch(() => '');
    for (const t of srels.matchAll(/Target="\.\.\/tables\/(table\d+\.xml)"/g)) { const p = 'xl/tables/' + t[1]; let x = await rd(p); x = x.replace(/ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g, (all, c1, r1, c2) => `ref="${c1}${r1}:${c2}${refFn()}"`); zip.file(p, x); }
  };
  await tbl('snt', () => Math.max(out.snt.last, 10)); await tbl('anl', () => Math.max(out.anl.last, 10)); await tbl('inst', () => out.inst.tabEnd); await tbl('incc', () => Math.max(out.incc.last, 7));
  // modelo 3D: imagem e link
  const d7rels = sh.m3d.path.replace('worksheets/', 'worksheets/_rels/') + '.rels';
  let s7 = await rd(d7rels); s7 = s7.replace(/Target="https?:[^"]*"/, `Target="${XL.esc(md.link || 'https://unitaengenharia.com.br')}"`); zip.file(d7rels, s7);
  const drawPath = 'xl/drawings/' + (/Target="\.\.\/drawings\/(drawing\d+\.xml)"/.exec(s7) || [])[1];
  if (zip.file(drawPath)) {
    const drels = drawPath.replace('drawings/', 'drawings/_rels/') + '.rels'; const dr = await rd(drels);
    const big = [...dr.matchAll(/Id="(rId\d+)"[^>]*Target="\.\.\/media\/(image\d+\.png)"/g)].find(x => x[2] === 'image7.png');
    let bytes = null;
    if (md.imagem && md.imagem.url) {
      try { bytes = await imageToPng(md.imagem.url, 8522340 / 6183086); }
      catch (e) { try { const raw = new Uint8Array(await (await fetch(md.imagem.url)).arrayBuffer()); if (raw[0] === 0x89 && raw[1] === 0x50) bytes = raw; } catch (e2) { console.warn(e2); } }
    }
    if (bytes && big) zip.file('xl/media/image7.png', bytes);
    else if (big) { let dx = await rd(drawPath); dx = dx.replace(new RegExp(`<xdr:twoCellAnchor(?:(?!</xdr:twoCellAnchor>)[\\s\\S])*?r:embed="${big[1]}"[\\s\\S]*?</xdr:twoCellAnchor>`), ''); zip.file(drawPath, dx); }
  }
  // nomes das abas e áreas de impressão
  let w = wbx; const oldS = sh.snt.name, oldA = sh.anl.name;
  const escN = s => XL.esc(s);
  w = w.split(`name="${escN(oldS)}"`).join(`name="${escN(SNTN)}"`).split(`name="${escN(oldA)}"`).join(`name="${escN(ANLN)}"`);
  w = w.split(XL.esc(XL.q(oldS))).join(XL.esc(SN)).split(XL.esc(XL.q(oldA))).join(XL.esc(AN));
  const pa = (sheetName, ref) => { w = w.replace(new RegExp(`(<definedName name="_xlnm.Print_Area" localSheetId="\\d+">)${XL.esc(sheetName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}![^<]*`), (all, g1) => `${g1}${XL.esc(sheetName)}!${ref}`); };
  pa("'RESUMO DE PREÇO (TX)'", `$A$1:$E$${out.tx.last}`); pa("'RESUMO DE CUSTOS (ORC)'", `$A$1:$H$${out.rc.last}`); pa("'PREMISSAS E EXCLUSÕES'", `$A$1:$D$${out.prem.last}`); pa("'RESUMO DOS INDIRETOS'", `$A$1:$E$${out.ind.last}`); pa("'CUSTO DE INSTALAÇÕES'", `$A$1:$E$${out.inst.last}`);
  zip.file('xl/workbook.xml', w);
  const app = zip.file('docProps/app.xml'); if (app) { let a = await app.async('string'); a = a.split(escN(oldS)).join(escN(SNTN)).split(escN(oldA)).join(escN(ANLN)); zip.file('docProps/app.xml', a); }
  const core = zip.file('docProps/core.xml'); if (core) { let c = await core.async('string'); c = c.replace(/<dc:title>[\s\S]*?<\/dc:title>/, '').replace(/<dcterms:modified[^>]*>[^<]*<\/dcterms:modified>/, `<dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:modified>`); zip.file('docProps/core.xml', c); }
  const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return { bytes: blob, nome: safeName(`ORC - ${(m.tipo || '').slice(0, 3).toUpperCase()} - ${cli ? cli + ' x ' : ''}${emp} - ${m.revisao || ''}`).replace(/\s+/g, ' ').slice(0, 150) + '.xlsx' };
}
async function exportCliente() {
  toast('Gerando a planilha para o cliente…');
  try {
    if (S.cur && !S.cur.extras) await loadExtras(S.cur.id);
    if (!S.incc) await loadIncc();
    const r = await gerarPlanilhaCliente();
    await saveFile(r.nome, new Blob([r.bytes]));
  } catch (e) { console.error(e); toast('Falha ao gerar a planilha do cliente: ' + e.message, 'err'); }
}
