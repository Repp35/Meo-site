// GHOST BUSCA — Wallet (Créditos + Carteira)

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
