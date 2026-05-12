// ── GHOST GSAP ANIMATIONS ──
// Versão 2 — animações variadas por tipo de página

(function () {
  if (typeof gsap === 'undefined') {
    console.warn('[ghost:gsap] GSAP não carregado.');
    return;
  }

  // Perfil de animação por página
  const PAGE_ANIM = {
    // Home — vem de baixo/longe com fade rápido
    'home':         { y: 20, scale: 0.97, duration: 0.22, ease: 'power3.out' },
    // Consulta — sobe rápido, snappy
    'query':        { y: 40, scale: 0.95, duration: 0.3,  ease: 'expo.out' },
    // Resultados — desce de cima, como "resposta chegando"
    'results':      { y: -30, scale: 1.02, duration: 0.35, ease: 'power3.out' },
    // Módulos — escala do centro, expansão
    'modules':      { y: 0,  scale: 0.93, duration: 0.38, ease: 'back.out(1.4)' },
    // Store/Planos — slide da direita
    'store':        { x: 60, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
    'upgrade':      { x: 60, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
    // Settings/Wallet/History — slide da direita mais sutil e fluido
    'settings':     { x: 30, y: 0, scale: 0.98, duration: 0.28, ease: 'expo.out' },
    'wallet':       { x: 30, y: 0, scale: 0.98, duration: 0.28, ease: 'expo.out' },
    'history':      { x: 30, y: 0, scale: 0.98, duration: 0.28, ease: 'expo.out' },
    // Créditos — sobe com bounce
    'credits':      { y: 35, scale: 0.96, duration: 0.38, ease: 'back.out(1.3)' },
    'credits-info': { y: 35, scale: 0.96, duration: 0.38, ease: 'back.out(1.3)' },
    // Chat — slide da direita, como abrir conversa
    'chat':         { x: 50, y: 0, scale: 1, duration: 0.3,  ease: 'expo.out' },
    // Thank you — zoom dramático do centro
    'thankyou':     { y: 0,  scale: 0.88, duration: 0.45, ease: 'back.out(2)' },
    // Product detail — slide da direita
    'product':      { x: 50, y: 0, scale: 1, duration: 0.3,  ease: 'power3.out' },
  };

  // Animação de BACK por tipo
  const PAGE_ANIM_BACK = {
    'query':    { y: 20,  scale: 1.02, duration: 0.25, ease: 'power2.out' },
    'results':  { y: 20,  scale: 1.02, duration: 0.25, ease: 'power2.out' },
    'settings': { x: -40, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' },
    'wallet':   { x: -40, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' },
    'history':  { x: -40, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' },
    'store':    { x: -60, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' },
    'chat':     { x: -50, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' },
    'product':  { x: -50, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' },
  };

  const DEFAULT_ANIM      = { y: 22, scale: 0.97, duration: 0.32, ease: 'power3.out' };
  const DEFAULT_ANIM_BACK = { y: -18, scale: 1.02, duration: 0.28, ease: 'power2.out' };

  // ── 1. TROCA DE PÁGINA ──
  window.showPage = function (id, pushHistory = true, isBack = false) {
    // Issue 1: se já está na página, só sobe o scroll inteligentemente
    const currentActive = document.querySelector('.page.active');
    if (currentActive && currentActive.id === 'page-' + id) {
      if (window.scrollY > 150) window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Otimização: desativa só a página atual, não varre todas
    if (currentActive) {
      currentActive.classList.remove('active');
      currentActive.style.animation = 'none';
      gsap.killTweensOf(currentActive);
    }

    const el = document.getElementById('page-' + id);
    if (!el) return;
    el.classList.add('active');
    el.style.animation = 'none';

    const cfg = isBack
      ? (PAGE_ANIM_BACK[id] || DEFAULT_ANIM_BACK)
      : (PAGE_ANIM[id]      || DEFAULT_ANIM);
    const from = { opacity: 0, x: cfg.x || 0, y: cfg.y || 0, scale: cfg.scale ?? 1 };
    const to   = { opacity: 1, x: 0, y: 0, scale: 1, duration: cfg.duration, ease: cfg.ease, clearProps: 'transform,opacity' };
    gsap.fromTo(el, from, to);

    // Stagger nos cards — só em páginas que não sejam home/modules
    if (id !== 'home' && id !== 'modules') {
      const cards = Array.from(el.querySelectorAll('.result-card,.plan-card,.hist-item,.settings-card,.store-card'));
      if (cards.length) {
        gsap.killTweensOf(cards);
        gsap.set(cards, { opacity: 0, y: id === 'settings' || id === 'wallet' || id === 'history' ? 10 : 16 });
        gsap.to(cards, {
          opacity: 1, y: 0,
          duration: id === 'settings' || id === 'wallet' || id === 'history' ? 0.28 : 0.36,
          ease: 'power2.out',
          stagger: id === 'settings' || id === 'wallet' || id === 'history' ? 0.055 : 0.05,
          delay: cfg.duration * 0.3,
          clearProps: 'transform,opacity'
        });
      }
    }

    window.scrollTo(0, 0);

    // Lógica original
    const nav = document.getElementById('main-nav');
    const storeHero = document.getElementById('store-hero');
    const _restorablePages = ['settings','wallet','history','chat','store','modules'];
    try {
      if (_restorablePages.includes(id)) { sessionStorage.setItem('ghost_last_page', id); sessionStorage.setItem('ghost_nav_active', '1'); }
      else { sessionStorage.removeItem('ghost_last_page'); sessionStorage.removeItem('ghost_nav_active'); }
    } catch (_) {}
    if (id === 'home') nav?.classList.remove('hidden');
    else { nav?.classList.add('hidden'); window.closeMenu?.(); }
    if (storeHero) storeHero.style.display = id === 'store' ? 'flex' : 'none';
    // Issue 5: home animation inteligente — lenta primeira vez, rápida no retorno
    if (id === 'home') {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.body.style.minHeight = '';
      if (window._homeVisited) {
        el.classList.add('home-visited');
      } else {
        el.classList.remove('home-visited');
        window._homeVisited = true;
        // Animação de entrada — elementos do hero aparecem de cima com bounce suave
        const heroEls = el.querySelectorAll('.hero-badge, .hero-title, .hero-sub, .hero-cta, .hero-stats');
        if (heroEls.length) {
          gsap.set(heroEls, { opacity: 0, y: -22 });
          gsap.to(heroEls, {
            opacity: 1, y: 0,
            duration: 0.42,
            ease: 'back.out(1.5)',
            stagger: 0.07,
            delay: 0.18,
            clearProps: 'transform,opacity'
          });
        }
      }
    }

    if (id === 'modules') {
      window.updateBalloon?.(); window.updateCpfProCard?.(); window.updateCreditsBalloon?.(); window.updateModulesBanner?.();
      const modCards = Array.from(document.querySelectorAll('#page-modules .mc'));
      if (modCards.length) {
        gsap.killTweensOf(modCards);
        gsap.set(modCards, { opacity: 0, y: 10 });
        for (let i = 0; i < modCards.length; i += 2) {
          const pair = modCards.slice(i, i + 2);
          gsap.to(pair, {
            opacity: 1, y: 0,
            duration: 0.2,
            ease: 'power2.out',
            delay: (i / 2) * 0.07,
            clearProps: 'transform,opacity',
            onComplete: () => {
              pair.forEach(c => { if (c.classList.contains('locked') || c.classList.contains('soon')) gsap.set(c, { opacity: 0.22 }); });
            }
          });
        }
      }
      window._modulesVisited = true;
    }
    if (id === 'chat') { window._renderChatUserAvatar?.(); window._setChatWelcomeTime?.(); }
    if (id !== 'chat') { window._stopChatPoll?.(); }
    if (id === 'thankyou') { const q = document.getElementById('tyQuestion'); if (q) { q.style.opacity=''; q.style.transform=''; q.style.transition=''; } }
    if (pushHistory) {
      const state = { page: id, mod: window.curMod };
      if (history.state?.page !== id) { try { history.pushState(state, '', location.href.split('#')[0] + '#' + id); } catch (_) {} }
    }
  };

  // ── 2. ABRIR MODAL ──
  window.openModal = function (id) {
    if ((id === 'modal-login' || id === 'modal-register') && window.currentUser && !window.currentUser.anon) return;
    window.closeAllModals?.();
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('open');
    window._overlayOpen = true;
    const modal = overlay.querySelector('.modal');
    if (!modal) return;
    gsap.fromTo(modal,
      { opacity: 0, y: 30, scale: 0.92 },
      { opacity: 1, y: 0, scale: 1, duration: 0.38, ease: 'back.out(1.6)', clearProps: 'transform,opacity' }
    );
  };

  // ── 3. FECHAR MODAL ──
  window.closeModal = function (id) {
    const overlay = document.getElementById(id);
    const modal = overlay?.querySelector('.modal');
    if (!overlay) return;
    const done = () => {
      overlay.classList.remove('open','closing');
      if (modal) { modal.classList.remove('closing'); gsap.set(modal, { clearProps: 'all' }); }
      if (!document.querySelector('.modal-overlay.open,.confirm-overlay.open,.csb-confirm-overlay.open')) window._overlayOpen = false;
    };
    if (modal) gsap.to(modal, { opacity: 0, y: 14, scale: 0.94, duration: 0.2, ease: 'power2.in', onComplete: done });
    else done();
  };

  // ── 4. FECHAR TODOS MODAIS ──
  window.closeAllModals = function () {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      const modal = m.querySelector('.modal');
      if (modal) {
        gsap.to(modal, { opacity: 0, y: 14, scale: 0.94, duration: 0.2, ease: 'power2.in', onComplete: () => {
          m.classList.remove('open','closing'); modal.classList.remove('closing'); gsap.set(modal, { clearProps: 'all' });
        }});
      } else { m.classList.remove('open','closing'); }
    });
    setTimeout(() => {
      if (!document.getElementById('navDropdown')?.classList.contains('open')) window._overlayOpen = false;
    }, 220);
  };

  // ── 5. CONFIRM BOX ──
  window.closeConfirm = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    const box = el.querySelector('.confirm-box,.csb-confirm-box');
    if (box) gsap.to(box, { opacity: 0, y: 10, scale: 0.94, duration: 0.18, ease: 'power2.in', onComplete: () => { el.classList.remove('open','closing'); gsap.set(box, { clearProps: 'all' }); }});
    else el.classList.remove('open','closing');
  };
  const _confObs = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.attributeName !== 'class') return;
      const el = m.target;
      if (el.classList.contains('open') && !el.classList.contains('closing')) {
        const box = el.querySelector('.confirm-box,.csb-confirm-box');
        if (box) gsap.fromTo(box, { opacity: 0, y: 22, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(1.7)', clearProps: 'transform,opacity' });
      }
    });
  });
  document.querySelectorAll('.confirm-overlay,.csb-confirm-overlay').forEach(el => _confObs.observe(el, { attributes: true, attributeFilter: ['class'] }));

  // ── 6. MENU NAV ──
  window.toggleMenu = function () {
    const dd = document.getElementById('navDropdown');
    const btn = document.getElementById('menuBtn');
    const storeBtn = document.getElementById('storeMenuBtn');
    if (dd?.classList.contains('open')) { window.closeMenu?.(); return; }
    [btn, storeBtn].forEach(b => { if (!b) return; b.style.animation='none'; b.offsetHeight; b.style.animation='menuBtnFlash .5s ease forwards'; });
    btn?.classList.add('open'); storeBtn?.classList.add('open');
    dd?.classList.add('open');
    document.querySelector('nav')?.classList.add('menu-open');
    document.getElementById('menuBlurOverlay')?.classList.add('on');
    document.body.style.overflow = 'hidden';
    window.closeAllPlanDetails?.();
    if (dd) {
      const items = dd.querySelectorAll('li,.nav-item,.nav-link,.dropdown-item,a,button');
      if (items.length) gsap.fromTo(items, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.26, ease: 'power2.out', stagger: 0.05, delay: 0.08 });
      else gsap.fromTo(dd, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.26, ease: 'power2.out', delay: 0.08 });
    }
  };

  // ── 7. SCROLL FADE ──
  function initScrollFade() {
    const targets = document.querySelectorAll('.scroll-fade:not(.scroll-animated)');
    if (!targets.length) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        // Se estiver dentro da home já visitada, aparece na hora
        const inVisitedHome = en.target.closest('#page-home.home-visited');
        const isPlanCard = en.target.classList.contains('pc');
        gsap.fromTo(en.target,
          { opacity: 0, y: isPlanCard ? 14 : 20 },
          {
            opacity: 1, y: 0,
            duration: inVisitedHome ? 0.12 : isPlanCard ? 0.28 : 0.48,
            ease: 'power2.out',
            clearProps: 'transform,opacity'
          }
        );
        en.target.classList.add('scroll-animated');
        obs.unobserve(en.target);
      });
    }, { threshold: 0.1 });
    targets.forEach(el => obs.observe(el));
  }

  // ── 8. THANK YOU FEEDBACK ──
  window.tyAnswerNo = function () {
    const q = document.getElementById('tyQuestion');
    if (q) {
      gsap.to(q, { opacity: 0, y: 8, duration: 0.22, ease: 'power2.in', onComplete: () => {
        q.innerHTML = '<p class="ty-q-done">Ótimo! Boas consultas.</p>';
        gsap.fromTo(q, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' });
      }});
    }
    setTimeout(() => window.goHome?.(), 2400);
  };
  window.tyAnswerYes = function () {
    if (window.navHist) window.navHist = window.navHist.filter(p => p !== 'thankyou');
    window._openChatPage?.();
  };

  // INIT
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initScrollFade);
  else initScrollFade();


})();
