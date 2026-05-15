
// ── PLANOS ──
const PLAN_LIMITS = {
  visitante: { label:'Visitante', cpf:1, cpfpro:0, cnpj:1, cep:1, ip:1, whois:1, nome:1, familiares:0, telefone:1, email:1, placa:1, cnh:0, foto:0, pix:1, cns:0, renavam:1, total:1 },
  basico:  { label:'Básico',  cpf:20, cpfpro:0,  cnpj:-1, cep:-1, ip:-1, whois:-1, nome:20, familiares:20, telefone:20, email:30, placa:10, cnh:5,  foto:1,  pix:10,  cns:10,  renavam:10,  total:80  },
  starter: { label:'Starter', cpf:50, cpfpro:50, cnpj:-1, cep:-1, ip:-1, whois:-1, nome:50, familiares:50, telefone:50, email:80, placa:20, cnh:20, foto:3,  pix:50,  cns:50,  renavam:20,  total:130 },
  pro:     { label:'Pro',     cpf:200,cpfpro:200,cnpj:-1, cep:-1, ip:-1, whois:-1, nome:200,familiares:200,telefone:200,email:-1, placa:80, cnh:80, foto:5,  pix:200, cns:200, renavam:80,  total:200 },
  premium: { label:'Premium', cpf:-1, cpfpro:-1, cnpj:-1, cep:-1, ip:-1, whois:-1, nome:-1, familiares:-1, telefone:-1, email:-1, placa:-1, cnh:-1, foto:2,  pix:-1,  cns:-1,  renavam:-1,  total:-1  },
};

// CORES DOS PLANOS (único lugar, evita duplicação) — paleta azul-índigo coesa
const PLAN_COLORS = {
  basico:  { grad:'linear-gradient(135deg,#6366f1,#4f46e5)', glow:'rgba(99,102,241,.45)',  label:'Básico'  },
  starter: { grad:'linear-gradient(135deg,#818cf8,#6366f1)', glow:'rgba(129,140,248,.45)', label:'Starter' },
  pro:     { grad:'linear-gradient(135deg,#a5b4fc,#818cf8)', glow:'rgba(165,180,252,.45)', label:'Pro'     },
  premium: { grad:'linear-gradient(135deg,#c7d2fe,#a5b4fc)', glow:'rgba(199,210,254,.4)', label:'Premium' },
};

// ── CRÉDITOS ──
const MOD_CREDITS = {
  cpf:0.7, nome:0.7, cnpj:0.7, email:1, telefone:1, cep:0, ip:0, whois:0,
  placa:1.5, cnh:2, familiares:2.7, cpfpro:6.3, foto:9.26, pix:0.7, cns:1, renavam:1.5,
};
const CREDITS_PER_BRL = 10 / 2.70;
const BRL_PER_CREDIT  = 2.70 / 10;
const CREDIT_DISCOUNTS = [
  { minBrl: 27.00, pct: 20, label: '20% OFF' },
  { minBrl: 13.50, pct: 15, label: '15% OFF' },
  { minBrl:  8.10, pct: 10, label: '10% OFF' },
  { minBrl:  2.70, pct:  0, label: ''         },
];
const PLAN_BADGE_COLORS = {
  basico:  { bg:'rgba(99,102,241,.08)',   color:'#818cf8', border:'rgba(99,102,241,.2)'  },
  starter: { bg:'rgba(129,140,248,.09)',  color:'#a5b4fc', border:'rgba(129,140,248,.22)' },
  pro:     { bg:'rgba(165,180,252,.09)',  color:'#c7d2fe', border:'rgba(165,180,252,.22)' },
  premium: { bg:'rgba(199,210,254,.08)',  color:'#e0e7ff', border:'rgba(199,210,254,.2)'  },
};

// PLANOS — duração e nomes
const PLAN_DURATIONS = { starter:7, pro:15, premium:30 };
const PLAN_NAMES_PT  = { starter:'Starter', pro:'Pro', premium:'Premium' };

// HISTÓRICO — chaves
const HIST_ENABLED_KEY = (email) => `ghost_hist_on_${email}`;

// ── CHAT ──
const CHAT_BLOCKED_WORDS = ['xingamento','palavrão','lixo','idiota','otário','merda','foda','puta','caralho','viado','porra','desgraça'];
const CHAT_COOLDOWN_MS   = 5000;
const CHAT_MAX_PER_MIN   = 10;

// ── BLOQUEAR ZOOM ──
(function(){
  // bloqueia pinça (touchstart com 2+ dedos)
  document.addEventListener('touchstart', function(e){
    if(e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  // bloqueia gesture events (Safari iOS)
  document.addEventListener('gesturestart',  function(e){ e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturechange', function(e){ e.preventDefault(); }, { passive: false });
  document.addEventListener('gestureend',    function(e){ e.preventDefault(); }, { passive: false });
  // bloqueia ctrl+scroll (desktop)
  document.addEventListener('wheel', function(e){
    if(e.ctrlKey) e.preventDefault();
  }, { passive: false });
})();

// ── TRAVAR SCROLL QUANDO OVERLAY ABERTO ──
(function(){
  function _anyOverlayOpen() {
    return !!(
      window._overlayOpen ||
      document.querySelector('.modal-overlay.open') ||
      document.querySelector('.confirm-overlay.open') ||
      document.querySelector('.csb-confirm-overlay.open')
    );
  }

  // MutationObserver — seta flag imediatamente quando qualquer overlay abre
  const _mo = new MutationObserver(() => {
    window._overlayOpen = !!(
      document.querySelector('.modal-overlay.open') ||
      document.querySelector('.confirm-overlay.open') ||
      document.querySelector('.csb-confirm-overlay.open')
    );
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal-overlay,.confirm-overlay,.csb-confirm-overlay').forEach(el => {
      _mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  });

  // trava no touchstart já — sem delay de animação
  document.addEventListener('touchstart', function(e) {
    if (!_anyOverlayOpen()) return;
    const modal = document.querySelector('.modal-overlay.open .modal') ||
                  document.querySelector('.confirm-overlay.open .confirm-box') ||
                  document.querySelector('.csb-confirm-overlay.open .csb-confirm-box');
    if (modal && modal.contains(e.target)) return;
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', function(e) {
    if (!_anyOverlayOpen()) return;
    const modal = document.querySelector('.modal-overlay.open .modal') ||
                  document.querySelector('.confirm-overlay.open .confirm-box') ||
                  document.querySelector('.csb-confirm-overlay.open .csb-confirm-box');
    if (modal && modal.contains(e.target)) return;
    e.preventDefault();
  }, { passive: false });
})();

// ── SUPABASE ──
const SUPABASE_URL  = 'https://wpdjetsomlvmlnkpkwja.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwZGpldHNvbWx2bWxua3Brd2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc3MTIsImV4cCI6MjA5MDMzMzcxMn0.Ggboop89c8yb8pSjIqBtFnUgjpf6jPT988qcAE8bBVA';
const SB_HEADERS    = { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON };
