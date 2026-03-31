// GHOST BUSCA — Core (Auth, UI, Store, Wallet, Settings, History, Chat)

// ── ESTADO DO USUÁRIO ──
let currentUser = null; // { name, email, plan }
let queryCounters = {}; // { cpf: 3, nome: 1, ... }
let activeCoupon = null;

// ── AUTH & CONTA — Supabase ──

// ── helpers de storage local (apenas para preferências leves) ──
const LS = {
  get:  k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set:  (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del:  k => { try { localStorage.removeItem(k); } catch {} },
};

// ── sessão: email salvo em localStorage como referência ──
function getSession()        { return LS.get('ghost_session'); }
function saveSession(email)  { LS.set('ghost_session', { email }); }
function clearSession()      { LS.del('ghost_session'); }

// ── contadores diários — 100% Supabase ──
function todayStr() { return new Date().toISOString().slice(0,10); }

async function getDailyCounters(email, plan) {
  try {
    const row = await sbGetOne('daily_counters',
      `user_key=eq.${encodeURIComponent(email)}&plan=eq.${plan || 'basico'}&date=eq.${todayStr()}`);
    return row?.counters || {};
  } catch { return {}; }
}

async function saveDailyCounters(email, counters, plan) {
  try {
    await sbUpsert('daily_counters',
      { user_key: email, plan: plan || currentUser?.plan || 'basico', date: todayStr(), counters },
      'user_key,plan,date');
  } catch {}
}

// ── SISTEMA ANÔNIMO ──
function getOrCreateAnonId() {
  let id = LS.get('ghost_anon_id');
  if (!id) { id = 'anon_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36); LS.set('ghost_anon_id', id); }
  return id;
}
function initAnon() {
  queryCounters = {};
  currentUser = { name: 'Visitante', email: getOrCreateAnonId(), plan: 'basico', anon: true };
}
function _persistCountersAnon() {}

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

  if (total === 999) {
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
  const tip  = document.getElementById('qbTooltip');
  const btn  = document.getElementById('qbInfoBtn');
  if (tip.classList.contains('on')) { tip.classList.remove('on'); return; }

  const plan   = currentUser?.plan || 'basico';
  const limits = PLAN_LIMITS[plan];
  const total  = limits.total;
  const usedN  = Object.values(queryCounters).reduce((a,b)=>a+b,0);
  const leftN  = total === 999 ? '∞' : Math.max(0, total - usedN);

  
  const now  = new Date();
  const meia = new Date(now); meia.setHours(24,0,0,0);
  const diff = meia - now;
  const hh   = Math.floor(diff / 3600000);
  const mm   = Math.floor((diff % 3600000) / 60000);
  const resetStr = hh > 0 ? `${hh}h ${mm}min` : `${mm}min`;

  tip.innerHTML = `<strong>${leftN} consultas restantes</strong><br>Plano <strong>${limits.label}</strong> · ${total === 999 ? 'Ilimitado' : total + ' por dia'}<br><span style="color:var(--p3)">↺ Reseta em ${resetStr}</span>`;

  
  const r = btn.getBoundingClientRect();
  tip.style.top  = (r.bottom + 8) + 'px';
  tip.style.left = Math.min(r.left, window.innerWidth - 240) + 'px';
  tip.classList.add('on');

  
  setTimeout(() => {
    const close = ev => { tip.classList.remove('on'); document.removeEventListener('click', close); };
    document.addEventListener('click', close);
  }, 10);
}

// ── ANIMAÇÃO DE UPGRADE ──
const PLAN_COLORS = {
  basico:  { grad:'linear-gradient(135deg,#22c55e,#16a34a)', glow:'rgba(34,197,94,.5)',  label:'Básico'  },
  starter: { grad:'linear-gradient(135deg,#a855f7,#7c3aed)', glow:'rgba(168,85,247,.5)', label:'Starter' },
  pro:     { grad:'linear-gradient(135deg,#a855f7,#c026d3)', glow:'rgba(192,38,211,.5)', label:'Pro'     },
  premium: { grad:'linear-gradient(135deg,#f472b6,#c026d3)', glow:'rgba(244,114,182,.5)',label:'Premium' },
};

function playUpgradeAnimation(oldPlan, newPlan, onDone) {
  const overlay  = document.getElementById('upgrade-overlay');
  const cardOld  = document.getElementById('upgCardOld');
  const cardNew  = document.getElementById('upgCardNew');
  const particles= document.getElementById('upgParticles');
  const label    = document.getElementById('upgLabel');
  const canvas   = document.getElementById('upg-canvas');
  const ctx      = canvas.getContext('2d');

  const oldC = PLAN_COLORS[oldPlan] || PLAN_COLORS.basico;
  const newC = PLAN_COLORS[newPlan] || PLAN_COLORS.premium;

  
  cardOld.innerHTML = `<div class="upg-card-plan" style="color:var(--muted)">Seu plano atual</div><div class="upg-card-name">${oldC.label}</div><div class="upg-card-sub">mudando agora...</div>`;
  cardOld.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:180px;padding:22px 20px;border-radius:1rem;text-align:center;border:1px solid rgba(255,255,255,.12);background:#0d0d1e;`;

  cardNew.innerHTML = `<div class="upg-card-plan" style="background:${newC.grad};-webkit-background-clip:text;background-clip:text;color:transparent">Novo plano</div><div class="upg-card-name">${newC.label}</div><div class="upg-card-sub">desbloqueado!</div>`;
  cardNew.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(.4) rotate(-8deg);width:180px;padding:22px 20px;border-radius:1rem;text-align:center;border:1px solid rgba(255,255,255,.18);background:#0d0d1e;opacity:0;box-shadow:0 0 40px ${newC.glow};`;

  label.innerHTML = '';
  particles.innerHTML = '';

  
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  
  overlay.style.animation = 'upgradeOverlayIn .3s ease both';
  overlay.style.opacity = '1';
  overlay.classList.add('on');

  // FASE 1: tremor (0–1.4s)
  cardOld.style.animation = 'planShake 1.3s ease both';

  // FASE 2: flash + explosão (1.0s)
  setTimeout(() => {
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 80);
    cardOld.style.animation = 'planExplode .45s ease forwards';
    const colors = ['#a855f7','#f472b6','#c026d3','#fff','#e879f9','#fbbf24','#38bdf8','#4ade80'];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('div');
      p.className = 'upg-particle';
      const angle = (i / 40) * Math.PI * 2;
      const dist  = 70 + Math.random() * 150;
      p.style.cssText = `background:${colors[i%colors.length]};--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;width:${3+Math.random()*7}px;height:${3+Math.random()*7}px;animation:particleFly ${.5+Math.random()*.5}s ease-out ${Math.random()*.1}s both`;
      particles.appendChild(p);
    }
    const cx = canvas.width/2, cy = canvas.height/2;
    const crackLines = Array.from({length:10},(_,i)=>{
      const a = (i/10)*Math.PI*2 + Math.random()*.3;
      return { x1:cx, y1:cy, x2:cx+Math.cos(a)*(100+Math.random()*100), y2:cy+Math.sin(a)*(100+Math.random()*100) };
    });
    let cAlpha = 1;
    const drawCracks = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.save(); ctx.globalAlpha = cAlpha;
      crackLines.forEach(l => {
        ctx.beginPath(); ctx.moveTo(l.x1,l.y1); ctx.lineTo(l.x2,l.y2);
        ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();
      });
      ctx.restore();
      cAlpha -= .07;
      if (cAlpha > 0) requestAnimationFrame(drawCracks);
      else ctx.clearRect(0,0,canvas.width,canvas.height);
    };
    drawCracks();
  }, 1000);

  // FASE 3: novo card emerge (1.45s)
  setTimeout(() => {
    cardOld.style.display = 'none';
    cardNew.style.opacity = '1';
    cardNew.style.animation = 'planEmerge .6s cubic-bezier(.34,1.56,.64,1) forwards';
    setTimeout(() => { cardNew.style.animation += ',planGlowPulse 1s ease 2'; }, 600);
    label.innerHTML = `<strong>${newC.label} ativo!</strong>Bem-vindo ao próximo nível`;
    label.style.animation = 'hFade .4s ease both';
  }, 1450);

  // FASE 4: fecha (3.2s)
  setTimeout(() => {
    overlay.style.animation = 'upgradeOverlayOut .35s ease forwards';
    setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.classList.remove('on');
      cardOld.style.display = '';
      cardNew.style.opacity = '0';
      cardNew.style.animation = '';
      cardOld.style.animation = '';
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if (onDone) onDone();
    }, 350);
  }, 3200);
}

