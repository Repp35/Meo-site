// Contém: animações 3D, wallet, histórico, settings, chat

// ── ANIMAÇÃO DE UPGRADE ──
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
  cardOld.style.animation = 'planShake 1.3s ease both';

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
    const crackLines = Array.from({length:10},(_,i)=>{ const a=(i/10)*Math.PI*2+Math.random()*.3; return{x1:cx,y1:cy,x2:cx+Math.cos(a)*(100+Math.random()*100),y2:cy+Math.sin(a)*(100+Math.random()*100)}; });
    let cAlpha = 1;
    const drawCracks = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.save(); ctx.globalAlpha=cAlpha; crackLines.forEach(l=>{ctx.beginPath();ctx.moveTo(l.x1,l.y1);ctx.lineTo(l.x2,l.y2);ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}); ctx.restore(); cAlpha-=.07; if(cAlpha>0)requestAnimationFrame(drawCracks); else ctx.clearRect(0,0,canvas.width,canvas.height); };
    drawCracks();
  }, 1000);

  setTimeout(() => {
    cardOld.style.display = 'none';
    cardNew.style.opacity = '1';
    cardNew.style.animation = 'planEmerge .6s cubic-bezier(.34,1.56,.64,1) forwards';
    setTimeout(() => { cardNew.style.animation += ',planGlowPulse 1s ease 2'; }, 600);
    label.innerHTML = `<strong>${newC.label} ativo!</strong>Bem-vindo ao próximo nível`;
    label.style.animation = 'hFade .4s ease both';
  }, 1450);

  setTimeout(() => {
    overlay.style.animation = 'upgradeOverlayOut .35s ease forwards';
    setTimeout(() => {
      overlay.style.opacity = '0'; overlay.classList.remove('on');
      cardOld.style.display = ''; cardNew.style.opacity = '0'; cardNew.style.animation = ''; cardOld.style.animation = '';
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

  setTimeout(() => { cardOld.style.transition='opacity .5s ease, transform .5s ease'; cardOld.style.opacity='0'; cardOld.style.transform='translate(-50%,-50%) scale(.85)'; }, 300);
  setTimeout(() => { cardNew.style.opacity='1'; cardNew.style.transition='opacity .4s ease'; label.innerHTML=`<strong>${newC.label}</strong>Plano alterado`; label.style.animation='hFade .4s ease both'; }, 900);
  setTimeout(() => {
    overlay.style.animation = 'upgradeOverlayOut .3s ease forwards';
    setTimeout(() => { overlay.style.opacity='0'; overlay.classList.remove('on'); cardOld.style.cssText=''; cardNew.style.cssText=''; cardOld.style.opacity=''; cardOld.style.transition=''; if(onDone)onDone(); }, 300);
  }, 2200);
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
    particles.push({ x:Math.random()*canvas.width, y:canvas.height+10, vx:(Math.random()-.5)*3, vy:-(3+Math.random()*4), size:3+Math.random()*6, color:colors[i%colors.length], alpha:1, rot:Math.random()*Math.PI*2, rotV:(Math.random()-.5)*.15 });
  }
  let frame = 0;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.08; p.rot+=p.rotV; p.alpha-=0.012; if(p.alpha<=0)return; ctx.save(); ctx.globalAlpha=p.alpha; ctx.fillStyle=p.color; ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size); ctx.restore(); });
    frame++;
    if(frame<180)requestAnimationFrame(draw);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  requestAnimationFrame(draw);
}

// THANK YOU + SUPORTE
function showThankYou(type, planOrAmount) {
  pushNav('thankyou');
  showPage('thankyou');
  const titleEl = document.getElementById('tyTitle');
  const subEl   = document.getElementById('tySub');
  const iconEl  = document.getElementById('tyIcon');
  const qEl     = document.getElementById('tyQuestion');
  if (qEl) qEl.dataset.type = type;

  if (type === 'plan') {
    _runTyAnimation();
    if (iconEl)  iconEl.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    if (titleEl) titleEl.textContent = `Plano ${PLAN_NAMES_PT[planOrAmount] || planOrAmount} ativado!`;
    if (subEl)   subEl.textContent   = 'Seu acesso foi liberado. Boas consultas!';
    if (qEl) qEl.innerHTML = `<p class="ty-q-text">Teve algum problema durante a assinatura?</p><div class="ty-btns"><button class="ty-btn ty-btn-no" onclick="tyAnswerNo()">Não, tudo certo!</button><button class="ty-btn ty-btn-yes" onclick="tyAnswerYes()">Sim, preciso de ajuda</button></div>`;
  } else if (type === 'credits') {
    _runTyAnimation();
    if (iconEl)  iconEl.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    if (titleEl) titleEl.textContent = 'Créditos adicionados!';
    if (subEl)   subEl.textContent   = 'Seus créditos já estão disponíveis na sua conta.';
    if (qEl) qEl.innerHTML = `<p class="ty-q-text">Teve algum problema durante a compra?</p><div class="ty-btns"><button class="ty-btn ty-btn-no" onclick="tyAnswerNo()">Não, tudo certo!</button><button class="ty-btn ty-btn-yes" onclick="tyAnswerYes()">Sim, preciso de ajuda</button></div>`;
  } else if (type === 'support') {
    if (iconEl)  iconEl.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    if (titleEl) titleEl.textContent = 'Suporte 24h';
    if (subEl)   subEl.textContent   = 'Nossa equipe está pronta para te ajudar.';
    if (qEl) qEl.innerHTML = `<p class="ty-q-text">Como podemos te ajudar hoje?</p><div class="ty-btns"><button class="ty-btn ty-btn-no" onclick="_openChatPage()">Abrir chat de atendimento</button><button class="ty-btn ty-btn-yes" onclick="goHome()" style="font-size:.8rem">Voltar para o início</button></div>`;
  }
}
function tyAnswerNo() {
  const q = document.getElementById('tyQuestion');
  if (q) { q.style.opacity='0'; q.style.transform='translateY(6px)'; q.style.transition='opacity .25s ease, transform .25s ease'; setTimeout(()=>{ q.innerHTML='<p class="ty-q-done">Ótimo! Boas consultas.</p>'; q.style.opacity='1'; q.style.transform='translateY(0)'; },260); }
  setTimeout(()=>goHome(), 2400);
}
function tyAnswerYes() { navHist=navHist.filter(p=>p!=='thankyou'); _openChatPage(); }

// ── CHAT STATUS ──
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

// ── CUPOM DE BOAS-VINDAS ──
function showWelcomeCouponModal() {
  const el=document.getElementById('welcomeCouponModal'), title=document.getElementById('wcTitle'), sub=document.getElementById('wcSub'), btn=document.getElementById('wcBtn');
  const isGuest=!currentUser||currentUser.anon;
  if(title)title.textContent=isGuest?'Oferta de boas-vindas':'Cupom ativado!';
  if(sub)sub.textContent=isGuest?'Cadastre-se agora e pague menos. Desconto aplicado automaticamente ao criar sua conta.':'Você ganhou desconto exclusivo de boas-vindas. Os preços já estão com o desconto aplicado para você.';
  if(btn)btn.textContent=isGuest?'Criar conta grátis':'Aproveitar agora';
  if(el)el.classList.add('open');
}
function wcBtnAction() { closeWelcomeCouponModal(); if(!currentUser||currentUser.anon)setTimeout(()=>openModal('modal-register'),180); }
function closeWelcomeCouponModal() {
  document.getElementById('welcomeCouponModal')?.classList.remove('open');
  if(currentUser&&!currentUser.anon) sbPatch('profiles',`id=eq.${encodeURIComponent(currentUser.id)}`,{welcome_coupon_used:true}).catch(()=>{});
}

// ── INPUT DE QUANTIDADE DE CRÉDITOS ──
function onCreditsQtyInput(el) {
  let v=parseInt(el.value)||1; v=Math.max(1,Math.min(100,v)); _creditsQty=v; el.value=v; renderCreditsSummary(); updatePresetsUI();
}

// WALLET — renderização
function goWallet() {
  if(!currentUser||currentUser.anon){openModal('modal-register');return;}
  pushNav('wallet'); showPage('wallet'); renderWallet();
}

function extractDominantColor(imgEl, cb) {
  try {
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=20;
    const ctx=canvas.getContext('2d'); ctx.drawImage(imgEl,0,0,20,20);
    const d=ctx.getImageData(0,0,20,20).data; let r=0,g=0,b=0,n=0;
    for(let i=0;i<d.length;i+=4){ const br=(d[i]+d[i+1]+d[i+2])/3; if(br<40||br>220)continue; r+=d[i];g+=d[i+1];b+=d[i+2];n++; }
    if(n===0){cb(null);return;}
    r=Math.round(r/n);g=Math.round(g/n);b=Math.round(b/n);
    const avg=(r+g+b)/3,boost=1.8;
    r=Math.min(255,Math.round(avg+(r-avg)*boost)); g=Math.min(255,Math.round(avg+(g-avg)*boost)); b=Math.min(255,Math.round(avg+(b-avg)*boost));
    const min=90; r=Math.max(r,min);g=Math.max(g,min);b=Math.max(b,min);
    cb(`rgb(${r},${g},${b})`);
  } catch(e){cb(null);}
}

function applyAvatarColors(container, imgSrc) {
  if(!imgSrc)return;
  const img=new Image(); img.crossOrigin='anonymous';
  img.onload=()=>{ extractDominantColor(img,color=>{ if(!color)return;
    const ring=container.querySelector('.wallet-avatar,.settings-avatar');
    const nameEl=container.querySelector('.wallet-name');
    if(ring){ring.style.border='2.5px solid transparent';ring.style.backgroundImage=`linear-gradient(#09091a,#09091a),linear-gradient(135deg,${color},${color} 30%,#a855f7 60%,${color})`;ring.style.backgroundOrigin='border-box';ring.style.backgroundClip='padding-box,border-box';ring.style.animation='gradAni 3s linear infinite';ring.style.backgroundSize='200% 200%';}
    if(nameEl){nameEl.style.backgroundImage=`linear-gradient(90deg,${color},#a855f7,${color})`;nameEl.style.backgroundSize='300% 100%';nameEl.style.webkitBackgroundClip='text';nameEl.style.backgroundClip='text';nameEl.style.color='transparent';nameEl.style.animation='gradAni 3s linear infinite';}
  }); };
  img.src=imgSrc;
}

function renderWallet() {
  const el=document.getElementById('walletContent'); if(!el)return;
  const email=currentUser.email, credits=getCredits(email), brl=creditsToReal(credits).toFixed(2).replace('.',',');
  const avatar=getUserAvatar(email), limits=PLAN_LIMITS[currentUser.plan], pc=PLAN_BADGE_COLORS[currentUser.plan]||PLAN_BADGE_COLORS.basico;
  const avatarHtml=avatar?`<img src="${avatar}" alt="avatar">`:`<span>${currentUser.name[0].toUpperCase()}</span>`;
  const buyBtn=`<button class="wallet-buy-btn" onclick="goCredits(null)"><svg width="10" height="12" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;display:inline-block;vertical-align:middle"><path d="M16 3L5 3C2.5 3 1 5 1 7C1 9 2.5 11 5 11L15 11C17.5 11 19 13 19 15C19 17 17.5 19 15 19L4 19" stroke="#fff" stroke-width="3" stroke-linecap="square" fill="none"/></svg>${credits>0?'Comprar mais créditos':'Comprar créditos'}</button>`;
  const knowBtn=`<button onclick="goCreditsInfo(null,true)" style="margin-top:10px;font-size:.78rem;font-weight:600;color:rgba(255,255,255,.7);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.18);padding:8px 22px;border-radius:99px;transition:all .2s" onmouseover="this.style.color='#fff';this.style.borderColor='rgba(255,255,255,.3)'" onmouseout="this.style.color='rgba(255,255,255,.7)';this.style.borderColor='rgba(255,255,255,.18)'">Conhecer créditos</button>`;
  el.innerHTML=`<div class="wallet-profile"><div class="wallet-avatar" id="walletAvatar">${avatarHtml}</div><div class="wallet-name" id="walletName">${currentUser.name}</div><div class="wallet-plan" style="color:${pc.color}">${limits.label}</div><div class="wallet-balance"><div class="wallet-balance-label">Saldo disponível</div><div class="wallet-balance-val"${credits>0?'':' style="color:var(--muted);font-size:1.8rem"'}>${brl}</div>${credits>0?`<div class="wallet-balance-sub">${credits} crédito${credits!==1?'s':''}</div>`:''}</div>${buyBtn}${knowBtn}</div>`;
  if(avatar)applyAvatarColors(el,avatar);
}

// ── AVATAR CROP ──
let _cropScale=1,_cropMinScale=1,_cropMaxScale=4,_cropX=0,_cropY=0,_cropSrc=null,_cropCallback=null;
let _cropDragging=false,_cropDragSX=0,_cropDragSY=0,_cropDragOX=0,_cropDragOY=0;
let _pinching=false,_pinchDist0=0,_pinchScale0=1,_pinchMidX=0,_pinchMidY=0,_pinchX0=0,_pinchY0=0;
const _CROP_STAGE=260;

function openCropper(src,cb){
  _cropSrc=src;_cropCallback=cb;
  const img=document.getElementById('ghost-cropImg');
  img.onload=()=>{
    const scaleW=_CROP_STAGE/img.naturalWidth,scaleH=_CROP_STAGE/img.naturalHeight;
    _cropMinScale=Math.max(scaleW,scaleH);_cropMaxScale=_cropMinScale*4;_cropScale=_cropMinScale;
    _cropX=(_CROP_STAGE-(img.naturalWidth*_cropScale))/2;_cropY=(_CROP_STAGE-(img.naturalHeight*_cropScale))/2;
    clampCrop();applyCropTransform();
  };
  img.src=src;
  document.getElementById('ghost-cropOv').classList.add('on');
  initCropDrag();
}
function clampCrop(){
  const img=document.getElementById('ghost-cropImg');
  const w=img.naturalWidth*_cropScale,h=img.naturalHeight*_cropScale;
  if(w<=_CROP_STAGE)_cropX=(_CROP_STAGE-w)/2;else _cropX=Math.min(0,Math.max(_CROP_STAGE-w,_cropX));
  if(h<=_CROP_STAGE)_cropY=(_CROP_STAGE-h)/2;else _cropY=Math.min(0,Math.max(_CROP_STAGE-h,_cropY));
}
function closeCropper(){document.getElementById('ghost-cropOv').classList.remove('on');_cropSrc=null;}
function applyCropTransform(){
  const img=document.getElementById('ghost-cropImg');
  img.style.transform=`translate(${_cropX}px,${_cropY}px) scale(${_cropScale})`;
  img.style.transformOrigin='0 0';
}
function _pinchDist(t){const dx=t[0].clientX-t[1].clientX,dy=t[0].clientY-t[1].clientY;return Math.hypot(dx,dy);}
function _stageOffset(stage){const r=stage.getBoundingClientRect();return{x:r.left,y:r.top};}
function initCropDrag(){
  const stage=document.getElementById('ghost-cropStage');
  stage.ontouchstart=ev=>{
    ev.preventDefault();
    if(ev.touches.length===2){
      _pinching=true;_cropDragging=false;_pinchDist0=_pinchDist(ev.touches);_pinchScale0=_cropScale;
      const off=_stageOffset(stage);
      _pinchMidX=((ev.touches[0].clientX+ev.touches[1].clientX)/2)-off.x;
      _pinchMidY=((ev.touches[0].clientY+ev.touches[1].clientY)/2)-off.y;
      _pinchX0=_cropX;_pinchY0=_cropY;
    }else if(ev.touches.length===1){_pinching=false;_cropDragging=true;_cropDragSX=ev.touches[0].clientX;_cropDragSY=ev.touches[0].clientY;_cropDragOX=_cropX;_cropDragOY=_cropY;}
  };
  stage.ontouchmove=ev=>{
    ev.preventDefault();
    if(_pinching&&ev.touches.length===2){
      const dist=_pinchDist(ev.touches);let newScale=_pinchScale0*(dist/_pinchDist0);
      newScale=Math.max(_cropMinScale,Math.min(_cropMaxScale,newScale));
      const ratio=newScale/_pinchScale0;_cropX=_pinchMidX+(_pinchX0-_pinchMidX)*ratio;_cropY=_pinchMidY+(_pinchY0-_pinchMidY)*ratio;_cropScale=newScale;clampCrop();applyCropTransform();
    }else if(_cropDragging&&ev.touches.length===1){
      _cropX=_cropDragOX+(ev.touches[0].clientX-_cropDragSX);_cropY=_cropDragOY+(ev.touches[0].clientY-_cropDragSY);clampCrop();applyCropTransform();
    }
  };
  stage.ontouchend=ev=>{if(ev.touches.length<2)_pinching=false;if(ev.touches.length===0)_cropDragging=false;};
  stage.onmousedown=ev=>{ev.preventDefault();_cropDragging=true;_cropDragSX=ev.clientX;_cropDragSY=ev.clientY;_cropDragOX=_cropX;_cropDragOY=_cropY;};
  window.onmousemove=ev=>{if(!_cropDragging)return;_cropX=_cropDragOX+(ev.clientX-_cropDragSX);_cropY=_cropDragOY+(ev.clientY-_cropDragSY);clampCrop();applyCropTransform();};
  window.onmouseup=()=>{_cropDragging=false;};
  stage.onwheel=ev=>{ev.preventDefault();const delta=ev.deltaY>0?-0.05:0.05;const off=_stageOffset(stage);const mx=ev.clientX-off.x,my=ev.clientY-off.y;const newScale=Math.max(_cropMinScale,Math.min(_cropMaxScale,_cropScale*(1+delta)));const ratio=newScale/_cropScale;_cropX=mx+(_cropX-mx)*ratio;_cropY=my+(_cropY-my)*ratio;_cropScale=newScale;clampCrop();applyCropTransform();};
}
function confirmCrop(){
  const img=document.getElementById('ghost-cropImg');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=260;
  const ctx=canvas.getContext('2d');
  ctx.beginPath();ctx.arc(130,130,130,0,Math.PI*2);ctx.clip();
  ctx.scale(_cropScale,_cropScale);
  ctx.drawImage(img,_cropX/_cropScale,_cropY/_cropScale);
  const dataUrl=canvas.toDataURL('image/jpeg',.92);
  closeCropper();
  if(_cropCallback)_cropCallback(dataUrl);
}

function triggerAvatarUpload() {
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=e=>{
    const file=e.target.files[0]; if(!file)return;
    const allowed=['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    if(!allowed.includes(file.type)){
      showToast('Formato inválido. Use JPG, PNG, WEBP ou GIF.','error');
      return;
    }
    const doUpload = async dataUrl => {
      const avatarEl=document.querySelector('.settings-avatar');
      if(avatarEl){avatarEl.classList.remove('avatar-swapping');void avatarEl.offsetWidth;avatarEl.classList.add('avatar-swapping');setTimeout(()=>avatarEl.classList.remove('avatar-swapping'),500);}
      const res=await fetch(dataUrl); const blob=await res.blob();
      window._avatarUploadError = null;
      await setUserAvatar(currentUser.email, blob);
      if(window._avatarUploadError) {
        showToast('Erro ao salvar foto: ' + window._avatarUploadError, 'error');
        return;
      }
      if(!currentUser.avatar_url) {
        showToast('Erro ao salvar foto. Verifique bucket "avatars" no Supabase.', 'error');
        return;
      }
      updateNavUser(); renderSettings();
      showToast('Foto atualizada!');
    };
    // GIF pula o cropper pra preservar a animação
    if(file.type==='image/gif'){
      const avatarEl=document.querySelector('.settings-avatar');
      if(avatarEl){avatarEl.classList.remove('avatar-swapping');void avatarEl.offsetWidth;avatarEl.classList.add('avatar-swapping');setTimeout(()=>avatarEl.classList.remove('avatar-swapping'),500);}
      window._avatarUploadError=null;
      setUserAvatar(currentUser.email,file).then(()=>{
        if(window._avatarUploadError){showToast('Erro ao salvar foto: '+window._avatarUploadError,'error');return;}
        if(!currentUser.avatar_url){showToast('Erro ao salvar foto. Verifique bucket "avatars" no Supabase.','error');return;}
        updateNavUser();renderSettings();showToast('Foto animada salva! 🎉');
      });
      return;
    }
    createImageBitmap(file).then(bmp=>{
      const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;
      c.getContext('2d').drawImage(bmp,0,0);
      openCropper(c.toDataURL('image/jpeg',.95), doUpload);
    }).catch(()=>{
      const r=new FileReader();
      r.onload=ev=>openCropper(ev.target.result, doUpload);
      r.readAsDataURL(file);
    });
  }; inp.click();
}

function removeAvatar() {
  if(!currentUser?.email)return;
  const avatarEl=document.querySelector('.settings-avatar');
  if(avatarEl){avatarEl.classList.remove('avatar-swapping');void avatarEl.offsetWidth;avatarEl.classList.add('avatar-swapping');}
  setTimeout(async()=>{
    // deleta do Storage (tenta jpg e png)
    const base=currentUser.email.replace(/[^a-z0-9]/gi,'_');
    for(const ext of ['jpg','png','gif','webp']){
      await sbDeleteAvatar(`${base}.${ext}`);
    }
    if(currentUser)currentUser.avatar_url=null;
    await sbPatch('profiles',`id=eq.${encodeURIComponent(currentUser.id)}`,{avatar_url:null});
    updateNavUser();renderSettings();
    showToast('Foto removida!');
  },220);
}

// HISTÓRICO + SETTINGS
function showToast(msg, type='success') {
  const t=document.createElement('div');
  t.style.cssText=`position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${type==='error'?'#c0392b':'var(--p)'};color:#fff;padding:10px 20px;border-radius:99px;font-size:.82rem;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.4);pointer-events:none;opacity:1;transition:opacity .4s`;
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),400);},3000);
}

function goHistory() { pushNav('history'); renderHistory(); showPage('history'); }
function goSettings() { pushNav('settings'); renderSettings(); showPage('settings'); }
function goUpgradePage() { goPlansFromResults(); closeMenu(); }

function updateMiniBalloon(mod) {
  const el=document.getElementById('qMiniBalloon'), txt=document.getElementById('qMiniBalloonTxt');
  if(!el||!txt)return;
  const plan=currentUser?.plan||'basico', limits=PLAN_LIMITS[plan], lim=limits[mod];
  if(lim===-1||lim===undefined){el.style.display='none';return;}
  const left=getModLeft(mod);
  if(left===Infinity){el.style.display='none';return;}
  el.style.display='inline-flex';
  el.className='q-mini-balloon'+(left===0?' danger':left<=3?' warn':'');
  if(left===0){
    const modUsed=queryCounters[mod]||0,modLimit=limits[mod],totalUsed=Object.values(queryCounters).reduce((a,b)=>a+b,0),totalLeft=limits.total===999?Infinity:Math.max(0,limits.total-totalUsed);
    let msg;
    if(modUsed===0&&totalLeft===0)msg='<strong>Sem consultas</strong> — limite diário total atingido';
    else if(modUsed>=modLimit)msg='<strong>Sem consultas</strong> — limite deste módulo atingido';
    else if(totalLeft===0)msg='<strong>Sem consultas</strong> — limite diário total atingido';
    else msg='<strong>Sem consultas</strong> — limite atingido';
    txt.innerHTML=msg;
  } else {
    txt.innerHTML=`<strong>${left}</strong> consulta${left!==1?'s':''} restante${left!==1?'s':''}`;
  }
}

