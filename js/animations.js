// ═══════════════════════════════════════
// GHOST BUSCA — Animações e Efeitos Visuais
// Se este arquivo quebrar, só os efeitos visuais falham.
// ═══════════════════════════════════════

try {

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

  // configura cards
  cardOld.innerHTML = `<div class="upg-card-plan" style="color:var(--muted)">Seu plano atual</div><div class="upg-card-name">${oldC.label}</div><div class="upg-card-sub">mudando agora...</div>`;
  cardOld.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:180px;padding:22px 20px;border-radius:1rem;text-align:center;border:1px solid rgba(255,255,255,.12);background:#0d0d1e;`;

  cardNew.innerHTML = `<div class="upg-card-plan" style="background:${newC.grad};-webkit-background-clip:text;background-clip:text;color:transparent">Novo plano</div><div class="upg-card-name">${newC.label}</div><div class="upg-card-sub">desbloqueado!</div>`;
  cardNew.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(.4) rotate(-8deg);width:180px;padding:22px 20px;border-radius:1rem;text-align:center;border:1px solid rgba(255,255,255,.18);background:#0d0d1e;opacity:0;box-shadow:0 0 40px ${newC.glow};`;

  label.innerHTML = '';
  particles.innerHTML = '';

  // canvas size
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // mostra overlay
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

  // card antigo some com fade
  setTimeout(() => { cardOld.style.transition = 'opacity .5s ease, transform .5s ease'; cardOld.style.opacity = '0'; cardOld.style.transform = 'translate(-50%,-50%) scale(.85)'; }, 300);

  // novo aparece menor e simples
  setTimeout(() => {
    cardNew.style.opacity = '1';
    cardNew.style.transition = 'opacity .4s ease';
    label.innerHTML = `<strong>${newC.label}</strong>Plano alterado`;
    label.style.animation = 'hFade .4s ease both';
  }, 900);

  // fecha (2.2s)
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
// ── 3D CANVAS ──
(function(){
  const canvas = document.getElementById('room3d');
  const isMobile = window.innerWidth < 900;
  const NPARTS = isMobile ? 10 : 22;
  const INTERVAL = isMobile ? 1000/30 : 1000/45;
  const ctx = canvas.getContext('2d');
  let W, H, cx, cy;
  function resize(){ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; cx=W/2; cy=H/2; }
  window.addEventListener('resize', resize); resize();

  let rx=0, ry=0, vx=0.00010, vy=0.00016;

  // opacity por página — nítido na home, bem apagado nas internas
  let targetOpacity = 0.45;
  const pageObs = new MutationObserver(mutations => {
    for(const m of mutations){
      if(m.target.classList.contains('active')){
        targetOpacity = m.target.id === 'page-home' ? 0.45 : 0.08;
        break;
      }
    }
  });
  document.querySelectorAll('.page').forEach(p => pageObs.observe(p, {attributes:true, attributeFilter:['class']}));

  const S=1.4, DIVS=6;
  const corners=[[-S,-S,-S],[S,-S,-S],[S,S,-S],[-S,S,-S],[-S,-S,S],[S,-S,S],[S,S,S],[-S,S,S]];
  const boxEdges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const gridSegs=[];
  for(let i=0;i<=DIVS;i++){
    const t=-S+(2*S/DIVS)*i;
    gridSegs.push([[t,S,-S],[t,S,S],0]);gridSegs.push([[-S,S,t],[S,S,t],0]);
    gridSegs.push([[t,-S,-S],[t,-S,S],1]);gridSegs.push([[-S,-S,t],[S,-S,t],1]);
    gridSegs.push([[t,-S,-S],[t,S,-S],2]);gridSegs.push([[-S,t,-S],[S,t,-S],2]);
    gridSegs.push([[t,-S,S],[t,S,S],3]);gridSegs.push([[-S,t,S],[S,t,S],3]);
    gridSegs.push([[-S,t,-S],[-S,t,S],4]);gridSegs.push([[-S,-S,t],[-S,S,t],4]);
    gridSegs.push([[S,t,-S],[S,t,S],5]);gridSegs.push([[S,-S,t],[S,S,t],5]);
  }

  // Partículas com profundidade variada:
  // z negativo = longe (pequeno, lento, opaco)
  // z positivo = perto (grande, rápido, brilhante)
  // trail = histórico de posições para motion blur
  function makeParticle() {
    const depth = Math.random(); // 0=fundo, 1=frente
    const z = -S + depth * 2 * S;
    const speed = 0.0002 + depth * 0.0006; // mais perto = mais rápido
    return {
      x: (Math.random()-.5)*2*S,
      y: (Math.random()-.5)*2*S,
      z,
      vx: (Math.random()-.5)*speed,
      vy: (Math.random()-.5)*speed,
      vz: (Math.random()-.5)*speed*0.5,
      size:  0.3 + depth * 2.2,   // longe: 0.3 | perto: 2.5
      alpha: 0.1 + depth * 0.55,  // longe: opaco | perto: brilhante
      trail: []                    // histórico para blur
    };
  }
  const particles = Array.from({length: NPARTS}, makeParticle);

  function rotX(p,a){const[x,y,z]=p,c=Math.cos(a),s=Math.sin(a);return[x,y*c-z*s,y*s+z*c];}
  function rotY(p,a){const[x,y,z]=p,c=Math.cos(a),s=Math.sin(a);return[x*c+z*s,y,-x*s+z*c];}
  function proj(p){const fov=Math.min(W,H)*.72,z=p[2]+2.2;if(z<=0.01)return null;return[cx+p[0]/z*fov,cy+p[1]/z*fov,z];}
  function tf(p){return proj(rotY(rotX(p,rx),ry));}

  const fc=[[168,85,247],[168,85,247],[192,38,211],[232,121,160],[168,85,247],[168,85,247]];

  // Trail do cubo: últimas N posições dos cantos projetados
  const CUBE_TRAIL_LEN = 4;
  let cubeTrail = []; // array de snapshots dos cantos projetados

  let last=0;

  function loop(ts){
    requestAnimationFrame(loop);
    if(document.hidden) return;
    if(ts-last < INTERVAL) return;
    const dt=Math.min(ts-last,40); last=ts;

    rx+=vx*dt; ry+=vy*dt;

    // transição suave de opacity entre páginas
    const cur = parseFloat(canvas.style.opacity) || 0.45;
    canvas.style.opacity = cur + (targetOpacity - cur) * 0.06;

    // Snapshot dos cantos antes de mover (para trail do cubo)
    const snap = corners.map(c => tf(c));
    cubeTrail.push(snap);
    if(cubeTrail.length > CUBE_TRAIL_LEN) cubeTrail.shift();

    // motion blur — no mobile menos opaco pra partículas não sumirem
    ctx.fillStyle = isMobile ? 'rgba(11,11,20,0.55)' : 'rgba(11,11,20,0.72)';
    ctx.fillRect(0,0,W,H);

    // grid
    for(const[a,b,f]of gridSegs){
      const pa=tf(a),pb=tf(b); if(!pa||!pb)continue;
      const[r,g,bl]=fc[f];
      const al=Math.max(0,.10-((pa[2]+pb[2])/2-1)*.025);
      ctx.beginPath();ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);
      ctx.strokeStyle=`rgba(${r},${g},${bl},${al})`;ctx.lineWidth=.55;ctx.stroke();
    }

    // trail do cubo — arestas fantasma com alpha decrescente
    cubeTrail.forEach((snap, ti) => {
      const a = (ti+1)/cubeTrail.length * 0.09;
      ctx.strokeStyle=`rgba(168,85,247,${a})`;ctx.lineWidth=.7;
      for(const[i,j]of boxEdges){
        const a2=snap[i],b2=snap[j]; if(!a2||!b2)continue;
        ctx.beginPath();ctx.moveTo(a2[0],a2[1]);ctx.lineTo(b2[0],b2[1]);ctx.stroke();
      }
    });

    // arestas do cubo (atual)
    ctx.strokeStyle='rgba(168,85,247,.28)';ctx.lineWidth=1;
    for(const[i,j]of boxEdges){
      const a=tf(corners[i]),b=tf(corners[j]); if(!a||!b)continue;
      ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
    }

    // partículas
    for(const p of particles){
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
      if(Math.abs(p.x)>S)p.vx*=-1;
      if(Math.abs(p.y)>S)p.vy*=-1;
      if(Math.abs(p.z)>S)p.vz*=-1;

      const pt=tf([p.x,p.y,p.z]); if(!pt)continue;

      const depth = (p.z+S)/(2*S);
      if(depth > 0.4){
        p.trail.push([pt[0],pt[1]]);
        if(p.trail.length > 5) p.trail.shift();
        for(let ti=0;ti<p.trail.length-1;ti++){
          const ta = (ti/p.trail.length) * p.alpha * 0.45;
          const tr = (p.size/Math.max(.5,pt[2])) * (ti/p.trail.length) * 0.8;
          ctx.beginPath();
          ctx.arc(p.trail[ti][0], p.trail[ti][1], Math.max(0.3,tr), 0, Math.PI*2);
          ctx.fillStyle=`rgba(168,85,247,${ta})`;ctx.fill();
        }
      } else {
        p.trail = [];
      }

      const r=Math.max(1, p.size/Math.max(.5,pt[2]));
      const al=Math.min(0.9, p.alpha*Math.min(1,1.5/pt[2]) * (isMobile ? 1.6 : 1));
      ctx.beginPath();ctx.arc(pt[0],pt[1],r,0,Math.PI*2);
      ctx.fillStyle=`rgba(168,85,247,${al})`;ctx.fill();
    }
  }

  requestAnimationFrame(loop);
})();
// ── LUZ HERO — segue o mouse, some nas páginas internas ──
(function(){
  const light = document.getElementById('hero-light');
  if(!light) return;
  let tx = 0, ty = 0, cx = 0, cy = 0;

  document.addEventListener('mousemove', e => {
    // offset suave em relação ao centro da tela
    const dx = (e.clientX - window.innerWidth/2) * 0.18;
    const dy = (e.clientY - window.innerHeight/2) * 0.14;
    tx = dx; ty = dy;
  });

  // anima suavemente atrás do cursor
  function animLight(){
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    light.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`;
    requestAnimationFrame(animLight);
  }
  requestAnimationFrame(animLight);

  // some nas páginas internas
  const obs = new MutationObserver(mutations => {
    for(const m of mutations){
      if(m.target.classList.contains('active')){
        light.classList.toggle('hidden', m.target.id !== 'page-home');
        break;
      }
    }
  });
  document.querySelectorAll('.page').forEach(p => obs.observe(p, {attributes:true, attributeFilter:['class']}));
})();

function detectDevice(){
  const isDesktop = window.innerWidth >= 900;
  document.body.classList.toggle('is-desktop', isDesktop);
  document.body.classList.toggle('is-mobile', !isDesktop);
}
detectDevice();
window.addEventListener('resize', detectDevice);

// ── SCROLL FADE IN (plans section) ──
(function(){
  const targets = document.querySelectorAll('#plans .plans-label, #plans .plans-title, #plans .plans-sub, #plans .plans-carousel-wrap, #plans .plans-dots, #plans .plans-drag-hint');
  targets.forEach(el => el.classList.add('scroll-fade'));
  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if(en.isIntersecting){ en.target.classList.add('visible'); obs.unobserve(en.target); }
    });
  }, {threshold: 0.1});
  targets.forEach(el => obs.observe(el));
})();

// ── FIX OVERFLOW SCROLL ──
// garante que overflow nunca fica preso após navegação de página
document.querySelectorAll('.page').forEach(p => {
  p.addEventListener('transitionend', () => {
    if(!document.querySelector('.modal-overlay.open') && !document.getElementById('navDropdown')?.classList.contains('open')){
      document.body.style.overflow = '';
    }
  });
});

// ── TILT 3D CREDITS INFO CARDS ──
(function(){
  function initCinfoCards() {
    document.querySelectorAll('.cinfo-card').forEach(card => {
      // tilt no hover (desktop)
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width  - 0.5;
        const y = (e.clientY - r.top)  / r.height - 0.5;
        card.style.transform = `perspective(500px) rotateX(${-y*10}deg) rotateY(${x*10}deg) translateY(-3px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.transition = 'transform .4s ease, border-color .25s, background .25s, box-shadow .25s';
        setTimeout(() => card.style.transition = '', 400);
      });
      // long press → zoom (mobile)
      let pressTimer;
      card.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
          card.style.transform = 'scale(1.04)';
          card.style.boxShadow = '0 16px 40px rgba(0,0,0,.4), 0 0 0 1px rgba(168,85,247,.2)';
        }, 400);
      }, {passive:true});
      card.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
        card.style.transform = '';
        card.style.boxShadow = '';
      });
    });
  }
  // inicializa quando a página de créditos ficar ativa
  const cinfoPage = document.getElementById('page-credits-info');
  if (cinfoPage) {
    new MutationObserver(() => {
      if (cinfoPage.classList.contains('active')) initCinfoCards();
    }).observe(cinfoPage, {attributes: true, attributeFilter: ['class']});
  }
})();

