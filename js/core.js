// GHOST BUSCA — Core (Auth, UI, Store, Wallet, Settings, History, Chat)

// ── ESTADO DO USUÁRIO ──
let currentUser = null; // { name, email, plan }
let queryCounters = {}; // { cpf: 3, nome: 1, ... }
let activeCoupons = new Set();

// ── AUTH & CONTA — Supabase ──

// ── helpers de storage local (apenas para preferências leves) ──
const LS = {
  get:  k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set:  (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del:  k => { try { localStorage.removeItem(k); } catch {} },
};

// ── sessão: gerenciada pelo Supabase Auth (JWT automático) ──
async function getAuthSession()  { const { data: { session } } = await _sb.auth.getSession(); return session; }
async function getAuthUser()     { const { data: { user } } = await _sb.auth.getUser(); return user; }
function saveSession()  {} // mantido por compatibilidade — não faz mais nada
function clearSession() {} // mantido por compatibilidade — não faz mais nada

// ── HELPERS DE CRÉDITOS ──
function getCredits(email) {
  if (!email) return 0;
  if (currentUser && currentUser.email === email && typeof currentUser._credits === 'number') return Math.round(currentUser._credits * 100) / 100;
  return 0;
}
function setCredits(email, val) {
  if (!email) return;
  const v = Math.max(0, Math.round(val * 100) / 100);
  if (currentUser && currentUser.email === email) currentUser._credits = v;
  // usa uid do currentUser se disponível, senão busca via session
  (async () => {
    const session = await getAuthSession();
    if (!session) return;
    sbPatch('profiles', `id=eq.${session.user.id}`, { creditos: v }).catch(()=>{});
  })();
}
function addCredits(email, val) { setCredits(email, getCredits(email) + val); }
function deductCredits(email, val) { setCredits(email, getCredits(email) - val); }
function creditsToReal(c) { return c * BRL_PER_CREDIT; }
function realToCredits(r) { return r * CREDITS_PER_BRL; }
function fmtBrl(v) { return 'R$' + v.toFixed(2).replace('.', ','); }
function getDiscount(brl) {
  return CREDIT_DISCOUNTS.find(d => brl >= d.minBrl) || CREDIT_DISCOUNTS[CREDIT_DISCOUNTS.length - 1];
}

// ── HELPERS DE AVATAR ──
function getUserAvatar(email) {
  if (!email) return null;
  if (currentUser && currentUser.email === email && currentUser.avatar_url) return currentUser.avatar_url;
  return null;
}
async function setUserAvatar(email, base64OrBlob) {
  let url = null;
  if (base64OrBlob instanceof Blob) {
    url = await sbUploadAvatar(email, base64OrBlob);
  } else if (typeof base64OrBlob === 'string' && base64OrBlob.startsWith('data:')) {
    const res  = await fetch(base64OrBlob);
    const blob = await res.blob();
    url = await sbUploadAvatar(email, blob);
  }
  if (url) {
    const _s = await getAuthSession();
    if (_s) await sbPatch('profiles', `id=eq.${_s.user.id}`, { avatar_url: url });
    if (currentUser && currentUser.email === email) currentUser.avatar_url = url;
  }
}

// ── HELPERS DE HISTÓRICO ──
let _creditsInfoMod = null;
let _creditsInfoFromWallet = false;

function histEnabled() {
  if (!currentUser || currentUser.anon) return false;
  return LS.get(HIST_ENABLED_KEY(currentUser.email)) === true;
}
function histSetEnabled(v) {
  if (!currentUser || currentUser.anon) return;
  LS.set(HIST_ENABLED_KEY(currentUser.email), v);
}
function histAdd(entry) {
  if (!histEnabled() || !currentUser || currentUser.anon) return;
  sbPost('historico', {
    user_id: currentUser.id,
    type:    entry.type  || 'consulta',
    name:    entry.name  || '',
    free:    entry.free  ?? false,
    quota:   entry.quota ?? false,
    value:   entry.value ? Number(entry.value) : null,
    ts:      Date.now(),
  }).catch(() => {});
}
async function histLoad() {
  if (!currentUser || currentUser.anon) return [];
  try {
    const rows = await sbGet('historico', `user_id=eq.${currentUser.id}&order=ts.desc&limit=200`);
    return rows || [];
  } catch { return []; }
}
async function histClear() {
  if (!currentUser || currentUser.anon) return;
  await sbDelete('historico', `user_id=eq.${currentUser.id}`);
}



// ── contadores diários — 100% Supabase ──
function todayStr() { return new Date().toISOString().slice(0,10); }

async function getDailyCounters(email, plan, uid) {
  try {
    const id = uid || currentUser?.id;
    if (!id) return {};
    const row = await sbGetOne('daily_counters', `user_id=eq.${id}&date=eq.${todayStr()}`);
    return row?.counters || {};
  } catch { return {}; }
}

async function saveDailyCounters(email, counters, plan) {
  try {
    if (!currentUser?.id) return;
    await sbUpsert('daily_counters',
      { user_id: currentUser.id, user_key: email, plan: plan || currentUser?.plan || 'basico', date: todayStr(), counters },
      'user_id,date');
  } catch {}
}

// ── SISTEMA ANÔNIMO ──
let _fpPromise = null;
function _loadFingerprint() {
  if (!_fpPromise) _fpPromise = FingerprintJS.load().then(fp => fp.get()).then(r => 'anon_fp_' + r.visitorId);
  return _fpPromise;
}

async function initAnon() {
  queryCounters = {};
  let anonId;
  try {
    anonId = await _loadFingerprint();
  } catch {
    // fallback pro localStorage se o FingerprintJS falhar
    anonId = LS.get('ghost_anon_id');
    if (!anonId) { anonId = 'anon_fp_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36); LS.set('ghost_anon_id', anonId); }
  }
  currentUser = { name: 'Visitante', email: anonId, plan: 'visitante', anon: true };
  // carrega contadores do Supabase
  try { queryCounters = await getDailyCounters(anonId, 'visitante'); } catch { queryCounters = {}; }
}

function _persistCountersAnon() {
  if (currentUser?.anon && currentUser?.email) {
    saveDailyCounters(currentUser.email, queryCounters, 'visitante');
  }
}

// ── BALÃO DE CONSULTAS ──
function updateBalloon() {
  const balloon = document.getElementById('queriesBalloon');
  const bar     = document.getElementById('qbBar');
  const numsEl  = document.getElementById('qbLeft');
  if (!balloon || !bar) return;

  const plan   = currentUser?.plan || 'basico';
  const limits = PLAN_LIMITS[plan];
  const total  = limits.total;
  const usedN  = getTotalUsed();

  if (total === -1) {
    bar.style.width = '100%'; bar.className = 'qb-bar';
    if (numsEl) numsEl.innerHTML = '<strong>∞</strong> restantes';
    return;
  }
  const leftN = Math.max(0, total - usedN);
  const pct   = Math.min(100, (usedN / total) * 100);
  bar.style.width = pct + '%';
  bar.className = 'qb-bar' + (pct >= 90 ? ' danger' : pct >= 65 ? ' warn' : '');

  if (leftN === 0) {
    if (numsEl) numsEl.innerHTML = `<strong style="color:var(--muted)">0</strong> restantes · <span style="color:var(--p);font-size:.62rem">↺ novas em ${getResetStr()}</span>`;
  } else {
    if (numsEl) numsEl.innerHTML = `<strong>${leftN}</strong> restantes`;
  }
}

function toggleQbTooltip(e) {
  e.stopPropagation();
  const tip  = document.getElementById('qbTooltip');
  if (tip.classList.contains('on')) { tip.classList.remove('on'); return; }

  const plan   = currentUser?.plan || 'basico';
  const limits = PLAN_LIMITS[plan];
  const total  = limits.total;
  const usedN  = Object.values(queryCounters).reduce((a,b)=>a+b,0);
  const leftN  = total === -1 ? '∞' : Math.max(0, total - usedN);

  const now  = new Date();
  const meia = new Date(now); meia.setHours(24,0,0,0);
  const diff = meia - now;
  const hh   = Math.floor(diff / 3600000);
  const mm   = Math.floor((diff % 3600000) / 60000);
  const resetStr = hh > 0 ? `${hh}h ${mm}min` : `${mm}min`;

  tip.innerHTML = `<strong>${leftN} consultas restantes</strong><br>Plano <strong>${limits.label}</strong> · ${total === -1 ? 'Ilimitado' : total + ' por dia'}<br><span style="color:var(--p3)">↺ Reseta em ${resetStr}</span>`;
  tip.classList.add('on');

  // Fecha ao clicar em qualquer lugar
  const close = () => { tip.classList.remove('on'); document.removeEventListener('click', close); };
  setTimeout(() => document.addEventListener('click', close), 10);
}

// ── MODAL DE UPGRADE/UNLOCK ──
const PLAN_PRICES = { starter:'R$5,80', pro:'R$8,90', premium:'R$14,20/mês' };
// Preços "originais" (sem desconto de cadastro) — exibidos riscados nos cards
const PLAN_PRICES_ORIG = { starter:'R$7,90', pro:'R$11,90', premium:'R$18,90' };
// Desconto aplicado ao se cadastrar (% exibido nos cards)
const WELCOME_DISCOUNT = { starter:27, pro:25, premium:25 };
const PLAN_UNLOCKS = {
  cpfpro:    ['starter','pro','premium'],
  foto:      ['starter','pro','premium'],
  familiares:['starter','pro','premium'],
};

function showUnlockModal(mod, type) {
  const el = document.getElementById('modalUnlockContent');
  const modName = MODS[mod]?.name || mod;
  const cost = MOD_CREDITS[mod] || 0;
  const hasCreditOption = cost > 0;
  const cheapestPlan = (PLAN_UNLOCKS[mod] || ['starter'])[0];
  const cheapestPrice = PLAN_PRICES[cheapestPlan] || 'R$5,70';
  const cheapestLabel = PLAN_LIMITS[cheapestPlan]?.label || 'Starter';
  let html = '';
  if (type === 'credits-only') {
    html = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#lockGrad)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block"><defs><linearGradient id="lockGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a855f7"/><stop offset="100%" stop-color="#f472b6"/></linearGradient></defs><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:8px">CPF Pro bloqueado</h3>
      <p style="font-size:.8rem;color:var(--muted);line-height:1.6;margin-bottom:20px">Acesse com créditos avulsos ou assine o plano ${cheapestLabel} a partir de <strong style="color:var(--p3)">${cheapestPrice}</strong>.</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="credits-buy-btn" onclick="document.getElementById('modalUnlock').classList.remove('open');goCredits('${mod}')">
          <svg width="13" height="13" viewBox="0 0 20 24" fill="none"><path d="M16 3L5 3C2.5 3 1 5 1 7C1 9 2.5 11 5 11L15 11C17.5 11 19 13 19 15C19 17 17.5 19 15 19L4 19" stroke="#fff" stroke-width="3" stroke-linecap="square"/></svg>
          Comprar créditos avulsos
        </button>
        <button onclick="document.getElementById('modalUnlock').classList.remove('open');goPlansFromResults()" style="width:100%;padding:11px;border-radius:var(--r);font-size:.85rem;font-weight:600;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted2);transition:all .15s">Ver planos</button>
        <button onclick="document.getElementById('modalUnlock').classList.remove('open')" style="font-size:.75rem;color:var(--muted);padding:6px;transition:color .15s" onmouseover="this.style.color='var(--fg)'" onmouseout="this.style.color='var(--muted)'">Agora não</button>
      </div>`;
  } else {
    html = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#lockGrad)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block"><defs><linearGradient id="lockGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a855f7"/><stop offset="100%" stop-color="#f472b6"/></linearGradient></defs><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:8px">${modName} bloqueado</h3>
      <p style="font-size:.8rem;color:var(--muted);line-height:1.6;margin-bottom:20px">Disponível no plano ${cheapestLabel}, a partir de <strong style="color:var(--p3)">${cheapestPrice}</strong>.${hasCreditOption ? ` Ou consulte avulso por ${fmtBrl(creditsToReal(cost))}.` : ''}</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="credits-buy-btn" onclick="document.getElementById('modalUnlock').classList.remove('open');goPlansFromResults()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          Ver planos
        </button>
        ${hasCreditOption ? `<button onclick="document.getElementById('modalUnlock').classList.remove('open');goCredits('${mod}')" style="width:100%;padding:11px;border-radius:var(--r);font-size:.85rem;font-weight:600;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted2);transition:all .15s">Comprar consulta avulsa</button>` : ''}
        <button onclick="document.getElementById('modalUnlock').classList.remove('open')" style="font-size:.75rem;color:var(--muted);padding:6px;transition:color .15s" onmouseover="this.style.color='var(--fg)'" onmouseout="this.style.color='var(--muted)'">Agora não</button>
      </div>`;
  }
  el.innerHTML = html;
  document.getElementById('modalUnlock').classList.add('open');
}

function goCreditsInfo(mod, fromWallet = false) {
  _creditsInfoMod = mod;
  _creditsInfoFromWallet = fromWallet;
  // mostra/esconde botão de comprar dependendo da origem
  const buyBtn = document.querySelector('#page-credits-info .cinfo-buy-btn');
  if (buyBtn) buyBtn.style.display = fromWallet ? 'none' : '';
  pushNav('credits-info');
  showPage('credits-info');
  // aplica logo após render
  setTimeout(() => {
    const b = document.querySelector('#page-credits-info .cinfo-buy-btn');
    if (b) b.style.display = fromWallet ? 'none' : '';
  }, 50);
}

// lógica inteligente de quando mostrar banner
// retorna: null (não mostrar), 'premium-mod' (módulo premium), 'low' (poucos), 'zero' (esgotado)
const PREMIUM_MODS = new Set(['foto','cpfpro']);
const CREDITS_LOW_THRESHOLD = 5;
let _csbDismissedUntil = 0; // timestamp até quando o banner fica fechado

function smartBannerType(mod) {
  if (!mod || MOD_CREDITS[mod] === 0) return null;
  if (_csbDismissedUntil > Date.now()) return null;
  if (!currentUser || currentUser.anon) return null;
  if (canUseCredits(mod)) return null;

  const perm = canQuery(mod);
  if (!perm.ok && (perm.reason === 'mod_limit' || perm.reason === 'total_limit')) return 'zero';

  const left = getModLeft(mod);
  if (left === 0) return 'zero';
  if (PREMIUM_MODS.has(mod)) return 'normal';
  if (left <= CREDITS_LOW_THRESHOLD) return 'low';
  return null;
}

// função unificada de banner — substitui showCreditsBanner + updateResultsBanner + updateModulesBanner
function renderBanner(mod, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!mod || _csbDismissedUntil > Date.now() || !currentUser || currentUser.anon) {
    el.innerHTML = ''; return;
  }
  const type = smartBannerType(mod);
  el.innerHTML = type ? buildSmartBanner(mod, type) : '';
}

function showCreditsBanner(mod) {
  const type = smartBannerType(mod);
  return type ? buildSmartBanner(mod, type) : '';
}

function updateResultsBanner(mod) { renderBanner(mod, 'resCreditsBanner'); }
function updateModulesBanner() {
  if (!currentUser || currentUser.anon || _csbDismissedUntil > Date.now()) {
    const el = document.getElementById('modulesCreditsBanner');
    if (el) el.innerHTML = ''; return;
  }
  const order = ['foto','cpf','nome','telefone','email','placa','cnh','familiares'];
  let bestMod = null;
  for (const mod of order) {
    const t = smartBannerType(mod);
    if (t === 'zero') { bestMod = mod; break; } // só mostra se completamente zerado
  }
  const el = document.getElementById('modulesCreditsBanner');
  if (el) el.innerHTML = bestMod ? buildSmartBanner(bestMod, 'zero') : '';
}

function buildSmartBanner(mod, type) {
  if (!type) return '';
  const cost     = MOD_CREDITS[mod] || 1;
  const modName  = MODS[mod]?.name || mod;
  const priceStr = fmtBrl(creditsToReal(cost));
  const left     = getModLeft(mod);

  let lbl;
  if (type === 'zero')     lbl = `${modName} — limite diário atingido · avulso ${priceStr}`;
  else if (type === 'low') lbl = `${modName} — ${left} restante${left!==1?'s':''} · avulso ${priceStr}`;
  else                     lbl = `${modName} · avulso ${priceStr}`;

  return `<div class="csb-pill ${type}">
    <div class="csb-pill-dot"></div>
    <span class="csb-pill-lbl">${lbl}</span>
    <button class="csb-pill-btn" onclick="goCredits('${mod}')">Ver</button>
    <button class="csb-pill-close" onclick="document.getElementById('csbConfirm').classList.add('open')">✕</button>
  </div>`;
}

function dismissCreditsBanner() {
  _csbDismissedUntil = Date.now() + 30 * 60 * 1000;
  document.getElementById('csbConfirm').classList.remove('open');
  ['modulesCreditsBanner','qCreditsBanner','resCreditsBanner'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = '';
  });
}

