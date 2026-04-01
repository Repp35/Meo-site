// GHOST BUSCA — Store (Produtos + Filtros)

// Normaliza produto do Supabase para o formato interno
function _normProduct(p) {
  if (!p) return null;
  return {
    id:          p.id,
    name:        p.name        || '',
    desc:        p.description || '',
    descFull:    p.description || '',
    img:         p.image_url   || null,
    tag:         Array.isArray(p.tags) ? p.tags[0] || '' : (p.tags || p.tag || ''),
    price:       Number(p.price) || 0,
    priceOld:    p.price_old   ? Number(p.price_old)  : null,
    discount:    p.discount    || null,
    buyUrl:      p.buy_url     || null,
    active:      p.active !== false,
  };
}

// Retorna src seguro: aceita só URLs CDN, ignora base64
function prodImgSrc(img) {
  if (!img) return null;
  if (img.startsWith('data:') || img.startsWith('blob:')) return null;
  return img;
}

let PRODUCTS = [];

async function loadProducts() {
  try {
    const rows = await sbGet('products', 'active=eq.true&order=created_at.desc');
    PRODUCTS = (rows || []).map(_normProduct);
  } catch { PRODUCTS = []; }
}

let curProduct = null;

async function goStore() {
  pushNav('store');
  showPage('store');
  await loadProducts();
  renderStore();
  window.scrollTo({top:0,behavior:'smooth'});
}

function _doRenderStore(filter) {
  const grid  = document.getElementById('storeGrid');
  const count = document.getElementById('storeCount');
  if (!grid) return;

  let filtered = PRODUCTS.filter(p =>
    p.active && (!filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.tag.toLowerCase().includes(filter.toLowerCase())
    )
  );
  if (_storePriceMin != null) filtered = filtered.filter(p => p.price >= _storePriceMin);
  if (_storePriceMax != null) filtered = filtered.filter(p => p.price <= _storePriceMax);

  const sort = window._storeSort || 'newest';
  if      (sort === 'az')         filtered = [...filtered].sort((a,b) => a.name.localeCompare(b.name,'pt-BR'));
  else if (sort === 'za')         filtered = [...filtered].sort((a,b) => b.name.localeCompare(a.name,'pt-BR'));
  else if (sort === 'price_asc')  filtered = [...filtered].sort((a,b) => a.price - b.price);
  else if (sort === 'price_desc') filtered = [...filtered].sort((a,b) => b.price - a.price);

  if (count) {
    const newTxt = filtered.length + ' produto' + (filtered.length !== 1 ? 's' : '') + ' disponíve' + (filtered.length !== 1 ? 'is' : 'l');
    if (count.textContent !== newTxt) {
      count.classList.remove('pop'); void count.offsetWidth;
      count.textContent = newTxt; count.classList.add('pop');
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

  grid.style.transition = 'opacity .1s ease';
  grid.style.opacity = '0';
  setTimeout(() => {
    grid.innerHTML = filtered.map(p => `
    <div class="prod-card" onclick="openProduct('${p.id}')">
      <div class="prod-img">
        ${prodImgSrc(p.img) ? `<img src="${escStr(prodImgSrc(p.img))}" alt="${escStr(p.name)}" loading="lazy">` : '<div class="prod-img-placeholder">👻</div>'}
        ${p.tag && p.tag.toLowerCase() !== 'premium' ? `<span class="prod-tag">${escStr(p.tag)}</span>` : ''}
        <button class="prod-fav" id="fav-${p.id}" onclick="event.stopPropagation();toggleFav('${p.id}')" title="Favoritar">
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
        <button class="prod-buy-btn" onclick="event.stopPropagation();buyProduct('${p.id}',event)">
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
  clearTimeout(_storeFilterTimer);
  _storeFilterTimer = setTimeout(() => _doRenderStore(val), 120);
  const inp = document.querySelector('.store-search');
  if (inp) {
    inp.classList.remove('char-anim'); void inp.offsetWidth;
    inp.classList.add('char-anim');
    setTimeout(() => inp.classList.remove('char-anim'), 100);
  }
}

let favs = new Set();
function toggleFav(id) {
  const btn = document.getElementById('fav-' + id);
  if (!btn) return;
  if (favs.has(id)) { favs.delete(id); btn.classList.remove('active'); }
  else              { favs.add(id);    btn.classList.add('active'); }
}

function buyProduct(id, e) {
  const p = PRODUCTS.find(x => x.id == id);
  if (!p) return;
  histAdd({ type:'produto', name:p.name, value: p.price || null, free: false });
  if (p.buyUrl && p.buyUrl !== '#') { window.open(p.buyUrl, '_blank'); return; }
  const btn = e?.currentTarget || e?.target;
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Em breve!'; btn.style.opacity = '.7';
    setTimeout(() => { btn.innerHTML = orig; btn.style.opacity = ''; }, 1800);
  }
}

function openProduct(id) {
  const p = PRODUCTS.find(x => x.id == id);
  if (!p) return;
  curProduct = p;
  const det = document.getElementById('productDetail');
  if (det) det.innerHTML = `
    <div class="pd-hero">
      <button class="pd-hero-back" onclick="goBack()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar</button>
      <div class="pd-img">${prodImgSrc(p.img) ? `<img src="${escStr(prodImgSrc(p.img))}" alt="${escStr(p.name)}" loading="lazy">` : '<div class="pd-img-placeholder">👻</div>'}</div>
    </div>
    <div class="pd-body">
      <div class="pd-tag-row"><span class="pd-tag">${escStr(p.tag)}</span></div>
      <div class="pd-name">${escStr(p.name)}</div>
      <div class="pd-price-row">
        <span class="pd-price">R$ ${p.price.toFixed(2).replace('.',',')}</span>
        ${p.priceOld ? `<span class="pd-price-old">R$ ${p.priceOld.toFixed(2).replace('.',',')}</span>` : ''}
        ${p.discount ? `<span class="pd-discount">-${p.discount}%</span>` : ''}
      </div>
      <button class="pd-buy-btn" onclick="buyProduct('${p.id}',event)">
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

function escStr(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── FILTRO POR PREÇO NA STORE ──
var _storePriceMin = null;
var _storePriceMax = null;

function applyPriceFilter() {
  var minEl = document.getElementById('filterPriceMin');
  var maxEl = document.getElementById('filterPriceMax');
  _storePriceMin = minEl && minEl.value ? parseFloat(minEl.value.replace(',','.')) : null;
  _storePriceMax = maxEl && maxEl.value ? parseFloat(maxEl.value.replace(',','.')) : null;
  toggleStoreFilters();
  _doRenderStore(document.querySelector('.store-search')?.value || '');
}

function clearPriceFilter() {
  _storePriceMin = null; _storePriceMax = null;
  var minEl = document.getElementById('filterPriceMin');
  var maxEl = document.getElementById('filterPriceMax');
  if (minEl) minEl.value = '';
  if (maxEl) maxEl.value = '';
  _doRenderStore(document.querySelector('.store-search')?.value || '');
}

function toggleStoreFilters() {
  var overlay = document.getElementById('filterOverlay');
  var popup   = document.getElementById('filterPopup');
  if (!overlay || !popup) return;
  var isOpen = overlay.classList.contains('on');
  overlay.classList.toggle('on', !isOpen);
  popup.classList.toggle('on', !isOpen);
}

function applyStoreSort(sort) {
  window._storeSort = sort;
  document.getElementById('filterOverlay')?.classList.remove('on');
  document.getElementById('filterPopup')?.classList.remove('on');
  ['az','za','price_asc','price_desc','newest'].forEach(s => {
    document.getElementById('sort-'+s)?.classList.toggle('active', s === sort);
  });
  _doRenderStore(document.querySelector('.store-search')?.value || '');
}

function updateSortChips() {
  var sort = window._storeSort || 'newest';
  ['newest','price_asc','price_desc','az','za'].forEach(s => {
    document.getElementById('sort-'+s)?.classList.toggle('active', s === sort);
  });
}

// ── PLANS PAGE ──
function goPlans() {
  goHome();
  setTimeout(() => {
    document.getElementById('plans')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }, 120);
}

function goPlansFromResults() {
  const srcGrid = document.getElementById('plansGrid');
  const dstGrid = document.getElementById('plansGridUpgrade');
  const dstDots = document.getElementById('plansDotsUpgrade');
  if (srcGrid && dstGrid) {
    dstGrid.innerHTML = srcGrid.innerHTML;
    if (dstDots) dstDots.innerHTML = '';
  }
  pushNav('upgrade');
  showPage('upgrade');
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
  let cur = 3, currentX = 0, targetX = 0, rafId = null;
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
  setTimeout(()=>goToInstantU(cur),60);
  setTimeout(()=>goToInstantU(cur),300);
}