function renderHistory() {
  const el=document.getElementById('historyContent'); if(!el)return;
  if(!currentUser||currentUser.anon){el.innerHTML=`<div class="hist-empty">Faça login para usar o histórico.</div>`;return;}
  const enabled=histEnabled(), list=LS.get(HIST_KEY(currentUser.email))||[];
  const months={};
  list.forEach(item=>{const d=new Date(item.ts),key=`${d.getFullYear()}-${d.getMonth()}`,label=d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});if(!months[key])months[key]={label,items:[]};months[key].items.push(item);});
  const typeIco={
    consulta:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
    credito: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    plano:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    produto: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  };
  let html=`<div class="hist-toggle-row"><div class="hist-toggle-info"><div class="hist-toggle-title">Salvar histórico</div><div class="hist-toggle-sub">Suas consultas, compras de créditos, planos e produtos ficam salvos na sua conta.</div></div><label class="hist-toggle"><input type="checkbox" id="histToggleChk" ${enabled?'checked':''} onchange="histSetEnabled(this.checked);renderHistory()"><span class="hist-slider"></span></label></div>`;
  if(!enabled){html+=`<div class="hist-empty">Ative o histórico para começar a registrar suas atividades.</div>`;el.innerHTML=html;return;}
  if(list.length===0){html+=`<div class="hist-empty">Nenhuma atividade registrada ainda.<br>As próximas consultas e transações aparecerão aqui.</div>`;el.innerHTML=html;return;}
  html+=`<div class="hist-list-wrap" id="histListWrap">`;
  Object.values(months).forEach(({label,items})=>{
    html+=`<div class="hist-month">${label}</div>`;
    items.forEach(item=>{
      const d=new Date(item.ts),dateStr=d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})+' · '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      const valStr=item.free?'Grátis':item.value?`R$ ${Number(item.value).toFixed(2).replace('.',',')}`:'—';
      const valClass=item.free?'free':item.value?'paid':'';
      let ico=typeIco[item.type]||typeIco.consulta,icoColor='var(--p)',label2='',sublabel=item.name;
      if(item.type==='consulta'){const sep=item.name.indexOf(' — ');if(sep!==-1){label2=item.name.slice(0,sep);sublabel=item.name.slice(sep+3);}const modKey=Object.entries(MODS).find(([k,v])=>v.name===label2)?.[0];if(modKey&&MOD_SVGS[modKey]){ico=MOD_SVGS[modKey].replace('width="22" height="22"','width="14" height="14"');icoColor=modKey==='foto'?'var(--p3)':'var(--p)';}}else{label2=item.name;sublabel='';}
      html+=`<div class="hist-item"><div class="hist-ico" style="color:${icoColor}">${ico}</div><div class="hist-info"><div class="hist-name">${label2}</div>${sublabel?`<div class="hist-date" style="color:var(--muted2);font-size:.72rem;margin-top:1px">${sublabel}</div>`:''}<div class="hist-date">${dateStr}</div></div><div class="hist-val ${valClass}">${valStr}</div></div>`;
    });
  });
  html+=`</div><button class="hist-delete-btn" onclick="document.getElementById('confirmClearHistory').classList.add('open')">Apagar histórico</button>`;
  el.innerHTML=html;
}

function renderSettings() {
  const el=document.getElementById('settingsContent'); if(!el)return;
  if(!currentUser||currentUser.anon){el.innerHTML=`<div class="settings-card"><div class="settings-card-title">Conta</div><div class="settings-row" style="padding:16px;flex-direction:column;gap:10px;align-items:stretch"><p style="font-size:.82rem;color:var(--muted);line-height:1.6">Você está navegando como visitante. Crie uma conta para salvar seu plano e histórico.</p><button class="modal-submit" onclick="openModal('modal-register');goBack()">Criar conta</button></div></div>`;return;}
  const limits=PLAN_LIMITS[currentUser.plan], totalUsed=Object.values(queryCounters).reduce((a,b)=>a+b,0), totalLim=limits.total===999?'∞':limits.total, planClass='plan-badge-'+currentUser.plan;
  const planExpiresAt=currentUser.planExpiresAt||null;
  let expiryHtml='', expiryBanner='';
  if(planExpiresAt){
    const days=Math.ceil((planExpiresAt-Date.now())/86400000),color=days<=2?'#f87171':days<=5?'#fbbf24':'#4ade80';
    if(days>0){expiryHtml=`<div class="settings-row"><span class="settings-row-label">Expira em</span><span class="settings-row-val" style="color:${color};font-weight:700">${days} dia${days!==1?'s':''}</span></div>`;if(days<=3)expiryBanner=`<div style="background:rgba(251,191,36,.07);border:1px solid rgba(251,191,36,.25);border-radius:.65rem;padding:12px 14px;margin-bottom:12px;font-size:.78rem;color:#fbbf24;line-height:1.5">⚠️ Seu plano <strong>${limits.label}</strong> expira em ${days} dia${days!==1?'s':''}. Renove para não perder o acesso.</div>`;}
    else expiryBanner=`<div style="background:rgba(248,113,113,.07);border:1px solid rgba(248,113,113,.25);border-radius:.65rem;padding:12px 14px;margin-bottom:12px;font-size:.78rem;color:#f87171;line-height:1.5">❌ Seu plano expirou. Você foi movido para o plano Básico. <button onclick="goHome();setTimeout(()=>{document.getElementById('plans')?.scrollIntoView({behavior:'smooth'})},150)" style="color:var(--p3);font-weight:700;text-decoration:underline">Renovar agora</button></div>`;
  }
  const modRows=Object.entries(limits).filter(([k])=>!['label','total'].includes(k)).map(([mod,lim])=>{const m=MODS[mod];if(!m)return'';const used=queryCounters[mod]||0,limTxt=lim===-1?'∞':lim===0?'—':lim,pct=lim>0&&lim!==999?Math.min(100,(used/lim)*100):(used>0?30:0),barColor=lim===0?'rgba(255,255,255,.1)':pct>=90?'#f87171':pct>=60?'#fbbf24':'var(--p)';return`<div class="settings-row"><span class="settings-row-label">${m.name}</span><div class="settings-progress-wrap"><span class="settings-progress-txt">${lim===0?'Não incluso':`${used} / ${limTxt}`}</span>${lim!==0?`<div class="settings-progress-bar"><div class="settings-progress-fill" style="width:${pct}%;background:${barColor}"></div></div>`:''}</div></div>`;}).join('');
  const credBal=getCredits(currentUser.email),credBrl=creditsToReal(credBal).toFixed(2).replace('.',',');
  const credCard=credBal>0?`<div class="settings-card"><div class="settings-card-title">Créditos avulsos</div><div class="settings-row"><span class="settings-row-label">Saldo</span><span class="settings-row-val" style="font-weight:700;background:var(--grad-text);background-size:400% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:gradAni 4s linear infinite">${credBrl}</span></div><div class="settings-row"><span class="settings-row-label">Créditos</span><span class="settings-row-val">${credBal} créditos</span></div><div class="settings-row" style="padding:10px 16px"><button onclick="goCreditsInfo(null,true)" style="font-size:.72rem;font-weight:600;color:var(--muted2);background:rgba(255,255,255,.04);border:1px solid var(--border);padding:5px 14px;border-radius:99px;transition:all .15s" onmouseover="this.style.color='var(--fg)'" onmouseout="this.style.color='var(--muted2)'">Comprar mais →</button></div></div>`:`<div class="settings-card"><div class="settings-card-title">Créditos avulsos</div><div class="settings-row" style="padding:12px 16px;flex-direction:column;gap:8px;align-items:flex-start"><span style="font-size:.78rem;color:var(--muted)">Sem créditos. Use para consultas avulsas sem precisar de plano.</span><button onclick="goCreditsInfo(null,true)" style="font-size:.72rem;font-weight:600;color:var(--p3);background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.2);padding:5px 14px;border-radius:99px;transition:all .15s">Ver créditos →</button></div></div>`;
  const avatarSrc=getUserAvatar(currentUser.email);
  el.innerHTML=`${expiryBanner}<div class="settings-card"><div class="settings-card-title">Perfil</div><div class="settings-avatar-wrap"><div class="settings-avatar" onclick="triggerAvatarUpload()" style="cursor:pointer" title="Trocar foto">${avatarSrc?`<img src="${avatarSrc}" alt="avatar">`:`<span>${currentUser.name[0].toUpperCase()}</span>`}</div><div class="settings-avatar-info"><div class="settings-avatar-name">${currentUser.name}</div><button onclick="triggerAvatarUpload()" class="btn-trocar-foto">Trocar foto</button>${avatarSrc?`<button onclick="removeAvatar()" style="margin-top:4px;margin-left:6px;font-size:.7rem;font-weight:500;color:var(--muted);background:rgba(255,255,255,.05);padding:4px 12px;border-radius:99px;border:1px solid var(--border);transition:all .15s">Remover</button>`:''}</div></div><div class="settings-row"><span class="settings-row-label">E-mail</span><span class="settings-row-val" style="-webkit-user-select:text;user-select:text">${currentUser.email}</span></div><div class="settings-row"><span class="settings-row-label">Plano</span><span class="settings-plan-badge ${planClass}">${limits.label}</span></div>${expiryHtml}</div>${credCard}<div class="settings-card"><div class="settings-card-title">Editar dados</div><div class="settings-row" style="flex-direction:column;align-items:stretch;gap:10px;padding:14px 16px"><div><label class="modal-label" style="margin-bottom:5px;display:block">Nome</label><input id="set-nome" class="modal-input" type="text" value="${currentUser.name}" placeholder="Seu nome" style="width:100%"></div><div><label class="modal-label" style="margin-bottom:5px;display:block">Nova senha</label><div class="modal-input-wrap"><input id="set-senha" class="modal-input" type="password" placeholder="Mínimo 5 caracteres" style="width:100%;padding-right:42px"><button class="modal-eye" onclick="togglePw('set-senha','set-senha-eye')" id="set-senha-eye"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div><div><label class="modal-label" style="margin-bottom:5px;display:block">Confirmar senha</label><input id="set-conf" class="modal-input" type="password" placeholder="Repita a nova senha" style="width:100%"></div><div id="set-msg" class="set-msg"></div><button class="modal-submit" onclick="saveProfileChanges()" style="margin-top:2px">Salvar alterações</button></div></div><div class="settings-card"><div class="usage-toggle-btn" onclick="toggleUsageDetail()"><span class="settings-card-title" style="border-bottom:none;padding:0">Uso hoje — ${todayStr()}</span><span class="usage-toggle-label"><span id="usageArrow" class="usage-toggle-arrow">▼</span> ver detalhes</span></div><div class="settings-row"><span class="settings-row-label">Total geral</span><div class="settings-progress-wrap"><span class="settings-progress-txt">${totalUsed} / ${totalLim}</span>${limits.total!==999?`<div class="settings-progress-bar"><div class="settings-progress-fill" style="width:${Math.min(100,(totalUsed/limits.total)*100)}%"></div></div>`:''}</div></div><div id="usageDetail" style="max-height:0;overflow:hidden;transition:max-height .32s cubic-bezier(.4,0,.2,1)">${modRows}</div></div><div class="settings-card"><div class="settings-card-title">Preferências</div><div class="settings-row"><span class="settings-row-label">Cursor personalizado</span><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><span style="font-size:.72rem;color:var(--muted)" id="cursorToggleLbl">${LS.get('ghost_cursor_enabled')!==false?'Ativado':'Desativado'}</span><div onclick="toggleCursorPref(this)" style="width:38px;height:22px;border-radius:99px;background:${LS.get('ghost_cursor_enabled')!==false?'var(--p)':'rgba(255,255,255,.12)'};position:relative;transition:background .2s;flex-shrink:0" id="cursorToggle"><div style="position:absolute;top:3px;left:${LS.get('ghost_cursor_enabled')!==false?'19px':'3px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.3)" id="cursorToggleThumb"></div></div></label></div></div><div class="settings-card"><div class="settings-card-title">Conta</div><div class="settings-row" style="padding:16px"><button class="btn-logout" onclick="logoutUser()">Sair da conta</button></div></div>`;
}

