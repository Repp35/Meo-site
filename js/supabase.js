try {

// ── CLIENT ──
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
window._sb = _sb;

// JWT dinâmico — inclui token do usuário logado pra RLS funcionar
async function getAuthHeaders() {
  const { data: { session } } = await _sb.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON,
    'Authorization': 'Bearer ' + (token || SUPABASE_ANON)
  };
}

window.sbGet = async function(table, query='') {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: await getAuthHeaders() });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d) ? d : null;
  } catch { return null; }
};

window.sbGetOne = async function(table, query='') {
  const d = await sbGet(table, query + '&limit=1');
  return d?.[0] || null;
};

window.sbPost = async function(table, body) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d) ? d[0] : d;
  } catch { return null; }
};

window.sbPatch = async function(table, query, body) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      method: 'PATCH',
      headers: { ...(await getAuthHeaders()), 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d) ? d[0] : d;
  } catch { return null; }
};

window.sbUpsert = async function(table, body, onConflict) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(body)
    });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d) ? d[0] : d;
  } catch { return null; }
};

// ── STORAGE — avatars ──
window.sbDeleteAvatar = async function(path) {
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
      method: 'DELETE', headers: await getAuthHeaders()
    });
  } catch {}
};

window.sbUploadAvatar = async function(email, blob) {
  try {
    const extMap = {'image/png':'png','image/gif':'gif','image/webp':'webp'};
    const ext = extMap[blob.type] || 'jpg';
    const path = `${email.replace(/[^a-z0-9]/gi,'_')}.${ext}`;
    await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
      method: 'DELETE', headers: await getAuthHeaders()
    }).catch(()=>{});
    const uploadHeaders = await getAuthHeaders();
    delete uploadHeaders['Content-Type'];
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
      method: 'POST',
      headers: { ...uploadHeaders, 'Content-Type': blob.type, 'x-upsert': 'true' },
      body: blob
    });
    if (!r.ok) {
      let errMsg = `HTTP ${r.status}`;
      try { const j = await r.json(); errMsg += ': ' + (j.message || j.error || JSON.stringify(j)); } catch {}
      console.error('[ghost:avatar] Upload falhou —', errMsg);
      window._avatarUploadError = errMsg;
      return null;
    }
    window._avatarUploadError = null;
    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`;
  } catch(e) {
    console.error('[ghost:avatar] Exceção no upload:', e);
    window._avatarUploadError = e?.message || 'Erro desconhecido';
    return null;
  }
};

} catch(e) {
  console.error("[ghost:supabase] ERRO FATAL:", e);
  window.sbGet    = async () => null;
  window.sbGetOne = async () => null;
  window.sbPost   = async () => null;
  window.sbPatch  = async () => null;
  window.sbUpsert = async () => null;
  window.sbUploadAvatar = async () => null;
  window._sb = null;
}