// ── INICIALIZAÇÃO PRINCIPAL ──
(async function() {
  try { history.replaceState({page:'home'}, '', location.href); } catch(_) {}
  showPage('home', false);
  await _loadSession();
  if (!currentUser) initAnon();
  setTimeout(function() { initDiscountBanner(); }, 500);
})();

// ── CONTADOR DE CONSULTAS EM TEMPO REAL ──
(function(){
  const el = document.getElementById('heroConsultas');
  if (!el) return;
  const KEY = 'ghost_total_queries';
  // começa em 25k — cresce com o tempo e com consultas reais
  let total = LS.get(KEY) || 25000;

  function fmt(n) {
    if (n >= 1000000) return '+' + (n/1000000).toFixed(1).replace('.0','') + 'M';
    if (n >= 1000)    return '+' + Math.floor(n/1000) + 'k';
    return '+' + n;
  }

  // sincroniza com consultas reais feitas no app
  function syncReal() {
    const email = window.currentUser?.email;
    if (!email || window.currentUser?.anon) return;
    const ever = LS.get(`ghost_ever_${email}`) || 0;
    // adiciona consultas reais ao total global (evita duplicar)
    const lastSync = LS.get(`ghost_tq_sync_${email}`) || 0;
    const diff = ever - lastSync;
    if (diff > 0) {
      total += diff;
      LS.set(KEY, total);
      LS.set(`ghost_tq_sync_${email}`, ever);
      el.textContent = fmt(total);
    }
  }

  function tick() {
    const delay = 8000 + Math.random() * 12000;
    setTimeout(() => {
      total += Math.floor(Math.random() * 4) + 1;
      LS.set(KEY, total);
      el.textContent = fmt(total);
      syncReal();
      tick();
    }, delay);
  }

  el.textContent = fmt(total);
  syncReal();
  tick();
})();
(function(){
  const s = document.getElementById('splash');
  if(!s) return;
  const doFade = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        s.classList.add('fade');
        setTimeout(() => s.remove(), 450);
      });
    });
  };
  // aguarda fontes carregarem antes de esconder o splash — evita flash de texto sem estilo
  if (document.fonts && document.fonts.ready) {
    Promise.race([
      document.fonts.ready,
      new Promise(res => setTimeout(res, 1800)) // timeout máximo de 1.8s
    ]).then(doFade);
  } else {
    doFade();
  }
})();

// ── CARROSSEL DE PLANOS ──
(function(){
  const wrap = document.querySelector('.plans-carousel-wrap');
  const grid = document.getElementById('plansGrid');
  const dotsWrap = document.getElementById('plansDots');
  if (!grid || !dotsWrap || !wrap) return;

  const cards = Array.from(grid.querySelectorAll('.pc'));
  const N = cards.length;
  const GAP = 16;
  const LERP = 0.32;       // velocidade da animação (0–1)
  const THRESHOLD = 55;   // px mínimos pra mudar de card
  const RUBBER = 0.18;    // resistência nas bordas (menor = mais resistência)

  let cur = 3; // começa no Premium (mensal) — recomendado
  let currentX = 0, targetX = 0;
  let rafId = null;

  function cardW() { return cards[0].offsetWidth; }
  function wrapW() { return wrap.offsetWidth; }
  function snapX(i) { return (wrapW() - cardW()) / 2 - i * (cardW() + GAP); }

  // Função rubber band: quanto mais longe da borda, menos o drag responde
  function rubberClamp(delta, atEdge) {
    if (!atEdge) return delta;
    // sqrt amortecido: dá sensação elástica
    const sign = delta > 0 ? 1 : -1;
    return sign * Math.sqrt(Math.abs(delta)) * 18 * RUBBER;
  }

  // criar dots
  cards.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'plans-dot';
    d.onclick = () => goTo(i);
    dotsWrap.appendChild(d);
  });

  function updateCards(i) {
    cards.forEach((c, j) => c.classList.toggle('pc-active', j === i));
    dotsWrap.querySelectorAll('.plans-dot').forEach((d, j) => d.classList.toggle('active', j === i));
  }

  function goTo(i) {
    i = Math.max(0, Math.min(N - 1, i));
    cur = i;
    targetX = snapX(i);
    updateCards(i);
    closeAllPlanDetails();
    startRaf();
  }

  function goToInstant(i) {
    i = Math.max(0, Math.min(N - 1, i));
    cur = i;
    currentX = targetX = snapX(i);
    grid.style.transform = `translateX(${currentX}px)`;
    updateCards(i);
  }

  function startRaf() {
    if (rafId) cancelAnimationFrame(rafId);
    function tick() {
      const diff = targetX - currentX;
      if (Math.abs(diff) < 0.1) {
        currentX = targetX;
        grid.style.transform = `translateX(${currentX}px)`;
        rafId = null;
        return;
      }
      currentX += diff * LERP;
      grid.style.transform = `translateX(${currentX}px)`;
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  // ── DRAG (mouse + touch unificado) ──
  let active = false, startX = 0, rawDelta = 0;

  function onStart(clientX) {
    active = true; rawDelta = 0; startX = clientX;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    grid.classList.add('dragging');
  }

  function onMove(clientX) {
    if (!active) return;
    rawDelta = clientX - startX;
    if (Math.abs(rawDelta) > 8) _planDragHappened = true;
    const atStart = cur === 0 && rawDelta > 0;
    const atEnd   = cur === N - 1 && rawDelta < 0;
    let visual;
    if (atStart || atEnd) {
      visual = snapX(cur) + rubberClamp(rawDelta, true);
    } else {
      visual = snapX(cur) + rawDelta * 0.6;
    }
    // clamp: nunca vai além do primeiro ou último card
    const minX = snapX(N - 1) - cardW() * 0.3;
    const maxX = snapX(0)     + cardW() * 0.3;
    visual = Math.max(minX, Math.min(maxX, visual));
    grid.style.transform = `translateX(${visual}px)`;
    currentX = visual;
  }

  function onEnd() {
    if (!active) return;
    active = false;
    grid.classList.remove('dragging');
    const atStart = cur === 0 && rawDelta > 0;
    const atEnd   = cur === N - 1 && rawDelta < 0;
    if (!atStart && !atEnd && rawDelta < -THRESHOLD) goTo(cur + 1);
    else if (!atStart && !atEnd && rawDelta > THRESHOLD) goTo(cur - 1);
    else goTo(cur); // snap de volta — inclui o rubber band
  }

  // mouse
  grid.addEventListener('mousedown', e => onStart(e.clientX));
  window.addEventListener('mousemove', e => onMove(e.clientX));
  window.addEventListener('mouseup', onEnd);

  // touch
  grid.addEventListener('touchstart', e => onStart(e.touches[0].clientX), { passive: true });
  grid.addEventListener('touchmove',  e => onMove(e.touches[0].clientX),  { passive: true });
  grid.addEventListener('touchend', () => {
    onEnd();
    // o browser dispara um click sintético no botão ~300ms após o touchend
    // setar o cooldown aqui faz o togglePlanDetail ignorar esse click duplicado
    _planDetailLocked = true; setTimeout(() => { _planDetailLocked = false; }, 700);
  }, { passive: true });

  window.addEventListener('resize', () => goToInstant(cur));

  // recalcula quando a home volta a ficar visível (menu → home, back, etc.)
  const homeEl = document.getElementById('page-home');
  if (homeEl) {
    const carouselObs = new MutationObserver(() => {
      if (homeEl.classList.contains('active')) {
        _scrollFixed = false; // reseta pra o scroll fix rodar de novo
        requestAnimationFrame(() => {
          goToInstant(cur);
          setTimeout(() => goToInstant(cur), 100);
          setTimeout(() => goToInstant(cur), 300);
        });
      }
    });
    carouselObs.observe(homeEl, { attributes: true, attributeFilter: ['class'] });
  }

  // recalcula ao rolar pra perto dos planos (section pode ter sido offscreen)
  let _scrollFixed = false;
  window.addEventListener('scroll', () => {
    if (_scrollFixed) return;
    const r = wrap.getBoundingClientRect();
    if (r.top < window.innerHeight + 200) {
      _scrollFixed = true;
      goToInstant(cur);
      setTimeout(() => goToInstant(cur), 80);
    }
  }, { passive: true });

  setTimeout(() => goToInstant(2), 60);
  setTimeout(() => goToInstant(cur), 350);
  window.addEventListener('load', () => { goToInstant(cur); setTimeout(() => goToInstant(cur), 200); });
})();

// ── TILT 3D ──
(function(){
  document.querySelectorAll('.mc:not(.soon)').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      card.style.setProperty('--rx', (-y * 14) + 'deg');
      card.style.setProperty('--ry', ( x * 14) + 'deg');
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
})();

// ── CURSOR PERSONALIZADO ──
(function(){
  const cur = document.getElementById('ghost-cursor');
  if (!cur) return;

  // só ativa em dispositivos com mouse real
  const hasPointer = window.matchMedia('(pointer:fine)').matches;
  if (!hasPointer) { cur.style.display = 'none'; return; }

  // respeita preferência do usuário
  const cursorEnabled = () => LS.get('ghost_cursor_enabled') !== false;
  if (!cursorEnabled()) { cur.style.display = 'none'; return; }

  const TRAIL_LEN = 10;
  const trailDots = [];
  let mx = -999, my = -999, ax = -999, ay = -999;

  for (let i = 0; i < TRAIL_LEN; i++) {
    const d = document.createElement('div');
    d.className = 'cursor-trail-dot';
    const t = i / TRAIL_LEN;
    const size = 3 + (1 - t) * 5;
    const r1 = Math.round(244 - (244-168)*t);
    const g1 = Math.round(114 - (114-85)*t);
    const b1 = Math.round(182 + (247-182)*(1-t));
    d.style.cssText = `width:${size}px;height:${size}px;background:rgb(${r1},${g1},${b1});opacity:${(1-t)*.6};position:fixed;z-index:99998;pointer-events:none;border-radius:50%;mix-blend-mode:screen;transform:translate(-50%,-50%);left:-999px;top:-999px`;
    document.body.appendChild(d);
    trailDots.push({ el:d, x:-999, y:-999 });
  }

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  document.addEventListener('mousedown', () => cur.classList.add('clicking'));
  document.addEventListener('mouseup',   () => cur.classList.remove('clicking'));

  let positions = Array(TRAIL_LEN).fill({x:-999,y:-999});
  function tick() {
    if (!cursorEnabled()) { requestAnimationFrame(tick); return; }
    ax += (mx - ax) * 0.4;
    ay += (my - ay) * 0.4;
    cur.style.left = ax + 'px';
    cur.style.top  = ay + 'px';

    positions = [{x:ax,y:ay}, ...positions.slice(0, TRAIL_LEN-1)];
    trailDots.forEach((dot, i) => {
      dot.el.style.left = positions[i].x + 'px';
      dot.el.style.top  = positions[i].y + 'px';
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // expõe função de toggle pro settings
  window._setCursorEnabled = (v) => {
    LS.set('ghost_cursor_enabled', v);
    cur.style.display = v ? '' : 'none';
    trailDots.forEach(d => d.el.style.display = v ? '' : 'none');
  };
})();


  console.log("[ghost:animations] módulo carregado ✓");
} catch(e) {
  console.error("[ghost:animations] ERRO:", e);
  window.playUpgradeAnimation   = function(a, b, cb) { if (cb) setTimeout(cb, 100); };
  window.playDowngradeAnimation = function(a, b, cb) { if (cb) setTimeout(cb, 100); };
}