function toggleCursorPref(toggle) {
  const enabled=LS.get('ghost_cursor_enabled')!==false, newVal=!enabled;
  LS.set('ghost_cursor_enabled',newVal);
  if(toggle){toggle.style.background=newVal?'var(--p)':'rgba(255,255,255,.12)';const thumb=document.getElementById('cursorToggleThumb');if(thumb)thumb.style.left=newVal?'19px':'3px';}
  const lbl=document.getElementById('cursorToggleLbl'); if(lbl)lbl.textContent=newVal?'Ativado':'Desativado';
  if(window._setCursorEnabled)window._setCursorEnabled(newVal);
}

function toggleUsageDetail() {
  const d=document.getElementById('usageDetail'),arrow=document.getElementById('usageArrow'),label=document.querySelector('.usage-toggle-label');
  if(!d)return;
  const open=d.style.maxHeight&&d.style.maxHeight!=='0px';
  d.style.maxHeight=open?'0px':d.scrollHeight+'px';
  if(arrow)arrow.classList.toggle('open',!open);
  if(label){label.style.transition='color .2s ease';label.style.color='var(--p3)';setTimeout(()=>{label.style.color='var(--p)';},1500);}
}

// ── CHAT DE SUPORTE ──
let _chatLastSend   = 0;
let _chatMsgTimes   = [];
let _chatMessages   = [];
let _chatPollInterval = null;
let _chatAdminAvatar = null;
let _chatAdminName = null;
let _adminAvatarChannel = null;

function _startChatPoll() {
  _stopChatPoll();
  if(!currentUser||currentUser.anon)return;
  _chatPollInterval=setInterval(async()=>{
    const msgs=await sbGet('chats',`user_key=eq.${encodeURIComponent(currentUser.email)}&order=created_at.asc`);
    if(!msgs)return;
    msgs.filter(m=>m.role==='admin').forEach(m=>{
      const already=_chatMessages.find(x=>x._id===m.id);
      if(!already){const msg={own:false,text:m.message,time:_chatFmtTime(new Date(m.created_at)),_id:m.id,admin_name:m.admin_name||null};_chatMessages.push(msg);_appendChatBubble(msg,true);try{LS.set('ghost_chat_msgs',_chatMessages.slice(-50));}catch(_){}}
    });
  },2000);
}
function _stopChatPoll() { clearInterval(_chatPollInterval); _chatPollInterval=null; }

function goChat() {
  if(!currentUser||currentUser.anon){openModal('modal-login');return;}
  setTimeout(initChatStatus,80);
  showThankYou('support',null);
}

async function _loadChatAdminAvatar() {
  try{
    const msgs=await sbGet('chats',`user_key=eq.${encodeURIComponent(currentUser?.email||'')}&role=eq.admin&order=created_at.desc&limit=1`);
    const adminName=msgs?.[0]?.admin_name||null;
    const query=adminName?`select=avatar_url,display_name&display_name=eq.${encodeURIComponent(adminName)}&limit=1`:`select=avatar_url,display_name&avatar_url=not.is.null&limit=1`;
    const rows=await sbGet('admins',query);
    _chatAdminAvatar=rows?.[0]?.avatar_url||null;
    _chatAdminName=rows?.[0]?.display_name||adminName||null;
    // se achou o admin pelo nome mas sem foto, tenta qualquer admin com foto
    if(adminName&&!_chatAdminAvatar){
      const fallback=await sbGet('admins',`select=avatar_url&avatar_url=not.is.null&limit=1`);
      _chatAdminAvatar=fallback?.[0]?.avatar_url||null;
    }
  }catch{_chatAdminAvatar=null;_chatAdminName=null;}
}
function _subscribeAdminAvatar() {
  if(_adminAvatarChannel)return;
  const sb=window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON):null;
  if(!sb)return;
  _adminAvatarChannel=sb.channel('admin-avatar').on('postgres_changes',{event:'UPDATE',schema:'public',table:'admins'},payload=>{if(payload.new?.avatar_url)_chatAdminAvatar=payload.new.avatar_url;}).subscribe();
}

async function _openChatPage() {
  pushNav('chat');showPage('chat');
  _renderChatUserAvatar();_setChatWelcomeTime();
  await _loadChatAdminAvatar();_subscribeAdminAvatar();
  if(currentUser&&!currentUser.anon){
    const msgs=await sbGet('chats',`user_key=eq.${encodeURIComponent(currentUser.email)}&order=created_at.asc`);
    if(msgs&&msgs.length>0){_chatMessages=msgs.map(m=>({own:m.role==='user',text:m.message,time:_chatFmtTime(new Date(m.created_at)),_id:m.id,admin_name:m.admin_name||null}));try{LS.set('ghost_chat_msgs',_chatMessages.slice(-50));}catch(_){}  _renderChatMessages();}
  }
  _startChatPoll();
}

function _setChatWelcomeTime() { const el=document.getElementById('chatWelcomeTime');if(el)el.textContent=_chatFmtTime(new Date()); }

function _renderChatUserAvatar() {
  const el=document.getElementById('chatUserAvatar');if(!el)return;
  const plan=currentUser?.plan||'basico',avatar=currentUser?.email?getUserAvatar(currentUser.email):null,name=currentUser?.name||'Visitante',initial=name[0]?.toUpperCase()||'V';
  const PLAN_RING={basico:'rgba(74,222,128,.7)',starter:'rgba(168,85,247,.8)',pro:'linear-gradient(135deg,#a855f7,#c026d3)',premium:'linear-gradient(135deg,#f472b6,#c026d3)'};
  el.style.background=PLAN_RING[plan]||PLAN_RING.basico;
  el.innerHTML=avatar?`<img src="${avatar}" alt="${initial}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span style="font-size:.75rem;font-weight:700;color:#fff">${initial}</span>`;
  el.dataset.plan=plan;
}