function updateCreditsBalloon() {
  const balloon = document.getElementById('creditsBalloon');
  const valEl   = document.getElementById('creditsBalloonVal');
  const wrap    = document.getElementById('creditsBalloonWrap');
  if (!balloon || !valEl) return;
  const email = currentUser?.email;
  if (!email || currentUser?.anon) {
    if (wrap) wrap.style.display = 'none';
    return;
  }
  if (wrap) wrap.style.display = 'flex';
  const credits = getCredits(email);
  if (credits > 0) {
    const brl = creditsToReal(credits).toFixed(2).replace('.', ',');
    valEl.textContent = brl;
    balloon.classList.add('has-balance');
  } else {
    valEl.textContent = 'Créditos';
    balloon.classList.remove('has-balance');
  }
}

// ── PÁGINA DE COMPRA DE CRÉDITOS ──
let _creditsTargetMod = null;
let _creditsQty = 1;

const CREDITO_MIN_BRL = 1.50; // Espelha o backend

function _calcQtyMin(mod) {
  // Calcula a quantidade mínima de consultas para atingir R$1,50
  const cost = MOD_CREDITS[mod] || 0.7;
  if (cost <= 0) return 1; // módulo gratuito, sem mínimo relevante
  const credMin = CREDITO_MIN_BRL / BRL_PER_CREDIT; // créditos mínimos
  return Math.max(1, Math.ceil(credMin / cost));
}

function goCredits(mod) {
  if (!currentUser || currentUser.anon) {
    showToast('Crie uma conta para comprar créditos.', 'error');
    setTimeout(() => openModal('modal-register'), 400);
    return;
  }
  _creditsTargetMod = mod || 'cpf';
  const m       = _creditsTargetMod;
  const modName = MODS[m]?.name || m;
  const cost    = MOD_CREDITS[m] || 0.7;

  // Começa no mínimo que atinge R$1,50
  _creditsQty = _calcQtyMin(m);

  document.getElementById('creditsModName').textContent = `Compra avulsa — ${modName}`;

  const hint = cost > 0
    ? `1 consulta de ${modName} = ${cost} crédito${cost !== 1 ? 's' : ''} (${fmtBrl(creditsToReal(cost))})`
    : `${modName} é gratuito`;
  document.getElementById('creditsCostHint').textContent = hint;

  // presets — filtrar só os que atingem o mínimo
  const presetsWrap = document.getElementById('creditsPresets');
  presetsWrap.innerHTML = '';
  const qtyMin = _calcQtyMin(m);
  [1, 5, 10, 20].filter(n => n >= qtyMin).forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'credits-preset' + (n === _creditsQty ? ' active' : '');
    btn.textContent = n + 'x';
    btn.onclick = () => { _creditsQty = n; renderCreditsSummary(); updatePresetsUI(); };
    presetsWrap.appendChild(btn);
  });

  renderCreditsSummary();
  updateCreditsBalloon();

  const email   = currentUser?.email;
  const balance = email ? getCredits(email) : 0;
  const balEl   = document.getElementById('creditsBalanceInfo');
  if (balEl) balEl.innerHTML = balance > 0
    ? `Saldo atual: <strong style="color:var(--p3)">${fmtBrl(creditsToReal(balance))}</strong>`
    : '';

  pushNav('credits');
  showPage('credits');
}

function changeCreditsQty(delta) {
  const qtyMin = _calcQtyMin(_creditsTargetMod || 'cpf');
  _creditsQty = Math.max(qtyMin, Math.min(100, _creditsQty + delta));
  renderCreditsSummary();
  updatePresetsUI();
}

function updatePresetsUI() {
  document.getElementById('creditsQtyNum').value = _creditsQty;
  document.querySelectorAll('.credits-preset').forEach((btn, i) => {
    const vals = [1, 5, 10, 20];
    btn.classList.toggle('active', vals[i] === _creditsQty);
  });
}

