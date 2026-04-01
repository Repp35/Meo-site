// GHOST BUSCA — Chat de Suporte

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
  if (!currentUser || currentUser.anon) {
    openModal('modal-login');
    return;
  }
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

