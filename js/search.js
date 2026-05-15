// Se este arquivo quebrar, só a busca falha.
// Auth, nav, store, wallet continuam funcionando.

try {

// ── AUTO MASK ──
function autoFmt(el) {
  if(['whois','nome','email','foto','familiares'].includes(curMod)) return;

  // IP: só permite chars válidos (dígitos, ponto, dois-pontos, hex a-f)
  if(curMod === 'ip') {
    el.value = el.value.replace(/[^0-9a-fA-F.:]/g, '').slice(0, 45);
    return;
  }

  // PIX: extrai números de qualquer texto colado, formata como CPF mascarado
  if(curMod === 'pix') {
    const digits = el.value.replace(/\D/g, '').slice(0, 6);
    if(!digits) { el.value = ''; return; }
    let c = ['*','*','*','*','*','*','*','*','*','*','*'];
    for(let i = 0; i < digits.length; i++) c[3 + i] = digits[i];
    el.value = c[0]+c[1]+c[2]+'.'+c[3]+c[4]+c[5]+'.'+c[6]+c[7]+c[8]+'-'+c[9]+c[10];
    return;
  }

  // PLACA: detecta formato antigo (ABC-1234) ou Mercosul (ABC1D23)
  if(curMod === 'placa') {
    const u = el.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7);
    if(!u) { el.value = ''; return; }
    // Mercosul: 3 letras + 1 número + 1 letra + 2 números
    const isMercosul = u.length >= 5 && /^[A-Z]{3}[0-9][A-Z]/.test(u);
    el.value = isMercosul ? u : (u.length > 3 ? u.slice(0,3)+'-'+u.slice(3) : u);
    return;
  }

  let v = el.value.replace(/\D/g,'');
  if(curMod==='cpf'||curMod==='cpfpro') {
    if(v.length>11) v=v.slice(0,11);
    v=v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/,'$1.$2.$3-$4');
  } else if(curMod==='cnpj') {
    if(v.length>14) v=v.slice(0,14);
    v=v.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/,'$1.$2.$3/$4').replace(/(\d{4})(\d)/,'$1-$2');
  } else if(curMod==='cep') {
    if(v.length>8) v=v.slice(0,8);
    v=v.replace(/(\d{5})(\d)/,'$1-$2');
  } else if(curMod==='telefone') {
    if(v.length>11) v=v.slice(0,11);
    if(v.length<=10) v=v.replace(/(\d{2})(\d{4})(\d)/,'($1) $2-$3');
    else v=v.replace(/(\d{2})(\d{5})(\d)/,'($1) $2-$3');
  } else if(curMod==='cnh') {
    if(v.length>11) v=v.slice(0,11);
  } else if(curMod==='cns') {
    if(v.length>15) v=v.slice(0,15);
    v=v.replace(/^(\d{3})(\d)/,'$1 $2')
       .replace(/^(\d{3}) (\d{4})(\d)/,'$1 $2 $3')
       .replace(/^(\d{3}) (\d{4}) (\d{4})(\d)/,'$1 $2 $3 $4');
  } else if(curMod==='renavam') {
    if(v.length>11) v=v.slice(0,11);
    v=v.replace(/^(\d{10})(\d)/,'$1-$2');
  }
  el.value=v;
}

function shake() {
  const i=document.getElementById('qInp');
  i.style.borderColor='rgba(248,113,113,.6)';
  i.animate([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}],{duration:180});
  setTimeout(()=>i.style.borderColor='',600);
}

// ── LOADING ──
let _searchAbortController = null;
let _cancelBtnTimer = null;

function _showCancelBtn() {
  const btn = document.getElementById('ldCancelBtn');
  if (btn) btn.style.display = 'flex';
}
function _hideCancelBtn() {
  const btn = document.getElementById('ldCancelBtn');
  if (btn) btn.style.display = 'none';
  if (_cancelBtnTimer) { clearTimeout(_cancelBtnTimer); _cancelBtnTimer = null; }
}
function cancelSearch() {
  if (_searchAbortController) {
    _searchAbortController.abort();
    _searchAbortController = null;
  }
  _hideCancelBtn();
  hideLd();
  renderErr('Consulta cancelada', 'Você cancelou a consulta. Tente novamente quando quiser.');
}
window.cancelSearch = cancelSearch;
const STEPS={
  cpf:    ['Validando CPF...','Buscando na base...','Montando resultado...'],
  cpfpro: ['Validando CPF...','Buscando dados completos...','Montando resultado...'],
  cnpj:   ['Validando CNPJ...','Consultando Receita...','Montando resultado...'],
  cep:    ['Validando CEP...','Consultando APIs...','Mesclando dados...'],
  ip:     ['Validando IP...','Geolocalização...','Dados de rede...'],
  whois:  ['Analisando domínio...','Consultando RDAP...','Extraindo registro...'],
  pix:    ['Validando chave...','Consultando Pix...','Montando resultado...'],
};
let _lastStepTime = 0;
function stepSet(n,s){
  const el=document.getElementById('ls'+n);
  if(!el) return;
  if(s==='done' && n < 3){
    const now = Date.now();
    const minGap = 400;
    const wait = Math.max(0, _lastStepTime + minGap - now);
    setTimeout(() => { el.className='ld-step '+s; _lastStepTime = Date.now(); }, wait);
  } else {
    el.className='ld-step '+s;
    if(s==='on') _lastStepTime = Date.now();
  }
}
function stepMsg(n,m){const el=document.getElementById('ls'+n+'t');if(el)el.textContent=m}
function showLd(mod){
  const msgs=STEPS[mod]||['Iniciando...','Consultando...','Finalizando...'];
  [1,2,3].forEach(i=>{stepSet(i,'');stepMsg(i,msgs[i-1]||'...')});
  _hideCancelBtn();
  document.getElementById('ld').classList.add('on');stepSet(1,'on');
  // mostra botão de cancelar após 8s
  _cancelBtnTimer = setTimeout(_showCancelBtn, 8000);
}
function hideLd(){document.getElementById('ld').classList.remove('on');_hideCancelBtn();}

// ── SAFE FETCH ──
async function sf(url,opts={},ms=9000){
  const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),ms);
  // encadeia com o cancel global
  const onCancel = () => ctrl.abort();
  if (_searchAbortController) _searchAbortController.signal.addEventListener('abort', onCancel);
  try{const r=await fetch(url,{...opts,signal:ctrl.signal});clearTimeout(t);return r;}
  catch{clearTimeout(t);return null;}
  finally{ if (_searchAbortController) _searchAbortController.signal.removeEventListener('abort', onCancel); }
}
async function sfJSON(url,opts,ms){const r=await sf(url,opts,ms);if(!r||!r.ok)return null;try{return await r.json();}catch{return null;}}
const CORS_PROXIES=[
  u=>`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  u=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  u=>`https://thingproxy.freeboard.io/fetch/${u}`,
];
async function proxyJSON(url){
  for(const mk of CORS_PROXIES){
    try{
      const r=await sf(mk(url),{},8000);if(!r||!r.ok)continue;
      const text=await r.text();let p;try{p=JSON.parse(text);}catch{continue;}
      if(p?.contents!==undefined){try{return JSON.parse(p.contents);}catch{continue;}}
      if(p&&typeof p==='object')return p;
    }catch(_){}
  }
  return null;
}