function renderCreditsSummary() {
  const m         = _creditsTargetMod || 'cpf';
  const cost      = MOD_CREDITS[m] || 0.7;
  const totalCred = Math.round(cost * _creditsQty * 100) / 100;
  const brlBase   = creditsToReal(totalCred);
  const disc      = getDiscount(brlBase);
  const brlFinal  = brlBase * (1 - disc.pct / 100);

  document.getElementById('creditsQtyNum').value = _creditsQty;

  const modName = MODS[m]?.name || m;

  // equivalência em foto nacional (se o módulo não for foto)
  const fotoCost = MOD_CREDITS['foto'] || 3.8;
  const fotoQty  = Math.floor(totalCred / fotoCost);
  const fotoLine = m !== 'foto' && fotoQty > 0
    ? `<div class="credits-summary-row" style="opacity:.6">
        <span class="credits-summary-label">Equivale a fotos nacionais</span>
        <span class="credits-summary-val">${fotoQty}x foto</span>
       </div>` : '';

  const summary = document.getElementById('creditsSummary');
  summary.innerHTML = `
    <div class="credits-summary-row">
      <span class="credits-summary-label">${_creditsQty}x ${modName}</span>
      <span class="credits-summary-val">${totalCred} créditos</span>
    </div>
    ${fotoLine}
    ${disc.pct > 0 ? `<div class="credits-summary-row">
      <span class="credits-summary-label">Desconto <span class="credits-discount">${disc.label}</span></span>
      <span class="credits-summary-val green">−${fmtBrl(brlBase - brlFinal)}</span>
    </div>` : ''}
    <div class="credits-summary-row">
      <span class="credits-summary-label" style="font-weight:600;color:var(--fg)">Total</span>
      <span class="credits-summary-val big">${fmtBrl(brlFinal)}</span>
    </div>`;

  const buyLabel = document.getElementById('creditsBuyLabel');
  if (buyLabel) buyLabel.textContent = `Pagar ${fmtBrl(brlFinal)}`;
}

// ── VERIFICA SE PODE USAR CRÉDITOS ──
function canUseCredits(mod) {
  const cost  = MOD_CREDITS[mod] || 0;
  if (cost === 0) return true;
  const email = currentUser?.email;
  if (!email) return false;
  return getCredits(email) >= cost;
}

function spendCredits(mod) {
  const cost  = MOD_CREDITS[mod] || 0;
  if (cost === 0) return;
  const email = currentUser?.email;
  if (email) deductCredits(email, cost);
  updateCreditsBalloon();
}

function playCreditsAnimation() {
  const btn = document.getElementById('creditsBalloon');
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'credits-spend-anim';
  el.textContent = '−' + fmtBrl(creditsToReal(MOD_CREDITS[curMod] || 1));
  el.style.left = (r.left + r.width/2 - 20) + 'px';
  el.style.top  = (r.top - 10) + 'px';
  document.body.appendChild(el);
  btn.style.animation = 'creditsPop .4s ease';
  setTimeout(() => { btn.style.animation = ''; el.remove(); }, 1000);
}

function askUseCredits(hasPlanLeft = false) {
  const cost    = MOD_CREDITS[curMod] || 0;
  const email   = currentUser?.email;
  const bal     = email ? getCredits(email) : 0;
  const left    = getModLeft(curMod);

  document.getElementById('creditsConfirmTitle').textContent = hasPlanLeft
    ? 'Usar créditos?' : 'Usar créditos?';
  document.getElementById('creditsConfirmMsg').textContent = hasPlanLeft
    ? `Você ainda tem ${left} consulta${left!==1?'s':''} do plano. Gastar um crédito (${fmtBrl(creditsToReal(cost))}) em vez de uma consulta do plano?`
    : `Esta consulta vai gastar ${cost} crédito${cost!==1?'s':''} (${fmtBrl(creditsToReal(cost))}) do seu saldo de ${fmtBrl(creditsToReal(bal))}.`;

  // troca botões dinamicamente
  const btns = document.querySelector('#confirmUseCredits .confirm-btns');
  btns.innerHTML = hasPlanLeft
    ? `<button class="confirm-cancel" style="flex:1;padding:9px;border-radius:var(--r);font-size:.8rem;font-weight:600;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted2)" onclick="document.getElementById('confirmUseCredits').classList.remove('open');_runSearch(false)">Usar plano</button>
       <button class="confirm-logout" style="flex:1;padding:9px;border-radius:var(--r);font-size:.8rem;font-weight:600;background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.3);color:var(--p3)" onclick="document.getElementById('confirmUseCredits').classList.remove('open');_doSearchCreditsConfirmed()">Usar créditos</button>`
    : `<button class="confirm-cancel" style="flex:1;padding:9px;border-radius:var(--r);font-size:.8rem;font-weight:600;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted2)" onclick="document.getElementById('confirmUseCredits').classList.remove('open')">Cancelar</button>
       <button class="confirm-logout" style="flex:1;padding:9px;border-radius:var(--r);font-size:.8rem;font-weight:600;background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.3);color:var(--p3)" onclick="document.getElementById('confirmUseCredits').classList.remove('open');_doSearchCreditsConfirmed()">Consultar</button>`;

  document.getElementById('confirmUseCredits').classList.add('open');
}

async function _doSearchCreditsConfirmed() {
  await _runSearch(true);
}

async function doSearchWithCredits() {
  if (!canUseCredits(curMod)) { goCreditsInfo(curMod); return; }
  askUseCredits();
}

// ── FIM DO SISTEMA DE CRÉDITOS ──

function toggleFaqPanel() {
  const faq = document.getElementById('faq');
  const panel = faq.querySelector('.faq-panel');
  const isOpen = faq.classList.contains('open');
  if (!isOpen) {
    const scroll = panel ? panel.querySelector('.faq-scroll') : null;
    const pH = scroll ? scroll.offsetHeight + 24 : 400;
    faq.classList.add('open');
    if (panel) panel.style.maxHeight = pH + 'px';
  } else {
    faq.classList.remove('open');
    if (panel) panel.style.maxHeight = '';
  }
}

function toggleFaq(el) {
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => {
    i.classList.remove('open');
    const a = i.querySelector('.faq-a');
    if (a) a.style.maxHeight = '';
  });
  if (!isOpen) {
    const a = el.querySelector('.faq-a');
    const inner = a ? a.querySelector('.faq-a-inner') : null;
    const panel = el.closest('.faq-panel');
    const aH = inner ? inner.offsetHeight : 200;
    el.classList.add('open');
    if (a) a.style.maxHeight = aH + 'px';
    if (panel) panel.style.maxHeight = (panel.scrollHeight + aH) + 'px';
    // só scrolla se o item estiver fora do viewport após a animação
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const vH = window.innerHeight;
      if (rect.bottom > vH || rect.top < 0) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 320);
  }
}

// ── STATE ──
let curMod = null;
let navHist = ['home'];

const MOD_SVGS = {
  cpf:       '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10h2M16 14h2M6 10h4M6 14h2"/></svg>',
  cpfpro:    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  cnpj:      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/></svg>',
  cep:       '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  ip:        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10z"/></svg>',
  whois:     '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
  nome:      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  familiares:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="18" cy="8" r="2.5"/><path d="M22 21v-1.5a3 3 0 0 0-2-2.83"/></svg>',
  telefone:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.8 19.8 0 0 1 1.08 3.4 2 2 0 0 1 3.05 1.22h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.1a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 21 16.92z"/></svg>',
  email:     '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>',
  foto:      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  placa:     '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5"/><circle cx="16" cy="17" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/></svg>',
  cnh:       '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M13 10h4M13 14h2"/></svg>',
  pix:       '<svg width="22" height="22" viewBox="0 0 512 512" fill="currentColor"><path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C353.7 383.7 372.6 391.5 392.6 391.5H407.7L310.6 488.6C280.3 518.1 231.1 518.1 200.8 488.6L103.3 391.2H112.6C132.6 391.2 151.5 383.4 165.7 369.2L242.4 292.5zM262.5 218.9C256.1 224.4 247.9 224.5 242.4 218.9L165.7 142.2C151.5 127.1 132.6 120.2 112.6 120.2H103.3L200.7 22.76C231.1-7.586 280.3-7.586 310.6 22.76L407.8 119.9H392.6C372.6 119.9 353.7 127.7 339.5 141.9L262.5 218.9zM112.6 142.7C126.4 142.7 139.1 148.3 149.7 158.1L226.4 234.8C233.6 241.1 243 245.6 252.5 245.6C261.9 245.6 271.3 241.1 278.5 234.8L355.5 157.8C365.3 148.1 378.8 142.5 392.6 142.5H430.3L488.6 200.8C518.9 231.1 518.9 280.3 488.6 310.6L430.3 368.9H392.6C378.8 368.9 365.3 363.3 355.5 353.6L278.5 276.6C264.6 262.7 240.3 262.7 226.4 276.6L149.7 353.2C139.1 363 126.4 368.6 112.6 368.6H80.78L22.41 310.2C-7.918 279.9-7.918 230.7 22.41 200.4L80.78 142H112.6z"/></svg>',
  cns:       '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  renavam:   '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a1 1 0 0 1-1-1v-4l2-5h12l2 5v4a1 1 0 0 1-1 1h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 9h14"/></svg>',
};
const MODS = {
  cpf:       {name:'CPF',          bg:'rgba(168,85,247,.12)', sub:'Digite o CPF', ph:'000.000.000-00'},
  cpfpro:    {name:'CPF Pro',      bg:'rgba(168,85,247,.15)', sub:'Digite o CPF', ph:'000.000.000-00'},
  cnpj:      {name:'CNPJ',         bg:'rgba(168,85,247,.1)',  sub:'Digite o CNPJ', ph:'00.000.000/0000-00'},
  cep:       {name:'CEP',          bg:'rgba(168,85,247,.1)',  sub:'Digite o CEP', ph:'00000-000'},
  ip:        {name:'IP',           bg:'rgba(168,85,247,.1)',  sub:'IPv4, IPv4 privado ou IPv6', ph:'8.8.8.8 · 192.168.1.1 · 2001:db8::1'},
  whois:     {name:'WHOIS',        bg:'rgba(168,85,247,.1)',  sub:'Digite o domínio', ph:'exemplo.com'},
  nome:      {name:'Nome',         bg:'rgba(168,85,247,.1)',  sub:'Pode ser só o primeiro nome', ph:'João'},
  familiares:{name:'Família',      bg:'rgba(168,85,247,.1)', sub:'Digite o CPF ou nome', ph:'CPF ou Nome'},
  telefone:  {name:'Telefone',     bg:'rgba(168,85,247,.1)',  sub:'Digite o telefone', ph:'(11) 99999-9999'},
  email:     {name:'E-mail',       bg:'rgba(168,85,247,.1)',  sub:'Digite o e-mail', ph:'exemplo@email.com'},
  foto:      {name:'Foto Nacional',bg:'rgba(232,121,160,.1)', sub:'CPF ou nome completo', ph:'CPF ou Nome'},
  placa:     {name:'Placa',        bg:'rgba(168,85,247,.1)',  sub:'Formato antigo ou Mercosul', ph:'ABC-1234 ou ABC1D23'},
  cnh:       {name:'CNH',          bg:'rgba(168,85,247,.1)',  sub:'Digite o número da CNH', ph:'00000000000'},
  pix:       {name:'Pix',           bg:'rgba(168,85,247,.12)', sub:'Cole ou digite o CPF parcial do Pix', ph:'***.000.000-**'},
  cns:       {name:'CNS',          bg:'rgba(168,85,247,.1)',  sub:'Digite o CNS', ph:'000 0000 0000 0000'},
  renavam:   {name:'RENAVAM',      bg:'rgba(168,85,247,.1)',  sub:'Digite o RENAVAM', ph:'00000000000'},
};

