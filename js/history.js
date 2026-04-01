// GHOST BUSCA — Histórico

// ── HISTÓRICO ──
const HIST_KEY = (email) => `ghost_hist_${email}`;
const HIST_ENABLED_KEY = (email) => `ghost_hist_on_${email}`;

function histEnabled() {
  if (!currentUser || currentUser.anon) return false;
  return LS.get(HIST_ENABLED_KEY(currentUser.email)) === true;
}

function histSetEnabled(v) {
  if (!currentUser || currentUser.anon) return;
  LS.set(HIST_ENABLED_KEY(currentUser.email), v);
}

function histAdd(entry) {
  // entry: { type: 'consulta'|'credito'|'plano'|'produto', name, value, free }
  if (!histEnabled()) return;
  const key = HIST_KEY(currentUser.email);
  const list = LS.get(key) || [];
  list.unshift({ ...entry, ts: Date.now() });
  if (list.length > 200) list.length = 200; // limite de 200 itens
  LS.set(key, list);
}

function histClear() {
  if (!currentUser || currentUser.anon) return;
  LS.set(HIST_KEY(currentUser.email), []);
}

function renderHistory() {
  const el = document.getElementById('historyContent');
  if (!el) return;

  if (!currentUser || currentUser.anon) {
    el.innerHTML = `<div class="hist-empty">Faça login para usar o histórico.</div>`;
    return;
  }

  const enabled = histEnabled();
  const list = LS.get(HIST_KEY(currentUser.email)) || [];

  // agrupa por mês
  const months = {};
  list.forEach(item => {
    const d = new Date(item.ts);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (!months[key]) months[key] = { label, items: [] };
    months[key].items.push(item);
  });

  const typeIco = {
    consulta: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
    credito:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    plano:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    produto:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  };

  let html = `
  <div class="hist-toggle-row">
    <div class="hist-toggle-info">
      <div class="hist-toggle-title">Salvar histórico</div>
      <div class="hist-toggle-sub">Suas consultas, compras de créditos, planos e produtos ficam salvos na sua conta. Acessível em qualquer dispositivo.</div>
    </div>
    <label class="hist-toggle">
      <input type="checkbox" id="histToggleChk" ${enabled ? 'checked' : ''} onchange="histSetEnabled(this.checked);renderHistory()">
      <span class="hist-slider"></span>
    </label>
  </div>`;

  if (!enabled) {
    html += `<div class="hist-empty">Ative o histórico para começar a registrar suas atividades.</div>`;
    el.innerHTML = html;
    return;
  }

  if (list.length === 0) {
    html += `<div class="hist-empty">Nenhuma atividade registrada ainda.<br>As próximas consultas e transações aparecerão aqui.</div>`;
    el.innerHTML = html;
    return;
  }

  html += `<div class="hist-list-wrap" id="histListWrap">`;
  Object.values(months).forEach(({ label, items }) => {
    html += `<div class="hist-month">${label}</div>`;
    items.forEach(item => {
      const d = new Date(item.ts);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
      const valStr = item.free ? 'Grátis' : item.value ? `R$ ${Number(item.value).toFixed(2).replace('.',',')}` : '—';
      const valClass = item.free ? 'free' : item.value ? 'paid' : '';

      // ícone: pra consulta usa SVG do módulo, outros usam typeIco
      let ico = typeIco[item.type] || typeIco.consulta;
      let icoColor = 'var(--p)';
      let label2 = '', sublabel = item.name;

      if (item.type === 'consulta') {
        // separa "CPF — 181.***" em módulo + dado
        const sep = item.name.indexOf(' — ');
        if (sep !== -1) {
          label2 = item.name.slice(0, sep);
          sublabel = item.name.slice(sep + 3);
        }
        // acha o mod pelo nome
        const modKey = Object.entries(MODS).find(([k,v]) => v.name === label2)?.[0];
        if (modKey && MOD_SVGS[modKey]) {
          ico = MOD_SVGS[modKey].replace('width="22" height="22"', 'width="14" height="14"');
          icoColor = modKey === 'foto' ? 'var(--p3)' : 'var(--p)';
        }
      } else {
        label2 = item.name;
        sublabel = '';
      }

      html += `
      <div class="hist-item">
        <div class="hist-ico" style="color:${icoColor}">${ico}</div>
        <div class="hist-info">
          <div class="hist-name">${label2}</div>
          ${sublabel ? `<div class="hist-date" style="color:var(--muted2);font-size:.72rem;margin-top:1px">${sublabel}</div>` : ''}
          <div class="hist-date">${dateStr}</div>
        </div>
        <div class="hist-val ${valClass}">${valStr}</div>
      </div>`;
    });
  });
  html += `</div>`;

  html += `<button class="hist-delete-btn" onclick="document.getElementById('confirmClearHistory').classList.add('open')">Apagar histórico</button>`;

  el.innerHTML = html;
}

