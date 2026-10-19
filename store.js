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
      if (!safe(() => localStorage.getItem(KEY + '_init'), '1')) this.seedDemo();
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
    // Démonstration : ventes FICTIVES générées à partir de la date du jour
    seedDemo() {
      let x = 20261019;
      const rnd = () => { x = (x + 0x6d2b79f5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
      const wpick = (pairs) => { let r = rnd() * pairs.reduce((m, p) => m + p[1], 0); for (const [v, w] of pairs) { if ((r -= w) < 0) return v; } return pairs[0][0]; };
      const pre = ['Aline', 'Brice', 'Carine', 'Daniel', 'Estelle', 'Fabrice', 'Grâce', 'Hervé', 'Inès', 'Jules', 'Karine', 'Lionel', 'Mireille', 'Noël', 'Océane', 'Patrick', 'Rosine', 'Serge', 'Tatiana', 'Yannick'];
      const nom = ['M.', 'N.', 'O.', 'B.', 'K.', 'D.', 'E.', 'A.', 'L.', 'T.'];
      const villes = { Gabon: [['Libreville', 'Akanda'], ['Libreville', 'Louis'], ['Libreville', 'Nzeng-Ayong'], ['Libreville', 'Owendo'], ['Port-Gentil', 'Centre'], ['Franceville', 'Potos'], ['Oyem', 'Centre'], ['Lambaréné', 'Centre']], France: [['Paris', ''], ['Lyon', ''], ['Marseille', ''], ['Bordeaux', ''], ['Lille', ''], ['Toulouse', '']], Belgique: [['Bruxelles', '']], Suisse: [['Genève', '']], Allemagne: [['Berlin', '']] };
      const list = [];
      let id = 0;
      const dayCount = 42;
      for (let d = dayCount; d >= 0; d--) {
        const n = d <= 7 ? 1 + Math.floor(rnd() * 2) : Math.floor(rnd() * 2.6);
        for (let k = 0; k < n; k++) {
          const pays = wpick([['Gabon', 55], ['France', 28], ['Belgique', 7], ['Suisse', 5], ['Allemagne', 5]]);
          const [ville, quartier] = pick(villes[pays]);
          const q = wpick([[1, 60], [2, 25], [3, 10], [5, 5]]);
          const eur = pays !== 'Gabon';
          const ageH = d * 24 + Math.floor(rnd() * 20);
          let statut;
          if (ageH > 240) statut = rnd() < 0.08 ? 'annulée' : 'livrée';
          else if (ageH > 96) statut = wpick([['livrée', 55], ['expédiée', 40], ['annulée', 5]]);
          else if (ageH > 36) statut = wpick([['expédiée', 50], ['confirmée', 45], ['annulée', 5]]);
          else statut = wpick([['confirmée', 40], ['nouvelle', 60]]);
          const paiement = eur ? wpick([['Lien de paiement (carte / PayPal)', 70], ['Virement bancaire', 30]]) : wpick([['Mobile Money', 60], ['À la livraison', 40]]);
          const paye = statut === 'annulée' ? false : statut === 'livrée' ? true : statut === 'nouvelle' ? false : eur ? rnd() < 0.85 : paiement === 'Mobile Money' && rnd() < 0.7;
          id++;
          list.push({
            id, reference: 'DEMO-' + String(1000 + id), date: new Date(Date.now() - ageH * 36e5).toISOString(),
            nom: pick(pre) + ' ' + pick(nom), telephone: eur ? '+33 6 00 00 ' + String(10 + id).padStart(2, '0') + ' 00' : '07 00 00 ' + String(10 + id).padStart(2, '0'),
            email: '', pays, ville, quartier, adresse: eur ? 'Adresse fictive (démo)' : 'Adresse fictive, près du repère n°' + (id % 9 + 1),
            quantite: q, total: eur ? q * 38 + 8 : q * 25000 + 2000, devise: eur ? 'EUR' : 'FCFA', paiement, statut, paye, note: '', demo: true,
          });
        }
      }
      saveLocal(list);
      safe(() => localStorage.setItem(KEY + '_init', '1'));
    },
    clearDemo() { saveLocal([]); safe(() => localStorage.setItem(KEY + '_init', '1')); },
  };
})();