let famType = 'mae';
function setFamType(type, btn) {
  famType = type;
  document.querySelectorAll('.fam-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const inp = document.getElementById('qInp');
  inp.placeholder = type === 'mae' ? 'CPF ou nome da mãe' : 'CPF ou nome do pai';
  document.getElementById('qSub').textContent = type === 'mae' ? 'Busca filhos por CPF ou nome da mãe' : 'Busca filhos por CPF ou nome do pai';
}

// ── NAVIGATION ──
function showPage(id, pushHistory = true, isBack = false) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.style.animation=''; });
  const el = document.getElementById('page-'+id);
  el.classList.add('active');
  el.style.animation = isBack ? 'pageBack .22s ease both' : 'pageIn .22s ease both';
  window.scrollTo(0, 0);
  const _restorablePages = ['settings','wallet','history','chat','store','modules'];
  try {
    if(_restorablePages.includes(id)) {
      sessionStorage.setItem('ghost_last_page', id);
      sessionStorage.setItem('ghost_nav_active', '1');
    } else {
      sessionStorage.removeItem('ghost_last_page');
      sessionStorage.removeItem('ghost_nav_active');
    }
  } catch(_) {}
  const nav = document.getElementById('main-nav');
  const storeHero = document.getElementById('store-hero');
  if (id === 'home') nav.classList.remove('hidden');
  else { nav.classList.add('hidden'); closeMenu(); } // fecha menu ao sair da home
  if (storeHero) storeHero.style.display = id === 'store' ? 'flex' : 'none';
  if (id === 'modules') { updateBalloon(); updateCpfProCard(); updateCreditsBalloon(); updateModulesBanner(); }
  if (id === 'chat')     { _renderChatUserAvatar(); _setChatWelcomeTime(); }
  if (id !== 'chat')     { _stopChatPoll(); }
  if (id === 'thankyou')  { const q = document.getElementById('tyQuestion'); if(q) { q.style.opacity=''; q.style.transform=''; q.style.transition=''; } }
  if (pushHistory) {
    const state = {page: id, mod: curMod};
    if (history.state?.page !== id) {
      try { history.pushState(state, '', location.href.split('#')[0] + '#' + id); } catch(_) {}
    }
  }
}

function updateCpfProCard() {
  const card = document.getElementById('cpfproCard');
  if (!card) return;
  const plan = currentUser?.plan || 'basico';
  const planOrder = ['basico','starter','pro','premium'];
  const unlocked = planOrder.indexOf(plan) >= 1;
  const hasCredits = canUseCredits('cpfpro');

  if (unlocked) {
    card.className = 'mc';
    card.onclick = () => goQuery('cpfpro');
    const badge = card.querySelector('.mc-lock-badge');
    if (badge) badge.remove();
    const link = card.querySelector('.mc-link');
    if (link) { link.textContent = 'Consultar'; link.style.color = ''; }
    const desc = card.querySelector('.mc-desc');
    if (desc) desc.remove();
  } else if (hasCredits) {
    card.className = 'mc';
    card.onclick = () => goQuery('cpfpro');
    const badge = card.querySelector('.mc-lock-badge');
    if (badge) {
      badge.innerHTML = '<span style="display:flex;flex-direction:column;gap:1px;align-items:center;line-height:1.15"><span>Créditos</span><span style="opacity:.65;font-size:.48rem;letter-spacing:.04em">Starter+</span></span>';
    }
    const link = card.querySelector('.mc-link');
    if (link) { link.textContent = 'Consultar'; link.style.color = ''; }
  } else {
    card.className = 'mc locked';
    card.onclick = () => goQuery('cpfpro');
    const badge = card.querySelector('.mc-lock-badge');
    if (badge) {
      badge.innerHTML = 'Starter+';
    }
  }
}
function goHome(){
  navHist=['home'];
  try { sessionStorage.removeItem('ghost_last_page'); sessionStorage.removeItem('ghost_nav_active'); } catch(_) {}
  showPage('home');
  window.scrollTo({top:0, behavior:'smooth'});
  initDiscountBanner();
}

// hero-cta always visible
function goModules() { pushNav('modules'); showPage('modules'); }
function goQueryOrLock(mod) {
  const plan = currentUser?.plan || 'basico';
  const planOrder = ['basico','starter','pro','premium'];
  // cpfpro requer starter+
  if (mod === 'cpfpro' && planOrder.indexOf(plan) < 1) {
    renderErr('Módulo bloqueado','O CPF Pro está disponível apenas nos planos Starter, Pro e Premium. Ative um cupom ou assine um plano para desbloquear.');
    pushNav('results'); showPage('results'); return;
  }
  goQuery(mod);
}

