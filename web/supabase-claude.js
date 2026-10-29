/*
 * Versão web (Vercel + Supabase): entrega ao app o mesmo window.claude do Artifact
 * (db, downloads, assets, user), com o banco no Supabase, e controla o login.
 * Depende de vendor/supabase.js (global "supabase") e config.js (window.ORC_CONFIG).
 * O app não muda: init() espera window.claude.use('db'), que só responde depois do login.
 */
(function () {
  'use strict';
  const CFG = window.ORC_CONFIG || {};
  const TAB = 'documentos', BUCKET = 'imagens';
  let sb = null;

  /* ===================== tela de login ===================== */
  const css = document.createElement('style');
  css.textContent = `
  #orcLogin{position:fixed;inset:0;z-index:100;background:#F4F4F3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:16px;font-family:'Inter',system-ui,sans-serif;color:#000;overflow:auto}
  #orcLogin[hidden],#orcLogin [hidden]{display:none}
  #orcLogin .lgo{display:flex;align-items:center;gap:12px;color:#373A36}
  #orcLogin .lgo svg{width:44px;height:44px}
  #orcLogin .lgo b{display:block;font-size:18px}
  #orcLogin .lgo small{display:block;font-size:11px;letter-spacing:.08em;color:#373A36}
  #orcLogin .cx{width:min(420px,100%);background:#FFF;border:1px solid #D0D0CE;border-radius:12px;padding:28px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box}
  #orcLogin h1{margin:0;font-size:20px;font-weight:700;color:#373A36}
  #orcLogin p{margin:0;font-size:14px;line-height:1.5;color:#373A36}
  #orcLogin form{display:flex;flex-direction:column;gap:12px}
  #orcLogin label{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:600;color:#373A36}
  #orcLogin input{height:40px;border:1px solid #D0D0CE;border-radius:8px;padding:0 12px;font:inherit;font-size:14px;font-weight:400;color:#000;background:#FFF}
  #orcLogin input:focus{outline:none;border-color:#FE5000;box-shadow:0 0 0 3px rgb(254 80 0/.2)}
  #orcLogin button.pri{height:40px;border:0;border-radius:8px;background:#FE5000;color:#FFF;font:inherit;font-weight:700;font-size:14px;cursor:pointer}
  #orcLogin button.pri[disabled]{opacity:.6;cursor:wait}
  #orcLogin button.lk{border:0;background:none;color:#373A36;text-decoration:underline;text-underline-offset:3px;font:inherit;font-size:14px;cursor:pointer;padding:2px 0;align-self:flex-start}
  #orcLogin button.lk:hover{color:#FE5000}
  #orcLogin .msg{font-size:14px;padding:10px 14px;border-radius:8px;border:1px solid rgb(198 40 40/.3);background:#FDECEC;color:#C62828}
  #orcLogin .msg.ok{border-color:rgb(30 138 76/.3);background:#E7F5EC;color:#1E8A4C}
  #orcLogin .rod{font-size:12px;color:#373A36;text-align:center;line-height:1.6}
  .top .orcUsr{display:inline-flex;align-items:center;gap:8px;flex:none}
  .top .orcUsr span{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;padding:0 6px;border-radius:15px;background:#FE5000;color:#FFF;font-size:12px;font-weight:700;cursor:default}
  .top .orcUsr button{background:transparent;color:inherit;border:0;border-radius:8px;height:32px;padding:0 10px;font:600 13px 'Inter',sans-serif;cursor:pointer;opacity:.85}
  .top .orcUsr button:hover{background:rgb(255 255 255/.12);opacity:1}`;
  document.head.appendChild(css);

  const tela = document.createElement('div'); tela.id = 'orcLogin'; tela.hidden = true;
  document.body.appendChild(tela);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function moldura(corpo) {
    const logo = document.querySelector('.top .brand svg');
    tela.innerHTML = `<div class="lgo">${logo ? logo.outerHTML : ''}<span><b>Orçamentos</b><small>UNITÀ ENGENHARIA</small></span></div>
      <div class="cx">${corpo}</div>
      <div class="rod">© ${new Date().getFullYear()} Unità Engenharia. Todos os direitos reservados.<br>Setor de orçamentos | Unità</div>`;
    tela.hidden = false;
    const f = tela.querySelector('input'); if (f) f.focus();
  }
  function aviso(txt, ok) { const m = tela.querySelector('.msg'); if (m) { m.textContent = txt; m.className = 'msg' + (ok ? ' ok' : ''); m.hidden = !txt; } }
  function ocupado(form, sim) { const b = form.querySelector('button.pri'); if (b) b.disabled = sim; }

  function telaEntrar(msg, ok) {
    moldura(`<h1>Entrar</h1>
      <div class="msg${ok ? ' ok' : ''}" ${msg ? '' : 'hidden'}>${esc(msg)}</div>
      <form id="fEntrar" novalidate>
        <label>E-mail<input type="email" name="email" autocomplete="username" required></label>
        <label>Senha<input type="password" name="senha" autocomplete="current-password" required></label>
        <button class="pri" type="submit">Entrar</button>
      </form>
      <button class="lk" type="button" id="bEsqueci">Esqueci minha senha</button>`);
    const f = tela.querySelector('#fEntrar');
    f.onsubmit = async ev => {
      ev.preventDefault(); const email = f.email.value.trim(), senha = f.senha.value;
      if (!email || !senha) { aviso('Informe e-mail e senha.'); return; }
      ocupado(f, true); aviso('');
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      ocupado(f, false);
      if (error) {
        const m = String(error.message || ''), cod = String(error.code || '');
        aviso(cod === 'invalid_credentials' || /invalid login credentials/i.test(m) ? 'E-mail ou senha incorretos. Se você foi convidado e ainda não criou a senha, use o link do e-mail de convite ou "Esqueci minha senha".'
          : cod === 'email_not_confirmed' || /not confirmed/i.test(m) ? 'Confirme o e-mail pelo link recebido antes de entrar.'
          : /failed to fetch|network|load failed/i.test(m) ? 'Sem conexão com o banco. Confira a internet e tente de novo.'
          : 'Não foi possível entrar (' + m + ').');
        return;
      }
      iniciar();
    };
    tela.querySelector('#bEsqueci').onclick = () => telaEsqueci();
  }

  function telaEsqueci() {
    moldura(`<h1>Recuperar senha</h1><p>Informe seu e-mail. Você vai receber um link para criar uma nova senha.</p>
      <div class="msg" hidden></div>
      <form id="fEsq" novalidate>
        <label>E-mail<input type="email" name="email" autocomplete="username" required></label>
        <button class="pri" type="submit">Enviar link</button>
      </form>
      <button class="lk" type="button" id="bVoltar">Voltar para o login</button>`);
    const f = tela.querySelector('#fEsq');
    f.onsubmit = async ev => {
      ev.preventDefault(); const email = f.email.value.trim(); if (!email) { aviso('Informe o e-mail.'); return; }
      ocupado(f, true);
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      ocupado(f, false);
      if (error) { aviso('Não foi possível enviar (' + error.message + ').'); return; }
      telaEntrar('Se o e-mail estiver cadastrado, o link chega em alguns minutos. Confira também a caixa de spam.', true);
    };
    tela.querySelector('#bVoltar').onclick = () => telaEntrar();
  }

  function telaSenha(convite) {
    moldura(`<h1>${convite ? 'Crie sua senha' : 'Nova senha'}</h1><p>${convite ? 'Defina a senha que você vai usar para entrar.' : 'Defina a nova senha de acesso.'} Use pelo menos 8 caracteres.</p>
      <div class="msg" hidden></div>
      <form id="fSenha" novalidate>
        <label>Nova senha<input type="password" name="s1" autocomplete="new-password" minlength="8" required></label>
        <label>Repita a senha<input type="password" name="s2" autocomplete="new-password" minlength="8" required></label>
        <button class="pri" type="submit">Salvar senha e entrar</button>
      </form>`);
    const f = tela.querySelector('#fSenha');
    f.onsubmit = async ev => {
      ev.preventDefault(); const a = f.s1.value, b = f.s2.value;
      if (a.length < 8) { aviso('A senha precisa ter pelo menos 8 caracteres.'); return; }
      if (a !== b) { aviso('As duas senhas não conferem.'); return; }
      ocupado(f, true);
      const { error } = await sb.auth.updateUser({ password: a });
      ocupado(f, false);
      if (error) { aviso('Não foi possível salvar a senha (' + error.message + ').'); return; }
      history.replaceState(null, '', location.pathname); iniciar();
    };
  }

  /* ===================== banco ===================== */
  // Mesma interface do banco do Artifact (ver dev/mock-claude.js): collection(caminho).get/onSnapshot,
  // doc(caminho).get/onSnapshot/set/update/delete. Cada documento é uma linha da tabela "documentos".
  const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  const pai = p => p.split('/').slice(0, -1).join('/');
  const idDe = p => p.split('/').pop();
  const erro = (code, msg) => Object.assign(new Error(msg || code), { code });
  function erroDb(e) {
    const m = String((e && e.message) || ''), c = String((e && e.code) || '');
    if (/fetch|network|timeout|load failed/i.test(m)) return erro('unavailable', m);
    if (c === '42501' || /row-level security|permission/i.test(m)) return erro('invalid_argument', 'sem permissão: ' + m);
    if (/JWT|session/i.test(m)) return erro('revoked', m);
    return erro(c || 'erro', m);
  }
  // merge aninhado: null apaga a chave, objetos são mesclados, o resto substitui (igual a jsonb_mesclar no banco)
  function mesclar(dst, src) {
    for (const k in src) {
      const v = src[k];
      if (v === null) delete dst[k];
      else if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) mesclar(dst[k], v);
      else dst[k] = clone(v);
    }
    return dst;
  }

  // cache local: caminho -> dados (só de documentos e coleções que alguém está ouvindo ou leu)
  const cache = new Map();
  const colCarregada = new Set();
  const pendentes = new Map();   // caminho -> gravações em andamento (o eco do tempo real espera elas terminarem)
  const sujos = new Set();       // caminhos que mudaram no banco enquanto havia gravação pendente
  const ouvintes = new Set();    // {tipo:'doc'|'col', caminho, fn}

  const snapDoc = p => ({ id: idDe(p), exists: cache.has(p), data: () => clone(cache.get(p)) });
  const snapCol = p => ({ docs: [...cache.keys()].filter(k => pai(k) === p).sort().map(snapDoc) });
  function avisar(caminho) {
    for (const o of ouvintes) {
      if (o.tipo === 'doc' && o.caminho === caminho) o.fn(snapDoc(caminho));
      if (o.tipo === 'col' && o.caminho === pai(caminho) && colCarregada.has(o.caminho)) o.fn(snapCol(o.caminho));
    }
  }

  async function lerDoc(p) {
    const { data, error } = await sb.from(TAB).select('dados').eq('caminho', p).maybeSingle();
    if (error) throw erroDb(error);
    if (data) cache.set(p, data.dados); else cache.delete(p);
  }
  async function lerCol(p) {
    const linhas = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from(TAB).select('caminho,dados').eq('colecao', p).order('caminho').range(de, de + 999);
      if (error) throw erroDb(error);
      linhas.push(...data); if (data.length < 1000) break;
    }
    for (const k of [...cache.keys()]) if (pai(k) === p && !pendentes.get(k)) cache.delete(k);
    for (const r of linhas) if (!pendentes.get(r.caminho)) cache.set(r.caminho, r.dados);
    colCarregada.add(p);
  }
  const ouvido = p => [...ouvintes].some(o => o.caminho === p || (o.tipo === 'col' && o.caminho === pai(p)));

  // mudança vinda do banco (de outra pessoa ou eco da própria gravação)
  async function mudou(p) {
    if (!ouvido(p)) { cache.delete(p); return; }
    if (pendentes.get(p)) { sujos.add(p); return; }
    try { await lerDoc(p); avisar(p); } catch (e) { console.warn('tempo real', p, e); }
  }

  // gravação: aplica no cache na hora (a tela não volta atrás enquanto o banco responde) e depois no banco
  async function gravar(p, local, remoto) {
    pendentes.set(p, (pendentes.get(p) || 0) + 1);
    const antes = clone(cache.get(p)), tinha = cache.has(p);
    local(); avisar(p);
    try { await remoto(); }
    catch (e) { if (tinha) cache.set(p, antes); else cache.delete(p); avisar(p); throw e; }
    finally {
      const n = pendentes.get(p) - 1;
      if (n) pendentes.set(p, n); else { pendentes.delete(p); if (sujos.delete(p)) mudou(p); }
    }
  }

  const db = {
    collection(p) {
      return {
        async get() { await lerCol(p); return snapCol(p); },
        onSnapshot(fn, onErr) {
          const o = { tipo: 'col', caminho: p, fn }; ouvintes.add(o);
          lerCol(p).then(() => { if (ouvintes.has(o)) fn(snapCol(p)); }, e => onErr && onErr(e));
          return () => ouvintes.delete(o);
        }
      };
    },
    doc(p) {
      return {
        async get() { if (!pendentes.get(p)) await lerDoc(p); return snapDoc(p); },
        onSnapshot(fn, onErr) {
          const o = { tipo: 'doc', caminho: p, fn }; ouvintes.add(o);
          lerDoc(p).then(() => { if (ouvintes.has(o)) fn(snapDoc(p)); }, e => onErr && onErr(e));
          return () => ouvintes.delete(o);
        },
        set(dados) {
          return gravar(p, () => cache.set(p, clone(dados)), async () => {
            const { error } = await sb.from(TAB).upsert({ caminho: p, dados });
            if (error) throw erroDb(error);
          });
        },
        async update(dados) {
          // mesmo comportamento do Artifact: update em documento inexistente dá invalid_argument (o app então cria com set)
          return gravar(p, () => { if (cache.has(p)) mesclar(cache.get(p), dados); }, async () => {
            const { data, error } = await sb.rpc('documento_atualizar', { p_caminho: p, p_dados: dados });
            if (error) throw erroDb(error);
            if (data !== true) throw erro('invalid_argument', 'documento não existe: ' + p);
          });
        },
        delete() {
          return gravar(p, () => cache.delete(p), async () => {
            const { error } = await sb.from(TAB).delete().eq('caminho', p);
            if (error) throw erroDb(error);
          });
        }
      };
    }
  };

  /* ===================== downloads, imagens, usuário ===================== */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 30000);
      return { status: 'saved' };
    }
  };
  const assets = {
    async upload(file) {
      const nome = (file && file.name) || 'imagem';
      const ext = (nome.match(/\.[a-z0-9]{1,5}$/i) || [''])[0].toLowerCase();
      const id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)) + ext;
      const { error } = await sb.storage.from(BUCKET).upload(id, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw erroDb(error);
      return { id, url: sb.storage.from(BUCKET).getPublicUrl(id).data.publicUrl };
    }
  };
  const user = { async can() { return true; } };

  /* ===================== usuário no cabeçalho ===================== */
  function chipUsuario(email) {
    const alvo = document.querySelector('.top'); if (!alvo || alvo.querySelector('.orcUsr')) return;
    const s = document.createElement('span'); s.className = 'orcUsr';
    const ini = email.split('@')[0].split(/[._\-+]+/).filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 3) || '?';
    s.innerHTML = `<span title="${esc(email)}" aria-label="${esc(email)}">${esc(ini)}</span><button type="button">Sair</button>`;
    s.querySelector('button').onclick = async () => { await sb.auth.signOut(); location.reload(); };
    alvo.appendChild(s);
  }

  /* ===================== partida ===================== */
  // o app chama window.claude.use(...) no carregamento; as respostas esperam o login
  let liberar; const logado = new Promise(r => { liberar = r; });
  window.claude = { use: async n => { await logado; return ({ db, downloads, assets, user })[n] || null; } };

  let iniciado = false;
  async function iniciar() {
    if (iniciado) return; iniciado = true;
    const { data } = await sb.auth.getUser();
    const email = (data && data.user && data.user.email) || '';
    tela.hidden = true; tela.innerHTML = '';
    sb.channel('documentos').on('postgres_changes', { event: '*', schema: 'public', table: TAB }, ev => {
      const p = (ev.new && ev.new.caminho) || (ev.old && ev.old.caminho); if (p) mudou(p);
    }).subscribe();
    chipUsuario(email);
    liberar();
  }

  async function partida() {
    if (!window.supabase || !CFG.url || !CFG.chave || /COLE_AQUI/.test(CFG.url + CFG.chave)) {
      moldura('<h1>Configuração pendente</h1><p>Preencha o endereço do projeto e a chave publishable do Supabase no arquivo web/config.js e publique de novo.</p>'); return;
    }
    const h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
    const tipo = h.get('type') || q.get('type');
    const falha = h.get('error_description') || q.get('error_description');
    const urlBase = String(CFG.url).trim().replace(/\/(rest|auth)\/v1\/?$/i, '').replace(/\/+$/, '');
    sb = window.supabase.createClient(urlBase, String(CFG.chave).trim(), { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
    let recuperando = false;
    sb.auth.onAuthStateChange(ev => {
      if (ev === 'PASSWORD_RECOVERY') { recuperando = true; telaSenha(false); }
      if (ev === 'SIGNED_OUT' && iniciado) location.reload();
    });
    const { data: { session } } = await sb.auth.getSession();
    if (falha) { history.replaceState(null, '', location.pathname); telaEntrar('O link expirou ou já foi usado. ' + (tipo === 'invite' ? 'Peça um novo convite.' : 'Peça um novo link em "Esqueci minha senha".')); return; }
    if (session && (tipo === 'invite' || tipo === 'recovery')) { telaSenha(tipo === 'invite'); return; }
    if (recuperando) return;
    if (session) { history.replaceState(null, '', location.pathname); iniciar(); return; }
    telaEntrar();
  }
  // espera o corpo da página (cabeçalho com o logo) antes de desenhar o login
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', partida); else partida();
})();