function goSettings() {
  pushNav('settings');
  renderSettings();
  showPage('settings');
}

function renderSettings() {
  const el = document.getElementById('settingsContent');
  if (!el) return;
  if (!currentUser || currentUser.anon) {
    el.innerHTML = `<div class="settings-card"><div class="settings-card-title">Conta</div><div class="settings-row" style="padding:16px;flex-direction:column;gap:10px;align-items:stretch">
      <p style="font-size:.82rem;color:var(--muted);line-height:1.6">Você está navegando como visitante. Crie uma conta para salvar seu plano e histórico.</p>
      <button class="modal-submit" onclick="openModal('modal-register');goBack()">Criar conta</button>
    </div></div>`;
    return;
  }

  const limits   = PLAN_LIMITS[currentUser.plan];
  const totalUsed= Object.values(queryCounters).reduce((a,b)=>a+b,0);
  const totalLim = limits.total === 999 ? '∞' : limits.total;
  const planClass= 'plan-badge-' + currentUser.plan;

  const planExpiresAt = currentUser.planExpiresAt || null;
  let expiryHtml = '';
  let expiryBanner = '';
  if (planExpiresAt) {
    const days = Math.ceil((planExpiresAt - Date.now()) / 86400000);
    const color = days <= 2 ? '#f87171' : days <= 5 ? '#fbbf24' : '#4ade80';
    if (days > 0) {
      expiryHtml = `<div class="settings-row"><span class="settings-row-label">Expira em</span><span class="settings-row-val" style="color:${color};font-weight:700">${days} dia${days !== 1 ? 's' : ''}</span></div>`;
      if (days <= 3) {
        expiryBanner = `<div style="background:rgba(251,191,36,.07);border:1px solid rgba(251,191,36,.25);border-radius:.65rem;padding:12px 14px;margin-bottom:12px;font-size:.78rem;color:#fbbf24;line-height:1.5">⚠️ Seu plano <strong>${limits.label}</strong> expira em ${days} dia${days!==1?'s':''}. Renove para não perder o acesso.</div>`;
      }
    } else {
      expiryBanner = `<div style="background:rgba(248,113,113,.07);border:1px solid rgba(248,113,113,.25);border-radius:.65rem;padding:12px 14px;margin-bottom:12px;font-size:.78rem;color:#f87171;line-height:1.5">❌ Seu plano expirou. Você foi movido para o plano Básico. <button onclick="goHome();setTimeout(()=>{document.getElementById('plans')?.scrollIntoView({behavior:'smooth'})},150)" style="color:var(--p3);font-weight:700;text-decoration:underline">Renovar agora</button></div>`;
    }
  }

  const modRows = Object.entries(limits).filter(([k])=>!['label','total'].includes(k)).map(([mod,lim])=>{
    const m=MODS[mod]; if(!m) return '';
    const used=queryCounters[mod]||0;
    const limTxt=lim===-1?'∞':lim===0?'—':lim;
    const pct=lim>0&&lim!==999?Math.min(100,(used/lim)*100):(used>0?30:0);
    const barColor=lim===0?'rgba(255,255,255,.1)':pct>=90?'#f87171':pct>=60?'#fbbf24':'var(--p)';
    return `<div class="settings-row"><span class="settings-row-label">${m.name}</span><div class="settings-progress-wrap"><span class="settings-progress-txt">${lim===0?'Não incluso':`${used} / ${limTxt}`}</span>${lim!==0?`<div class="settings-progress-bar"><div class="settings-progress-fill" style="width:${pct}%;background:${barColor}"></div></div>`:''}</div></div>`;
  }).join('');

  const credBal   = getCredits(currentUser.email);
  const credBrl   = creditsToReal(credBal).toFixed(2).replace('.', ',');
  const credCard  = credBal > 0
    ? `<div class="settings-card">
        <div class="settings-card-title">Créditos avulsos</div>
        <div class="settings-row">
          <span class="settings-row-label">Saldo</span>
          <span class="settings-row-val" style="font-weight:700;background:var(--grad-text);background-size:400% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:gradAni 4s linear infinite">${credBrl}</span>
        </div>
        <div class="settings-row"><span class="settings-row-label">Créditos</span><span class="settings-row-val">${credBal} créditos</span></div>
        <div class="settings-row" style="padding:10px 16px">
          <button onclick="goCreditsInfo(null,true)" style="font-size:.72rem;font-weight:600;color:var(--muted2);background:rgba(255,255,255,.04);border:1px solid var(--border);padding:5px 14px;border-radius:99px;transition:all .15s" onmouseover="this.style.color='var(--fg)'" onmouseout="this.style.color='var(--muted2)'">Comprar mais →</button>
        </div>
      </div>`
    : `<div class="settings-card">
        <div class="settings-card-title">Créditos avulsos</div>
        <div class="settings-row" style="padding:12px 16px;flex-direction:column;gap:8px;align-items:flex-start">
          <span style="font-size:.78rem;color:var(--muted)">Sem créditos. Use para consultas avulsas sem precisar de plano.</span>
          <button onclick="goCreditsInfo(null,true)" style="font-size:.72rem;font-weight:600;color:var(--p3);background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.2);padding:5px 14px;border-radius:99px;transition:all .15s">Ver créditos →</button>
        </div>
      </div>`;

  el.innerHTML = `
    ${expiryBanner}
    <div class="settings-card">
      <div class="settings-card-title">Perfil</div>
      <div class="settings-avatar-wrap">
        <div class="settings-avatar" onclick="triggerAvatarUpload()" style="cursor:pointer" title="Trocar foto">
          ${getUserAvatar(currentUser.email) ? `<img src="${getUserAvatar(currentUser.email)}" alt="avatar">` : `<span>${currentUser.name[0].toUpperCase()}</span>`}
        </div>
        <div class="settings-avatar-info">
          <div class="settings-avatar-name">${currentUser.name}</div>
          <button onclick="triggerAvatarUpload()" class="btn-trocar-foto">Trocar foto</button>
          ${getUserAvatar(currentUser.email) ? `<button onclick="removeAvatar()" style="margin-top:4px;margin-left:6px;font-size:.7rem;font-weight:500;color:var(--muted);background:rgba(255,255,255,.05);padding:4px 12px;border-radius:99px;border:1px solid var(--border);transition:all .15s">Remover</button>` : ''}
        </div>
      </div>
      <div class="settings-row"><span class="settings-row-label">E-mail</span><span class="settings-row-val" style="-webkit-user-select:text;user-select:text">${currentUser.email}</span></div>
      <div class="settings-row"><span class="settings-row-label">Plano</span><span class="settings-plan-badge ${planClass}">${limits.label}</span></div>
      ${expiryHtml}
    </div>
    ${credCard}
    <div class="settings-card">
      <div class="settings-card-title">Editar dados</div>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:10px;padding:14px 16px">
        <div><label class="modal-label" style="margin-bottom:5px;display:block">Nome</label>
        <input id="set-nome" class="modal-input" type="text" value="${currentUser.name}" placeholder="Seu nome" style="width:100%"></div>
        <div><label class="modal-label" style="margin-bottom:5px;display:block">Nova senha</label>
        <div class="modal-input-wrap"><input id="set-senha" class="modal-input" type="password" placeholder="Mínimo 5 caracteres" style="width:100%;padding-right:42px"><button class="modal-eye" onclick="togglePw('set-senha','set-senha-eye')" id="set-senha-eye"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
        <div><label class="modal-label" style="margin-bottom:5px;display:block">Confirmar senha</label>
        <input id="set-conf" class="modal-input" type="password" placeholder="Repita a nova senha" style="width:100%"></div>
        <div id="set-msg" class="set-msg"></div>
        <button class="modal-submit" onclick="saveProfileChanges()" style="margin-top:2px">Salvar alterações</button>
      </div>
    </div>
    <div class="settings-card">
      <div class="usage-toggle-btn" onclick="toggleUsageDetail()">
        <span class="settings-card-title" style="border-bottom:none;padding:0">Uso hoje — ${todayStr()}</span>
        <span class="usage-toggle-label"><span id="usageArrow" class="usage-toggle-arrow">▼</span> ver detalhes</span>
      </div>
      <div class="settings-row"><span class="settings-row-label">Total geral</span><div class="settings-progress-wrap"><span class="settings-progress-txt">${totalUsed} / ${totalLim}</span>${limits.total!==999?`<div class="settings-progress-bar"><div class="settings-progress-fill" style="width:${Math.min(100,(totalUsed/limits.total)*100)}%"></div></div>`:''}</div></div>
      <div id="usageDetail" style="max-height:0;overflow:hidden;transition:max-height .32s cubic-bezier(.4,0,.2,1)">${modRows}</div>
    </div>
    <div class="settings-card">
      <div class="settings-card-title">Preferências</div>
      <div class="settings-row">
        <span class="settings-row-label">Cursor personalizado</span>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <span style="font-size:.72rem;color:var(--muted)" id="cursorToggleLbl">${LS.get('ghost_cursor_enabled') !== false ? 'Ativado' : 'Desativado'}</span>
          <div onclick="toggleCursorPref(this)" style="width:38px;height:22px;border-radius:99px;background:${LS.get('ghost_cursor_enabled') !== false ? 'var(--p)' : 'rgba(255,255,255,.12)'};position:relative;transition:background .2s;flex-shrink:0" id="cursorToggle">
            <div style="position:absolute;top:3px;left:${LS.get('ghost_cursor_enabled') !== false ? '19px' : '3px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.3)" id="cursorToggleThumb"></div>
          </div>
        </label>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-title">Conta</div>
      <div class="settings-row" style="padding:16px"><button class="btn-logout" onclick="logoutUser()">Sair da conta</button></div>
    </div>`;
}