// ── ANIMAÇÃO DE DOWNGRADE ──
function playDowngradeAnimation(oldPlan, newPlan, onDone) {
  const overlay = document.getElementById('upgrade-overlay');
  const cardOld = document.getElementById('upgCardOld');
  const cardNew = document.getElementById('upgCardNew');
  const label   = document.getElementById('upgLabel');
  const canvas  = document.getElementById('upg-canvas');
  const ctx     = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const oldC = PLAN_COLORS[oldPlan] || PLAN_COLORS.premium;
  const newC = PLAN_COLORS[newPlan] || PLAN_COLORS.basico;

  cardOld.innerHTML = `<div class="upg-card-plan" style="color:var(--muted)">Plano atual</div><div class="upg-card-name" style="background:${oldC.grad};-webkit-background-clip:text;background-clip:text;color:transparent">${oldC.label}</div>`;
  cardOld.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:180px;padding:22px 20px;border-radius:1rem;text-align:center;border:1px solid rgba(255,255,255,.12);background:#0d0d1e;`;
  cardNew.innerHTML = `<div class="upg-card-plan" style="color:var(--muted)">Novo plano</div><div class="upg-card-name">${newC.label}</div>`;
  cardNew.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:160px;padding:18px 16px;border-radius:1rem;text-align:center;border:1px solid rgba(255,255,255,.1);background:#0d0d1e;opacity:0;`;
  label.innerHTML = '';

  overlay.style.animation = 'upgradeOverlayIn .25s ease both';
  overlay.style.opacity   = '1';
  overlay.classList.add('on');

  
  setTimeout(() => { cardOld.style.transition = 'opacity .5s ease, transform .5s ease'; cardOld.style.opacity = '0'; cardOld.style.transform = 'translate(-50%,-50%) scale(.85)'; }, 300);

  
  setTimeout(() => {
    cardNew.style.opacity = '1';
    cardNew.style.transition = 'opacity .4s ease';
    label.innerHTML = `<strong>${newC.label}</strong>Plano alterado`;
    label.style.animation = 'hFade .4s ease both';
  }, 900);

  
  setTimeout(() => {
    overlay.style.animation = 'upgradeOverlayOut .3s ease forwards';
    setTimeout(() => {
      overlay.style.opacity = '0'; overlay.classList.remove('on');
      cardOld.style.cssText = ''; cardNew.style.cssText = '';
      cardOld.style.opacity = ''; cardOld.style.transition = '';
      if (onDone) onDone();
    }, 300);
  }, 2200);
}

// ── SISTEMA DE CRÉDITOS ──

// custo em créditos por módulo (10 créditos = R$2,70)
const MOD_CREDITS = {
  cpf:       0.7,
  nome:      0.7,
  cnpj:      0.7,
  email:     1,
  telefone:  1,
  cep:       0,
  ip:        0,
  whois:     0,
  placa:     1.5,
  cnh:       2,
  familiares:2.7,
  cpfpro:    6.3,
  foto:      9.26,
  pix:       0.7,
  cns:       1,
  renavam:   1.5,
};
const CREDITS_PER_BRL = 10 / 2.70; // créditos por real
const BRL_PER_CREDIT  = 2.70 / 10; // reais por crédito

// desconto progressivo por valor em reais
const CREDIT_DISCOUNTS = [
  { minBrl: 27.00, pct: 20, label: '20% OFF' },
  { minBrl: 13.50, pct: 15, label: '15% OFF' },
  { minBrl:  8.10, pct: 10, label: '10% OFF' },
  { minBrl:  2.70, pct:  0, label: ''         },
];

function getCredits(email) {
  if (!email) return 0;
  if (currentUser && currentUser.email === email && typeof currentUser._credits === 'number') return currentUser._credits;
  return 0;
}
function setCredits(email, val) {
  if (!email) return;
  const v = Math.max(0, Math.round(val * 100) / 100);
  if (currentUser && currentUser.email === email) currentUser._credits = v;
  sbPatch('users', `email=eq.${encodeURIComponent(email)}`, { credits: v }).catch(()=>{});
}
function addCredits(email, val) {
  setCredits(email, getCredits(email) + val);
}
function deductCredits(email, val) {
  setCredits(email, getCredits(email) - val);
}

function creditsToReal(c) { return c * BRL_PER_CREDIT; }
function realToCredits(r) { return r * CREDITS_PER_BRL; }
function fmtBrl(v)        { return 'R$' + v.toFixed(2).replace('.', ','); }

function getDiscount(brl) {
  return CREDIT_DISCOUNTS.find(d => brl >= d.minBrl) || CREDIT_DISCOUNTS[CREDIT_DISCOUNTS.length - 1];
}

// ── CARTEIRA DIGITAL ──
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
    // converte base64 para Blob
    const res  = await fetch(base64OrBlob);
    const blob = await res.blob();
    url = await sbUploadAvatar(email, blob);
  }
  if (url) {
    await sbPatch('users', `email=eq.${encodeURIComponent(email)}`, { avatar_url: url });
    if (currentUser && currentUser.email === email) currentUser.avatar_url = url;
    // avatar salvo no banco via sbPatch acima
  } else {
    // sem URL do storage, avatar não salvo
  }
}

function goWallet() {
  if (!currentUser || currentUser.anon) {
    openModal('modal-register'); return;
  }
  pushNav('wallet');
  showPage('wallet');
  renderWallet();
}

function extractDominantColor(imgEl, cb) {
  // usa canvas pra extrair cor média da foto
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 20;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, 20, 20);
    const d = ctx.getImageData(0, 0, 20, 20).data;
    let r=0,g=0,b=0,n=0;
    for(let i=0;i<d.length;i+=4){
      // ignora pixels muito escuros ou muito claros
      const br = (d[i]+d[i+1]+d[i+2])/3;
      if(br < 40 || br > 220) continue;
      r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++;
    }
    if(n===0){ cb(null); return; }
    r=Math.round(r/n); g=Math.round(g/n); b=Math.round(b/n);
    // amplifica a cor dominante: aumenta contraste entre canais (saturação)
    const avg = (r+g+b)/3;
    const boost = 1.8;
    r = Math.min(255, Math.round(avg + (r - avg) * boost));
    g = Math.min(255, Math.round(avg + (g - avg) * boost));
    b = Math.min(255, Math.round(avg + (b - avg) * boost));
    // garante brilho mínimo
    const min = 90;
    r=Math.max(r,min); g=Math.max(g,min); b=Math.max(b,min);
    cb(`rgb(${r},${g},${b})`);
  } catch(e){ cb(null); }
}

function applyAvatarColors(container, imgSrc) {
  if (!imgSrc) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    extractDominantColor(img, color => {
      if (!color) return;
      // cria gradiente animado com a cor extraída + variações
      const ring = container.querySelector('.wallet-avatar,.settings-avatar');
      const nameEl = container.querySelector('.wallet-name');
      if (ring) {
        ring.style.border = `2.5px solid transparent`;
        ring.style.backgroundImage = `linear-gradient(#09091a,#09091a),linear-gradient(135deg,${color},${color} 30%,#a855f7 60%,${color})`;
        ring.style.backgroundOrigin = 'border-box';
        ring.style.backgroundClip = 'padding-box,border-box';
        ring.style.animation = 'gradAni 3s linear infinite';
        ring.style.backgroundSize = '200% 200%';
      }
      if (nameEl) {
        nameEl.style.backgroundImage = `linear-gradient(90deg,${color},#a855f7,${color})`;
        nameEl.style.backgroundSize = '300% 100%';
        nameEl.style.webkitBackgroundClip = 'text';
        nameEl.style.backgroundClip = 'text';
        nameEl.style.color = 'transparent';
        nameEl.style.animation = 'gradAni 3s linear infinite';
      }
    });
  };
  img.src = imgSrc;
}

const PLAN_BADGE_COLORS = {
  basico:  { bg:'rgba(74,222,128,.08)',  color:'#4ade80', border:'rgba(74,222,128,.22)' },
  starter: { bg:'rgba(168,85,247,.1)',   color:'#c084fc', border:'rgba(168,85,247,.28)' },
  pro:     { bg:'rgba(192,38,211,.1)',   color:'#e879f9', border:'rgba(192,38,211,.28)' },
  premium: { bg:'rgba(244,114,182,.1)',  color:'#f472b6', border:'rgba(244,114,182,.28)' },
};

function renderWallet() {
  const el = document.getElementById('walletContent');
  if (!el) return;
  const email   = currentUser.email;
  const credits = getCredits(email);
  const brl     = creditsToReal(credits).toFixed(2).replace('.', ',');
  const avatar  = getUserAvatar(email);
  const limits  = PLAN_LIMITS[currentUser.plan];
  const pc      = PLAN_BADGE_COLORS[currentUser.plan] || PLAN_BADGE_COLORS.basico;
  const avatarHtml = avatar
    ? `<img src="${avatar}" alt="avatar">`
    : `<span>${currentUser.name[0].toUpperCase()}</span>`;

  if (credits > 0) {
    el.innerHTML = `
      <div class="wallet-profile">
        <div class="wallet-avatar" id="walletAvatar">${avatarHtml}</div>
        <div class="wallet-name" id="walletName">${currentUser.name}</div>
        <div class="wallet-plan" style="color:${pc.color}">${limits.label}</div>
        <div class="wallet-balance">
          <div class="wallet-balance-label">Saldo disponível</div>
          <div class="wallet-balance-val">${brl}</div>
          <div class="wallet-balance-sub">${credits} crédito${credits!==1?"s":""}</div>
        </div>
        <button class="wallet-buy-btn" onclick="goCredits(null)">
          <svg width="10" height="12" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;display:inline-block;vertical-align:middle"><path d="M16 3L5 3C2.5 3 1 5 1 7C1 9 2.5 11 5 11L15 11C17.5 11 19 13 19 15C19 17 17.5 19 15 19L4 19" stroke="#fff" stroke-width="3" stroke-linecap="square" fill="none"/></svg>
          Comprar mais créditos
        </button>
        <button onclick="goCreditsInfo(null,true)" style="margin-top:10px;font-size:.78rem;font-weight:600;color:rgba(255,255,255,.7);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.18);padding:8px 22px;border-radius:99px;transition:all .2s" onmouseover="this.style.color='#fff';this.style.borderColor='rgba(255,255,255,.3)'" onmouseout="this.style.color='rgba(255,255,255,.7)';this.style.borderColor='rgba(255,255,255,.18)'">Conhecer créditos</button>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="wallet-profile">
        <div class="wallet-avatar" id="walletAvatar">${avatarHtml}</div>
        <div class="wallet-name" id="walletName">${currentUser.name}</div>
        <div class="wallet-plan" style="color:${pc.color}">${limits.label}</div>
        <div class="wallet-balance">
          <div class="wallet-balance-label">Saldo disponível</div>
          <div class="wallet-balance-val" style="color:var(--muted);font-size:1.8rem">0,00</div>
        </div>
        <button class="wallet-buy-btn" onclick="goCredits(null)">
          <svg width="10" height="12" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;display:inline-block;vertical-align:middle"><path d="M16 3L5 3C2.5 3 1 5 1 7C1 9 2.5 11 5 11L15 11C17.5 11 19 13 19 15C19 17 17.5 19 15 19L4 19" stroke="#fff" stroke-width="3" stroke-linecap="square" fill="none"/></svg>
          Comprar créditos
        </button>
        <button onclick="goCreditsInfo(null,true)" style="margin-top:10px;font-size:.78rem;font-weight:600;color:rgba(255,255,255,.7);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.18);padding:8px 22px;border-radius:99px;transition:all .2s" onmouseover="this.style.color='#fff';this.style.borderColor='rgba(255,255,255,.3)'" onmouseout="this.style.color='rgba(255,255,255,.7)';this.style.borderColor='rgba(255,255,255,.18)'">Conhecer créditos</button>
      </div>`;
  }

  // aplica cores da foto se tiver avatar
  if (avatar) {
    const container = el;
    applyAvatarColors(container, avatar);
  }
}

function triggerAvatarUpload() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = async () => {
        const MAX = 400;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.88);
        const avatarEl = document.querySelector('.settings-avatar');
        if (avatarEl) { avatarEl.classList.remove('avatar-swapping'); void avatarEl.offsetWidth; avatarEl.classList.add('avatar-swapping'); setTimeout(()=>avatarEl.classList.remove('avatar-swapping'),500); }
        await setUserAvatar(currentUser.email, compressed);
        updateNavUser();
        renderSettings();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}

function removeAvatar() {
  if (currentUser?.email) {
    const avatarEl = document.querySelector('.settings-avatar');
    if (avatarEl) { avatarEl.classList.remove('avatar-swapping'); void avatarEl.offsetWidth; avatarEl.classList.add('avatar-swapping'); }
    setTimeout(async () => {
      if (currentUser) currentUser.avatar_url = null;
      if (currentUser) currentUser.avatar_url = null;
      await sbPatch('users', `email=eq.${encodeURIComponent(currentUser.email)}`, { avatar_url: null });
      updateNavUser(); renderSettings();
    }, 220);
  }
}
let _creditsInfoMod = null;
let _creditsInfoFromWallet = false;
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

function goCredits(mod) {
  _creditsTargetMod = mod || 'cpf'; // padrão: CPF
  const m       = _creditsTargetMod;
  const modName = MODS[m]?.name || m;
  const cost    = MOD_CREDITS[m] || 0.7;

  _creditsQty = 1;

  document.getElementById('creditsModName').textContent = `Compra avulsa — ${modName}`;

  const hint = cost > 0
    ? `1 consulta de ${modName} = ${cost} crédito${cost !== 1 ? 's' : ''} (${fmtBrl(creditsToReal(cost))})`
    : `${modName} é gratuito`;
  document.getElementById('creditsCostHint').textContent = hint;

  // presets
  const presetsWrap = document.getElementById('creditsPresets');
  presetsWrap.innerHTML = '';
  [1, 5, 10, 20].forEach(n => {
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
  _creditsQty = Math.max(0.5, Math.min(100, Math.round((_creditsQty + delta * 0.5) * 2) / 2));
  renderCreditsSummary();
  updatePresetsUI();
}

function updatePresetsUI() {
  document.getElementById('creditsQtyNum').textContent = _creditsQty;
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

  document.getElementById('creditsQtyNum').textContent = _creditsQty;

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

function buyCreditsNow() {
  const cost      = _creditsTargetMod ? (MOD_CREDITS[_creditsTargetMod] || 1) : 1;
  const totalCred = Math.round(cost * _creditsQty * 100) / 100;
  const brlBase   = creditsToReal(totalCred);
  const disc      = getDiscount(brlBase);
  const brlFinal  = brlBase * (1 - disc.pct / 100);

  const btn = document.getElementById('creditsBuyBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .6s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Aguardando pagamento...`;

  // TODO: integrar com gateway (Mercado Pago, Stripe, etc.)
  // Por enquanto simula confirmação após 1.5s (modo demo)
  setTimeout(() => {
    const email = currentUser?.email;
    if (email) {
      addCredits(email, totalCred);
      updateCreditsBalloon();
      histAdd({ type:'credito', name:`${totalCred} créditos adicionados`, value: brlFinal.toFixed(2), free: false });
    }
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Créditos adicionados!`;
    btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
    setTimeout(() => {
      btn.innerHTML = orig; btn.disabled = false; btn.style.background = '';
      goBack();
      updateCreditsBalloon();
      if (_creditsTargetMod) updateMiniBalloon(_creditsTargetMod);
    }, 1200);
  }, 1500);
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
  faq.classList.toggle('open');
  if (faq.classList.contains('open')) {
    // max-height dinâmico: evita cortar conteúdo se FAQ crescer
    if (panel) panel.style.maxHeight = panel.scrollHeight + 'px';
    setTimeout(() => faq.scrollIntoView({behavior:'smooth', block:'nearest'}), 60);
  } else {
    if (panel) panel.style.maxHeight = '';
  }
}

function toggleFaq(el) {
  const isOpen = el.classList.contains('open');
  // fecha todos os outros e reseta max-height
  document.querySelectorAll('.faq-item.open').forEach(i => {
    i.classList.remove('open');
    const a = i.querySelector('.faq-a');
    if (a) a.style.maxHeight = '';
  });
  if (!isOpen) {
    el.classList.add('open');
    // altura dinâmica: evita corte se o texto crescer
    const a = el.querySelector('.faq-a');
    if (a) a.style.maxHeight = a.scrollHeight + 'px';
    // recalcula painel pai pra acomodar item aberto
    const panel = el.closest('.faq-panel');
    if (panel) panel.style.maxHeight = panel.scrollHeight + a.scrollHeight + 'px';
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
  ip:        {name:'IP',           bg:'rgba(168,85,247,.1)',  sub:'Digite o IP', ph:'8.8.8.8'},
  whois:     {name:'WHOIS',        bg:'rgba(168,85,247,.1)',  sub:'Digite o domínio', ph:'exemplo.com'},
  nome:      {name:'Nome',         bg:'rgba(168,85,247,.1)',  sub:'Digite o nome completo', ph:'João Silva'},
  familiares:{name:'Família',      bg:'rgba(168,85,247,.1)', sub:'Digite o CPF ou nome', ph:'CPF ou Nome'},
  telefone:  {name:'Telefone',     bg:'rgba(168,85,247,.1)',  sub:'Digite o telefone', ph:'(11) 99999-9999'},
  email:     {name:'E-mail',       bg:'rgba(168,85,247,.1)',  sub:'Digite o e-mail', ph:'exemplo@email.com'},
  foto:      {name:'Foto Nacional',bg:'rgba(232,121,160,.1)', sub:'CPF ou nome completo', ph:'CPF ou Nome'},
  placa:     {name:'Placa',        bg:'rgba(168,85,247,.1)',  sub:'Digite a placa', ph:'ABC-1234'},
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
function showPage(id, pushHistory = true) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.style.animation=''; });
  const el = document.getElementById('page-'+id);
  el.classList.add('active');
  el.style.animation = 'pageIn .22s ease both';
  window.scrollTo(0, 0);
  const nav = document.getElementById('main-nav');
  const storeHero = document.getElementById('store-hero');
  if (id === 'home') nav.classList.remove('hidden');
  else { nav.classList.add('hidden'); closeMenu(); } // fecha menu ao sair da home
  if (storeHero) storeHero.style.display = id === 'store' ? 'flex' : 'none';
  if (id === 'modules') { updateBalloon(); updateCpfProCard(); updateCreditsBalloon(); updateModulesBanner(); }
  if (id === 'chat')     { _renderChatUserAvatar(); _setChatWelcomeTime(); _startChatPoll(); }
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
  inp.inputMode  = numMods.includes(mod) ? 'numeric' : 'text'; // placa usa text pois tem letras
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
  if(navHist.length>1){ navHist.pop(); showPage(navHist[navHist.length-1]); }
  else goHome();
}
function pushNav(page) { if(navHist[navHist.length-1]!==page) navHist.push(page); }
// ── DOM bindings (adiados para garantir que os elementos existem) ──
document.addEventListener('DOMContentLoaded', function() {
  const _modsBack = document.getElementById('modsBack');
  const _qBack    = document.getElementById('qBack');
  const _btnBk    = document.getElementById('btnBk');
  if (_modsBack) _modsBack.onclick = goBack;
  if (_qBack)    _qBack.onclick    = goBack;
  if (_btnBk)    _btnBk.onclick    = () => { showPage('query'); };
  document.addEventListener('keydown', e=>{ if(e.key==='Enter'&&document.getElementById('page-query')?.classList.contains('active')) doSearch(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeAllModals(); });
});

// ── registrar ──
async function submitRegister(btn) {
  const overlay = document.getElementById('modal-register');
  const inputs  = overlay.querySelectorAll('.modal-input');
  const nomeEl  = inputs[0], emailEl = inputs[1], senhaEl = inputs[2];
  [nomeEl, emailEl, senhaEl].forEach(i => i.style.borderColor = '');

  let ok = true;
  const shakeInp = i => { i.style.borderColor='rgba(248,113,113,.6)'; i.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:180}); ok=false; };

  const nome  = nomeEl.value.trim();
  const email = emailEl.value.trim().toLowerCase();
  const senha = senhaEl.value;

  if (!nome)                                         shakeInp(nomeEl);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))   shakeInp(emailEl);
  if (senha.length < 5)                             shakeInp(senhaEl);
  if (!ok) return;

  const orig = btn.textContent;
  btn.textContent = 'Criando conta...'; btn.style.opacity = '.7'; btn.disabled = true;

  // verifica se email já existe
  const existing = await sbGetOne('users', `email=eq.${encodeURIComponent(email)}`);
  if (existing) {
    emailEl.style.borderColor = 'rgba(248,113,113,.6)';
    showModalErr(overlay, 'Este e-mail já está cadastrado.');
    btn.textContent = orig; btn.style.opacity = ''; btn.disabled = false;
    return;
  }

  const newUser = await sbPost('users', {
    email, nome, senha, plan: 'basico', credits: 0, welcome_coupon_used: false
  });

  if (!newUser) {
    showModalErr(overlay, 'Erro ao criar conta. Tente novamente.');
    btn.textContent = orig; btn.style.opacity = ''; btn.disabled = false;
    return;
  }

  saveSession(email);

  btn.textContent = '✓ Conta criada!'; btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
  setTimeout(() => {
    closeModal('modal-register');
    btn.textContent = orig; btn.style.opacity = ''; btn.style.background = ''; btn.disabled = false;
    [nomeEl, emailEl, senhaEl].forEach(i => { i.value = ''; i.style.borderColor = ''; });
    clearModalErr(overlay);
    _loadSession();
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

  // busca por email ou nome
  let user = await sbGetOne('users', `email=eq.${encodeURIComponent(identifier)}`);
  if (!user) {
    const byName = await sbGet('users', `nome=ilike.${encodeURIComponent(identifier)}&limit=1`);
    user = byName?.[0] || null;
  }

  if (!user || user.senha !== senha) {
    btn.textContent = orig; btn.style.opacity = ''; btn.disabled = false;
    [identEl, senhaEl].forEach(i => i.style.borderColor = 'rgba(248,113,113,.6)');
    showModalErr(overlay, 'Usuário ou senha incorretos.');
    return;
  }

  if (user.banned) {
    btn.textContent = orig; btn.style.opacity = ''; btn.disabled = false;
    showModalErr(overlay, 'Conta suspensa. Entre em contato com o suporte.');
    return;
  }

  saveSession(user.email);

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
  const sess = getSession();
  if (!sess?.email) { return; }

  // aguarda o banco sem mostrar como visitante (evita flicker)

  try {
    const user = await sbGetOne('users', `email=eq.${encodeURIComponent(sess.email)}`);

    if (!user) {
      // usuário não existe mais no banco — limpa sessão, fica como visitante
      clearSession();
      initAnon();
      updateNavUser();
      return;
    }

    // verifica expiração do plano
    if (user.plan_expires_at && Date.now() > new Date(user.plan_expires_at).getTime() && user.plan !== 'basico') {
      await sbPatch('users', `email=eq.${encodeURIComponent(user.email)}`, { plan: 'basico', plan_expires_at: null });
      user.plan = 'basico';
      user.plan_expires_at = null;
    }

    queryCounters = await getDailyCounters(user.email, user.plan);

    currentUser = {
      name:          user.nome,
      email:         user.email,
      plan:          user.plan,
      planExpiresAt: user.plan_expires_at ? new Date(user.plan_expires_at).getTime() : null,
      avatar_url:    user.avatar_url || null,
      _credits:      user.credits || 0,
    };

    updateNavUser();

  } catch {
    // erro de rede — fica como visitante, sessão permanece salva pra próxima tentativa
    initAnon();
    updateNavUser();
  }
}

// ── logout ── (ver logoutUser() abaixo, que usa confirmação de modal)

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
  if (newSenha && newSenha.length < 5) { msgEl.textContent = 'Senha deve ter no mínimo 5 caracteres.'; msgEl.className='set-msg err'; senhaEl?.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:200}); return; }
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

  const patch = { nome: newNome };
  if (newSenha) patch.senha = newSenha;

  const updated = await sbPatch('users', `email=eq.${encodeURIComponent(currentUser.email)}`, patch);
  if (!updated) {
    if (msgEl) { msgEl.textContent = 'Erro ao salvar. Tente novamente.'; msgEl.className = 'set-msg err'; }
    return;
  }

  currentUser.name = newNome;
  updateNavUser();

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

  renderSettings();
}

// ── MODALS ──
function openModal(id){ closeAllModals(); document.getElementById(id).classList.add('open'); document.body.style.overflow='hidden'; }
function closeModal(id){
  const overlay = document.getElementById(id);
  const modal   = overlay?.querySelector('.modal');
  if (!overlay) return;
  overlay.classList.add('closing');
  if (modal) modal.classList.add('closing');
  setTimeout(() => { overlay.classList.remove('open','closing'); if (modal) modal.classList.remove('closing'); document.body.style.overflow = ''; }, 200);
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
      document.body.style.overflow = '';
    }
  }, 200);
}
function switchModal(a,b){ closeModal(a); setTimeout(()=>openModal(b),110); }
// Binding de fechar modal ao clicar fora — adiado para garantir que os elementos existem
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{ if(e.target===o) closeAllModals(); }));
  _loadSession();
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

  if (isOpen) { _closePD(panel); }
  else { _openPD(panel); setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150); }
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
  showPage(page, false);
});

// ── MENU ──
function toggleMenu() {
  const btn      = document.getElementById('menuBtn');
  const storeBtn = document.getElementById('storeMenuBtn');
  const dd       = document.getElementById('navDropdown');
  const isOpen   = dd.classList.contains('open');
  if (isOpen) closeMenu();
  else {
    btn?.classList.add('open'); storeBtn?.classList.add('open');
    dd.classList.add('open');
    document.getElementById('menuBlurOverlay').classList.add('on');
    document.body.style.overflow = 'hidden';
    closeAllPlanDetails(); // fecha detalhes ao abrir menu
  }
}
function closeMenu() {
  document.getElementById('menuBtn')?.classList.remove('open');
  document.getElementById('storeMenuBtn')?.classList.remove('open');
  document.getElementById('navDropdown')?.classList.remove('open');
  document.getElementById('menuBlurOverlay')?.classList.remove('on');
  // só libera scroll se não há modal aberto
  if (!document.querySelector('.modal-overlay.open')) {
    document.body.style.overflow = '';
  }
}
document.addEventListener('click', e => {
  const btn      = document.getElementById('menuBtn');
  const storeBtn = document.getElementById('storeMenuBtn');
  const dd       = document.getElementById('navDropdown');
  if (dd?.classList.contains('open') && !dd.contains(e.target) && !btn?.contains(e.target) && !storeBtn?.contains(e.target)) closeMenu();
});

// ── CUPOM ──
// ── PLANOS E LIMITES ──
async function loginUser(name, email, plan, days) {
  const oldPlan = currentUser?.plan || 'basico';

  let expiresAt = null;
  if (days && days > 0) {
    // se já tem plano igual, estende
    const existing = await sbGetOne('users', `email=eq.${encodeURIComponent(email)}`);
    if (existing && existing.plan === plan && plan !== 'basico' && existing.plan_expires_at) {
      const current = new Date(existing.plan_expires_at).getTime();
      expiresAt = new Date(Math.max(current, Date.now()) + days * 86400000).toISOString();
    } else {
      expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    }
  }

  const patch = { plan };
  if (name && name !== 'Usuário') patch.nome = name;
  patch.plan_expires_at = expiresAt;

  await sbPatch('users', `email=eq.${encodeURIComponent(email)}`, patch);

  saveSession(email);
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
function _doLogout() {
  clearSession();
  currentUser = null;
  queryCounters = {};
  activeCoupon = null;
  const wcModal = document.getElementById('welcomeCouponModal');
  if (wcModal) wcModal.classList.remove('open');
  updateNavUser();
  goHome();
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
}

function goHistory() {
  pushNav('history');
  renderHistory();
  showPage('history');
}

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
  if (limits.total === 999) return modLeft;
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
  const totalLeft = limits.total === 999 ? Infinity : Math.max(0, limits.total - totalUsed);
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
  'DEMO':    { plan:'basico',  name:'Reppzudo', email:'renanmonteiro123356@gmail.com', days:0 },
  'BASICO':  { plan:'basico',  name:null, email:null, days:0 },
  'STARTER': { plan:'starter', name:null, email:null, days:7 },
  'PRO':     { plan:'pro',     name:null, email:null, days:15 },
  'PREMIUM': { plan:'premium', name:null, email:null, days:30 },
  'GHOST':   { type:'ghost' },
  'DOUBLE':  { type:'double' },
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
      const name  = coupon.name  || (currentUser?.name  || 'Usuário');
      const email = coupon.email || (currentUser?.email || '');
      loginUser(name, email, coupon.plan, coupon.days || 0);
      const label = PLAN_LIMITS[coupon.plan].label;
      const daysMsg = coupon.days ? ` · válido por ${coupon.days} dias` : '';
      msg.className = 'coupon-msg success';
      msg.textContent = `✓ Plano ${label} ativado${daysMsg}!`;
      input.classList.add('applied');
      input.value = '';
      setTimeout(() => input.classList.remove('applied'), 700);
      setTimeout(() => { msg.className = 'coupon-msg'; msg.textContent = ''; }, 4000);
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
        if (typeof lim === 'number' && lim > LEAVE && lim !== -1 && lim !== 999 && mod !== 'label' && mod !== 'total') {
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
      activeCoupon = coupon;
      msg.className = 'coupon-msg success';
      msg.textContent = coupon.type === 'ghost'
        ? '✓ Modo Ghost ativo — resultados mockados habilitados.'
        : '✓ Modo Double ativo — resultado duplo nas consultas.';
      input.classList.add('applied');
      setTimeout(() => input.classList.remove('applied'), 700);
      setTimeout(() => { msg.className = 'coupon-msg'; msg.textContent = ''; }, 4000);
    }
  }, 350);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement?.id === 'couponInput') redeemCoupon();
});

let PRODUCTS = [];

async function loadProducts() {
  try {
    const rows = await sbGet('products', 'active=eq.true&order=id.asc');
    PRODUCTS = rows || [];
  } catch { PRODUCTS = []; }
}
let curProduct = null;

async function goStore() { pushNav('store'); showPage('store'); if (!PRODUCTS.length) await loadProducts(); renderStore(); window.scrollTo({top:0,behavior:'smooth'}); }
function _doRenderStore(filter) {
  const grid  = document.getElementById('storeGrid');
  const count = document.getElementById('storeCount');
  if (!grid) return;
  let filtered = PRODUCTS.filter(p => p.active && (!filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.tag.toLowerCase().includes(filter.toLowerCase())));
  // filtro de preço
  if (_storePriceMin != null) filtered = filtered.filter(function(p){ return p.price >= _storePriceMin; });
  if (_storePriceMax != null) filtered = filtered.filter(function(p){ return p.price <= _storePriceMax; });
  const sort = window._storeSort || 'newest';
  if (sort === 'az')         filtered = [...filtered].sort((a,b) => a.name.localeCompare(b.name,'pt-BR'));
  else if (sort === 'za')    filtered = [...filtered].sort((a,b) => b.name.localeCompare(a.name,'pt-BR'));
  else if (sort === 'price_asc')  filtered = [...filtered].sort((a,b) => a.price - b.price);
  else if (sort === 'price_desc') filtered = [...filtered].sort((a,b) => b.price - a.price);
  // Contador — só anima se mudou
  if (count) {
    const newTxt = filtered.length + ' produto' + (filtered.length !== 1 ? 's' : '') + ' disponíve' + (filtered.length !== 1 ? 'is' : 'l');
    if (count.textContent !== newTxt) {
      count.classList.remove('pop');
      void count.offsetWidth;
      count.textContent = newTxt;
      count.classList.add('pop');
    }
  }
  if (filtered.length === 0) {
    grid.style.opacity = '0';
    setTimeout(() => {
      grid.innerHTML = '<div class="res-err" style="margin:20px 24px"><h3>Nenhum produto encontrado</h3><p>Tente outro termo.</p></div>';
      grid.style.transition = 'opacity .15s ease';
      grid.style.opacity = '1';
    }, 120);
    return;
  }
  // Fade out → troca conteúdo → fade in
  grid.style.transition = 'opacity .1s ease';
  grid.style.opacity = '0';
  setTimeout(() => {
    grid.innerHTML = filtered.map((p, i) => `
    <div class="prod-card" onclick="openProduct(${p.id})">
      <div class="prod-img">
        ${p.img ? `<img src="${escStr(p.img)}" alt="${escStr(p.name)}">` : '<div class="prod-img-placeholder">👻</div>'}
        ${p.tag && p.tag.toLowerCase() !== 'premium' ? `<span class="prod-tag">${escStr(p.tag)}</span>` : ''}
        <button class="prod-fav" id="fav-${p.id}" onclick="event.stopPropagation();toggleFav(${p.id})" title="Favoritar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
      </div>
      <div class="prod-body">
        <div class="prod-name">${escStr(p.name)}</div>
        <div class="prod-desc">${escStr(p.desc)}</div>
        <div class="prod-price-row">
          <span class="prod-price">R$ ${p.price.toFixed(2).replace('.',',')}</span>
          ${p.priceOld ? `<span class="prod-price-old">R$ ${p.priceOld.toFixed(2).replace('.',',')}</span>` : ''}
          ${p.discount ? `<span class="prod-discount-badge">-${p.discount}%</span>` : ''}
        </div>
        <button class="prod-buy-btn" onclick="event.stopPropagation();buyProduct(${p.id},event)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          Comprar
        </button>
      </div>
    </div>`).join('');
    grid.style.transition = 'opacity .15s ease';
    grid.style.opacity = '1';
  }, 110);
}

let _storeFilterTimer = null;
function renderStore(filter = '') { _doRenderStore(filter); }
function filterProducts(val) {
  // debounce 120ms — evita dupla animação em cliques rápidos
  clearTimeout(_storeFilterTimer);
  _storeFilterTimer = setTimeout(() => _doRenderStore(val), 120);
  // animação por caractere — só o texto pisca (opacity flash)
  const inp = document.querySelector('.store-search');
  if (inp) {
    inp.classList.remove('char-anim');
    void inp.offsetWidth;
    inp.classList.add('char-anim');
    setTimeout(() => inp.classList.remove('char-anim'), 100);
  }
}
let favs = new Set();
function toggleFav(id) {
  const btn = document.getElementById('fav-' + id);
  if (!btn) return;
  if (favs.has(id)) { favs.delete(id); btn.classList.remove('active'); }
  else { favs.add(id); btn.classList.add('active'); }
}
function buyProduct(id, e) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  histAdd({ type:'produto', name:p.name, value: p.price || null, free: false });
  const url = p.buyUrl && p.buyUrl !== '#' ? p.buyUrl : null;
  if (url) { window.open(url, '_blank'); return; }
  const btn = e?.currentTarget || e?.target;
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Em breve!'; btn.style.opacity = '.7';
    setTimeout(() => { btn.innerHTML = orig; btn.style.opacity = ''; }, 1800);
  }
}
function openProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  curProduct = p;
  const det = document.getElementById('productDetail');
  if (det) det.innerHTML = `
    <div class="pd-hero">
      <button class="pd-hero-back" onclick="goBack()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar</button>
      <div class="pd-img">${p.img ? `<img src="${escStr(p.img)}" alt="${escStr(p.name)}">` : '<div class="pd-img-placeholder">👻</div>'}</div>
    </div>
    <div class="pd-body">
      <div class="pd-tag-row"><span class="pd-tag">${escStr(p.tag)}</span></div>
      <div class="pd-name">${escStr(p.name)}</div>
      <div class="pd-price-row">
        <span class="pd-price">R$ ${p.price.toFixed(2).replace('.',',')}</span>
        ${p.priceOld ? `<span class="pd-price-old">R$ ${p.priceOld.toFixed(2).replace('.',',')}</span>` : ''}
        ${p.discount ? `<span class="pd-discount">-${p.discount}%</span>` : ''}
      </div>
      <button class="pd-buy-btn" onclick="buyProduct(${p.id},event)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        Comprar Agora
      </button>
      <div class="pd-badges">
        <div class="pd-badge"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg><span class="pd-badge-label">Entrega Imediata</span></div>
        <div class="pd-badge"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg><span class="pd-badge-label">Pagamento Seguro</span></div>
        <div class="pd-badge"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span class="pd-badge-label">Garantia 7 dias</span></div>
      </div>
      <div class="pd-sep"></div>
      <div class="pd-section-title">Descrição</div>
      <div class="pd-desc-text">${escStr(p.descFull || p.desc)}</div>
    </div>`;
  pushNav('product'); showPage('product');
}
function openAddProduct() { alert('Em breve: painel de adição de produtos.'); }
function escStr(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── PLANS PAGE ──
function goPlans(){
  goHome();
  setTimeout(() => {
    const plans = document.getElementById('plans');
    if (plans) plans.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

function goPlansFromResults(){
  // monta carrossel de upgrade igual ao da home
  const srcGrid = document.getElementById('plansGrid');
  const dstGrid = document.getElementById('plansGridUpgrade');
  const dstDots = document.getElementById('plansDotsUpgrade');
  if (srcGrid && dstGrid) {
    dstGrid.innerHTML = srcGrid.innerHTML;
    if (dstDots) dstDots.innerHTML = '';
  }
  pushNav('upgrade');
  showPage('upgrade');
  // inicializa carrossel do upgrade
  initUpgradeCarousel();
}

function initUpgradeCarousel() {
  const wrap = document.querySelector('#page-upgrade .plans-carousel-wrap');
  const grid = document.getElementById('plansGridUpgrade');
  const dotsWrap = document.getElementById('plansDotsUpgrade');
  if (!grid || !dotsWrap || !wrap) return;
  const cards = Array.from(grid.querySelectorAll('.pc'));
  const N = cards.length; if (!N) return;
  const GAP = 16, LERP = 0.2, THRESHOLD = 55, RUBBER = 0.18;
  let cur = 2, currentX = 0, targetX = 0, rafId = null;
  dotsWrap.innerHTML = '';
  const cardW = () => cards[0].offsetWidth;
  const wrapW = () => wrap.offsetWidth;
  const snapX = i => (wrapW() - cardW()) / 2 - i * (cardW() + GAP);
  const rubberClamp = d => { const s = d>0?1:-1; return s*Math.sqrt(Math.abs(d))*18*RUBBER; };
  cards.forEach((_,i) => {
    const d = document.createElement('div');
    d.className='plans-dot'; d.onclick=()=>goToU(i); dotsWrap.appendChild(d);
  });
  function updateU(i){ cards.forEach((c,j)=>c.classList.toggle('pc-active',j===i)); dotsWrap.querySelectorAll('.plans-dot').forEach((d,j)=>d.classList.toggle('active',j===i)); }
  function goToU(i){ i=Math.max(0,Math.min(N-1,i)); cur=i; targetX=snapX(i); updateU(i); startRafU(); }
  function goToInstantU(i){ i=Math.max(0,Math.min(N-1,i)); cur=i; currentX=targetX=snapX(i); grid.style.transform=`translateX(${currentX}px)`; updateU(i); }
  function startRafU(){ if(rafId) cancelAnimationFrame(rafId); function tick(){ const diff=targetX-currentX; if(Math.abs(diff)<0.1){currentX=targetX;grid.style.transform=`translateX(${currentX}px)`;rafId=null;return;} currentX+=diff*LERP; grid.style.transform=`translateX(${currentX}px)`; rafId=requestAnimationFrame(tick); } rafId=requestAnimationFrame(tick); }
  let active=false,startX=0,rawDelta=0;
  grid.addEventListener('mousedown',e=>{active=true;rawDelta=0;startX=e.clientX;if(rafId){cancelAnimationFrame(rafId);rafId=null;}grid.classList.add('dragging');});
  window.addEventListener('mousemove',e=>{if(!active)return;rawDelta=e.clientX-startX;const atS=cur===0&&rawDelta>0,atE=cur===N-1&&rawDelta<0;grid.style.transform=`translateX(${(atS||atE)?snapX(cur)+rubberClamp(rawDelta):snapX(cur)+rawDelta*0.6}px)`;currentX=parseFloat(grid.style.transform.replace(/[^-\d.]/g,''));});
  window.addEventListener('mouseup',()=>{if(!active)return;active=false;grid.classList.remove('dragging');const atS=cur===0&&rawDelta>0,atE=cur===N-1&&rawDelta<0;if(!atS&&!atE&&rawDelta<-THRESHOLD)goToU(cur+1);else if(!atS&&!atE&&rawDelta>THRESHOLD)goToU(cur-1);else goToU(cur);});
  grid.addEventListener('touchstart',e=>{active=true;rawDelta=0;startX=e.touches[0].clientX;},{passive:true});
  grid.addEventListener('touchmove',e=>{if(!active)return;rawDelta=e.touches[0].clientX-startX;if(Math.abs(rawDelta)>5)_planDragHappened=true;grid.style.transform=`translateX(${snapX(cur)+rawDelta*0.6}px)`;},{passive:true});
  grid.addEventListener('touchend',()=>{if(!active)return;active=false;if(rawDelta<-THRESHOLD)goToU(cur+1);else if(rawDelta>THRESHOLD)goToU(cur-1);else goToU(cur);},{passive:true});
  window.addEventListener('resize',()=>goToInstantU(cur));
  setTimeout(()=>goToInstantU(3),60);
  setTimeout(()=>goToInstantU(cur),300);
}

// ── SISTEMA DE CHAT DE SUPORTE ──

const CHAT_BLOCKED_WORDS = ['xingamento','palavrão','lixo','idiota','otário','merda','foda','puta','caralho','viado','porra','desgraça'];
const CHAT_COOLDOWN_MS   = 5000;   // 5s entre mensagens
const CHAT_MAX_PER_MIN   = 10;     // máx 10 msgs por minuto
let _chatLastSend   = 0;
let _chatMsgTimes   = [];          // timestamps do último minuto
let _chatMessages   = [];          // histórico da sessão
let _chatPollInterval = null;

function _startChatPoll() {
  _stopChatPoll();
  if (!currentUser || currentUser.anon) return;
  _chatPollInterval = setInterval(async () => {
    const msgs = await sbGet('chats',
      `user_key=eq.${encodeURIComponent(currentUser.email)}&order=created_at.asc`);
    if (!msgs) return;
    msgs.filter(m => m.role === 'admin').forEach(m => {
      const already = _chatMessages.find(x => x._id === m.id);
      if (!already) {
        const msg = { own: false, text: m.message, time: _chatFmtTime(new Date(m.created_at)), _id: m.id };
        _chatMessages.push(msg);
        _appendChatBubble(msg, true);
        try { LS.set('ghost_chat_msgs', _chatMessages.slice(-50)); } catch(_) {}
      }
    });
  }, 2000);
}

function _stopChatPoll() {
  clearInterval(_chatPollInterval);
  _chatPollInterval = null;
}

// Entrada pelo menu → mostra tela de suporte primeiro
function goChat() {
  setTimeout(initChatStatus, 80);
  showThankYou('support', null);
}

// ── Avatar do admin (realtime) ──
let _chatAdminAvatar = null;
let _adminAvatarChannel = null;
async function _loadChatAdminAvatar() {
  try {
    const rows = await sbGet('admins', 'select=avatar_url&limit=1');
    _chatAdminAvatar = rows?.[0]?.avatar_url || null;
  } catch { _chatAdminAvatar = null; }
}
function _subscribeAdminAvatar() {
  if (_adminAvatarChannel) return;
  const sb = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON)
    : null;
  if (!sb) return;
  _adminAvatarChannel = sb
    .channel('admin-avatar')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admins' }, payload => {
      if (payload.new?.avatar_url) _chatAdminAvatar = payload.new.avatar_url;
    })
    .subscribe();
}

// Abre o chat diretamente (usado pela tela de suporte e pelo tyAnswerYes)
async function _openChatPage() {
  pushNav('chat');
  showPage('chat');
  _renderChatUserAvatar();
  _setChatWelcomeTime();
  await _loadChatAdminAvatar();
  _subscribeAdminAvatar();

  // carrega histórico do banco se logado
  if (currentUser && !currentUser.anon) {
    const msgs = await sbGet('chats',
      `user_key=eq.${encodeURIComponent(currentUser.email)}&order=created_at.asc`);
    if (msgs && msgs.length > 0) {
      _chatMessages = msgs.map(m => ({
        own: m.role === 'user',
        text: m.message,
        time: _chatFmtTime(new Date(m.created_at)),
        _id: m.id
      }));
      try { LS.set('ghost_chat_msgs', _chatMessages.slice(-50)); } catch(_) {}
      _renderChatMessages();
    }
  }
}

function _setChatWelcomeTime() {
  const el = document.getElementById('chatWelcomeTime');
  if (el) el.textContent = _chatFmtTime(new Date());
}

function _renderChatUserAvatar() {
  const el = document.getElementById('chatUserAvatar');
  if (!el) return;
  const plan    = currentUser?.plan || 'basico';
  const avatar  = currentUser?.email ? getUserAvatar(currentUser.email) : null;
  const name    = currentUser?.name || 'Visitante';
  const initial = name[0]?.toUpperCase() || 'V';
  const PLAN_RING = {
    basico:  'rgba(74,222,128,.7)',
    starter: 'rgba(168,85,247,.8)',
    pro:     'linear-gradient(135deg,#a855f7,#c026d3)',
    premium: 'linear-gradient(135deg,#f472b6,#c026d3)',
  };
  const ring = PLAN_RING[plan] || PLAN_RING.basico;
  el.style.background = ring.includes('gradient') ? ring : ring;
  el.innerHTML = avatar
    ? `<img src="${avatar}" alt="${initial}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="font-size:.75rem;font-weight:700;color:#fff">${initial}</span>`;
  el.dataset.plan = plan;
}

function openChatProfile() {
  const pop  = document.getElementById('chatProfilePopover');
  const av   = document.getElementById('cppAvatar');
  const nm   = document.getElementById('cppName');
  const pl   = document.getElementById('cppPlan');
  if (!pop) return;
  const plan    = currentUser?.plan || 'basico';
  const avatar  = currentUser?.email ? getUserAvatar(currentUser.email) : null;
  const name    = currentUser?.name || 'Visitante';
  const initial = name[0]?.toUpperCase() || 'V';
  const PLAN_COLORS_CHAT = { basico:'#4ade80', starter:'#a855f7', pro:'#c026d3', premium:'#f472b6' };
  const PLAN_LABELS_CHAT = { basico:'Plano Básico', starter:'Plano Starter', pro:'Plano Pro', premium:'Plano Premium' };
  av.innerHTML = avatar
    ? `<img src="${avatar}" alt="${initial}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="font-size:1.1rem;font-weight:700;color:#fff">${initial}</span>`;
  av.style.background = avatar ? 'transparent' : 'var(--grad)';
  nm.textContent = name;
  pl.textContent = PLAN_LABELS_CHAT[plan] || 'Plano Básico';
  pl.style.color = PLAN_COLORS_CHAT[plan] || '#4ade80';
  pop.classList.add('open');
  setTimeout(() => document.addEventListener('click', _closeChatProfileOutside), 10);
}
function closeChatProfile() {
  document.getElementById('chatProfilePopover')?.classList.remove('open');
  document.removeEventListener('click', _closeChatProfileOutside);
}
function _closeChatProfileOutside(e) {
  const pop = document.getElementById('chatProfilePopover');
  if (pop && !pop.contains(e.target) && e.target.id !== 'chatUserAvatar') closeChatProfile();
}

function _chatFmtTime(d) {
  return d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

function _renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  // remove mensagens antigas (mantém a welcome)
  const existing = container.querySelectorAll('.chat-msg-row');
  existing.forEach(m => m.remove());
  _chatMessages.forEach(msg => _appendChatBubble(msg, false));
  container.scrollTop = container.scrollHeight;
}

// ── Lógica de avatar "estilo Instagram" ──
// Avatar só aparece na primeira mensagem de uma sequência.
// Nova sequência = mensagem do lado oposto entre as duas, ou primeira mensagem de todas.
function _shouldShowAvatar(index, messages) {
  if (index === 0) return true;
  const cur  = messages[index];
  const prev = messages[index - 1];
  // lado diferente do anterior → começa nova sequência
  return cur.own !== prev.own;
}

function _appendChatBubble(msg, animate = true) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const plan    = currentUser?.plan || 'basico';
  const avatar  = currentUser?.email ? getUserAvatar(currentUser.email) : null;
  const name    = currentUser?.name || 'Visitante';
  const initial = name[0]?.toUpperCase() || 'V';

  // Decide se mostra avatar: nova sequência = primeiro depois do oposto
  const allRows    = _chatMessages;
  const msgIndex   = allRows.length - 1; // msg recém adicionada é a última
  const showAvatar = _shouldShowAvatar(msgIndex, allRows);

  const row = document.createElement('div');
  row.className = 'chat-msg-row' + (msg.own ? ' own' : '');
  if (animate) row.style.animation = 'chatMsgIn .25s cubic-bezier(.34,1.56,.64,1) both';

  if (msg.own) {
    const avatarHtml = showAvatar
      ? (avatar
          ? `<img src="${avatar}" alt="${initial}" class="chat-avatar-img">`
          : `<span class="chat-avatar-initial">${initial}</span>`)
      : '';
    const wrapClass = showAvatar ? 'chat-avatar-wrap' : 'chat-avatar-spacer';
    row.innerHTML = `
      <div class="chat-bubble own">${escStr(msg.text)}<span class="chat-bubble-time">${msg.time}</span></div>
      <div class="${wrapClass}" ${showAvatar ? `onclick="openChatProfile()"` : ''}>
        ${avatarHtml}
      </div>`;
  } else {
    // Mensagem do suporte — mostra avatar do admin ou círculo neutro
    const ghostHtml = showAvatar
      ? (_chatAdminAvatar
          ? `<div class="chat-ghost-ico"><img src="${_chatAdminAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`
          : `<div class="chat-ghost-ico" style="background:var(--p2,#6366f1);display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:.7rem;font-weight:700;color:#fff">A</div>`)
      : `<div class="chat-avatar-spacer"></div>`;
    row.innerHTML = `
      ${ghostHtml}
      <div class="chat-bubble ghost">${escStr(msg.text)}<span class="chat-bubble-time">${msg.time}</span></div>`;
  }

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function autoResizeChatInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  const counter = document.getElementById('chatInputCounter');
  if (counter) counter.textContent = 500 - el.value.length;
}

function chatInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
}

function sendChatMessage() {
  const inp     = document.getElementById('chatInput');
  const warnEl  = document.getElementById('chatRateWarn');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;

  // cooldown entre msgs
  const now = Date.now();
  if (now - _chatLastSend < CHAT_COOLDOWN_MS) {
    const sec = Math.ceil((CHAT_COOLDOWN_MS - (now - _chatLastSend)) / 1000);
    _showChatWarn(`Aguarde ${sec}s antes de enviar outra mensagem.`);
    return;
  }

  // rate limit por minuto
  _chatMsgTimes = _chatMsgTimes.filter(t => now - t < 60000);
  if (_chatMsgTimes.length >= CHAT_MAX_PER_MIN) {
    _showChatWarn('Muitas mensagens em pouco tempo. Aguarde um momento.');
    return;
  }

  // filtro de palavras proibidas
  const lower = text.toLowerCase();
  if (CHAT_BLOCKED_WORDS.some(w => lower.includes(w))) {
    _showChatWarn('Sua mensagem contém conteúdo inadequado.');
    return;
  }

  // tudo ok — envia
  _chatLastSend = now;
  _chatMsgTimes.push(now);
  if (warnEl) { warnEl.textContent = ''; warnEl.style.display = 'none'; }

  const msg = { own: true, text, time: _chatFmtTime(new Date()) };
  _chatMessages.push(msg);
  _appendChatBubble(msg, true);

  inp.value = '';
  inp.style.height = 'auto';
  const counter = document.getElementById('chatInputCounter');
  if (counter) counter.textContent = '500';

  // salva no localStorage
  try { LS.set('ghost_chat_msgs', _chatMessages.slice(-50)); } catch(_) {}

  // envia pro Supabase
  if (currentUser && !currentUser.anon) {
    sbPost('chats', {
      user_key: currentUser.email,
      role: 'user',
      message: text,
      read_by_admin: false
    });
  }
}

function _showChatWarn(msg) {
  const el = document.getElementById('chatRateWarn');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.animation = 'chatWarnIn .2s ease both';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// carrega histórico do chat ao iniciar
document.addEventListener('DOMContentLoaded', () => {
  const saved = LS.get('ghost_chat_msgs');
  if (Array.isArray(saved)) _chatMessages = saved;
  // hora de boas-vindas no chat
  const wel = document.getElementById('chatWelcomeTime');
  if (wel) wel.textContent = _chatFmtTime(new Date());
});

// ── COMPRA DE PLANO + FLUXO PÓS-COMPRA ──

const PLAN_DURATIONS = { starter: 7, pro: 15, premium: 30 }; // dias
const PLAN_NAMES_PT  = { starter:'Starter', pro:'Pro', premium:'Premium' };

function buyPlan(plan, btn) {
  if (!currentUser || currentUser.anon) {
    openModal('modal-login');
    return;
  }
  const orig = btn?.innerHTML;
  if (btn) { btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .6s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Processando...'; btn.disabled = true; }

  // TODO: integrar com gateway de pagamento (Mercado Pago, Stripe, etc.)
  // Por enquanto: aprovação automática (modo demo)
  setTimeout(async () => {
    const oldPlan    = currentUser.plan;
    const expiresAt  = new Date(Date.now() + PLAN_DURATIONS[plan] * 86400000).toISOString();
    await sbPatch('users', `email=eq.${encodeURIComponent(currentUser.email)}`, { plan, plan_expires_at: expiresAt });
    currentUser.plan         = plan;
    currentUser.planExpiresAt = Date.now() + PLAN_DURATIONS[plan] * 86400000;
    queryCounters = await getDailyCounters(currentUser.email, plan);
    updateNavUser();
    histAdd({ type:'plano', name:`Plano ${PLAN_NAMES_PT[plan]||plan} ativado`, value: (PLAN_PRICES[plan]||'').replace('R$','').replace('/mês','').trim()||null, free: false });
    if (btn) { btn.innerHTML = orig; btn.disabled = false; }

    // fecha menu se aberto
    closeMenu();

    // animação de upgrade se for de fato upgrade
    const planOrder = ['basico','starter','pro','premium'];
    if (planOrder.indexOf(plan) > planOrder.indexOf(oldPlan)) {
      playUpgradeAnimation(oldPlan, plan, () => showThankYou('plan', plan));
    } else {
      showThankYou('plan', plan);
    }
  }, 1200);
}

// type = 'plan' | 'credits' | 'support'
function showThankYou(type, planOrAmount) {
  pushNav('thankyou');
  showPage('thankyou');

  const titleEl = document.getElementById('tyTitle');
  const subEl   = document.getElementById('tySub');
  const iconEl  = document.getElementById('tyIcon');
  const qEl     = document.getElementById('tyQuestion');

  // guarda o tipo para os botões saberem o que fazer
  if (qEl) qEl.dataset.type = type;

  if (type === 'plan') {
    _runTyAnimation();
    if (iconEl)  iconEl.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    if (titleEl) titleEl.textContent = `Plano ${PLAN_NAMES_PT[planOrAmount] || planOrAmount} ativado!`;
    if (subEl)   subEl.textContent   = 'Seu acesso foi liberado. Boas consultas!';
    if (qEl) qEl.innerHTML = `
      <p class="ty-q-text">Teve algum problema durante a assinatura?</p>
      <div class="ty-btns">
        <button class="ty-btn ty-btn-no"  onclick="tyAnswerNo()">Não, tudo certo!</button>
        <button class="ty-btn ty-btn-yes" onclick="tyAnswerYes()">Sim, preciso de ajuda</button>
      </div>`;

  } else if (type === 'credits') {
    _runTyAnimation();
    if (iconEl)  iconEl.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    if (titleEl) titleEl.textContent = 'Créditos adicionados!';
    if (subEl)   subEl.textContent   = 'Seus créditos já estão disponíveis na sua conta.';
    if (qEl) qEl.innerHTML = `
      <p class="ty-q-text">Teve algum problema durante a compra?</p>
      <div class="ty-btns">
        <button class="ty-btn ty-btn-no"  onclick="tyAnswerNo()">Não, tudo certo!</button>
        <button class="ty-btn ty-btn-yes" onclick="tyAnswerYes()">Sim, preciso de ajuda</button>
      </div>`;

  } else if (type === 'support') {
    // Entrada direta pelo menu — sem animação de confete, vai direto para o chat
    if (iconEl)  iconEl.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    if (titleEl) titleEl.textContent = 'Suporte 24h';
    if (subEl)   subEl.textContent   = 'Nossa equipe está pronta para te ajudar.';
    if (qEl) qEl.innerHTML = `
      <p class="ty-q-text">Como podemos te ajudar hoje?</p>
      <div class="ty-btns">
        <button class="ty-btn ty-btn-no"  onclick="_openChatPage()">Abrir chat de atendimento</button>
        <button class="ty-btn ty-btn-yes" onclick="goHome()" style="font-size:.8rem">Voltar para o início</button>
      </div>`;
  }
}

function tyAnswerNo() {
  const q = document.getElementById('tyQuestion');
  if (q) {
    q.style.opacity = '0';
    q.style.transform = 'translateY(6px)';
    q.style.transition = 'opacity .25s ease, transform .25s ease';
    setTimeout(() => {
      q.innerHTML = '<p class="ty-q-done">Ótimo! Boas consultas.</p>';
      q.style.opacity = '1';
      q.style.transform = 'translateY(0)';
    }, 260);
  }
  setTimeout(() => goHome(), 2400);
}

function tyAnswerYes() {
  navHist = navHist.filter(p => p !== 'thankyou');
  _openChatPage();
}

function _runTyAnimation() {
  const canvas = document.getElementById('ty-canvas');
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx     = canvas.getContext('2d');
  const colors  = ['#a855f7','#f472b6','#c026d3','#fff','#e879f9','#fbbf24','#38bdf8','#4ade80'];
  const particles = [];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      vx: (Math.random() - .5) * 3,
      vy: -(3 + Math.random() * 4),
      size: 3 + Math.random() * 6,
      color: colors[i % colors.length],
      alpha: 1,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - .5) * .15,
    });
  }
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.08; // gravidade
      p.rot+= p.rotV;
      p.alpha -= 0.012;
      if (p.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      ctx.restore();
    });
    frame++;
    if (frame < 180) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(draw);
}

// ── override de buyCreditsNow para acionar pós-compra ──
const _origBuyCreditsNow = buyCreditsNow;
buyCreditsNow = function() {
  const cost      = _creditsTargetMod ? (MOD_CREDITS[_creditsTargetMod] || 1) : 1;
  const totalCred = Math.round(cost * _creditsQty * 100) / 100;
  const brlBase   = creditsToReal(totalCred);
  const disc      = getDiscount(brlBase);
  const brlFinal  = brlBase * (1 - disc.pct / 100);

  const btn = document.getElementById('creditsBuyBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .6s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Aguardando pagamento...`;

  setTimeout(() => {
    const email = currentUser?.email;
    if (email) {
      addCredits(email, totalCred);
      histAdd({ type:'credito', name:`${totalCred} créditos adicionados`, value: brlFinal.toFixed(2), free: false });
    }
    // Atualiza todos os elementos que mostram créditos instantaneamente
    function _refreshAllCredits() {
      updateCreditsBalloon();
      if (_creditsTargetMod) updateMiniBalloon(_creditsTargetMod);
      // Atualiza saldo na página de compra
      const balEl = document.getElementById('creditsBalanceInfo');
      if (balEl && email) {
        const newBal = getCredits(email);
        balEl.innerHTML = newBal > 0
          ? `Saldo atual: <strong style="color:var(--p3)">${fmtBrl(creditsToReal(newBal))}</strong>`
          : '';
      }
      // Atualiza wallet se estiver aberta
      const walletEl = document.getElementById('walletContent');
      if (walletEl && walletEl.innerHTML) renderWallet();
      // Atualiza settings se estiver aberta
      const setEl = document.getElementById('settingsContent');
      if (setEl && setEl.innerHTML) renderSettings();
    }
    _refreshAllCredits();

    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Créditos adicionados!`;
    btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
    setTimeout(() => {
      btn.innerHTML = orig; btn.disabled = false; btn.style.background = '';
      _refreshAllCredits();
      showThankYou('credits', brlFinal.toFixed(2));
    }, 900);
  }, 1500);
};

// ── CHAT STATUS (Online/Offline por horário) ──
function initChatStatus() {
  const dot = document.getElementById('chatStatusDot');
  const txt = document.getElementById('chatStatusTxt');
  const msg = document.getElementById('chatWelcomeMsg');
  if (!dot || !txt) return;
  const h = new Date().getHours();
  const isOnline = h >= 8 && h < 23;
  dot.style.background = isOnline ? '#4ade80' : '#f87171';
  dot.style.boxShadow = isOnline ? '0 0 6px #4ade80' : '0 0 6px #f87171';
  txt.textContent = isOnline ? 'Online' : 'Offline';
  txt.style.color = isOnline ? '#4ade80' : '#f87171';
  if (msg) msg.textContent = isOnline
    ? 'Olá! Seja bem-vindo ao suporte Ghost. Envie sua mensagem e responderemos assim que pudermos.'
    : 'Estamos offline no momento. Deixe sua mensagem e responderemos assim que voltarmos!';
}

// ── INPUT EDITÁVEL DE CRÉDITOS ──
function onCreditsQtyInput(el) {
  let v = parseInt(el.value) || 1;
  v = Math.max(1, Math.min(100, v));
  _creditsQty = v;
  el.value = v;
  renderCreditsSummary();
  updatePresetsUI();
}

// ── CUPOM DE BOAS-VINDAS ──
function showWelcomeCouponModal() {
  const el      = document.getElementById('welcomeCouponModal');
  const title   = document.getElementById('wcTitle');
  const sub     = document.getElementById('wcSub');
  const btn     = document.getElementById('wcBtn');
  const isGuest = !currentUser || currentUser.anon;

  if (title) title.textContent = isGuest ? 'Oferta de boas-vindas' : 'Cupom ativado!';
  if (sub)   sub.textContent   = isGuest
    ? 'Cadastre-se agora e pague menos. Desconto aplicado automaticamente ao criar sua conta.'
    : 'Você ganhou desconto exclusivo de boas-vindas. Os preços já estão com o desconto aplicado para você.';
  if (btn)   btn.textContent   = isGuest ? 'Criar conta grátis' : 'Aproveitar agora';

  if (el) el.classList.add('open');
}
function wcBtnAction() {
  closeWelcomeCouponModal();
  if (!currentUser || currentUser.anon) {
    setTimeout(() => openModal('modal-register'), 180);
  }
}
function closeWelcomeCouponModal() {
  const el = document.getElementById('welcomeCouponModal');
  if (el) el.classList.remove('open');
  if (currentUser && !currentUser.anon) {
    sbPatch('users', `email=eq.${encodeURIComponent(currentUser.email)}`, { welcome_coupon_used: true }).catch(()=>{});
  }
}

// ── FILTRO POR PREÇO NA STORE ──
var _storePriceMin = null;
var _storePriceMax = null;

function applyPriceFilter() {
  var minEl = document.getElementById('filterPriceMin');
  var maxEl = document.getElementById('filterPriceMax');
  var minVal = minEl ? parseFloat(minEl.value.replace(',','.')) : NaN;
  var maxVal = maxEl ? parseFloat(maxEl.value.replace(',','.')) : NaN;
  _storePriceMin = isNaN(minVal) ? null : minVal;
  _storePriceMax = isNaN(maxVal) ? null : maxVal;
  toggleStoreFilters();
  var search = document.querySelector('.store-search') ? document.querySelector('.store-search').value : '';
  _doRenderStore(search);
}

function clearPriceFilter() {
  _storePriceMin = null;
  _storePriceMax = null;
  var minEl = document.getElementById('filterPriceMin');
  var maxEl = document.getElementById('filterPriceMax');
  if (minEl) minEl.value = '';
  if (maxEl) maxEl.value = '';
  var search = document.querySelector('.store-search') ? document.querySelector('.store-search').value : '';
  _doRenderStore(search);
}

// ── FILTROS DA STORE — POPUP COM OVERLAY ──
function toggleStoreFilters() {
  var overlay = document.getElementById('filterOverlay');
  var popup   = document.getElementById('filterPopup');
  if (!overlay || !popup) return;
  var isOpen = overlay.classList.contains('on');
  if (isOpen) {
    overlay.classList.remove('on');
    popup.classList.remove('on');
  } else {
    overlay.classList.add('on');
    popup.classList.add('on');
  }
}
function applyStoreSort(sort) {
  window._storeSort = sort;
  // fecha popup
  var fo = document.getElementById('filterOverlay');
  var fp = document.getElementById('filterPopup');
  if (fo) fo.classList.remove('on');
  if (fp) fp.classList.remove('on');
  // atualiza botões ativos
  ['az','za','price_asc','price_desc','newest'].forEach(function(s) {
    var btn = document.getElementById('sort-'+s);
    if (btn) {
      if (s === sort) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
  var search = document.querySelector('.store-search') ? document.querySelector('.store-search').value : '';
  _doRenderStore(search);
}

function updateSortChips() {
  var sort = window._storeSort || 'newest';
  ['newest','price_asc','price_desc','az','za'].forEach(function(s) {
    var btn = document.getElementById('sort-'+s);
    if (btn) {
      if (s === sort) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
}

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
    _discBannerTimer = setTimeout(hideBanner, 4000);
  }
  function hideBanner() {
    banner.classList.remove('visible');
    _discBannerTimer = setTimeout(showBanner, 5500);
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