// ── MOCK DATA ──
const NO_DOUBLE = new Set(['whois','ip','cep','cnpj']);
function getMock(mod, val) {
  const N = 'Indisponível';
  const mocks = {
    cpf: {cpf:val||'000.000.000-00',nome:N,nascimento:N,idade:N,sexo:N,estado_civil:N,nacionalidade:N,naturalidade:N,signo:N,nome_mae:N,nome_pai:N,cnh:N,logradouro:N,numero:N,bairro:N,cidade:N,uf:N,cep:N,ibge:N,situacao_cadastral:N,titulo_eleitor:N},
    cpfpro: {cpf:val||'000.000.000-00',nome:N,nascimento:N,idade:N,sexo:N,signo:N,estado_civil:N,empresario:N,cnpj:N,servidor_publico:N,cor_pele:N,cor_olhos:N,cor_cabelo:N,altura:N,pis:N,nacionalidade:N,naturalidade:N,aposentado:N,parto_gemelar:N,escolaridade:N,nome_mae:N,nome_pai:N,irmaos:N,cns_definitivo:N,cns_provisorio:N,nis_nit:N,titulo_eleitor:N,situacao_rf:N,situacao_cadastral:N,renda_atual:N,score_faixa:N,score_spc:N,vip_sus:N,vip_motivo:N,logradouro:N,numero:N,bairro:N,cidade:N,uf:N,cep:N,ibge:N,siafi:N,gia:N,ddd:N,coordenada:N,chassi:N,cnh:N,renavam:N,placa_nacional:N,placa_mercosul:N,ano_fabricacao:N,potencia:N,peso_bruto:N,capacidade_passageiros:N,telefone:N},
    nome: {cpf:N,nome:val||N,nascimento:N,idade:N,sexo:N,estado_civil:N,nacionalidade:N,naturalidade:N,signo:N,nome_mae:N,nome_pai:N,cnh:N,logradouro:N,numero:N,bairro:N,cidade:N,uf:N,cep:N,ibge:N,situacao_cadastral:N,titulo_eleitor:N},
    familiares:  {nome:N,cpf:N},
    familiares2: {nome:N,cpf:N},
    telefone: {formato_internacional:val||N,formato_nacional:N,formato_e164:N,numero_local:N,pais:N,codigo_iso:N,fuso_horario:N,operadora:N,status:N,nome:N,cpf:N,nascimento:N,sexo:N,estado_civil:N,logradouro:N,numero:N,bairro:N,cidade:N,uf:N,cep:N,regiao:N,latitude:N,longitude:N,google_maps:N},
    email: {email:val||N,nome:N,cpf:N,nascimento:N,sexo:N,dominio:N,provedor:N,valido:N,descartavel:N,mx_valido:N,breaches:N,fontes:N,ultima_vez:N,logradouro:N,cidade:N,uf:N},
    foto: {__foto:true,nome:N,cpf:val||N,estado_emissor:N,data_emissao:N},
    placa: {placa_nacional:val||N,placa_mercosul:N,chassi:N,renavam:N,ano_fabricacao:N,potencia:N,peso_bruto:N,capacidade_passageiros:N,nome:N,cpf:N,nascimento:N,sexo:N,logradouro:N,numero:N,bairro:N,cidade:N,uf:N,cep:N},
    cnh: {numero:val||N,nome:N,cpf:N,data_nascimento:N,categoria:N,data_validade:N,situacao:N,pontos:N},
    cnpj: {cnpj:val||'00.000.000/0000-00',nome:N,nome_fantasia:N,razao_social:N,data_abertura:N,natureza_juridica:N,capital_social:N,porte:N,codigo_situacao:N,data_situacao:N,cnae_principal:N,cnae_secundarios:N,socios:N,telefones:N,emails:N,logradouro:N,numero:N,bairro:N,cidade:N,uf:N,cep:N,simples_nacional:N,data_opcao_simples:N,meio:N},
    cep: {cep:val||'00000-000',logradouro:N,complemento:N,bairro:N,uf:N,ibge:N,gia:N,ddd:N,siafi:N,regiao:N,latitude:N,longitude:N},
    cep_morador: {nome:N,cpf:N,nascimento:N,sexo:N,numero:N,bairro:N},
    ip: {ip:val||N,hostname:N,tipo:N,isp:N,org:N,asn:N,pais:N,codigo_pais:N,regiao:N,cidade:N,cep:N,latitude:N,longitude:N,fuso_horario:N,proxy:N,vpn:N,tor:N,hosting:N},
    pix: {cpf:val||N,nome:N,nascimento:N,idade:N,sexo:N,estado_civil:N,nacionalidade:N,naturalidade:N,signo:N,nome_mae:N,nome_pai:N,cnh:N,logradouro:N,numero:N,bairro:N,cidade:N,uf:N,cep:N,ibge:N,situacao_cadastral:N,titulo_eleitor:N},
    cns: {cns_definitivo:val||N,cns_provisorio:N,nome:N,cpf:N,nascimento:N,sexo:N,nome_mae:N,nome_pai:N},
    renavam: {renavam:val||N,placa_nacional:N,placa_mercosul:N,chassi:N,ano_fabricacao:N,potencia:N,peso_bruto:N,capacidade_passageiros:N,nome:N,cpf:N,nascimento:N,sexo:N,logradouro:N,numero:N,bairro:N,cidade:N,uf:N,cep:N},
  };
  const r = mocks[mod];
  if (!r) return null;
  return {...r};
}

// ── STUB ──
// forceGhost: ignora verificação de cupom (já validado no _runSearch como fallback)
// skipSteps:  não anima steps (API real já os animou antes de falhar)
async function searchStub(val, forceGhost = false, skipSteps = false){
  if (!skipSteps) {
    stepSet(1,'on');
    await new Promise(r=>setTimeout(r,600));
    stepSet(1,'done'); stepSet(2,'on');
    await new Promise(r=>setTimeout(r,550));
    stepSet(2,'done');
  }

  const isGhost = forceGhost || activeCoupons.has('ghost') || activeCoupons.has('ghost2');

  // foto só funciona com ghost
  if (curMod === 'foto') {
    if (!isGhost) return null;
  }

  // familiares: só com ghost
  if (curMod === 'familiares') {
    if (!isGhost) return null;
    const f1 = getMock('familiares', val);
    const f2 = getMock('familiares2', val);
    return f1 && f2 ? [f1, f2] : f1 ? [f1] : null;
  }

  // cep tem API real — se chegou aqui no stub é porque a API falhou
  if (curMod === 'cep') return null;

  // todos os outros módulos sem API real: só retorna dados se ghost
  if (!isGhost) return null;

  const mock = getMock(curMod, val);
  return mock ? [mock] : null;
}

// ── CPF ──
function nCPF(raw, n) {
  if (!raw || typeof raw !== 'object') return null;
  const g = (...ks) => { for (const k of ks) { const v = raw[k]; if (v && String(v).trim() && String(v).trim() !== '0' && String(v).trim() !== 'null') return String(v); } return null; };
  const nome = g('nome','NOME','name','nm_pessoa'); if (!nome) return null;
  // formata data de nascimento
  let nasc = g('data_nascimento','nascimento','NASC','birthdate');
  if (nasc && nasc.includes('-')) {
    const [y,m,d] = nasc.split('-');
    nasc = `${d}/${m}/${y}`;
  }
  // mapeia genero
  const gen = g('genero','sexo','SEXO','gender');
  const sexo = gen === 'M' ? 'Masculino' : gen === 'F' ? 'Feminino' : gen;
  const o = { nome, cpf: n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'), nascimento: nasc, sexo, nome_mae: g('nome_mae','mae','MAE','nm_mae','mother'), nome_pai: g('nome_pai','pai','PAI','nm_pai','father'), situacao: g('situacao','SITUACAO','status'), titulo_eleitor: g('titulo_eleitor','titulo'), renda: g('renda'), pis: g('pis','PIS'), email: g('email','EMAIL'), telefone: g('telefone','celular','phone'), logradouro: g('logradouro','LOGRADOURO'), numero: g('numero','NUMERO'), bairro: g('bairro','BAIRRO'), cidade: g('cidade','MUNICIPIO'), uf: g('uf','UF'), cep_end: g('cep','CEP') };
  Object.keys(o).forEach(k => { if (!o[k]) delete o[k]; }); return o;
}
async function searchCPF(cpf) {
  const n = cpf.replace(/\D/g, ''); if (n.length !== 11) return null;
  const KEY = '55c9476b357b8404a427ad090909c2f08fa485f84e4c78cb13545a5c6564455e';
  stepSet(1, 'on');

  // tenta direto (funciona se a API tiver CORS liberado)
  let raw = await sfJSON(`https://apicpf.com/api/consulta?cpf=${n}`, { headers: {'X-API-KEY': KEY, 'Accept': 'application/json'} });
  if (raw) { const d = raw.data || raw.resultado || raw; const nm = nCPF(d, n); if (nm) { stepSet(1,'done'); stepSet(2,'done'); return [nm]; } }

  stepSet(1,'done'); stepSet(2,'on');

  // fallback: proxy com key na URL
  raw = await proxyJSON(`https://apicpf.com/api/consulta?cpf=${n}&key=${KEY}`);
  if (raw) { const d = raw.data || raw.resultado || raw; const nm = nCPF(d, n); if (nm) { stepSet(2,'done'); return [nm]; } }

  stepSet(2,'done'); return null;
}

// ── CNPJ ──
function nCNPJ(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const g = (...ks) => { for (const k of ks) { const v = raw[k]; if (v && String(v).trim() && String(v).trim() !== '0') return String(v); } return null; };
  const razao = g('razao_social','nome','company_name','nome_empresarial'); if (!razao) return null;
  let socios = null; const qsa = raw.qsa || raw.QSA || raw.socios || [];
  if (Array.isArray(qsa) && qsa.length) socios = qsa.map(s => s.nome || s.name || '').filter(Boolean).join(' · ');
  let tel = g('telefone','ddd_telefone_1','fone');
  if (!tel) { const tls = raw.telefones || []; if (Array.isArray(tls) && tls.length) tel = tls.map(t => t.ddd ? `(${t.ddd}) ${t.numero}` : t).join(' / '); }
  const logr = g('logradouro','street'); const num = g('numero');
  const end = [logr, num && num !== 'S/N' ? num : null].filter(Boolean).join(', ');
  const o = { razao_social: razao, nome_fantasia: g('nome_fantasia','fantasia'), cnpj: (g('cnpj','CNPJ','document') || '').replace(/\D/g,'').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'), situacao: g('situacao_cadastral','situacao','status'), data_abertura: g('data_inicio_atividade','data_abertura','abertura'), porte: g('porte','porte_empresa'), capital_social: g('capital_social','capital'), natureza_juridica: g('natureza_juridica'), tipo: g('matriz_filial','tipo'), logradouro: end || null, complemento: g('complemento'), bairro: g('bairro'), cidade: g('municipio','cidade'), uf: g('uf'), cep: g('cep','CEP'), email: g('email','EMAIL','correio_eletronico'), telefone: tel, simples: raw.opcao_simples === 'S' || raw.simples === true ? 'Sim' : raw.opcao_simples === 'N' || raw.simples === false ? 'Não' : null, mei: raw.opcao_mei === 'S' || raw.mei === true ? 'Sim' : null, atividade: g('cnae_fiscal_descricao','atividade_principal'), socios };
  Object.keys(o).forEach(k => { if (!o[k]) delete o[k]; }); return o;
}
async function searchCNPJ(cnpj) {
  const n = cnpj.replace(/\D/g, ''); if (n.length !== 14) return null;
  const tf = async url => { const d = await sfJSON(url); return d ? nCNPJ(d) : null; };
  stepSet(1,'on');
  const r1 = await tf(`https://brasilapi.com.br/api/cnpj/v1/${n}`); if (r1) { stepSet(1,'done'); stepSet(2,'done'); return [r1]; }
  stepSet(1,'done'); stepSet(2,'on');
  const r2 = await tf(`https://publica.cnpj.ws/cnpj/${n}`); if (r2) { stepSet(2,'done'); return [r2]; }
  const r3 = await tf(`https://minhareceita.org/${n}`); if (r3) { stepSet(2,'done'); return [r3]; }
  stepSet(2,'done'); return null;
}

// ── CEP ──
async function searchCEP(cep) {
  const n = cep.replace(/\D/g, ''); if (n.length !== 8) return null;
  stepSet(1,'on');
  const all = await Promise.allSettled([
    sfJSON(`https://viacep.com.br/ws/${n}/json/`),
    sfJSON(`https://brasilapi.com.br/api/cep/v2/${n}`),
    sfJSON(`https://cep.awesomeapi.com.br/json/${n}`),
    sfJSON(`https://opencep.com/v1/${n}`),
  ]);
  stepSet(1,'done'); stepSet(2,'on');
  let m = {};
  all.forEach(res => { if (res.status === 'fulfilled' && res.value && !res.value.erro && !res.value.message && !res.value.name) m = {...m, ...res.value}; });
  stepSet(2,'done');
  if (!m.logradouro && !m.street && !m.address) return null;
  const lat = m.location?.coordinates?.latitude || m.lat || null;
  const lng = m.location?.coordinates?.longitude || m.lng || null;
  const maps = lat && lng ? `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">Abrir no Maps ↗</a>` : null;
  const o = { _type:'cep_info', cep: n.replace(/(\d{5})(\d{3})/, '$1-$2'), logradouro: m.logradouro || m.street || m.address || null, tipo: m.address_type || m.tipo || null, complemento: m.complemento || null, bairro: m.bairro || m.neighborhood || m.district || null, cidade: m.localidade || m.city || null, estado: m.estado || m.state || null, uf: m.uf || null, regiao: m.regiao || null, ddd: m.ddd || null, ibge: m.ibge || m.city_ibge || null, gia: m.gia || null, siafi: m.siafi || null, latitude: lat ? String(lat) : null, longitude: lng ? String(lng) : null, google_maps: maps };
  Object.keys(o).forEach(k => { if (!o[k] && k !== '_type') delete o[k]; });
  const moradores = (m.moradores || m.residents || []).map((r,idx) => ({
    _type:'cep_morador', _idx: idx+1,
    nome: r.nome||null, cpf: r.cpf||null, nascimento: r.nascimento||null,
    sexo: r.sexo||null, numero: r.numero||null, bairro: r.bairro||null
  })).filter(r => r.nome || r.cpf);
  return [o, ...moradores];
}

// IP
async function searchIP(ip) {
  const t = ip.trim();
  const fi = d => ({ip:d.ip||t,tipo:d.type||null,cidade:d.city||null,regiao:d.region||null,pais:`${d.country||''} (${d.country_code||''})`,continente:d.continent||null,latitude:d.latitude?String(d.latitude):null,longitude:d.longitude?String(d.longitude):null,timezone:d.timezone?.id||null,provedor:d.connection?.isp||null,org:d.connection?.org||null,asn:d.connection?.asn?`AS${d.connection.asn}`:null});
  const fa = d => ({ip:d.ip||t,hostname:d.hostname||null,cidade:d.city||null,regiao:d.region||null,pais:`${d.country_name||''} (${d.country||''})`,continente:d.continent_code||null,latitude:d.latitude?String(d.latitude):null,longitude:d.longitude?String(d.longitude):null,timezone:d.timezone||null,provedor:d.org||null,asn:d.asn||null,proxy_vpn:d.proxy?'Sim':'Não'});
  const cl = o => { Object.keys(o).forEach(k => { if (!o[k]) delete o[k]; }); return o; };
  stepSet(1,'on');
  let d = await sfJSON(`https://ipwho.is/${t}`); if (d?.success) { stepSet(1,'done'); stepSet(2,'done'); return [cl(fi(d))]; }
  d = await sfJSON(`https://freeipapi.com/api/json/${t}`); if (d?.ipAddress) { stepSet(1,'done'); stepSet(2,'done'); return [cl({ip:d.ipAddress||t,cidade:d.cityName||null,regiao:d.regionName||null,pais:`${d.countryName||''} (${d.countryCode||''})`,latitude:d.latitude?String(d.latitude):null,longitude:d.longitude?String(d.longitude):null,timezone:d.timeZone||null})]; }
  d = await sfJSON(`https://ipapi.co/${t}/json/`); if (d && !d.error && !d.reason) { stepSet(1,'done'); stepSet(2,'done'); return [cl(fa(d))]; }
  stepSet(1,'done'); stepSet(2,'on');
  d = await proxyJSON(`https://ipwho.is/${t}`); if (d?.success) { stepSet(2,'done'); return [cl(fi(d))]; }
  d = await proxyJSON(`https://ipapi.co/${t}/json/`); if (d && !d.error && !d.reason) { stepSet(2,'done'); return [cl(fa(d))]; }
  stepSet(2,'done'); return null;
}

// ── WHOIS ──
function normWhoisObj(raw, domain) {
  const g = (...ks) => { for (const k of ks) { const v = raw[k]; if (v && String(v).trim() && String(v).trim() !== 'REDACTED FOR PRIVACY') return String(v).trim(); } return null; };
  const ns = raw.name_servers || raw.nameservers || [];
  const nsArr = Array.isArray(ns) ? ns.map(n => typeof n === 'string' ? n : (n.name || n.ldhName || '')).filter(Boolean) : [];
  const statusArr = Array.isArray(raw.status) ? raw.status : (raw.status ? [raw.status] : []);
  const reg = raw.registrant || raw.contacts?.registrant || {};
  return { domain_name: (g('domain_name','domain','ldhName') || domain || '').toUpperCase(), registry_id: g('domain_id','registry_domain_id'), registrar: g('registrar','registrar_name'), registrar_url: g('registrar_url'), registrar_iana: g('registrar_iana_id'), whois_server: g('registrar_whois_server','whois_server'), creation_date: g('creation_date','created_date','created'), updated_date: g('updated_date','update_date'), expiration_date: g('expiration_date','expires_date','expiry_date'), status: statusArr.join(' | ') || null, registrant_org: g('registrant_organization') || reg.organization || null, registrant_country: g('registrant_country') || reg.country || null, registrant_email: g('registrant_email') || reg.email || null, nameservers: nsArr.join(', ') || null, dnssec: g('dnssec') || (raw.secureDNS?.delegationSigned ? 'signedDelegation' : 'unsigned') };
}
function normRDAP(raw, domain) {
  const ev = a => raw.events?.find(e => e.eventAction === a)?.eventDate || null;
  const reg = raw.entities?.find(e => e.roles?.includes('registrar'));
  const ns = raw.nameservers?.map(n => n.ldhName).filter(Boolean) || [];
  return { domain_name: (raw.ldhName || domain || '').toUpperCase(), registrar: reg?.vcardArray?.[1]?.find(x => x[0] === 'fn')?.[3] || null, creation_date: ev('registration'), updated_date: ev('last changed'), expiration_date: ev('expiration'), status: Array.isArray(raw.status) ? raw.status.slice(0,4).join(' | ') : null, nameservers: ns.join(', ') || null, dnssec: raw.secureDNS?.delegationSigned ? 'signedDelegation' : 'unsigned' };
}
function mergeW(a, b) { const o = {...a}; for (const k of Object.keys(b)) { if (!o[k] && b[k]) o[k] = b[k]; } return o; }
function dictToText(d) {
  const LABELS = { domain_name:'Domain Name', registry_id:'Registry Domain ID', registrar:'Registrar', registrar_url:'Registrar URL', registrar_iana:'Registrar IANA ID', whois_server:'Registrar WHOIS Server', creation_date:'Creation Date', updated_date:'Updated Date', expiration_date:'Expiration Date', status:'Domain Status', registrant_org:'Registrant Organization', registrant_country:'Registrant Country', registrant_email:'Registrant Email', tech_email:'Tech Email', nameservers:'Name Server', dnssec:'DNSSEC' };
  const lines = [];
  for (const [k, label] of Object.entries(LABELS)) { const v = d[k]; if (!v) continue; if (k === 'nameservers') { v.split(', ').forEach(ns => lines.push(`${label}: ${ns.trim().toUpperCase()}`)); } else if (k === 'status') { v.split(' | ').forEach(s => lines.push(`${label}: ${s.trim()}`)); } else { lines.push(`${label}: ${v}`); } }
  return lines.join('\n');
}
async function searchWHOIS(domain) {
  const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  let merged = {};
  stepSet(1,'on');
  try { const raw = await sfJSON(`https://who-dat.as93.net/${d}`); if (raw && !raw.error && (raw.domain_name || raw.creation_date)) merged = mergeW(merged, normWhoisObj(raw, d)); } catch (_) {}
  if (!merged.domain_name) { try { const raw = await proxyJSON(`https://who-dat.as93.net/${d}`); if (raw && !raw.error && (raw.domain_name || raw.creation_date)) merged = mergeW(merged, normWhoisObj(raw, d)); } catch (_) {} }
  stepSet(1,'done'); stepSet(2,'on');
  try { const raw = await sfJSON(`https://rdap.org/domain/${d}`); if (raw && (raw.ldhName || raw.events?.length)) merged = mergeW(merged, normRDAP(raw, d)); } catch (_) {}
  if (!merged.creation_date) { try { const raw = await proxyJSON(`https://rdap.org/domain/${d}`); if (raw && (raw.ldhName || raw.events?.length)) merged = mergeW(merged, normRDAP(raw, d)); } catch (_) {} }
  try { const tld = d.split('.').pop(); const base = tld === 'net' ? 'https://rdap.verisign.com/net/v1' : 'https://rdap.verisign.com/com/v1'; const raw = await sfJSON(`${base}/domain/${d}`); if (raw?.ldhName || raw?.events?.length) merged = mergeW(merged, normRDAP(raw, d)); } catch (_) {}
  stepSet(2,'done');
  const hasData = merged.domain_name || merged.creation_date || merged.registrar || merged.nameservers;
  if (!hasData) return null;
  Object.keys(merged).forEach(k => { if (!merged[k]) delete merged[k]; });
  const text = dictToText(merged); if (!text) return null;
  return [{ __whois_raw: text, dominio: d }];
}

// ── PIX CPF ──
async function searchPix(val) {
  // extrai os dígitos conhecidos da máscara
  const digits = val.replace(/[^0-9]/g, '');
  if (digits.length < 4) return null;

  stepSet(1,'on');
  await new Promise(r=>setTimeout(r,500));
  stepSet(1,'done'); stepSet(2,'on');
  await new Promise(r=>setTimeout(r,500));
  stepSet(2,'done');

  const N = 'Indisponível';
  return [{
    cpf: val.trim(),
    nome: N, nascimento: N, nome_mae: N, nome_pai: N, avo: N,
    nis_nit: N, rg: N, cnh: N,
    logradouro: N, numero: N, bairro: N, cidade: N, uf: N, cep: N,
    telefone: N, email: N, situacao: N, titulo_eleitor: N,
  }];
}
const MOD_MIN_LEN = {
  cpf:9, cpfpro:9, cnpj:14, cep:8, placa:7, cnh:11, telefone:9, cns:15, renavam:9,
};

// PARSE CPF PARCIAL (Pix)
function parseCpfParcial(val) {
  // extrai só dígitos e asteriscos/pontos/traços
  // exemplos aceitos: ***.723.262-**, .723.262-, 723.262, 723262
  const clean = val.replace(/[^0-9*xX]/g, ''); // mantém dígitos e *
  const digits = val.replace(/[^0-9]/g, '');    // só dígitos

  // precisa ter pelo menos 4 dígitos consecutivos pra buscar
  if (digits.length < 4) return null;

  // monta padrão de busca — substitui * e posições desconhecidas por '?'
  // normaliza para 11 chars onde desconhecido = '?'
  let pattern = '';
  let di = 0;
  for (let i = 0; i < 11; i++) {
    if (di < clean.length) {
      const c = clean[di];
      if (c === '*' || c === 'x' || c === 'X') { pattern += '?'; di++; }
      else if (/\d/.test(c)) { pattern += c; di++; }
      else pattern += '?';
    } else {
      pattern += '?';
    }
  }
  return { pattern, knownDigits: digits };
}

// helper — valida IPv4 e IPv6
function isValidIP(val) {
  const t = val.trim();
  // IPv4 (público ou privado)
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(t))
    return t.split('.').every(n => Number(n) >= 0 && Number(n) <= 255);
  // IPv6 — contém dois-pontos e só hex chars + dois-pontos
  if (t.includes(':') && /^[0-9a-fA-F:]+$/.test(t)) {
    const parts = t.split(':');
    return parts.length >= 2 && parts.length <= 8;
  }
  return false;
}

function validateInput(mod, val) {
  if (mod === 'pix') {
    const digits = val.replace(/[^0-9]/g, '');
    return digits.length >= 4 && digits.length <= 6;
  }
  if (mod === 'ip') return isValidIP(val);
  if (mod === 'placa') {
    const p = val.replace(/[^a-zA-Z0-9]/g,'');
    if (p.length < 7) return false;
    // formato antigo: 3 letras + 4 números
    if (/^[A-Za-z]{3}[0-9]{4}$/.test(p)) return true;
    // Mercosul: 3 letras + 1 número + 1 letra + 2 números
    if (/^[A-Za-z]{3}[0-9][A-Za-z][0-9]{2}$/.test(p)) return true;
    return false;
  }
  if (mod === 'nome') return val.trim().length >= 2;
  const clean = val.replace(/\D/g,'');
  const min   = MOD_MIN_LEN[mod];
  if (min && clean.length < min) return false;
  if (['email','foto','whois','familiares','cns'].includes(mod) && val.trim().length < 3) return false;
  return true;
}

// ── SEARCH ROUTER ──
function _handlePermissionDenied(perm) {
  const mod     = curMod;
  const modName = MODS[mod]?.name || mod;
  const cost    = MOD_CREDITS[mod] || 0;
  const priceStr = cost > 0 ? fmtBrl(creditsToReal(cost)) : null;

  if (perm.reason === 'login') {
    renderErr('Login necessário','Crie uma conta gratuitamente para consultar.');
    pushNav('results'); showPage('results'); return;
  }

  // visitante esgotou a consulta diária — pede cadastro
  if (currentUser?.anon && (perm.reason === 'mod_limit' || perm.reason === 'total_limit')) {
    const el = document.getElementById('modalUnlockContent');
    const resetMsg = (() => {
      const now  = new Date();
      const meia = new Date(now); meia.setHours(24,0,0,0);
      const diff = meia - now;
      const hh   = Math.floor(diff / 3600000);
      const mm   = Math.floor((diff % 3600000) / 60000);
      return hh > 0 ? `${hh}h ${mm}min` : `${mm}min`;
    })();
    el.innerHTML = `
      <div style="margin-bottom:10px;color:var(--p)"><svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.03 2 3 6.03 3 11v9l3-2 2 2 2-2 2 2 2-2 3 2v-9c0-4.97-4.03-9-9-9zm-3.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg></div>
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:8px">Você usou sua consulta gratuita</h3>
      <p style="font-size:.8rem;color:var(--muted);line-height:1.6;margin-bottom:6px">Crie uma conta grátis e ganhe <strong style="color:var(--fg)">7 consultas por dia</strong> — sem precisar pagar nada.</p>
      <p style="font-size:.72rem;color:var(--muted);margin-bottom:20px">↺ Ou aguarde ${resetMsg} para uma nova consulta gratuita.</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="modal-submit" style="width:100%" onclick="document.getElementById('modalUnlock').classList.remove('open');openModal('modal-register')">
          Criar conta grátis
        </button>
        <button onclick="document.getElementById('modalUnlock').classList.remove('open');openModal('modal-login')" style="width:100%;padding:11px;border-radius:var(--r);font-size:.85rem;font-weight:600;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted2)">Já tenho conta</button>
        <button onclick="document.getElementById('modalUnlock').classList.remove('open')" style="font-size:.75rem;color:var(--muted);padding:6px" onmouseover="this.style.color='var(--fg)'" onmouseout="this.style.color='var(--muted)'">Voltar amanhã</button>
      </div>`;
    document.getElementById('modalUnlock').classList.add('open');
    return;
  }

  if (perm.reason === 'credits-only') {
    if (canUseCredits(mod)) { askUseCredits(); return; }
    showUnlockModal(mod, 'credits-only'); return;
  }
  if (perm.reason === 'upgrade') {
    showUnlockModal(mod, 'upgrade'); return;
  }

  // limit — mod_limit ou total_limit
  if (canUseCredits(mod)) { askUseCredits(); return; }

  const isTotalLimit = perm.reason === 'total_limit';
  const el = document.getElementById('modalUnlockContent');
  const resetMsg = (() => {
    const now  = new Date();
    const meia = new Date(now); meia.setHours(24,0,0,0);
    const diff = meia - now;
    const hh   = Math.floor(diff / 3600000);
    const mm   = Math.floor((diff % 3600000) / 60000);
    return hh > 0 ? `${hh}h ${mm}min` : `${mm}min`;
  })();

  el.innerHTML = `
    <div style="margin-bottom:10px;color:var(--muted)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>
    <h3 style="font-size:1rem;font-weight:700;margin-bottom:8px">Acabaram suas consultas diárias</h3>
    <p style="font-size:.8rem;color:var(--muted);line-height:1.6;margin-bottom:6px">${
      isTotalLimit
        ? `Você atingiu o limite total do dia. ${priceStr ? `Continue agora por apenas ${priceStr} por consulta de ${modName}.` : ''}`
        : `Você esgotou as consultas de ${modName} de hoje. ${priceStr ? `Continue por apenas ${priceStr}.` : ''}`
    }</p>
    <p style="font-size:.72rem;color:var(--muted);margin-bottom:20px">↺ Novas consultas em ${resetMsg}</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${cost > 0 ? `<button class="credits-buy-btn" onclick="document.getElementById('modalUnlock').classList.remove('open');goCredits('${mod}')">
        <svg width="13" height="13" viewBox="0 0 20 24" fill="none"><path d="M16 3L5 3C2.5 3 1 5 1 7C1 9 2.5 11 5 11L15 11C17.5 11 19 13 19 15C19 17 17.5 19 15 19L4 19" stroke="#fff" stroke-width="3" stroke-linecap="square"/></svg>
        Comprar consultas avulsas
      </button>` : ''}
      <button onclick="document.getElementById('modalUnlock').classList.remove('open');goPlansFromResults()" style="width:100%;padding:11px;border-radius:var(--r);font-size:.85rem;font-weight:600;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted2);transition:all .15s">Ver planos</button>
      <button onclick="document.getElementById('modalUnlock').classList.remove('open')" style="font-size:.75rem;color:var(--muted);padding:6px" onmouseover="this.style.color='var(--fg)'" onmouseout="this.style.color='var(--muted)'">Voltar amanhã</button>
    </div>`;
  document.getElementById('modalUnlock').classList.add('open');
}

async function doSearch(){
  const val = document.getElementById('qInp').value.trim();
  if (!val) { shake(); return; }
  if (!validateInput(curMod, val)) { shake(); return; }

  // cupom ghost/double/ghost2 bypassa todas as restrições
  const isGhost = activeCoupons.has('ghost') || activeCoupons.has('double') || activeCoupons.has('ghost2');
  if (isGhost) { await _runSearch(); return; }

  // módulos com seleção de pessoa: conta 1 consulta ao pesquisar,
  // mas devolve se o usuário sair sem liberar ninguém
  if (LIBERAR_MODS.has(curMod)) {
    const perm = canQuery(curMod);
    if (!perm.ok) { _handlePermissionDenied(perm); return; }
    window._liberarModeActive = true;
    window._liberarAnyReleased = false;
    incrementCounter(curMod);
    const val2 = document.getElementById('qInp').value.trim();
    const cost2 = MOD_CREDITS[curMod] || 0;
    histAdd({ type:'consulta', name:`${MODS[curMod]?.name || curMod} — ${val2}`, free: cost2 === 0, quota: cost2 > 0, value: null });
    await _runSearch(false, true);
    return;
  }

  const perm = canQuery(curMod);

  if (!perm.ok) {
    _handlePermissionDenied(perm);
    return;
  }

  // tem consultas — pergunta créditos só se módulo premium ou poucos restantes
  const cost = MOD_CREDITS[curMod] || 0;
  const left = perm.left != null ? perm.left : Infinity;
  const isPremiumMod = PREMIUM_MODS.has(curMod);
  const isLow = left !== Infinity && left <= CREDITS_LOW_THRESHOLD;

  if (cost > 0 && canUseCredits(curMod) && (isPremiumMod || isLow)) {
    askUseCredits(true);
    return;
  }

  await _runSearch();
}

async function _runSearch(useCredits = false, skipCount = false) {
  const val = document.getElementById('qInp').value.trim();
  showLd(curMod);
  const t0 = Date.now();
  const MIN_MS = 900;

  // cria controller de cancelamento para esta busca
  _searchAbortController = new AbortController();
  const signal = _searchAbortController.signal;

  async function _doApiCall() {
    if (signal.aborted) return null;
    if (curMod==='cpf'||curMod==='cpfpro') return await searchCPF(val);
    else if(curMod==='cnpj')  return await searchCNPJ(val);
    else if(curMod==='cep')   return await searchCEP(val);
    else if(curMod==='ip')    return await searchIP(val);
    else if(curMod==='whois') return await searchWHOIS(val);
    else if(curMod==='pix')   return await searchPix(val);
    else return await searchStub(val);
  }

  try{
    let res;
    const isGhost  = activeCoupons.has('ghost')  || activeCoupons.has('ghost2');
    const isDouble = activeCoupons.has('double') || activeCoupons.has('ghost2');

    // Sempre tenta a API real primeiro
    res = await _doApiCall();

    // Se cancelado durante a chamada, para aqui
    if (signal.aborted) return;

    // Se falhou (cooldown/erro), aguarda 1.8s e tenta novamente
    if ((!res || res.length === 0) && !isGhost) {
      stepMsg(1, 'Aguardando API...');
      await new Promise(r => setTimeout(r, 1800));
      if (signal.aborted) return;
      res = await _doApiCall();
      if (signal.aborted) return;
    }

    // ghost: se a API não retornou nada, cai no mock como fallback
    if ((!res || res.length === 0) && isGhost) {
      res = await searchStub(val, true, true); // forceGhost=true, skipSteps=true
    }

    // double: duplica todos os resultados (cópia com CPF mascarado)
    if (res && res.length > 0 && isDouble) {
      const copies = res.map(item => {
        const copy = {...item};
        if (copy.cpf !== undefined) copy.cpf = '***.***.***-**';
        return copy;
      });
      res = [...res, ...copies];
    }

    const elapsed = Date.now() - t0;
    if (elapsed < MIN_MS) await new Promise(r => setTimeout(r, MIN_MS - elapsed));
    if (signal.aborted) return;
    if (res && res.length > 0) {
      if (!skipCount) {
        if (useCredits) { spendCredits(curMod); playCreditsAnimation(); }
        else incrementCounter(curMod);
        const cost = MOD_CREDITS[curMod] || 0;
        histAdd({ type:'consulta', name:`${MODS[curMod]?.name || curMod} — ${val}`, free: cost === 0 && !useCredits, quota: cost > 0 && !useCredits, value: useCredits ? creditsToReal(cost).toFixed(2) : null });
      }
    }
    stepSet(3,'done'); hideLd(); pushNav('results'); renderResults(res);
    updateResultsBanner(curMod);
  }catch(e){
    if (signal.aborted) return; // cancelado pelo usuário, já tratado
    hideLd(); renderErr('Erro inesperado','Verifique sua conexão e tente novamente.');
  } finally {
    _searchAbortController = null;
  }
}

// ── UPGRADE BLOCK ──
// ── CAMPOS BLOQUEADOS POR MÓDULO ──
const LOCKED_FIELDS = {
  cpf: {
    title: 'Disponível no CPF Pro',
    plan: 'starter',
    fields: [
      {lbl:'Sexo',          val:'M / F'},
      {lbl:'Raça/Cor',      val:'████'},
      {lbl:'Signo',         val:'████'},
      {lbl:'Tipo Sanguíneo',val:'████'},
      {lbl:'CNS Definitivo',val:'████'},
      {lbl:'Score SPC',     val:'███'},
      {lbl:'Renda Estimada',val:'R$ ████'},
      {lbl:'Escolaridade',  val:'████'},
      {lbl:'Estado Civil',  val:'████'},
      {lbl:'Bolsa Família', val:'████'},
      {lbl:'Empresário',    val:'████'},
      {lbl:'Classe Social', val:'████'},
    ]
  },
  nome: {
    title: 'Disponível no CPF Pro',
    plan: 'starter',
    fields: [
      {lbl:'Score SPC',     val:'███'},
      {lbl:'Renda Estimada',val:'R$ ████'},
      {lbl:'Estado Civil',  val:'████'},
      {lbl:'Bolsa Família', val:'████'},
      {lbl:'Tipo Sanguíneo',val:'████'},
      {lbl:'Escolaridade',  val:'████'},
    ]
  },
  pix: {
    title: 'Disponível no CPF Pro',
    plan: 'starter',
    fields: [
      {lbl:'Score SPC',     val:'███'},
      {lbl:'Banco',         val:'████'},
      {lbl:'Tipo Conta',    val:'████'},
      {lbl:'Renda Estimada',val:'R$ ████'},
      {lbl:'Estado Civil',  val:'████'},
      {lbl:'Bolsa Família', val:'████'},
    ]
  },
  telefone: {
    title: 'Mais dados disponíveis',
    plan: 'starter',
    fields: [
      {lbl:'WhatsApp',      val:'████'},
      {lbl:'Outros números',val:'████'},
      {lbl:'Emails',        val:'████'},
      {lbl:'CPF Vinculado', val:'███.***.***-**'},
      {lbl:'Endereço',      val:'████'},
    ]
  },
  placa: {
    title: 'Dados avançados do veículo',
    plan: 'pro',
    fields: [
      {lbl:'Multas',        val:'████'},
      {lbl:'Proprietário',  val:'████'},
      {lbl:'CPF Dono',      val:'███.***.***-**'},
      {lbl:'Histórico',     val:'████'},
      {lbl:'Leilão',        val:'████'},
    ]
  },
};

function lockedFieldsBlock() {
  const plan     = currentUser?.plan || 'basico';
  const planOrder= ['basico','starter','pro','premium'];
  const planIdx  = planOrder.indexOf(plan);
  const locked   = LOCKED_FIELDS[curMod];
  if (!locked) return '';

  // só mostra se o usuário não tem o plano necessário
  const requiredIdx = planOrder.indexOf(locked.plan);
  if (planIdx >= requiredIdx) return '';

  const planLabel = locked.plan === 'starter' ? 'Starter' : 'Pro';
  const fields = locked.fields.map(f => `
    <div class="rc-locked-field" onclick="goPlansFromResults()">
      <span class="rc-locked-ico"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
      <span class="rc-locked-lbl">${f.lbl}</span>
      <span class="rc-locked-val">${f.val}</span>
    </div>`).join('');

  return `
    <div class="rc-locked-section">
      <div class="rc-locked-title">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        ${locked.title} · <span style="color:var(--p3);cursor:pointer" onclick="goPlansFromResults()">Assinar ${planLabel} →</span>
      </div>
      <div class="rc-locked-grid">${fields}</div>
    </div>`;
}

function upgradeBlock() {
  const plan = currentUser?.plan || 'basico';
  const planOrder = ['basico','starter','pro','premium'];
  const planIdx = planOrder.indexOf(plan);

  // Starter+ já tem foto — não mostra banner
  if (planIdx >= 1) return '';

  // adapta texto por módulo
  let txt;
  if (curMod === 'foto') {
    txt = `Quer mais consultas de <strong>Foto Nacional?</strong> Faça upgrade para o <strong>Starter</strong>`;
  } else {
    txt = `Quer ver a <strong>foto real</strong> desta pessoa? Disponível no <strong>Starter</strong>`;
  }

  return `
    <div class="res-upgrade" id="resUpgradeBanner">
      <div class="res-upgrade-emoji"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--p3)"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
      <div class="res-upgrade-txt">${txt}</div>
      <button class="res-upgrade-btn" onclick="goPlansFromResults()">Ver planos</button>
      <button onclick="document.getElementById('resUpgradeBanner').remove()" style="flex-shrink:0;font-size:1rem;color:var(--muted);background:none;border:none;padding:0 4px;line-height:1;cursor:pointer" title="Fechar">✕</button>
    </div>`;
}

// ── RENDER ──
const FIELD_LABELS = {
  cpf:'CPF', nome:'Nome', nascimento:'Nascimento', idade:'Idade', sexo:'Sexo',
  estado_civil:'Estado Civil', nacionalidade:'Nacionalidade', naturalidade:'Naturalidade',
  signo:'Signo', nome_mae:'Mãe', nome_pai:'Pai', irmaos:'Irmãos',
  cnh:'CNH', titulo_eleitor:'Título de Eleitor',
  logradouro:'Logradouro', numero:'Número', bairro:'Bairro', cidade:'Cidade',
  uf:'UF', cep:'CEP', ibge:'IBGE', siafi:'SIAFI', gia:'GIA', ddd:'DDD',
  situacao_cadastral:'Situação Cadastral', situacao_rf:'Situação RF',
  empresario:'Empresário', cnpj:'CNPJ', servidor_publico:'Servidor Público',
  cor_pele:'Cor da Pele', cor_olhos:'Cor dos Olhos', cor_cabelo:'Cor do Cabelo',
  altura:'Altura', pis:'PIS', aposentado:'Aposentado', parto_gemelar:'Parto Gemelar',
  escolaridade:'Escolaridade', cns_definitivo:'CNS Definitivo', cns_provisorio:'CNS Provisório',
  nis_nit:'NIS/NIT', renda_atual:'Renda Atual', score_faixa:'Score Faixa', score_spc:'Score SPC',
  vip_sus:'VIP SUS', vip_motivo:'Motivo VIP', nome_social:'Nome Social',
  coordenada:'Coordenada', chassi:'Chassi', renavam:'RENAVAM',
  placa_nacional:'Placa Nacional', placa_mercosul:'Placa Mercosul',
  ano_fabricacao:'Ano de Fabricação', potencia:'Potência', peso_bruto:'Peso Bruto',
  capacidade_passageiros:'Capacidade de Passageiros', telefone:'Telefone',
  cnae_principal:'CNAE Principal', cnae_secundarios:'CNAEs Secundários',
  socios:'Quadro Societário', telefones:'Telefones', emails:'E-mails',
  nome_fantasia:'Nome Fantasia', razao_social:'Razão Social', data_abertura:'Data de Abertura',
  natureza_juridica:'Natureza Jurídica', capital_social:'Capital Social', porte:'Porte',
  codigo_situacao:'Código de Situação', data_situacao:'Data da Situação',
  simples_nacional:'Simples Nacional', data_opcao_simples:'Data de Opção Simples', meio:'Meio',
  complemento:'Complemento', regiao:'Região', latitude:'Latitude', longitude:'Longitude',
  formato_internacional:'Formato Internacional', formato_nacional:'Formato Nacional',
  formato_e164:'Formato E.164', numero_local:'Número Local', pais:'País',
  codigo_iso:'Código ISO', fuso_horario:'Fuso Horário', operadora:'Operadora', status:'Status',
  google_maps:'', ip:'IP', hostname:'Hostname', tipo:'Tipo', isp:'ISP', org:'Organização',
  asn:'ASN', proxy:'Proxy', vpn:'VPN', tor:'Tor', hosting:'Hosting',
  dominio:'Domínio', provedor:'Provedor', valido:'Válido', descartavel:'Descartável',
  mx_valido:'MX Válido', breaches:'Vazamentos', fontes:'Fontes', ultima_vez:'Última Vez',
};

const WIDE=new Set(['logradouro','email','status','nameservers','socios','google_maps','razao_social','nome_fantasia','natureza_juridica','telefone','atividade','cnae_principal','cnae_secundarios','irmaos','emails','telefones','coordenada','breaches','fontes']);
const HTML_K=new Set(['google_maps','coordenada']);

const MOD_RESULT_LABEL = {
  familiares: (i, item) => {
    const rel = item._relacao || '';
    if (rel === 'filha') return `Filha ${i+1}`;
    if (rel === 'filho') return `Filho ${i+1}`;
    if (rel === 'irma') return `Irmã ${i+1}`;
    if (rel === 'irmao') return `Irmão ${i+1}`;
    if (rel === 'pai') return 'Pai';
    if (rel === 'mae') return 'Mãe';
    return `Familiar ${i+1}`;
  },
  cep: (i, item) => (item && item._type === 'cep_info') ? 'Informações do CEP' : `Residente ${(item && item._idx) || i}`,
};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── SISTEMA LIBERAR ──
const LIBERAR_MODS = new Set(['nome','familiares','placa','pix','cnh','cns','renavam']);

// ── HELPERS DE MÁSCARA ──
function _maskCpf(cpf) {
  if (!cpf || cpf === '—' || cpf === 'Indisponível') return '—';
  const d = cpf.replace(/\D/g,'');
  if (d.length < 11) return cpf;
  return `${d.slice(0,3)}.★★★.★★★-${d.slice(9,11)}`;
}
function _getDia(nasc) {
  if (!nasc || nasc === '—' || nasc === 'Indisponível') return '··/··/····';
  const partes = nasc.split(/[-\/]/);
  let dd;
  if (partes[0].length === 4) dd = (partes[2] || '??').padStart(2,'0');
  else dd = (partes[0] || '??').padStart(2,'0');
  return `${dd}/★★/★★★★`;
}
function _maskPlaca(placa) {
  if (!placa || placa === '—' || placa === 'Indisponível') return '—';
  const p = placa.toUpperCase().replace(/[^A-Z0-9]/g,'');
  return p.length >= 4 ? `${p.slice(0,3)}-****` : placa;
}

function _fakeCpf(seed) {
  // mostra só os 3 primeiros e os 2 últimos dígitos
  const first = ['282','391','475','513','637'][seed % 5];
  const last  = ['11','34','72','58','96'][seed % 5];
  return `${first}.***.***-${last}`;
}
function _fakeNasc(seed) {
  const days = ['05','12','17','23','30'];
  const months = ['03','07','09','11'];
  const d = days[seed % days.length];
  return `${d}/**/****`;
}

function _renderPreviewCard(item, idx) {
  const mod = curMod;
  const isDouble = activeCoupons.has('double') || activeCoupons.has('ghost2');
  const cpfProCost  = MOD_CREDITS['cpfpro'] || 0;
  const cpfProPrice = cpfProCost > 0 ? fmtBrl(creditsToReal(cpfProCost)) : null;
  const relacao = item._relacao
    ? `<span class="rc-relacao-tag">${esc(item._relacao)}</span>` : '';

  let previewFields = '';

  if (['nome','familiares','pix'].includes(mod) || item._type === 'cep_morador') {
    const nome   = item.nome || (isDouble ? 'Indisponível' : '—');
    const cpf    = isDouble ? _fakeCpf(idx) : _maskCpf(item.cpf);
    const dia    = isDouble ? _fakeNasc(idx) : _getDia(item.nascimento);
    const cidade = isDouble ? 'Amapá — AP' : (item.cidade ? (item.uf ? `${item.cidade} — ${item.uf}` : item.cidade) : '—');
    previewFields = `
      <div class="rpf-field"><span class="rpf-lbl">Nome:</span><span class="rpf-val">${esc(nome)}</span></div>
      <div class="rpf-field"><span class="rpf-lbl">CPF:</span><span class="rpf-val rpf-masked">${cpf}</span></div>
      <div class="rpf-field"><span class="rpf-lbl">Nascimento:</span><span class="rpf-val rpf-masked">${dia}</span></div>
      <div class="rpf-field"><span class="rpf-lbl">Cidade:</span><span class="rpf-val">${esc(cidade)}</span></div>`;

  } else if (['placa','renavam'].includes(mod)) {
    const nome  = item.nome || (isDouble ? 'Indisponível' : '—');
    const placa = _maskPlaca(item.placa_nacional || item.placa_mercosul || item.placa || item.renavam);
    const uf    = isDouble ? 'AP' : (item.uf || '—');
    previewFields = `
      <div class="rpf-field"><span class="rpf-lbl">Proprietário:</span><span class="rpf-val">${esc(nome)}</span></div>
      <div class="rpf-field"><span class="rpf-lbl">Placa:</span><span class="rpf-val rpf-masked">${placa}</span></div>
      <div class="rpf-field"><span class="rpf-lbl">UF:</span><span class="rpf-val">${esc(uf)}</span></div>`;

  } else if (mod === 'cnh') {
    const nome = item.nome || (isDouble ? 'Indisponível' : '—');
    const dia  = isDouble ? _fakeNasc(idx) : _getDia(item.data_nascimento || item.nascimento);
    const cat  = item.categoria || (isDouble ? 'B' : '—');
    previewFields = `
      <div class="rpf-field"><span class="rpf-lbl">Nome:</span><span class="rpf-val">${esc(nome)}</span></div>
      <div class="rpf-field"><span class="rpf-lbl">Nascimento:</span><span class="rpf-val rpf-masked">${dia}</span></div>
      <div class="rpf-field"><span class="rpf-lbl">Categoria:</span><span class="rpf-val">${esc(cat)}</span></div>`;

  } else if (mod === 'cns') {
    const nome = item.nome || (isDouble ? 'Indisponível' : '—');
    const dia  = isDouble ? _fakeNasc(idx) : _getDia(item.nascimento);
    previewFields = `
      <div class="rpf-field"><span class="rpf-lbl">Nome:</span><span class="rpf-val">${esc(nome)}</span></div>
      <div class="rpf-field"><span class="rpf-lbl">Nascimento:</span><span class="rpf-val rpf-masked">${dia}</span></div>`;

  } else {
    const nome = item.nome || (isDouble ? 'Indisponível' : `Resultado ${idx+1}`);
    const cpf  = isDouble ? _fakeCpf(idx) : _maskCpf(item.cpf);
    previewFields = `
      <div class="rpf-field"><span class="rpf-lbl">Nome:</span><span class="rpf-val">${esc(nome)}</span></div>
      <div class="rpf-field"><span class="rpf-lbl">CPF:</span><span class="rpf-val rpf-masked">${cpf}</span></div>`;
  }

  const upsellTxt = cpfProPrice
    ? `Ou acesse os dados completos por <span class="rpf-upsell-link" onclick="goCredits('cpfpro')">${cpfProPrice}</span>`
    : '';

  return `
    <div class="rc rc-preview" id="rc-preview-${idx}" style="animation-delay:${idx * .08}s">
      ${relacao ? `<div class="rc-preview-header">${relacao}</div>` : ''}
      <div class="rc-preview-fields">${previewFields}</div>
      <div class="rc-liberar-footer">
        ${upsellTxt ? `<p class="rpf-upsell-hint">${upsellTxt}</p>` : ''}
        <button class="rc-liberar-btn" id="rc-liberar-btn-${idx}" onclick="liberarCard(${idx});spawnBubbles(this)">
          Liberar informações
        </button>
      </div>
    </div>`;
}
async function liberarCard(idx) {
  const btn = document.getElementById(`rc-liberar-btn-${idx}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin .7s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Abrindo...'; }

  window._liberarAnyReleased = true;

  const data = window._lastResultData?.data;
  if (!data || !data[idx]) return;

  // renderiza APENAS o item escolhido como resultado completo
  // (exatamente igual ao CPF — sem a intermediadora)
  const savedMod = curMod;
  LIBERAR_MODS.delete(savedMod);
  renderResults([data[idx]]);
  LIBERAR_MODS.add(savedMod);
}

function renderResults(data){
  const con = document.getElementById('resCon');
  showPage('results');
  const mod     = MODS[curMod];
  const modIcon = mod ? '' : '';
  const modName = mod?.name || curMod;
  const count   = data?.length || 0;
  const modSvg = MOD_SVGS[curMod] || modIcon;
  const modIcoColor = curMod === 'foto' ? 'var(--p3)' : 'var(--p)';
  const modHeader = `<div class="res-mod-header"><div class="res-mod-ico" style="color:${modIcoColor}">${modSvg}</div><div class="res-mod-name">${modName}</div></div>`;
  if(!data || count === 0){
    con.innerHTML = modHeader + `<div class="res-err"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted);margin:0 auto 8px"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><h3>Nenhum resultado encontrado</h3><p>Verifique o dado informado e tente novamente.</p></div>`;
    return;
  }

  // guarda dados pra download
  window._lastResultData = { mod: curMod, modName, data };
  let hasFoto = false;

  // módulos com sistema de liberar por pessoa
  if (LIBERAR_MODS.has(curMod)) {
    const isSingleNome = (curMod === 'nome' || curMod === 'familiares') && count === 1;
    const allReleased = data.every(item => item._released || item._type === 'cep_info');

    // todos liberados ou resultado único → cai no fluxo normal abaixo
    if (!isSingleNome && !allReleased) {
      let html = modHeader;
      html += `<div class="res-count">${count} RESULTADO${count > 1 ? 'S' : ''} ENCONTRADO${count > 1 ? 'S' : ''}</div>`;
      data.forEach((item, i) => {
        if (item._type === 'cep_info') {
          const sections = MOD_SECTIONS['cep'];
          html += `<div class="rc" style="animation-delay:${i*.07}s"><div class="rc-head"><div class="rc-card-label">Informações do CEP</div></div>${renderWithSections(item, sections)}</div>`;
        } else if (item._released) {
          // já liberado: renderiza completo inline
          const labelFn = MOD_RESULT_LABEL[curMod];
          const label = labelFn ? labelFn(i, item) : (count > 1 ? `Resultado ${i+1}` : 'Resultado');
          const sectionKey = (item._type && MOD_SECTIONS[item._type]) ? item._type : curMod;
          const sections = MOD_SECTIONS[sectionKey];
          const bodyHtml = sections ? renderWithSections(item, sections) : `<div class="rc-fields">${Object.entries(item).map(([k,v])=>{ if(!v||k.startsWith('_'))return''; const lbl=FIELD_LABELS[k]||k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); return `<div class="rf"><div class="rf-lbl">${lbl}</div><div class="rf-val">${esc(v)}</div></div>`; }).join('')}</div>`;
          html += `<div class="rc" style="animation-delay:${i*.07}s"><div class="rc-head"><div class="rc-card-label">${label}</div><div class="rc-liberated-badge">✓ Liberado</div></div>${bodyHtml}</div>`;
        } else {
          html += _renderPreviewCard(item, i);
        }
      });
      con.innerHTML = html;
      window.liberarCard = liberarCard;
      window._liberarModeActive = true;
      window._liberarRefundMod = curMod;
      return;
    }
    // allReleased ou single → cai no fluxo normal abaixo
  }

  let html = modHeader;
  if(count > 1) html += `<div class="res-count">${count} RESULTADOS ENCONTRADOS</div>`;
  data.forEach((item, i) => {
    const labelFn = MOD_RESULT_LABEL[curMod];
    const label = labelFn ? labelFn(i, item) : (count > 1 ? `Resultado ${i+1}` : 'Resultado');
    if(item.__whois_raw){
      html += `<div class="rc" style="animation-delay:${i*.07}s"><div class="rc-head"><div class="rc-card-label">${label}</div></div><div style="padding:16px 18px"><textarea class="whois-raw" readonly>${esc(item.__whois_raw)}</textarea></div></div>`;
      return;
    }
    let fotoBlock = '';
    if(item.__foto){
      hasFoto = true;
      delete item.__foto;
      fotoBlock = `<div class="foto-placeholder-wrap"><div class="foto-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" style="opacity:.3;color:var(--muted)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Foto indisponível</span></div><button class="foto-download-btn" disabled><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Baixar foto</button></div>`;
    }
    let bodyHtml = '';
    const sectionKey = (item && item._type && MOD_SECTIONS[item._type]) ? item._type : curMod;
    const sections = MOD_SECTIONS[sectionKey];
    if(sections){ bodyHtml = renderWithSections(item, sections); }
    else {
      const fields = Object.entries(item).map(([k,v]) => {
        if(!v || k.startsWith('_')) return '';
        const lbl = k.replace(/_/g,' ').replace(/\b\w/g, ch => ch.toUpperCase());
        const val = HTML_K.has(k) ? v : esc(v);
        return `<div class="rf ${WIDE.has(k)?'wide':''}"><div class="rf-lbl">${lbl}</div><div class="rf-val">${val}</div></div>`;
      }).join('');
      bodyHtml = `<div class="rc-fields">${fotoBlock}${fields}</div>`;
    }
    html += `<div class="rc" style="animation-delay:${i*.07}s"><div class="rc-head"><div class="rc-card-label">${label}</div></div>${bodyHtml}</div>`;
  });
  html += lockedFieldsBlock();
  html += upgradeBlock();

  // botão de download dos resultados (sem foto)
  html += `<div style="margin-top:8px">
    <button onclick="downloadResults()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;font-size:.78rem;font-weight:500;color:var(--muted2);background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:.6rem;padding:11px;transition:all .15s" onmouseover="this.style.borderColor='rgba(255,255,255,.14)';this.style.color='var(--fg)'" onmouseout="this.style.borderColor='rgba(255,255,255,.07)';this.style.color='var(--muted2)'">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Baixar resultados (.txt)
    </button>
  </div>`;

  con.innerHTML = html;

  // confirmação ao sair se tem foto e não baixou
  window._hasFotoNotDownloaded = hasFoto;
}

