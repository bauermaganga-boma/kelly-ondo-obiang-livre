/* Stockage des commandes : Supabase si configuré, sinon navigateur (démonstration). */
(function () {
  const C = window.LIVRE_CONFIG;
  const real = !!(C.supabaseUrl && C.supabaseAnonKey);
  const KEY = 'livre_commandes_v1', TOK = 'livre_admin_token';
  const safe = (fn, d) => { try { return fn(); } catch { return d; } };
  let token = safe(() => sessionStorage.getItem(TOK), null);

  const rest = (path, opts = {}, auth = false) =>
    fetch(C.supabaseUrl + '/rest/v1/' + path, {
      ...opts,
      headers: { apikey: C.supabaseAnonKey, Authorization: 'Bearer ' + (auth && token ? token : C.supabaseAnonKey), 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
  const need = (r) => { if (r.status === 401 || r.status === 403) { token = null; safe(() => sessionStorage.removeItem(TOK)); throw Object.assign(new Error('auth'), { auth: true }); } if (!r.ok) throw new Error('Erreur serveur'); return r; };
  const local = () => safe(() => JSON.parse(localStorage.getItem(KEY) || '[]'), []);
  const saveLocal = (l) => safe(() => localStorage.setItem(KEY, JSON.stringify(l)));

  const ref = () => 'EDE-' + Array.from(crypto.getRandomValues(new Uint8Array(3))).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  window.Store = {
    real,
    loggedIn: () => !real || !!token,

    async login(email, password) {
      const r = await fetch(C.supabaseUrl + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: C.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!r.ok) throw new Error('Identifiants incorrects.');
      token = (await r.json()).access_token;
      safe(() => sessionStorage.setItem(TOK, token));
    },
    logout() { token = null; safe(() => sessionStorage.removeItem(TOK)); },

    async create(o) {
      const row = { reference: ref(), date: new Date().toISOString(), statut: 'nouvelle', paye: false, note: '', ...o };
      if (real) {
        need(await rest('commandes', { method: 'POST', body: JSON.stringify(row), headers: { Prefer: 'return=minimal' } }));
      } else {
        const l = local(); row.id = (l.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1; l.push(row); saveLocal(l);
      }
      return row;
    },
    async list() {
      if (real) return (await need(await rest('commandes?select=*&order=id.desc', {}, true))).json();
      return local().sort((a, b) => b.id - a.id);
    },
    async update(id, patch) {
      if (real) { need(await rest('commandes?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(patch) }, true)); return; }
      saveLocal(local().map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    async remove(id) {
      if (real) { need(await rest('commandes?id=eq.' + id, { method: 'DELETE' }, true)); return; }
      saveLocal(local().filter((c) => c.id !== id));
    },
    // démonstration uniquement
    seedDemo() {
      const d = (n) => new Date(Date.now() - n * 864e5).toISOString();
      const base = { email: '', note: '', paye: false };
      saveLocal([
        { ...base, id: 1, reference: 'EDE-DEMO01', date: d(3), nom: 'Exemple Client A', telephone: '07 00 00 01', ville: 'Libreville', quartier: 'Louis', adresse: 'Adresse d\'exemple', pays: 'Gabon', quantite: 2, total: 52000, devise: 'FCFA', paiement: 'Mobile Money', statut: 'livrée', paye: true },
        { ...base, id: 2, reference: 'EDE-DEMO02', date: d(2), nom: 'Exemple Client B', telephone: '07 00 00 02', ville: 'Port-Gentil', quartier: '', adresse: 'Adresse d\'exemple', pays: 'Gabon', quantite: 1, total: 27000, devise: 'FCFA', paiement: 'À la livraison', statut: 'expédiée' },
        { ...base, id: 3, reference: 'EDE-DEMO03', date: d(1), nom: 'Exemple Client C', telephone: '+33 6 00 00 00 03', ville: 'Paris', quartier: '', adresse: 'Adresse d\'exemple', pays: 'France', quantite: 2, total: 84, devise: 'EUR', paiement: 'Lien de paiement (carte / PayPal)', statut: 'confirmée', paye: true },
        { ...base, id: 4, reference: 'EDE-DEMO04', date: d(0), nom: 'Exemple Client D', telephone: '+32 4 00 00 00 04', ville: 'Bruxelles', quartier: '', adresse: 'Adresse d\'exemple', pays: 'Belgique', quantite: 1, total: 46, devise: 'EUR', paiement: 'Virement bancaire', statut: 'nouvelle' },
      ]);
    },
    clearDemo() { saveLocal([]); },
  };
})();