function goQuery(mod) {
  curMod = mod;
  const m = MODS[mod];
  const ico = document.getElementById('qIco');
  const svg = MOD_SVGS[mod] || '';
  ico.innerHTML = svg; ico.style.background = m.bg; ico.style.color = 'var(--p)';
  if (mod === 'foto') ico.style.color = 'var(--p3)';
  document.getElementById('qTit').textContent = 'Consulta de '+m.name;
  document.getElementById('qSub').textContent  = m.sub;
  const inp = document.getElementById('qInp');
  inp.placeholder = m.ph; inp.value = '';
  const sm = document.getElementById('qIcoSm'); sm.innerHTML = MOD_SVGS[mod] ? `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='${mod==='foto'?'var(--p3)':'var(--muted)'}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>${MOD_SVGS[mod].replace(/<svg[^>]*>/,'').replace('</svg>','')}</svg>` : ''; sm.style.color = mod==='foto' ? 'var(--p3)' : 'var(--muted)';
  document.getElementById('fam-selector').style.display = mod==='familiares'?'flex':'none';
  const numMods = ['cpf','cpfpro','cnpj','cep','cnh','telefone','cns','renavam'];
  inp.inputMode  = 'text'; // teclado normal em todos os módulos
  inp.setAttribute('autocomplete','off');
  if(mod === 'familiares') inp.placeholder = famType === 'mae' ? 'CPF ou nome da mãe' : 'CPF ou nome do pai';
  // atualiza mini-balão e banner de créditos
  updateMiniBalloon(mod);
  renderBanner(mod, 'qCreditsBanner');
  pushNav('query'); showPage('query');
}
function downloadResults() {
  const d = window._lastResultData;
  if (!d) return;
  const lines = ['GHOST BUSCA — RESULTADOS', '═'.repeat(36), ''];
  d.data.forEach((item, i) => {
    if (d.data.length > 1) lines.push(`RESULTADO: ${i+1}`, '─'.repeat(24));
    if (item.__whois_raw) { lines.push(item.__whois_raw); }
    else {
      Object.entries(item).forEach(([k, v]) => {
        if (!v) return;
        const lbl = k.replace(/_/g,' ').toUpperCase();
        lines.push(`• ${lbl}: ${v}`);
      });
    }
    lines.push('');
  });
  lines.push('─'.repeat(36), `Gerado em: ${new Date().toLocaleString('pt-BR')}`, 'Ghost Busca — ghostbusca.com');
  const blob = new Blob([lines.join('\n')], { type:'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ghost_${d.modName.toLowerCase().replace(/\s/g,'_')}_${Date.now()}.txt`;
  a.click(); URL.revokeObjectURL(a.href);
}

function goBack() {
  // se estava na tela de liberar e não liberou ninguém, devolve a consulta
  if (window._liberarModeActive && !window._liberarAnyReleased && window._liberarRefundMod) {
    const mod = window._liberarRefundMod;
    if (queryCounters[mod] > 0) queryCounters[mod]--;
    if (currentUser?.email) saveDailyCounters(currentUser.email, queryCounters, currentUser.plan);
    updateBalloon(); updateModulesBanner();
  }
  window._liberarModeActive = false;
  window._liberarAnyReleased = false;
  window._liberarRefundMod = null;
  history.back();
}
function pushNav(page) { if(navHist[navHist.length-1]!==page) navHist.push(page); }
// ── DOM bindings (adiados para garantir que os elementos existem) ──
document.addEventListener('DOMContentLoaded', function() {
  const _modsBack = document.getElementById('modsBack');
  const _qBack    = document.getElementById('qBack');
  const _btnBk    = document.getElementById('btnBk');
  if (_modsBack) _modsBack.onclick = goBack;
  if (_qBack)    _qBack.onclick    = goBack;
  if (_btnBk)    _btnBk.onclick    = goBack;
  document.addEventListener('keydown', e=>{ if(e.key==='Enter'&&document.getElementById('page-query')?.classList.contains('active')) doSearch(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeAllModals(); });
});

// ── registrar ──
async function submitRegister(btn) {
  const overlay    = document.getElementById('modal-register');
  const nomeEl     = overlay.querySelector('input[autocomplete="name"]');
  const emailEl    = overlay.querySelector('#reg-identifier');
  const usernameEl = overlay.querySelector('#reg-username');
  const senhaEl    = overlay.querySelector('#reg-pw');
  [nomeEl, emailEl, usernameEl, senhaEl].forEach(i => i && (i.style.borderColor = ''));

  let ok = true;
  const shakeInp = i => { if(!i)return; i.style.borderColor='rgba(248,113,113,.6)'; i.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:180}); ok=false; };

  const nome     = nomeEl?.value.trim() || '';
  const email    = emailEl?.value.trim().toLowerCase() || '';
  const username = usernameEl?.value.trim() || '';
  const senha    = senhaEl?.value || '';

  if (!nome)                                          shakeInp(nomeEl);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))    shakeInp(emailEl);
  if (!username || username.length < 3)               shakeInp(usernameEl);
  if (senha.length < 6)                              shakeInp(senhaEl);
  if (!ok) return;

  // username vira o "nome" exibido — combina nome + username
  const displayName = username;

  const orig = btn.textContent;
  btn.textContent = 'Verificando...'; btn.style.opacity = '.7'; btn.disabled = true;

  // verifica IP suspeito (VPN, Tor, datacenter)
  try {
    const ipRes = await fetch(`${SUPABASE_URL}/functions/v1/check-suspicious`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({})
    });
    const ipData = await ipRes.json();
    if (ipData.suspicious) {
      showModalErr(overlay, 'Cadastro não permitido com VPN, proxy ou Tor. Desative e tente novamente.');
      btn.textContent = orig; btn.style.opacity = ''; btn.disabled = false;
      return;
    }
  } catch {
    // se a verificação falhar por erro de rede, deixa passar
  }

  // verifica se o domínio do email realmente aceita emails
  try {
    const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/verify-email-real`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email })
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.valid) {
      emailEl.style.borderColor = 'rgba(248,113,113,.6)';
      emailEl.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:180});
      showModalErr(overlay, verifyData.reason || 'E-mail inválido.');
      btn.textContent = orig; btn.style.opacity = ''; btn.disabled = false;
      return;
    }
  } catch {
    // se a verificação falhar por erro de rede, deixa passar
  }

  btn.textContent = 'Criando conta...';

  const { error: signUpErr } = await _sb.auth.signUp({
    email,
    password: senha,
    options: { data: { nome: displayName } }
  });

  if (signUpErr) {
    const jaExiste = signUpErr.message?.toLowerCase().includes('already registered');
    if (jaExiste) emailEl.style.borderColor = 'rgba(248,113,113,.6)';
    showModalErr(overlay, jaExiste ? 'Este e-mail já está cadastrado.' : 'Erro ao criar conta. Tente novamente.');
    btn.textContent = orig; btn.style.opacity = ''; btn.disabled = false;
    return;
  }

  // login automático após cadastro (sem precisar de confirmação de email)
  const { error: signInErr } = await _sb.auth.signInWithPassword({ email, password: senha });
  btn.textContent = '✓ Conta criada!'; btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
  setTimeout(async () => {
    closeModal('modal-register');
    btn.textContent = orig; btn.style.opacity = ''; btn.style.background = ''; btn.disabled = false;
    [nomeEl, emailEl, usernameEl, senhaEl].forEach(i => { if(i){ i.value = ''; i.style.borderColor = ''; } });
    clearModalErr(overlay);
    await _loadSession();
    setTimeout(() => showWelcomeCouponModal(), 600);
  }, 700);
}

// ── login ──
async function submitLogin(btn) {
  const overlay  = document.getElementById('modal-login');
  const identEl  = document.getElementById('login-identifier');
  const senhaEl  = document.getElementById('login-pw');
  [identEl, senhaEl].forEach(i => i.style.borderColor = '');

  let ok = true;
  const shakeInp = i => { i.style.borderColor='rgba(248,113,113,.6)'; i.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:180}); ok=false; };

  const identifier = identEl.value.trim().toLowerCase();
  const senha = senhaEl.value;

  if (!identifier) shakeInp(identEl);
  if (!senha) shakeInp(senhaEl);
  if (!ok) return;

  const orig = btn.textContent;
  btn.textContent = 'Entrando...'; btn.style.opacity = '.7'; btn.disabled = true;

  // login via Supabase Auth
  let loginEmail = identifier;

  // se não parece email, tenta achar pelo nome na tabela profiles
  if (!identifier.includes('@')) {
    const byName = await sbGet('profiles', `nome=ilike.${encodeURIComponent(identifier)}&limit=1`);
    const profile = byName?.[0] || null;
    if (!profile || !profile.email) {
      btn.textContent = orig; btn.style.opacity = ''; btn.disabled = false;
      [identEl, senhaEl].forEach(i => i.style.borderColor = 'rgba(248,113,113,.6)');
      showModalErr(overlay, 'Usuário ou senha incorretos.');
      return;
    }
    loginEmail = profile.email;
  }

  const { data: signInData, error: signInErr } = await _sb.auth.signInWithPassword({
    email: loginEmail,
    password: senha,
  });

  if (signInErr) {
    btn.textContent = orig; btn.style.opacity = ''; btn.disabled = false;
    [identEl, senhaEl].forEach(i => i.style.borderColor = 'rgba(248,113,113,.6)');
    showModalErr(overlay, 'Usuário ou senha incorretos.');
    return;
  }

  // verifica se está banido
  const profile = await sbGetOne('profiles', `id=eq.${signInData.user.id}`);
  if (profile?.banned) {
    await _sb.auth.signOut();
    btn.textContent = orig; btn.style.opacity = ''; btn.disabled = false;
    showModalErr(overlay, 'Conta suspensa. Entre em contato com o suporte.');
    return;
  }

  btn.textContent = '✓ Bem-vindo!'; btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
  setTimeout(async () => {
    closeModal('modal-login');
    btn.textContent = orig; btn.style.opacity = ''; btn.style.background = ''; btn.disabled = false;
    [identEl, senhaEl].forEach(i => { i.value = ''; i.style.borderColor = ''; });
    clearModalErr(overlay);
    await _loadSession();
  }, 700);
}

// ── helpers de erro inline no modal ──
function showModalErr(overlay, msg) {
  let el = overlay.querySelector('.modal-err');
  if (!el) { el = document.createElement('div'); el.className = 'modal-err'; overlay.querySelector('.modal').appendChild(el); }
  el.textContent = '⚠ ' + msg;
  el.style.cssText = 'font-size:.72rem;color:#f87171;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:.4rem;padding:8px 12px;margin-top:10px;animation:couponPop .3s ease both';
}
function clearModalErr(overlay) {
  overlay.querySelector('.modal-err')?.remove();
}

// ── carrega sessão salva ao iniciar ──
async function _loadSession() {
  try {
    const session = await getAuthSession();
    if (!session) { await initAnon(); updateNavUser(); return; }

    const uid = session.user.id;
    const email = session.user.email;

    const profile = await sbGetOne('profiles', `id=eq.${uid}`);

    if (!profile) {
      await _sb.auth.signOut();
      await initAnon();
      updateNavUser();
      return;
    }

    // verifica expiração do plano
    if (profile.plan_expires_at && Date.now() > new Date(profile.plan_expires_at).getTime() && profile.plano !== 'basico') {
      await sbPatch('profiles', `id=eq.${uid}`, { plano: 'basico', plan_expires_at: null });
      profile.plano = 'basico';
      profile.plan_expires_at = null;
    }

    queryCounters = await getDailyCounters(email, profile.plano, uid);

    currentUser = {
      id:            uid,
      name:          profile.nome,
      email:         email,
      plan:          profile.plano,
      planExpiresAt: profile.plan_expires_at ? new Date(profile.plan_expires_at).getTime() : null,
      avatar_url:    profile.avatar_url || null,
      _credits:      profile.creditos || 0,
    };

    updateNavUser();

    // Verificar pagamentos pendentes em segundo plano (cobre o caso de fechar o site e pagar)
    _checkPendingPayments(uid).catch(() => {});

  } catch {
    await initAnon();
    updateNavUser();
  }
}

// ── logout ── (ver logoutUser() abaixo, que usa confirmação de modal)

// Verifica pagamentos pendentes ao logar — cobre o caso de fechar o site após pagar
async function _checkPendingPayments(uid) {
  try {
    const quinzeMinAtras = new Date(Date.now() - 900000).toISOString();
    const authH = await getAuthHeaders();
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/pagamentos?user_id=eq.${uid}&status=eq.pending&created_at=gte.${quinzeMinAtras}&select=id,payment_id,tipo,plano,valor_brl&order=created_at.desc&limit=5`,
      { headers: authH }
    );
    const pendentes = await r.json();
    if (!pendentes?.length) return;

    for (const pag of pendentes) {
      try {
        const chk = await fetch(`${SUPABASE_URL}/functions/v1/check-pix-status`, {
          method: 'POST',
          headers: authH,
          body: JSON.stringify({ payment_id: pag.payment_id })
        });
        const result = await chk.json();
        if (result?.status === 'paid') {
          // Recarregar perfil e atualizar estado
          const fresh = await sbGetOne('profiles', `id=eq.${uid}`);
          if (fresh) {
            currentUser.plan = fresh.plano || currentUser.plan;
            currentUser.planExpiresAt = fresh.plan_expires_at ? new Date(fresh.plan_expires_at).getTime() : null;
            currentUser._credits = fresh.creditos || 0;
            queryCounters = await getDailyCounters(currentUser.email, currentUser.plan);
            updateNavUser();
            // Notificar o usuário que o pagamento foi identificado
            if (pag.tipo === 'plano') {
              showToast(`Pagamento do Plano ${PLAN_NAMES_PT[pag.plano] || pag.plano} confirmado! Seu acesso foi liberado.`, 'success');
            } else {
              showToast('Seus créditos foram adicionados!', 'success');
            }
          }
          break; // Um de cada vez é suficiente
        }
      } catch(_) {}
    }
  } catch(_) {}
}

// ── salva contador a cada consulta ──
function _persistCounters() {
  if (currentUser) saveDailyCounters(currentUser.email, queryCounters, currentUser.plan);
}

