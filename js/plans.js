// GHOST BUSCA — Planos (Animações + Compra + Cupom)

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