function openChatProfile() {
  const pop=document.getElementById('chatProfilePopover'),av=document.getElementById('cppAvatar'),nm=document.getElementById('cppName'),pl=document.getElementById('cppPlan');
  if(!pop)return;
  const plan=currentUser?.plan||'basico',avatar=currentUser?.email?getUserAvatar(currentUser.email):null,name=currentUser?.name||'Visitante',initial=name[0]?.toUpperCase()||'V';
  const PC={basico:'#4ade80',starter:'#a855f7',pro:'#c026d3',premium:'#f472b6'},PL={basico:'Plano Básico',starter:'Plano Starter',pro:'Plano Pro',premium:'Plano Premium'};
  av.innerHTML=avatar?`<img src="${avatar}" alt="${initial}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span style="font-size:1.1rem;font-weight:700;color:#fff">${initial}</span>`;
  av.style.background=avatar?'transparent':'var(--grad)';
  nm.textContent=name;pl.textContent=PL[plan]||'Plano Básico';pl.style.color=PC[plan]||'#4ade80';
  pop.classList.add('open');
  setTimeout(()=>document.addEventListener('click',_closeChatProfileOutside),10);
}
function closeChatProfile(){document.getElementById('chatProfilePopover')?.classList.remove('open');document.removeEventListener('click',_closeChatProfileOutside);}
function _closeChatProfileOutside(e){const pop=document.getElementById('chatProfilePopover');if(pop&&!pop.contains(e.target)&&e.target.id!=='chatUserAvatar')closeChatProfile();}

function openAdminInspect(){
  const pop=document.getElementById('adminInspectPopover');if(!pop)return;
  const name=_chatAdminName||'Admin';
  const av=document.getElementById('aipAvatar');
  if(av)av.innerHTML=_chatAdminAvatar?`<img src="${_chatAdminAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span style="font-size:1.1rem;font-weight:700;color:#fff">${name[0].toUpperCase()}</span>`;
  const nm=document.getElementById('aipName');if(nm)nm.textContent=name;
  pop.classList.add('open');
  setTimeout(()=>document.addEventListener('click',_closeAdminInspectOutside),10);
}
function closeAdminInspect(){document.getElementById('adminInspectPopover')?.classList.remove('open');document.removeEventListener('click',_closeAdminInspectOutside);}
function _closeAdminInspectOutside(e){const pop=document.getElementById('adminInspectPopover');if(pop&&!pop.contains(e.target)&&!e.target.classList.contains('chat-admin-av-img')&&!e.target.classList.contains('chat-admin-av-fallback'))closeAdminInspect();}
function _chatFmtTime(d){return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}

function _renderChatMessages() {
  const container=document.getElementById('chatMessages');if(!container)return;
  container.querySelectorAll('.chat-msg-row,.chat-admin-header').forEach(m=>m.remove());
  _chatMessages.forEach((msg,i)=>_appendChatBubble(msg,false,i));
  container.scrollTop=container.scrollHeight;
}

function _shouldShowAvatar(index,messages){if(index===0)return true;return messages[index].own!==messages[index-1].own;}

function _appendChatBubble(msg,animate=true,msgIndex=null) {
  const container=document.getElementById('chatMessages');if(!container)return;
  if(msgIndex===null)msgIndex=_chatMessages.length-1;
  const showHeader=_shouldShowAvatar(msgIndex,_chatMessages);

  if(!msg.own&&showHeader){
    const adminName=msg.admin_name||_chatAdminName||'Admin';
    const headerRow=document.createElement('div');
    headerRow.className='chat-admin-header'+(animate?' anim-in':'');
    const avHtml=_chatAdminAvatar
      ?`<img src="${_chatAdminAvatar}" class="chat-admin-av-img" onclick="openAdminInspect()" alt="${escStr(adminName)}">`
      :`<div class="chat-admin-av-fallback" onclick="openAdminInspect()">${escStr(adminName)[0].toUpperCase()}</div>`;
    headerRow.innerHTML=`${avHtml}<span class="chat-admin-name">${escStr(adminName)}</span>`;
    container.appendChild(headerRow);
  }

  const row=document.createElement('div');
  row.className='chat-msg-row'+(msg.own?' own':'');
  if(animate)row.style.animation='chatMsgIn .25s cubic-bezier(.34,1.56,.64,1) both';
  if(msg.own){
    row.innerHTML=`<div class="chat-bubble own">${escStr(msg.text)}<span class="chat-bubble-time">${msg.time}</span></div>`;
  }else{
    row.innerHTML=`<div class="chat-bubble ghost">${escStr(msg.text)}<span class="chat-bubble-time">${msg.time}</span></div>`;
  }
  container.appendChild(row);container.scrollTop=container.scrollHeight;
}

function autoResizeChatInput(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';const counter=document.getElementById('chatInputCounter');if(counter)counter.textContent=500-el.value.length;}
function chatInputKeydown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatMessage();}}

function sendChatMessage() {
  const inp=document.getElementById('chatInput');if(!inp)return;
  const text=inp.value.trim();if(!text)return;
  const now=Date.now();
  if(now-_chatLastSend<CHAT_COOLDOWN_MS){const sec=Math.ceil((CHAT_COOLDOWN_MS-(now-_chatLastSend))/1000);_showChatWarn(`Aguarde ${sec}s antes de enviar outra mensagem.`);return;}
  _chatMsgTimes=_chatMsgTimes.filter(t=>now-t<60000);
  if(_chatMsgTimes.length>=CHAT_MAX_PER_MIN){_showChatWarn('Muitas mensagens em pouco tempo. Aguarde um momento.');return;}
  const lower=text.toLowerCase();
  if(CHAT_BLOCKED_WORDS.some(w=>lower.includes(w))){_showChatWarn('Sua mensagem contém conteúdo inadequado.');return;}
  _chatLastSend=now;_chatMsgTimes.push(now);
  const warnEl=document.getElementById('chatRateWarn');if(warnEl){warnEl.textContent='';warnEl.style.display='none';}
  const msg={own:true,text,time:_chatFmtTime(new Date())};
  _chatMessages.push(msg);_appendChatBubble(msg,true);
  inp.value='';inp.style.height='auto';
  const counter=document.getElementById('chatInputCounter');if(counter)counter.textContent='500';
  try{LS.set('ghost_chat_msgs',_chatMessages.slice(-50));}catch(_){}
  if(currentUser&&!currentUser.anon)sbPost('chats',{user_key:currentUser.email,role:'user',message:text,read_by_admin:false});
}
function _showChatWarn(msg){const el=document.getElementById('chatRateWarn');if(!el)return;el.textContent=msg;el.style.display='block';el.style.animation='chatWarnIn .2s ease both';clearTimeout(el._hideTimer);el._hideTimer=setTimeout(()=>{el.style.display='none';},3500);}

document.addEventListener('DOMContentLoaded',()=>{
  const saved=LS.get('ghost_chat_msgs');
  if(Array.isArray(saved))_chatMessages=saved;
  const wel=document.getElementById('chatWelcomeTime');
  if(wel)wel.textContent=_chatFmtTime(new Date());
});