// ── settings: editar nome e senha ──
function saveProfileChanges() {
  if (!currentUser) return;
  const nomeEl  = document.getElementById('set-nome');
  const senhaEl = document.getElementById('set-senha');
  const confEl  = document.getElementById('set-conf');
  const msgEl   = document.getElementById('set-msg');

  const newNome  = nomeEl?.value.trim();
  const newSenha = senhaEl?.value;
  const newConf  = confEl?.value;

  msgEl.textContent = '';
  msgEl.className   = 'set-msg';

  if (!newNome) { msgEl.textContent = 'Nome não pode estar vazio.'; msgEl.className='set-msg err'; nomeEl?.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:200}); return; }
  if (newSenha && newSenha.length < 6) { msgEl.textContent = 'Senha deve ter no mínimo 6 caracteres.'; msgEl.className='set-msg err'; senhaEl?.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:200}); return; }
  if (newSenha && newSenha !== newConf) { msgEl.textContent = 'As senhas não coincidem.'; msgEl.className='set-msg err'; confEl?.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:200}); return; }

  if (newSenha) {
    document.getElementById('confirmPwChange').classList.add('open');
    return;
  }
  _doSaveProfile();
}

async function _doSaveProfile() {
  if (!currentUser) return;
  const nomeEl  = document.getElementById('set-nome');
  const senhaEl = document.getElementById('set-senha');
  const confEl  = document.getElementById('set-conf');
  const msgEl   = document.getElementById('set-msg');
  const btn     = document.querySelector('#page-settings .modal-submit');

  const newNome  = nomeEl?.value.trim();
  const newSenha = senhaEl?.value;

  const session = await getAuthSession();
  if (!session) return;
  const uid = session.user.id;

  if (newSenha) {
    const { error: pwErr } = await _sb.auth.updateUser({ password: newSenha });
    if (pwErr) {
      if (msgEl) { msgEl.textContent = 'Erro ao atualizar senha.'; msgEl.className = 'set-msg err'; }
      return;
    }
  }

  const updated = await sbPatch('profiles', `id=eq.${uid}`, { nome: newNome });
  if (!updated) {
    if (msgEl) { msgEl.textContent = 'Erro ao salvar. Tente novamente.'; msgEl.className = 'set-msg err'; }
    return;
  }

  currentUser.name = newNome;
  updateNavUser();

  // atualiza nome visível sem re-renderizar a página inteira
  const nameEl = document.querySelector('.settings-avatar-name');
  if (nameEl) nameEl.textContent = newNome;

  if (senhaEl) senhaEl.value = '';
  if (confEl)  confEl.value  = '';

  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Salvo!';
    btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
    btn.animate([{transform:'scale(.97)'},{transform:'scale(1.03)'},{transform:'scale(1)'}],{duration:300});
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2000);
  }

  if (msgEl) {
    msgEl.textContent = '✓ Alterações salvas com sucesso!';
    msgEl.className   = 'set-msg ok';
    setTimeout(() => { if (msgEl) { msgEl.textContent = ''; msgEl.className='set-msg'; } }, 2500);
  }
}

// ── MODALS ──
function openModal(id){
  if((id==='modal-login'||id==='modal-register')&&currentUser&&!currentUser.anon) return;
  closeAllModals(); document.getElementById(id).classList.add('open'); window._overlayOpen = true;
  document.body.style.overflow = 'hidden';
}
function closeModal(id){
  const overlay = document.getElementById(id);
  const modal   = overlay?.querySelector('.modal');
  if (!overlay) return;
  overlay.classList.add('closing');
  if (modal) modal.classList.add('closing');
  setTimeout(() => {
    overlay.classList.remove('open','closing');
    if (modal) modal.classList.remove('closing');
    if (!document.querySelector('.modal-overlay.open,.confirm-overlay.open,.csb-confirm-overlay.open')) {
      window._overlayOpen = false;
      document.body.style.overflow = '';
    }
  }, 200);
}
function closeAllModals(){
  document.querySelectorAll('.modal-overlay.open').forEach(m => {
    const modal = m.querySelector('.modal');
    m.classList.add('closing'); if (modal) modal.classList.add('closing');
    setTimeout(() => { m.classList.remove('open','closing'); if (modal) modal.classList.remove('closing'); }, 200);
  });
  setTimeout(() => {
    // só trava scroll se menu ainda estiver aberto
    if (!document.getElementById('navDropdown')?.classList.contains('open')) {
      
    }
  }, 200);
}
function switchModal(a,b){ closeModal(a); setTimeout(()=>openModal(b),110); }
// Binding de fechar modal ao clicar fora
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{ if(e.target===o) closeAllModals(); }));

  // fechar confirm-overlay ao clicar fora
  document.querySelectorAll('.confirm-overlay').forEach(o=>o.addEventListener('click',e=>{
    if(e.target===o) o.classList.remove('open');
  }));

  // ── RESTAURAR PÁGINA ──
  // Só restaura se o usuário estava ativamente nessa página (flag ghost_nav_active)
  // Se voltou pra home antes do reload, a flag foi limpa e não restaura
  const deepPages = ['settings','wallet','history','chat','plans','store','modules'];
  const navActive = (() => { try { return sessionStorage.getItem('ghost_nav_active'); } catch(_) { return null; } })();
  const lastPage  = navActive ? (() => { try { return sessionStorage.getItem('ghost_last_page'); } catch(_) { return null; } })() : null;
  const hashPage  = location.hash.replace('#','');

  // páginas que só fazem sentido com estado — redireciona pra home
  const statefulOnly = ['results','query'];
  if (statefulOnly.includes(hashPage) && !navActive) {
    history.replaceState(null, '', location.pathname);
    _loadSession();
    return;
  }

  const targetPage = lastPage || (deepPages.includes(hashPage) ? hashPage : null);

  if (targetPage && targetPage !== 'home') {
    _loadSession().then(() => {
      const navMap = {
        settings: () => { pushNav('settings');  renderSettings(); showPage('settings', false); },
        wallet:   () => { pushNav('wallet');    renderWallet();   showPage('wallet',   false); },
        history:  () => { pushNav('history');   renderHistory();  showPage('history',  false); },
        chat:     () => goChat(),
        plans:    () => { pushNav('plans');     showPage('plans',    false); },
        store:    () => { pushNav('store');     showPage('store',    false); },
        modules:  () => { pushNav('modules');   showPage('modules',  false); },
      };
      const fn = navMap[targetPage];
      if (fn) fn(); else showPage('home', false);
    });
  } else {
    _loadSession();
  }
});

// ── CTA ──
function handleConsult(e) {
  const btn = document.getElementById('btnConsult');
  const r = document.createElement('span'); r.className='rip';
  const rect = btn.getBoundingClientRect();
  r.style.left=(e.clientX-rect.left-5)+'px'; r.style.top=(e.clientY-rect.top-5)+'px';
  btn.appendChild(r); setTimeout(()=>r.remove(),700);
  setTimeout(()=>goModules(), 220);
}

// ── PLAN DETAIL ──
function _closePD(p) {
  p.style.maxHeight      = '0';
  p.style.opacity        = '0';
  p.style.marginTop      = '0';
  p.style.borderTopWidth = '0px';
  const inner = p.firstElementChild;
  if (inner) inner.style.paddingTop = '0';
  p.dataset.open = '0';
}
function _openPD(p) {
  p.style.maxHeight      = p.scrollHeight + 28 + 'px';
  p.style.opacity        = '1';
  p.style.marginTop      = '14px';
  p.style.borderTopWidth = '1px';
  p.style.borderTopColor = 'var(--border)';
  const inner = p.firstElementChild;
  if (inner) inner.style.paddingTop = '14px';
  p.dataset.open = '1';
}
function closeAllPlanDetails() {
  document.querySelectorAll('.pc-detail').forEach(p => {
    _closePD(p);
    const b = p.closest('.pc')?.querySelector('.pc-btn:not(.primary)');
    if (b) b.textContent = 'Ver módulos';
  });
}

let _planDetailLocked = false;
let _planDragHappened = false;
function togglePlanDetail(id, btn, event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  if (_planDetailLocked) return;
  if (_planDragHappened) { _planDragHappened = false; return; }

  _planDetailLocked = true;
  setTimeout(() => { _planDetailLocked = false; }, 700);

  const panel = document.getElementById(id);
  if (!panel) return;
  const isOpen = panel.dataset.open === '1';

  if (btn && !btn.classList.contains('primary')) btn.textContent = isOpen ? 'Ver módulos' : 'Fechar';

  document.querySelectorAll('.pc-detail').forEach(p => {
    if (p !== panel) {
      _closePD(p);
      const b = p.closest('.pc')?.querySelector('.pc-btn:not(.primary)');
      if (b) b.textContent = 'Ver módulos';
    }
  });

  if (isOpen) {
    _closePD(panel);
    setTimeout(() => {
      const card = panel.closest('.pc');
      if (card) {
        const rect = card.getBoundingClientRect();
        const vH = window.innerHeight;
        if (rect.bottom > vH || rect.top < 0) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 220);
  }
  else { _openPD(panel); setTimeout(() => { const card = panel.closest('.pc') || panel; card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150); }
}

// ── SCROLL REVEAL ──
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting) {
      en.target.style.opacity = '1';
      en.target.style.transform = 'translate3d(0,0,0)';
      io.unobserve(en.target);
    }
  });
}, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });

// .pc cards are in a carousel - no scroll reveal needed
document.querySelectorAll('.mc').forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translate3d(0,10px,0)';
  el.style.transition = `opacity .4s ${i * .04}s cubic-bezier(.22,1,.36,1), transform .4s ${i * .04}s cubic-bezier(.22,1,.36,1)`;
  io.observe(el);
});

// ── TOGGLE PASSWORD ──
function togglePw(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  } else {
    inp.type = 'password';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
}

// ── BROWSER BACK ──
window.addEventListener('popstate', e => {
  const page = e.state?.page || 'home';
  const mod  = e.state?.mod  || null;
  if (page === 'home') navHist = ['home'];
  else if (page === 'modules') navHist = ['home','modules'];
  else if (page === 'query')   navHist = ['home','modules','query'];
  else if (page === 'results') navHist = ['home','modules','query','results'];
  else if (page === 'store')   navHist = ['home','store'];
  else if (page === 'product') navHist = ['home','store','product'];
  else if (page === 'plans')   navHist = ['home','plans'];
  if (mod && MODS[mod] && page === 'query') {
    curMod = mod;
    const m = MODS[mod];
    const ico = document.getElementById('qIco');
    if (ico) { const s2 = MOD_SVGS[mod] || ''; ico.innerHTML = s2; ico.style.background = m.bg; ico.style.color = mod==='foto'?'var(--p3)':'var(--p)'; }
    const qTit = document.getElementById('qTit');
    const qSub = document.getElementById('qSub');
    const qInp = document.getElementById('qInp');
    const famSel = document.getElementById('fam-selector');
    if (qTit) qTit.textContent = 'Consulta de '+m.name;
    if (qSub) qSub.textContent = m.sub;
    if (qInp) { qInp.placeholder = m.ph; }
    if (famSel) famSel.style.display = mod==='familiares'?'flex':'none';
  }
  showPage(page, false, true);
});