function renderErr(t, m){
  showPage('results');
  document.getElementById('resCon').innerHTML=`<div class="res-err">
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted);margin:0 auto 10px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <h3>${t}</h3><p>${m}</p>
  </div>`;
}

// ── SEÇÕES POR MÓDULO ──
const MOD_SECTIONS = {
  cpf: {
    'Identificação':['nome','cpf','nascimento','idade','sexo','estado_civil','nacionalidade','naturalidade','signo'],
    'Filiação':['nome_mae','nome_pai'],
    'Documentos':['cnh','titulo_eleitor'],
    'Endereço':['logradouro','numero','bairro','cidade','uf','cep','ibge'],
    'Situação':['situacao_cadastral'],
  },
  pix: {
    'Identificação':['nome','cpf','nascimento','idade','sexo','estado_civil','nacionalidade','naturalidade','signo'],
    'Filiação':['nome_mae','nome_pai'],
    'Documentos':['cnh','titulo_eleitor'],
    'Endereço':['logradouro','numero','bairro','cidade','uf','cep','ibge'],
    'Situação':['situacao_cadastral'],
  },
  nome: {
    'Identificação':['nome','cpf','nascimento','idade','sexo','estado_civil','nacionalidade','naturalidade','signo'],
    'Filiação':['nome_mae','nome_pai'],
    'Documentos':['cnh','titulo_eleitor'],
    'Endereço':['logradouro','numero','bairro','cidade','uf','cep','ibge'],
    'Situação':['situacao_cadastral'],
  },
  cpfpro: {
    'Identificação':['nome','cpf','nascimento','idade','sexo','signo','estado_civil','empresario','cnpj','servidor_publico'],
    'Biometria':['cor_pele','cor_olhos','cor_cabelo','altura','pis'],
    'Pessoal':['nacionalidade','naturalidade','aposentado','parto_gemelar','escolaridade'],
    'Filiação':['nome_mae','nome_pai','irmaos'],
    'Documentos':['cns_definitivo','cns_provisorio','nis_nit','titulo_eleitor'],
    'Situação':['situacao_rf','situacao_cadastral'],
    'Financeiro':['renda_atual','score_faixa','score_spc'],
    'VIP SUS':['vip_sus','vip_motivo'],
    'Endereço':['logradouro','numero','bairro','cidade','uf','cep','ibge','siafi','gia','ddd','coordenada'],
    'Automóvel':['chassi','cnh','renavam','placa_nacional','placa_mercosul','ano_fabricacao','potencia','peso_bruto','capacidade_passageiros'],
    'Contato':['telefone'],
  },
  cep: {
    'Endereço':['cep','logradouro','tipo','complemento','bairro','cidade','estado','uf'],
    'Região':['regiao','ddd','ibge','gia','siafi'],
    'Localização':['latitude','longitude','google_maps'],
  },
  cep_morador: {
    'Residente':['nome','cpf','nascimento','sexo','numero','bairro'],
  },
  cnpj: {
    'Identificação':['cnpj','nome','nome_fantasia','razao_social','data_abertura','natureza_juridica'],
    'Porte':['porte','capital_social','codigo_situacao','data_situacao'],
    'Atividade':['cnae_principal','cnae_secundarios'],
    'Quadro Societário':['socios'],
    'Contato':['telefones','emails'],
    'Endereço':['logradouro','numero','bairro','cidade','uf','cep'],
    'Fiscal':['simples_nacional','data_opcao_simples','meio'],
  },
  placa: {
    'Veículo':['placa_nacional','placa_mercosul','chassi','renavam','ano_fabricacao','potencia','peso_bruto','capacidade_passageiros'],
    'Proprietário':['nome','cpf','nascimento','sexo'],
    'Endereço':['logradouro','numero','bairro','cidade','uf','cep'],
  },
  telefone: {
    'Dados Estáticos':['formato_internacional','formato_nacional','formato_e164','numero_local','pais','codigo_iso','fuso_horario','operadora','status'],
    'Identificação':['nome','cpf','nascimento','sexo','estado_civil'],
    'Endereço':['logradouro','numero','bairro','cidade','uf','cep'],
    'Geolocalização':['regiao','latitude','longitude','google_maps'],
  },
  cns: {
    'Identificação':['cns_definitivo','cns_provisorio','nome','cpf','nascimento','sexo'],
    'Filiação':['nome_mae','nome_pai'],
  },
  renavam: {
    'Veículo':['renavam','placa_nacional','placa_mercosul','chassi','ano_fabricacao','potencia','peso_bruto','capacidade_passageiros'],
    'Proprietário':['nome','cpf','nascimento','sexo'],
    'Endereço':['logradouro','numero','bairro','cidade','uf','cep'],
  },
  ip: {
    'Identificação':['ip','hostname','tipo','isp','org','asn'],
    'Localização':['pais','codigo_pais','regiao','cidade','cep','latitude','longitude','fuso_horario'],
    'Rede':['proxy','vpn','tor','hosting'],
  },
  email: {
    'Identificação':['email','nome','cpf','nascimento','sexo'],
    'Domínio':['dominio','provedor','valido','descartavel','mx_valido'],
    'Vazamentos':['breaches','fontes','ultima_vez'],
    'Endereço':['logradouro','cidade','uf'],
  },
  whois: {},
  familiares: {},
  foto: {},
  cnh: {
    'Habilitação': ['numero', 'nome', 'cpf', 'data_nascimento', 'categoria', 'data_validade', 'situacao', 'pontos'],
  },
};

function renderWithSections(item, sections){
  let html = '';
  const rendered = new Set();
  for(const [title, keys] of Object.entries(sections)){
    const rows = keys.map(k => {
      const v = item[k];
      rendered.add(k);
      const lbl = FIELD_LABELS[k] || k.replace(/_/g,' ').replace(/\b\w/g, ch => ch.toUpperCase());
      if(lbl === '') return ''; // campos ocultos como google_maps inline
      const val = v ? (HTML_K.has(k) ? v : esc(v)) : '<span class="rf-na">—</span>';
      return `<div class="rf ${WIDE.has(k)?'wide':''}"><div class="rf-lbl">${lbl}</div><div class="rf-val">${val}</div></div>`;
    }).join('');
    if(rows.trim()) html += `<div class="rc-section-label">${title}</div><div class="rc-fields">${rows}</div>`;
  }
  const rest = Object.entries(item).filter(([k])=>!rendered.has(k) && !k.startsWith('_')).map(([k,v])=>{
    const lbl = FIELD_LABELS[k] || k.replace(/_/g,' ').replace(/\b\w/g, ch => ch.toUpperCase());
    const val = v ? esc(v) : '<span class="rf-na">—</span>';
    return `<div class="rf ${WIDE.has(k)?'wide':''}"><div class="rf-lbl">${lbl}</div><div class="rf-val">${val}</div></div>`;
  }).join('');
  if(rest.trim()) html += `<div class="rc-fields" style="padding-top:8px">${rest}</div>`;
  return html;
}

  function spawnBubbles(btn) {
    for (let i = 0; i < 7; i++) {
      const b = document.createElement('span');
      b.className = 'bubble';
      const size = 8 + Math.random() * 14;
      b.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*(btn.offsetWidth-size)}px;top:${Math.random()*(btn.offsetHeight-size)}px;animation-delay:${i*0.06}s`;
      btn.appendChild(b);
      setTimeout(() => b.remove(), 700);
    }
  }
  window.spawnBubbles = spawnBubbles;

  // EXPOR GLOBALS (funções usadas pelo HTML e outros módulos)
  window.doSearch      = doSearch;
  window.autoFmt       = autoFmt;
  window.renderErr     = renderErr;
  window._runSearch    = _runSearch;
  window.renderResults = renderResults;
  window.liberarCard   = liberarCard;


} catch(e) {
  console.error("[ghost:search] ERRO AO CARREGAR:", e);
  // Fallback: mostra erro amigável ao tentar buscar
  window.doSearch = function() {
    if (typeof renderErr === "function") {
      renderErr("Módulo de busca indisponível", "Erro interno. Tente recarregar a página.");
      if (typeof showPage === "function") showPage("results");
    } else { alert("Erro: módulo de busca indisponível. Recarregue a página."); }
  };
  window.autoFmt = function() {};
}