// CANVAS 3D + EFEITOS VISUAIS
(function(){
  const canvas=document.getElementById('room3d');
  const isMobile=window.innerWidth<900;
  const NPARTS=isMobile?10:22, INTERVAL=isMobile?1000/30:1000/45;
  const ctx=canvas.getContext('2d');
  let W,H,cx,cy;
  function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;cx=W/2;cy=H/2;}
  window.addEventListener('resize',resize);resize();
  let rx=0,ry=0,vx=0.00010,vy=0.00016;
  let targetOpacity=0.45;
  const pageObs=new MutationObserver(mutations=>{for(const m of mutations){if(m.target.classList.contains('active')){targetOpacity=m.target.id==='page-home'?0.45:0.08;break;}}});
  document.querySelectorAll('.page').forEach(p=>pageObs.observe(p,{attributes:true,attributeFilter:['class']}));
  const S=1.4,DIVS=6;
  const corners=[[-S,-S,-S],[S,-S,-S],[S,S,-S],[-S,S,-S],[-S,-S,S],[S,-S,S],[S,S,S],[-S,S,S]];
  const boxEdges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const gridSegs=[];
  for(let i=0;i<=DIVS;i++){const t=-S+(2*S/DIVS)*i;gridSegs.push([[t,S,-S],[t,S,S],0]);gridSegs.push([[-S,S,t],[S,S,t],0]);gridSegs.push([[t,-S,-S],[t,-S,S],1]);gridSegs.push([[-S,-S,t],[S,-S,t],1]);gridSegs.push([[t,-S,-S],[t,S,-S],2]);gridSegs.push([[-S,t,-S],[S,t,-S],2]);gridSegs.push([[t,-S,S],[t,S,S],3]);gridSegs.push([[-S,t,S],[S,t,S],3]);gridSegs.push([[-S,t,-S],[-S,t,S],4]);gridSegs.push([[-S,-S,t],[-S,S,t],4]);gridSegs.push([[S,t,-S],[S,t,S],5]);gridSegs.push([[S,-S,t],[S,S,t],5]);}
  function makeParticle(){const depth=Math.random(),z=-S+depth*2*S,speed=0.0002+depth*0.0006;return{x:(Math.random()-.5)*2*S,y:(Math.random()-.5)*2*S,z,vx:(Math.random()-.5)*speed,vy:(Math.random()-.5)*speed,vz:(Math.random()-.5)*speed*0.5,size:0.3+depth*2.2,alpha:0.1+depth*0.55,trail:[]};}
  const particles=Array.from({length:NPARTS},makeParticle);
  function rotX(p,a){const[x,y,z]=p,c=Math.cos(a),s=Math.sin(a);return[x,y*c-z*s,y*s+z*c];}
  function rotY(p,a){const[x,y,z]=p,c=Math.cos(a),s=Math.sin(a);return[x*c+z*s,y,-x*s+z*c];}
  function proj(p){const fov=Math.min(W,H)*.72,z=p[2]+2.2;if(z<=0.01)return null;return[cx+p[0]/z*fov,cy+p[1]/z*fov,z];}
  function tf(p){return proj(rotY(rotX(p,rx),ry));}
  const fc=[[168,85,247],[168,85,247],[192,38,211],[232,121,160],[168,85,247],[168,85,247]];
  const CUBE_TRAIL_LEN=4;let cubeTrail=[],last=0;
  function loop(ts){
    requestAnimationFrame(loop);if(document.hidden)return;if(ts-last<INTERVAL)return;const dt=Math.min(ts-last,40);last=ts;
    rx+=vx*dt;ry+=vy*dt;
    const cur=parseFloat(canvas.style.opacity)||0.45;canvas.style.opacity=cur+(targetOpacity-cur)*0.06;
    const snap=corners.map(c=>tf(c));cubeTrail.push(snap);if(cubeTrail.length>CUBE_TRAIL_LEN)cubeTrail.shift();
    ctx.fillStyle=isMobile?'rgba(11,11,20,0.55)':'rgba(11,11,20,0.72)';ctx.fillRect(0,0,W,H);
    for(const[a,b,f]of gridSegs){const pa=tf(a),pb=tf(b);if(!pa||!pb)continue;const[r,g,bl]=fc[f];const al=Math.max(0,.10-((pa[2]+pb[2])/2-1)*.025);ctx.beginPath();ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.strokeStyle=`rgba(${r},${g},${bl},${al})`;ctx.lineWidth=.55;ctx.stroke();}
    cubeTrail.forEach((snap,ti)=>{const a=(ti+1)/cubeTrail.length*0.09;ctx.strokeStyle=`rgba(168,85,247,${a})`;ctx.lineWidth=.7;for(const[i,j]of boxEdges){const a2=snap[i],b2=snap[j];if(!a2||!b2)continue;ctx.beginPath();ctx.moveTo(a2[0],a2[1]);ctx.lineTo(b2[0],b2[1]);ctx.stroke();}});
    ctx.strokeStyle='rgba(168,85,247,.28)';ctx.lineWidth=1;for(const[i,j]of boxEdges){const a=tf(corners[i]),b=tf(corners[j]);if(!a||!b)continue;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(Math.abs(p.x)>S)p.vx*=-1;if(Math.abs(p.y)>S)p.vy*=-1;if(Math.abs(p.z)>S)p.vz*=-1;const pt=tf([p.x,p.y,p.z]);if(!pt)continue;const depth=(p.z+S)/(2*S);if(depth>0.4){p.trail.push([pt[0],pt[1]]);if(p.trail.length>5)p.trail.shift();for(let ti=0;ti<p.trail.length-1;ti++){const ta=(ti/p.trail.length)*p.alpha*0.45,tr=(p.size/Math.max(.5,pt[2]))*(ti/p.trail.length)*0.8;ctx.beginPath();ctx.arc(p.trail[ti][0],p.trail[ti][1],Math.max(0.3,tr),0,Math.PI*2);ctx.fillStyle=`rgba(168,85,247,${ta})`;ctx.fill();}}else{p.trail=[];}const r=Math.max(1,p.size/Math.max(.5,pt[2])),al=Math.min(0.9,p.alpha*Math.min(1,1.5/pt[2])*(isMobile?1.6:1));ctx.beginPath();ctx.arc(pt[0],pt[1],r,0,Math.PI*2);ctx.fillStyle=`rgba(168,85,247,${al})`;ctx.fill();}
  }
  requestAnimationFrame(loop);
})();

// ── LUZ HERO ──
(function(){
  const light=document.getElementById('hero-light');if(!light)return;
  let tx=0,ty=0,cx=0,cy=0;
  document.addEventListener('mousemove',e=>{tx=(e.clientX-window.innerWidth/2)*0.18;ty=(e.clientY-window.innerHeight/2)*0.14;});
  function animLight(){cx+=(tx-cx)*0.06;cy+=(ty-cy)*0.06;light.style.transform=`translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`;requestAnimationFrame(animLight);}
  requestAnimationFrame(animLight);
  const obs=new MutationObserver(mutations=>{for(const m of mutations){if(m.target.classList.contains('active')){light.classList.toggle('hidden',m.target.id!=='page-home');break;}}});
  document.querySelectorAll('.page').forEach(p=>obs.observe(p,{attributes:true,attributeFilter:['class']}));
})();

function detectDevice(){const isDesktop=window.innerWidth>=900;document.body.classList.toggle('is-desktop',isDesktop);document.body.classList.toggle('is-mobile',!isDesktop);}
detectDevice();window.addEventListener('resize',detectDevice);

// SCROLL FADE (plans)
(function(){
  const targets=document.querySelectorAll('#plans .plans-label, #plans .plans-title, #plans .plans-sub, #plans .plans-carousel-wrap, #plans .plans-dots, #plans .plans-drag-hint');
  targets.forEach(el=>el.classList.add('scroll-fade'));
  const obs=new IntersectionObserver(entries=>{entries.forEach(en=>{if(en.isIntersecting){en.target.classList.add('visible');obs.unobserve(en.target);}});},{threshold:0.1});
  targets.forEach(el=>obs.observe(el));
})();

// ── FIX OVERFLOW SCROLL ──
document.querySelectorAll('.page').forEach(p=>{p.addEventListener('transitionend',()=>{if(!document.querySelector('.modal-overlay.open')&&!document.getElementById('navDropdown')?.classList.contains('open'))document.body.style.overflow='';});});

// TILT 3D — CARDS DE CRÉDITO
(function(){
  function initCinfoCards(){document.querySelectorAll('.cinfo-card').forEach(card=>{card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`perspective(500px) rotateX(${-y*10}deg) rotateY(${x*10}deg) translateY(-3px)`;});card.addEventListener('mouseleave',()=>{card.style.transform='';card.style.transition='transform .4s ease, border-color .25s, background .25s, box-shadow .25s';setTimeout(()=>card.style.transition='',400);});let pressTimer;card.addEventListener('touchstart',()=>{pressTimer=setTimeout(()=>{card.style.transform='scale(1.04)';card.style.boxShadow='0 16px 40px rgba(0,0,0,.4), 0 0 0 1px rgba(168,85,247,.2)';},400);},{passive:true});card.addEventListener('touchend',()=>{clearTimeout(pressTimer);card.style.transform='';card.style.boxShadow='';});});}
  const cinfoPage=document.getElementById('page-credits-info');
  if(cinfoPage)new MutationObserver(()=>{if(cinfoPage.classList.contains('active'))initCinfoCards();}).observe(cinfoPage,{attributes:true,attributeFilter:['class']});
})();

// ── INICIALIZAÇÃO ──
(function() {
  try{history.replaceState({page:'home'},'',location.href);}catch(_){}
  showPage('home',false);
  // _loadSession é chamado pelo DOMContentLoaded em core.js
  setTimeout(function(){initDiscountBanner();},500);
})();