// ── CUPOM ──
// ── PLANOS E LIMITES ──
async function loginUser(name, email, plan, days) {
  const oldPlan = currentUser?.plan || 'basico';

  let expiresAt = null;
  if (days && days > 0) {
    // se já tem plano igual, estende
    const session = await getAuthSession();
    if (session) {
      const existing = await sbGetOne('profiles', `id=eq.${session.user.id}`);
      if (existing && existing.plano === plan && plan !== 'basico' && existing.plan_expires_at) {
        const current = new Date(existing.plan_expires_at).getTime();
        expiresAt = new Date(Math.max(current, Date.now()) + days * 86400000).toISOString();
      } else {
        expiresAt = new Date(Date.now() + days * 86400000).toISOString();
      }
    } else {
      expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    }
  }

  const patch = { plano: plan, plan_expires_at: expiresAt };
  if (name && name !== 'Usuário') patch.nome = name;

  const session2 = await getAuthSession();
  if (session2) await sbPatch('profiles', `id=eq.${session2.user.id}`, patch);
  currentUser = { ...currentUser, name: name || currentUser?.name, email, plan, planExpiresAt: expiresAt ? new Date(expiresAt).getTime() : null };
  queryCounters = await getDailyCounters(email, plan);
  updateNavUser();

  const planOrder = ['basico','starter','pro','premium'];
  const oldIdx = planOrder.indexOf(oldPlan);
  const newIdx = planOrder.indexOf(plan);
  if (newIdx > oldIdx) { playUpgradeAnimation(oldPlan, plan); histAdd({ type:'plano', name:`Plano ${PLAN_LIMITS[plan]?.label || plan} ativado`, free: false, value: null }); }
  else if (newIdx < oldIdx) playDowngradeAnimation(oldPlan, plan);
}

function logoutUser() {
  document.getElementById('confirmLogout').classList.add('open');
}
async function _doLogout() {
  await _sb.auth.signOut();
  currentUser = null;
  queryCounters = {};
  activeCoupons = new Set();
  const wcModal = document.getElementById('welcomeCouponModal');
  if (wcModal) wcModal.classList.remove('open');
  updateNavUser();
  goHome();
}

// ── PREÇOS DOS PLANOS: visitante vê preço cheio, cadastrado vê desconto ──
function updatePlanPrices() {
  const isLoggedIn = currentUser && !currentUser.anon;
  const plans = [
    ['starterPriceGuest','starterPriceMember','starterDiscTag'],
    ['proPriceGuest',    'proPriceMember',    'proDiscTag'],
    ['premiumPriceGuest','premiumPriceMember', 'premiumDiscTag'],
  ];
  plans.forEach(([gId, mId, dId]) => {
    const gEl = document.getElementById(gId);
    const mEl = document.getElementById(mId);
    const dEl = document.getElementById(dId);
    if (!mEl) return;
    if (isLoggedIn) {
      // cadastrado: preço cheio riscado + preço com desconto
      if (gEl) gEl.style.display = '';
      mEl.style.display = '';
      if (dEl) dEl.style.display = 'none';
    } else {
      // visitante: só preço cheio (sem risco), tag incentiva cadastro
      if (gEl) gEl.style.display = 'none';
      mEl.style.display = '';
      if (dEl) dEl.style.display = '';
    }
  });
}

