// ═══════════════════════════════════════
// GHOST BUSCA — Camada Supabase
// ═══════════════════════════════════════
try {

async function sbGet(table, query='') {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: SB_HEADERS });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d) ? d : null;
  } catch { return null; }
}
async function sbGetOne(table, query='') {
  const d = await sbGet(table, query + '&limit=1');
  return d?.[0] || null;
}
async function sbPost(table, body) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST', headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d) ? d[0] : d;
  } catch { return null; }
}
async function sbPatch(table, query, body) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      method: 'PATCH', headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d) ? d[0] : d;
  } catch { return null; }
}
async function sbUpsert(table, body, onConflict) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST', headers: { ...SB_HEADERS, 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(body)
    });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d) ? d[0] : d;
  } catch { return null; }
}

// ── SUPABASE STORAGE — avatars ──
async function sbUploadAvatar(email, blob) {
  try {
    const ext  = blob.type === 'image/png' ? 'png' : 'jpg';
    const path = `${email.replace(/[^a-z0-9]/gi,'_')}.${ext}`;
    // remove arquivo antigo primeiro (ignora erro)
    await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
      method: 'DELETE', headers: SB_HEADERS
    }).catch(()=>{});
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
      method: 'POST', headers: { ...SB_HEADERS, 'Content-Type': blob.type, 'x-upsert': 'true' },
      body: blob
    });
    if (!r.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`;
  } catch { return null; }
}

} catch(e) {
  console.error("[ghost:supabase] ERRO FATAL:", e);
  // Stub functions para não quebrar o resto
  window.sbGet    = async () => null;
  window.sbGetOne = async () => null;
  window.sbPost   = async () => null;
  window.sbPatch  = async () => null;
  window.sbUpsert = async () => null;
  window.sbUploadAvatar = async () => null;
}