// ── CONTADOR DE CONSULTAS ──
(function(){
  const el=document.getElementById('heroConsultas');if(!el)return;
  const KEY='ghost_total_queries';let total=LS.get(KEY)||25000;
  function fmt(n){if(n>=1000000)return'+'+( n/1000000).toFixed(1).replace('.0','')+'M';if(n>=1000)return'+'+Math.floor(n/1000)+'k';return'+'+n;}
  function syncReal(){const email=window.currentUser?.email;if(!email||window.currentUser?.anon)return;const ever=LS.get(`ghost_ever_${email}`)||0,lastSync=LS.get(`ghost_tq_sync_${email}`)||0,diff=ever-lastSync;if(diff>0){total+=diff;LS.set(KEY,total);LS.set(`ghost_tq_sync_${email}`,ever);el.textContent=fmt(total);}}
  function tick(){const delay=8000+Math.random()*12000;setTimeout(()=>{total+=Math.floor(Math.random()*4)+1;LS.set(KEY,total);el.textContent=fmt(total);syncReal();tick();},delay);}
  el.textContent=fmt(total);syncReal();tick();
})();

// ── SPLASH ──
(function(){
  const s=document.getElementById('splash');if(!s)return;
  const doFade=()=>{requestAnimationFrame(()=>{requestAnimationFrame(()=>{s.classList.add('fade');setTimeout(()=>s.remove(),450);});});};
  if(document.fonts&&document.fonts.ready)Promise.race([document.fonts.ready,new Promise(res=>setTimeout(res,1800))]).then(doFade);
  else doFade();
})();

// ── CARROSSEL DE PLANOS ──
(function(){
  const wrap=document.querySelector('.plans-carousel-wrap'),grid=document.getElementById('plansGrid'),dotsWrap=document.getElementById('plansDots');
  if(!grid||!dotsWrap||!wrap)return;
  const cards=Array.from(grid.querySelectorAll('.pc')),N=cards.length,GAP=16,LERP=0.32,THRESHOLD=55,RUBBER=0.18;
  let cur=3,currentX=0,targetX=0,rafId=null;
  function cardW(){return cards[0].offsetWidth;}function wrapW(){return wrap.offsetWidth;}function snapX(i){return(wrapW()-cardW())/2-i*(cardW()+GAP);}
  function rubberClamp(delta,atEdge){if(!atEdge)return delta;const sign=delta>0?1:-1;return sign*Math.sqrt(Math.abs(delta))*18*RUBBER;}
  cards.forEach((_,i)=>{const d=document.createElement('div');d.className='plans-dot';d.onclick=()=>goTo(i);dotsWrap.appendChild(d);});
  function updateCards(i){cards.forEach((c,j)=>c.classList.toggle('pc-active',j===i));dotsWrap.querySelectorAll('.plans-dot').forEach((d,j)=>d.classList.toggle('active',j===i));}
  function goTo(i){i=Math.max(0,Math.min(N-1,i));cur=i;targetX=snapX(i);updateCards(i);closeAllPlanDetails();startRaf();}
  function goToInstant(i){i=Math.max(0,Math.min(N-1,i));cur=i;currentX=targetX=snapX(i);grid.style.transform=`translateX(${currentX}px)`;updateCards(i);}
  function startRaf(){if(rafId)cancelAnimationFrame(rafId);function tick(){const diff=targetX-currentX;if(Math.abs(diff)<0.1){currentX=targetX;grid.style.transform=`translateX(${currentX}px)`;rafId=null;return;}currentX+=diff*LERP;grid.style.transform=`translateX(${currentX}px)`;rafId=requestAnimationFrame(tick);}rafId=requestAnimationFrame(tick);}
  let active=false,startX=0,rawDelta=0;
  function onStart(clientX){active=true;rawDelta=0;startX=clientX;if(rafId){cancelAnimationFrame(rafId);rafId=null;}grid.classList.add('dragging');}
  function onMove(clientX){if(!active)return;rawDelta=clientX-startX;if(Math.abs(rawDelta)>8)_planDragHappened=true;const atStart=cur===0&&rawDelta>0,atEnd=cur===N-1&&rawDelta<0;let visual;if(atStart||atEnd){visual=snapX(cur)+rubberClamp(rawDelta,true);}else{visual=snapX(cur)+rawDelta*0.6;}const minX=snapX(N-1)-cardW()*0.3,maxX=snapX(0)+cardW()*0.3;visual=Math.max(minX,Math.min(maxX,visual));grid.style.transform=`translateX(${visual}px)`;currentX=visual;}
  function onEnd(){if(!active)return;active=false;grid.classList.remove('dragging');const atStart=cur===0&&rawDelta>0,atEnd=cur===N-1&&rawDelta<0;if(!atStart&&!atEnd&&rawDelta<-THRESHOLD)goTo(cur+1);else if(!atStart&&!atEnd&&rawDelta>THRESHOLD)goTo(cur-1);else goTo(cur);}
  grid.addEventListener('mousedown',e=>onStart(e.clientX));window.addEventListener('mousemove',e=>onMove(e.clientX));window.addEventListener('mouseup',onEnd);
  grid.addEventListener('touchstart',e=>onStart(e.touches[0].clientX),{passive:true});grid.addEventListener('touchmove',e=>onMove(e.touches[0].clientX),{passive:true});
  grid.addEventListener('touchend',()=>{onEnd();_planDetailLocked=true;setTimeout(()=>{_planDetailLocked=false;},700);},{passive:true});
  window.addEventListener('resize',()=>goToInstant(cur));
  const homeEl=document.getElementById('page-home');
  if(homeEl)new MutationObserver(()=>{if(homeEl.classList.contains('active')){_scrollFixed=false;requestAnimationFrame(()=>{goToInstant(cur);setTimeout(()=>goToInstant(cur),100);setTimeout(()=>goToInstant(cur),300);});}}).observe(homeEl,{attributes:true,attributeFilter:['class']});
  let _scrollFixed=false;
  window.addEventListener('scroll',()=>{if(_scrollFixed)return;const r=wrap.getBoundingClientRect();if(r.top<window.innerHeight+200){_scrollFixed=true;goToInstant(cur);setTimeout(()=>goToInstant(cur),80);}},{passive:true});
  setTimeout(()=>goToInstant(cur),60);setTimeout(()=>goToInstant(cur),350);window.addEventListener('load',()=>{goToInstant(cur);setTimeout(()=>goToInstant(cur),200);});
})();

// TILT 3D — MODULE CARDS
(function(){
  document.querySelectorAll('.mc:not(.soon)').forEach(card=>{
    card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.setProperty('--rx',(-y*14)+'deg');card.style.setProperty('--ry',(x*14)+'deg');});
    card.addEventListener('mouseleave',()=>{card.style.setProperty('--rx','0deg');card.style.setProperty('--ry','0deg');});
  });
})();

// ── CURSOR PERSONALIZADO ──
(function(){
  const cur=document.getElementById('ghost-cursor');if(!cur)return;
  const hasPointer=window.matchMedia('(pointer:fine)').matches;if(!hasPointer){cur.style.display='none';return;}
  const cursorEnabled=()=>LS.get('ghost_cursor_enabled')!==false;if(!cursorEnabled()){cur.style.display='none';return;}
  const TRAIL_LEN=10,trailDots=[];let mx=-999,my=-999,ax=-999,ay=-999;
  for(let i=0;i<TRAIL_LEN;i++){const d=document.createElement('div');d.className='cursor-trail-dot';const t=i/TRAIL_LEN,size=3+(1-t)*5,r1=Math.round(244-(244-168)*t),g1=Math.round(114-(114-85)*t),b1=Math.round(182+(247-182)*(1-t));d.style.cssText=`width:${size}px;height:${size}px;background:rgb(${r1},${g1},${b1});opacity:${(1-t)*.6};position:fixed;z-index:99998;pointer-events:none;border-radius:50%;mix-blend-mode:screen;transform:translate(-50%,-50%);left:-999px;top:-999px`;document.body.appendChild(d);trailDots.push({el:d,x:-999,y:-999});}
  document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;});document.addEventListener('mousedown',()=>cur.classList.add('clicking'));document.addEventListener('mouseup',()=>cur.classList.remove('clicking'));
  let positions=Array(TRAIL_LEN).fill({x:-999,y:-999});
  function tick(){if(!cursorEnabled()){requestAnimationFrame(tick);return;}ax+=(mx-ax)*0.4;ay+=(my-ay)*0.4;cur.style.left=ax+'px';cur.style.top=ay+'px';positions=[{x:ax,y:ay},...positions.slice(0,TRAIL_LEN-1)];trailDots.forEach((dot,i)=>{dot.el.style.left=positions[i].x+'px';dot.el.style.top=positions[i].y+'px';});requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
  window._setCursorEnabled=(v)=>{LS.set('ghost_cursor_enabled',v);cur.style.display=v?'':'none';trailDots.forEach(d=>d.el.style.display=v?'':'none');};
})();