function updateNavUser() {
  const guest     = document.getElementById('nav-guest');
  const user      = document.getElementById('nav-user');
  const circle    = document.getElementById('navAvCircle');
  const nameEl    = document.getElementById('navAvName');
  const setItem   = document.getElementById('menuSettingsItem');
  const planBadge = document.getElementById('menuPlanBadge');
  const heroBadge = document.getElementById('heroBadge');

  function _fadeSwapNav(hideEl, showEl) {
    hideEl.style.transition = 'opacity .2s ease';
    hideEl.style.opacity = '0';
    setTimeout(() => {
      hideEl.style.display = 'none';
      showEl.style.opacity = '0';
      showEl.style.display = 'flex';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        showEl.style.transition = 'opacity .25s ease';
        showEl.style.opacity = '1';
      }));
    }, 180);
  }

  function _fadeSwapBadge(el, newHTML) {
    el.style.transition = 'opacity .18s ease, transform .18s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-4px)';
    setTimeout(() => {
      el.innerHTML = newHTML;
      el.style.transition = 'opacity .22s ease, transform .22s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 180);
  }

  if (currentUser && !currentUser.anon) {
    stopDiscountBanner();
    const avatar = getUserAvatar(currentUser.email);
    if (avatar) {
      circle.innerHTML = `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      circle.textContent = currentUser.name[0].toUpperCase();
    }
    nameEl.textContent = currentUser.name;

    const guestVisible = guest.style.display !== 'none';
    if (guestVisible) {
      _fadeSwapNav(guest, user);
    } else if (user.style.display === 'none') {
      user.style.display = 'flex';
    }

    if (setItem) setItem.style.display = 'flex';
    const histItem = document.getElementById('menuHistoryItem');
    if (histItem) histItem.style.display = 'flex';
    if (planBadge) planBadge.textContent = '';

    if (heroBadge) {
      const plan  = currentUser.plan || 'basico';
      const label = PLAN_LIMITS[plan]?.label || 'Básico';
      const newHTML = `<span class="hero-badge-dot"></span>Plano ${label} ativo`;
      if (heroBadge.textContent.includes('Sem cadastro')) {
        _fadeSwapBadge(heroBadge, newHTML);
      } else {
        heroBadge.innerHTML = newHTML;
      }
      heroBadge.classList.remove('hidden');
    }
  } else {
    const userVisible = user.style.display === 'flex';
    if (userVisible) {
      _fadeSwapNav(user, guest);
    } else if (guest.style.display === 'none') {
      guest.style.display = 'flex';
    }

    if (setItem) setItem.style.display = 'none';
    const histItem = document.getElementById('menuHistoryItem');
    if (histItem) histItem.style.display = 'none';

    if (heroBadge) {
      const newHTML = '<span class="hero-badge-dot"></span>Sem cadastro obrigatório';
      if (!heroBadge.textContent.includes('Sem cadastro')) {
        _fadeSwapBadge(heroBadge, newHTML);
      } else {
        heroBadge.innerHTML = newHTML;
      }
      heroBadge.classList.remove('hidden');
    }
  }
  updateCreditsBalloon();
  applyHeroContent();
  updatePlanPrices();
}

// goHistory definida em ui.js

// ── HELPER CACHEADO ──
function getTotalUsed() {
  return Object.values(queryCounters).reduce((a,b)=>a+b,0);
}

function getResetStr() {
  const now  = new Date();
  const meia = new Date(now); meia.setHours(24,0,0,0);
  const diff = meia - now;
  const hh   = Math.floor(diff / 3600000);
  const mm   = Math.floor((diff % 3600000) / 60000);
  return hh > 0 ? `${hh}h ${mm}min` : `${mm}min`;
}

// retorna quantas consultas realmente restam no módulo:
// min(limite_do_módulo, total_restante_na_conta)
function getModLeft(mod) {
  const plan   = currentUser?.plan || 'basico';
  const limits = PLAN_LIMITS[plan];
  const lim    = limits[mod];
  if (lim === -1 || lim === undefined) return Infinity;
  if (lim === 0) return 0;
  const used      = queryCounters[mod] || 0;
  const modLeft   = Math.max(0, lim - used);
  if (limits.total === -1) return modLeft;
  const totalLeft = Math.max(0, limits.total - getTotalUsed());
  return Math.min(modLeft, totalLeft);
}

// retorna objeto rico: { ok, reason, left, modUsed, totalLeft }
function canQuery(mod) {
  const plan   = currentUser?.plan || 'basico';
  const limits = PLAN_LIMITS[plan];
  if (!limits) return { ok: true };

  if (mod === 'cpfpro' && limits.cpfpro === 0) {
    return canUseCredits('cpfpro')
      ? { ok: false, reason: 'credits-only' }
      : { ok: false, reason: 'upgrade' };
  }
  const lim = limits[mod];
  if (lim === -1) return { ok: true };
  if (lim === 0)  return { ok: false, reason: 'upgrade' };

  const modUsed   = queryCounters[mod] || 0;
  const totalUsed = getTotalUsed();
  const totalLeft = limits.total === -1 ? Infinity : Math.max(0, limits.total - totalUsed);
  const modLeft   = Math.max(0, lim - modUsed);
  const left      = Math.min(modLeft, totalLeft);

  if (left <= 0) {
    const reason = modUsed >= lim ? 'mod_limit' : 'total_limit';
    return { ok: false, reason, left: 0, modUsed, totalLeft };
  }
  return { ok: true, left, modUsed, totalLeft };
}

function incrementCounter(mod) {
  queryCounters[mod] = (queryCounters[mod] || 0) + 1;
  if (currentUser?.email) {
    saveDailyCounters(currentUser.email, queryCounters, currentUser.plan);
    // contador vitalício — base pra personalização do hero
    const key = `ghost_ever_${currentUser.email}`;
    LS.set(key, (LS.get(key) || 0) + 1);
  }
  updateBalloon();
}

function getLifetimeQueries() {
  if (!currentUser?.email || currentUser.anon) return 0;
  return LS.get(`ghost_ever_${currentUser.email}`) || 0;
}

// ── HERO PERSONALIZADO ──
function getHeroContent() {
  const total      = getLifetimeQueries();
  const rawName    = currentUser?.name?.split(' ')[0] || '';
  const isLoggedIn = currentUser && !currentUser.anon;

  const seed  = parseInt(new Date().toISOString().slice(0,10).replace(/-/g,''));
  const pick  = (arr) => arr[seed % arr.length];
  const pick2 = (arr) => arr[(seed + 7) % arr.length];

  const h = new Date().getHours();
  const period =
    h >= 5  && h < 12 ? 'manha'    :
    h >= 12 && h < 15 ? 'dia'      :
    h >= 15 && h < 19 ? 'tarde'    :
    h >= 19            ? 'noite'   : 'madrugada';

  const greetMap = {
    manha:    ['Bom dia,',       'Manhã boa,',        'Começando bem,'],
    dia:      ['Boa tarde,',     'E aí,',             'Olá,'],
    tarde:    ['Boa tarde,',     'Boa tarde mesmo,',  'E então,'],
    noite:    ['Boa noite,',     'Boa noite mesmo,',  'Noite,'],
    madrugada:['Ainda acordado?','Hora estranha dessa,','Noite longa,'],
  };
  const greeting = pick(greetMap[period]);

  // admin pode sinalizar nome estranho via LS flag
  const nameFlag = currentUser?.email ? LS.get(`ghost_nameflag_${currentUser.email}`) : null;
  const useName  = isLoggedIn && rawName.length >= 3 && !nameFlag;
  const name     = useName ? rawName : '';

  if (!isLoggedIn || total < 3) {
    return {
      title: `<span class="gt">Consulte dados</span><br><span style="color:var(--fg)">de qualquer pessoa</span>`,
      sub: 'Aqui tem consulta de CPF, CNPJ,<br>telefone e muito mais!',
    };
  }

  if (total < 10) {
    const titles = name ? [
      [greeting,              name],
      ['Olá,',               name],
      ['Bem-vindo de volta,', name],
    ] : [
      ['Olá', 'por onde começar?'],
      ['Pronto para usar', ''],
      ['Bem-vindo de volta', ''],
    ];
    const subs = [
      'Por onde quer começar?',
      'O que vamos consultar hoje?',
      'Tudo pronto para você.',
      'Seus dados, na hora que precisar.',
    ];
    const t = pick(titles);
    return { title: `<span class="gt">${t[0]}</span><br><span style="color:var(--fg)">${t[1]}</span>`, sub: pick2(subs) };
  }

  if (total < 30) {
    const titles = name ? [
      ['De volta,',    `${name}?`],
      [greeting,       name],
      ['Aqui de novo,',name],
      ['Que bom,',     name],
    ] : [
      ['De volta', ''],
      ['Sempre por aqui', ''],
      ['Tudo pronto', ''],
    ];
    const subs = [
      'O que precisamos hoje?',
      `${total} consultas realizadas.`,
      'Sempre bom ter você por aqui.',
      'O que vamos descobrir hoje?',
      'Seus dados quando quiser.',
    ];
    const t = pick(titles);
    return { title: `<span class="gt">${t[0]}</span><br><span style="color:var(--fg)">${t[1]}</span>`, sub: pick2(subs) };
  }

  const titles = name ? [
    [greeting,       name],
    ['Pronto,',      `${name}?`],
    ['Que bom,',     name],
    ['E então,',     `${name}?`],
    ['Tudo certo,',  `${name}?`],
  ] : [
    ['Bem-vindo de volta', ''],
    ['Tudo por aqui', ''],
    ['Quando quiser', ''],
  ];
  const subs = [
    `${total} consultas realizadas.`,
    period === 'madrugada' ? 'Noite produtiva, hein.' :
    period === 'manha'     ? 'Começando o dia com tudo.' :
    period === 'noite'     ? 'Noite de consultas.' : 'Tudo pronto quando precisar.',
    'Usuário de longa data.',
    'Seus dados, sempre aqui.',
    'Sempre que precisar, aqui estamos.',
  ];
  const t = pick(titles);
  return { title: `<span class="gt">${t[0]}</span><br><span style="color:var(--fg)">${t[1]}</span>`, sub: pick2(subs) };
}

function applyHeroContent() {
  const badgeEl = document.getElementById('heroBadge');
  if (!badgeEl) return;
  const isLoggedIn = currentUser && !currentUser.anon;
  if (isLoggedIn && currentUser.plan) {
    const planLabels = { basico:'Básico', starter:'Starter', pro:'Pro', premium:'Premium' };
    const label = planLabels[currentUser.plan] || currentUser.plan;
    badgeEl.innerHTML = `<span class="hero-badge-dot"></span>Plano ${label} ativo`;
  } else {
    badgeEl.innerHTML = '<span class="hero-badge-dot"></span>Sem cadastro obrigatório';
  }
}

// ── CUPONS ──
const PLAN_COUPONS = {
  'BEMVINDO': { type:'welcome_discount' },
  'GHOST':   { type:'ghost' },
  'DOUBLE':  { type:'double' },
  'GHOST2':  { type:'ghost2' },
  'CREDITS': { type:'credits', amount: 50 },
  'C10':     { type:'credits', amount: Math.round(10  * (10/2.70)) },
  'C50':     { type:'credits', amount: Math.round(50  * (10/2.70)) },
  'C100':    { type:'credits', amount: Math.round(100 * (10/2.70)) },
  'BURN':    { type:'burn' },
  'RESET':   { type:'reset' },
  'H3':     { type:'hero3' },
  'H10':    { type:'hero10' },
  'H30':    { type:'hero30' },
};

function redeemCoupon() {
  const input = document.getElementById('couponInput');
  const msg   = document.getElementById('couponMsg');
  const code  = input.value.trim().toUpperCase();
  if (!code) return;
  msg.className = 'coupon-msg';
  setTimeout(() => {
    const coupon = PLAN_COUPONS[code];
    if (!coupon) {
      msg.className = 'coupon-msg error';
      msg.textContent = '✕ Cupom inválido ou expirado.';
      input.classList.add('shake-inp');
      setTimeout(() => input.classList.remove('shake-inp'), 500);
      return;
    }
    if (coupon.plan) {
      msg.className = 'coupon-msg error';
      msg.textContent = '✕ Cupom inválido ou expirado.';
      return;
    } else if (coupon.type === 'credits') {
      const userEmail = currentUser?.email;
      if (!userEmail) {
        msg.className = 'coupon-msg error';
        msg.textContent = '✕ Erro ao identificar usuário.';
        return;
      }
      addCredits(userEmail, coupon.amount || 10);
      updateCreditsBalloon();
      msg.className = 'coupon-msg success';
      msg.textContent = `✓ ${fmtBrl(creditsToReal(coupon.amount || 10))} em créditos adicionados!`;
      input.classList.add('applied');
      input.value = '';
      setTimeout(() => input.classList.remove('applied'), 700);
      setTimeout(() => { msg.className = 'coupon-msg'; msg.textContent = ''; }, 4000);
    } else if (coupon.type === 'burn') {
      const plan   = currentUser?.plan || 'basico';
      const limits = PLAN_LIMITS[plan];
      const LEAVE  = 5;
      Object.entries(limits).forEach(([mod, lim]) => {
        if (typeof lim === 'number' && lim > LEAVE && lim !== -1 && lim !== -1 && mod !== 'label' && mod !== 'total') {
          queryCounters[mod] = lim - LEAVE; // gasta até sobrar 5
        }
      });
      if (currentUser?.email) saveDailyCounters(currentUser.email, queryCounters, plan);
      updateBalloon(); updateModulesBanner();
      msg.className = 'coupon-msg success';
      msg.textContent = '✓ Consultas queimadas — restam 5 em cada módulo.';
      input.value = '';
      setTimeout(() => { msg.className = 'coupon-msg'; msg.textContent = ''; }, 4000);
    } else if (coupon.type === 'reset') {
      const email = currentUser?.email;
      if (!email) { msg.className='coupon-msg error'; msg.textContent='✕ Faça login primeiro.'; return; }
      Object.keys(queryCounters).forEach(k => queryCounters[k] = 0);
      saveDailyCounters(email, queryCounters, currentUser.plan);
      LS.del(`ghost_ever_${email}`);
      LS.del(`ghost_tq_sync_${email}`);
      LS.del('ghost_total_queries');
      updateBalloon(); updateModulesBanner(); applyHeroContent();
      msg.className = 'coupon-msg success';
      msg.textContent = '✓ Tudo zerado — como se fosse o primeiro acesso.';
      input.value = '';
      setTimeout(() => { msg.className = 'coupon-msg'; msg.textContent = ''; }, 4000);
    } else if (coupon.type === 'hero3' || coupon.type === 'hero10' || coupon.type === 'hero30') {
      const email = currentUser?.email;
      if (!email) { msg.className='coupon-msg error'; msg.textContent='✕ Faça login primeiro.'; return; }
      const n = coupon.type === 'hero3' ? 3 : coupon.type === 'hero10' ? 10 : 30;
      LS.set(`ghost_ever_${email}`, n);
      applyHeroContent();
      msg.className = 'coupon-msg success';
      msg.textContent = `✓ Hero na fase ${n}.`;
      input.value = '';
      setTimeout(() => { msg.className = 'coupon-msg'; msg.textContent = ''; }, 3000);
    } else {
      activeCoupons.add(coupon.type);
      msg.className = 'coupon-msg success';
      msg.textContent = '✓ Modo Double ativo — resultados mockados + duplicados.';
      input.classList.add('applied');
      input.value = '';
      setTimeout(() => input.classList.remove('applied'), 700);
      setTimeout(() => { msg.className = 'coupon-msg'; msg.textContent = ''; }, 4000);
    }
  }, 350);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement?.id === 'couponInput') redeemCoupon();
});


// ── BANNER FLUTUANTE DE DESCONTO POR CADASTRO ──
var _discBannerTimer = null;

function initDiscountBanner() {
  if (currentUser && !currentUser.anon) return;
  var banner = document.getElementById('discountBanner');
  if (!banner) return;
  clearTimeout(_discBannerTimer);

  function showBanner() {
    if (currentUser && !currentUser.anon) { stopDiscountBanner(); return; }
    banner.classList.add('visible');
    _discBannerTimer = setTimeout(hideBanner, 7000);
  }
  function hideBanner() {
    banner.classList.remove('visible');
    _discBannerTimer = setTimeout(showBanner, 3000);
  }

  _discBannerTimer = setTimeout(showBanner, 1800);
}

function stopDiscountBanner() {
  clearTimeout(_discBannerTimer);
  var banner = document.getElementById('discountBanner');
  if (banner) banner.classList.remove('visible');
}

// ── FADE-IN AO ENTRAR/SAIR DA VIEWPORT ──
(function() {
  if (!window.IntersectionObserver) return;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
      } else {
        entry.target.classList.remove('in-view');
      }
    });
  }, { threshold: 0.15 });
  function observeScrollFade() {
    var els = document.querySelectorAll('.scroll-fade');
    els.forEach(function(el) { observer.observe(el); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeScrollFade);
  } else {
    observeScrollFade();
  }
})();