function toggleCursorPref(toggle) {
  const enabled = LS.get('ghost_cursor_enabled') !== false;
  const newVal  = !enabled;
  LS.set('ghost_cursor_enabled', newVal);
  if (toggle) {
    toggle.style.background = newVal ? 'var(--p)' : 'rgba(255,255,255,.12)';
    const thumb = document.getElementById('cursorToggleThumb');
    if (thumb) thumb.style.left = newVal ? '19px' : '3px';
  }
  const lbl = document.getElementById('cursorToggleLbl');
  if (lbl) lbl.textContent = newVal ? 'Ativado' : 'Desativado';
  if (window._setCursorEnabled) window._setCursorEnabled(newVal);
}

function goUpgradePage() {
  goPlansFromResults();
  closeMenu();
}

function updateMiniBalloon(mod) {
  const el  = document.getElementById('qMiniBalloon');
  const txt = document.getElementById('qMiniBalloonTxt');
  if (!el || !txt) return;
  const plan   = currentUser?.plan || 'basico';
  const limits = PLAN_LIMITS[plan];
  const lim    = limits[mod];
  if (lim === -1 || lim === undefined) { el.style.display = 'none'; return; }
  const left = getModLeft(mod);
  if (left === Infinity) { el.style.display = 'none'; return; }
  el.style.display = 'inline-flex';
  el.className = 'q-mini-balloon' + (left === 0 ? ' danger' : left <= 3 ? ' warn' : '');

  if (left === 0) {
    const modUsed    = queryCounters[mod] || 0;
    const modLimit   = limits[mod];
    const totalUsed  = Object.values(queryCounters).reduce((a,b)=>a+b,0);
    const totalLeft  = limits.total === 999 ? Infinity : Math.max(0, limits.total - totalUsed);
    let msg;
    if (modUsed === 0 && totalLeft === 0) {
      msg = '<strong>Sem consultas</strong> — limite diário total atingido';
    } else if (modUsed >= modLimit) {
      msg = '<strong>Sem consultas</strong> — limite deste módulo atingido';
    } else if (totalLeft === 0) {
      msg = '<strong>Sem consultas</strong> — limite diário total atingido';
    } else {
      msg = '<strong>Sem consultas</strong> — limite atingido';
    }
    txt.innerHTML = msg;
  } else {
    txt.innerHTML = `<strong>${left}</strong> consulta${left !== 1 ? 's' : ''} restante${left !== 1 ? 's' : ''}`;
  }
}

// verifica se o módulo está disponível no plano atual
function toggleUsageDetail() {
  const d = document.getElementById('usageDetail');
  const arrow = document.getElementById('usageArrow');
  const label = document.querySelector('.usage-toggle-label');
  if (!d) return;
  const open = d.style.maxHeight && d.style.maxHeight !== '0px';
  d.style.maxHeight = open ? '0px' : d.scrollHeight + 'px';
  if (arrow) arrow.classList.toggle('open', !open);
  // Efeito: roxo → rosa → volta roxo
  if (label) {
    label.style.transition = 'color .2s ease';
    label.style.color = 'var(--p3)';
    setTimeout(() => {
      label.style.color = 'var(--p)';
    }, 1500);
  }
}
