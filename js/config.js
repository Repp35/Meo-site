// ═══════════════════════════════════════
// GHOST BUSCA — Configurações Globais
// ═══════════════════════════════════════

const PLAN_LIMITS = {
  basico:  { label:'Básico',  cpf:20, cpfpro:0,  cnpj:-1, cep:-1, ip:-1, whois:-1, nome:20, familiares:20, telefone:20, email:30, placa:10, cnh:5,  foto:1,  pix:10,  cns:10,  renavam:10,  total:80  },
  starter: { label:'Starter', cpf:50, cpfpro:50, cnpj:-1, cep:-1, ip:-1, whois:-1, nome:50, familiares:50, telefone:50, email:80, placa:20, cnh:20, foto:3,  pix:50,  cns:50,  renavam:20,  total:373 },
  pro:     { label:'Pro',     cpf:200,cpfpro:200,cnpj:-1, cep:-1, ip:-1, whois:-1, nome:200,familiares:200,telefone:200,email:-1, placa:80, cnh:80, foto:1,  pix:200, cns:200, renavam:80,  total:999 },
  premium: { label:'Premium', cpf:-1, cpfpro:-1, cnpj:-1, cep:-1, ip:-1, whois:-1, nome:-1, familiares:-1, telefone:-1, email:-1, placa:-1, cnh:-1, foto:2,  pix:-1,  cns:-1,  renavam:-1,  total:999 },
};

// ── SUPABASE CONFIG ──
const SUPABASE_URL  = 'https://wpdjetsomlvmlnkpkwja.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwZGpldHNvbWx2bWxua3Brd2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc3MTIsImV4cCI6MjA5MDMzMzcxMn0.Ggboop89c8yb8pSjIqBtFnUgjpf6jPT988qcAE8bBVA';
const SB_HEADERS    = { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON };
