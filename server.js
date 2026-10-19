// Serveur sans dépendance : node server.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const PORT = process.env.PORT || cfg.port;
// Sans ADMIN_PASSWORD, un mot de passe aléatoire est généré à chaque démarrage (affiché dans la console).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('hex');
const PUBLIC = path.join(__dirname, 'public');

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new DatabaseSync(path.join(__dirname, 'data', 'commandes.db'));
db.exec(`CREATE TABLE IF NOT EXISTS commandes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE,
  date TEXT NOT NULL,
  nom TEXT NOT NULL,
  telephone TEXT NOT NULL,
  email TEXT,
  ville TEXT NOT NULL,
  quartier TEXT,
  adresse TEXT NOT NULL,
  quantite INTEGER NOT NULL,
  total INTEGER NOT NULL,
  paiement TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'nouvelle',
  paye INTEGER NOT NULL DEFAULT 0,
  note TEXT
)`);

try { db.exec("ALTER TABLE commandes ADD COLUMN devise TEXT NOT NULL DEFAULT 'FCFA'"); } catch {}
try { db.exec("ALTER TABLE commandes ADD COLUMN pays TEXT NOT NULL DEFAULT 'Gabon'"); } catch {}
const STATUTS = ['nouvelle', 'confirmée', 'expédiée', 'livrée', 'annulée'];
const sessions = new Set();
const hits = new Map(); // anti-spam simple par IP

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const send = (res, code, body, type = 'application/json; charset=utf-8', headers = {}) => {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', (c) => { data += c; if (data.length > 20000) { reject(new Error('trop gros')); req.destroy(); } });
  req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
});

const cookie = (req, name) => (req.headers.cookie || '').split(';').map((s) => s.trim().split('=')).find(([k]) => k === name)?.[1];
const isAdmin = (req) => sessions.has(cookie(req, 'sid'));
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s; // neutralise les formules Excel
  return '"' + s.replace(/"/g, '""') + '"';
}

async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/config') {
    return send(res, 200, { prix: cfg.prix, fraisLivraison: cfg.fraisLivraison, prixEuro: cfg.prixEuro, fraisLivraisonEuro: cfg.fraisLivraisonEuro, fraisLivraisonEurope: cfg.fraisLivraisonEurope, paysEurope: cfg.paysEurope, devise: cfg.devise, whatsapp: cfg.whatsapp, mobileMoney: cfg.mobileMoney });
  }

  if (route === 'POST /api/commande') {
    const ip = req.socket.remoteAddress;
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
    if (recent.length >= 10) return send(res, 429, { error: 'Trop de demandes, réessayez plus tard.' });
    hits.set(ip, [...recent, now]);

    const b = await readBody(req);
    const c = {
      nom: clean(b.nom, 100), telephone: clean(b.telephone, 30), email: clean(b.email, 120),
      ville: clean(b.ville, 80), quartier: clean(b.quartier, 80), adresse: clean(b.adresse, 300),
      pays: b.pays === 'Gabon' || cfg.paysEurope.includes(b.pays) ? b.pays : 'Gabon',
      note: clean(b.note, 300), quantite: Math.max(1, Math.min(50, parseInt(b.quantite, 10) || 1)),
    };
    const europe = c.pays !== 'Gabon';
    c.devise = europe || b.devise === 'EUR' ? 'EUR' : 'FCFA';
    const modes = europe ? ['Lien de paiement (carte / PayPal)', 'Virement bancaire'] : ['À la livraison', 'Mobile Money'];
    c.paiement = modes.includes(b.paiement) ? b.paiement : modes[0];
    if (!c.nom || !c.telephone || !c.ville || !c.adresse) return send(res, 400, { error: 'Merci de remplir tous les champs obligatoires.' });
    if (c.telephone.replace(/\D/g, '').length < 8) return send(res, 400, { error: 'Numéro de téléphone invalide.' });

    const total = europe ? c.quantite * cfg.prixEuro + cfg.fraisLivraisonEurope : c.devise === 'EUR' ? c.quantite * cfg.prixEuro + cfg.fraisLivraisonEuro : c.quantite * cfg.prix + cfg.fraisLivraison;
    const ref = 'EDE-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    db.prepare(`INSERT INTO commandes (reference,date,nom,telephone,email,ville,quartier,adresse,quantite,total,paiement,note,devise,pays)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(ref, new Date().toISOString(), c.nom, c.telephone, c.email, c.ville, c.quartier, c.adresse, c.quantite, total, c.paiement, c.note, c.devise, c.pays);
    return send(res, 201, { reference: ref, total, devise: c.devise });
  }

  if (route === 'POST /api/admin/login') {
    const b = await readBody(req);
    const a = Buffer.from(String(b.password ?? '')), z = Buffer.from(ADMIN_PASSWORD);
    if (a.length !== z.length || !crypto.timingSafeEqual(a, z)) return send(res, 401, { error: 'Mot de passe incorrect.' });
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.add(sid);
    return send(res, 200, { ok: true }, undefined, { 'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` });
  }

  if (url.pathname.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'Non autorisé' });

    if (route === 'POST /api/admin/logout') {
      sessions.delete(cookie(req, 'sid'));
      return send(res, 200, { ok: true }, undefined, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
    }
    if (route === 'GET /api/admin/commandes') {
      return send(res, 200, db.prepare('SELECT * FROM commandes ORDER BY id DESC').all());
    }
    if (route === 'GET /api/admin/export.csv') {
      const rows = db.prepare('SELECT * FROM commandes ORDER BY id DESC').all();
      const head = ['Référence', 'Date', 'Nom', 'Téléphone', 'Email', 'Ville', 'Quartier', 'Adresse', 'Quantité', 'Total', 'Devise', 'Pays', 'Paiement', 'Payé', 'Statut', 'Note'];
      const lines = rows.map((r) => [r.reference, r.date, r.nom, r.telephone, r.email, r.ville, r.quartier, r.adresse, r.quantite, r.total, r.devise, r.pays, r.paiement, r.paye ? 'oui' : 'non', r.statut, r.note].map(csvCell).join(';'));
      return send(res, 200, '﻿' + [head.map(csvCell).join(';'), ...lines].join('\r\n'), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="commandes.csv"' });
    }
    const m = url.pathname.match(/^\/api\/admin\/commandes\/(\d+)$/);
    if (m && req.method === 'PATCH') {
      const b = await readBody(req);
      const id = Number(m[1]);
      if (b.statut !== undefined) {
        if (!STATUTS.includes(b.statut)) return send(res, 400, { error: 'Statut invalide' });
        db.prepare('UPDATE commandes SET statut=? WHERE id=?').run(b.statut, id);
      }
      if (b.paye !== undefined) db.prepare('UPDATE commandes SET paye=? WHERE id=?').run(b.paye ? 1 : 0, id);
      if (b.note !== undefined) db.prepare('UPDATE commandes SET note=? WHERE id=?').run(clean(b.note, 300), id);
      return send(res, 200, { ok: true });
    }
    if (m && req.method === 'DELETE') {
      db.prepare('DELETE FROM commandes WHERE id=?').run(Number(m[1]));
      return send(res, 200, { ok: true });
    }
  }
  return send(res, 404, { error: 'Introuvable' });
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/admin' || p === '/admin/') p = '/admin/index.html';
  if (p === '/') p = '/index.html';
  if (!path.extname(p)) p += '.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep) && file !== PUBLIC) return send(res, 403, 'Interdit', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, '<h1>Page introuvable</h1><a href="/">Retour</a>', 'text/html; charset=utf-8');
    send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': 'public, max-age=300' });
  });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    send(res, 400, { error: 'Requête invalide' });
  }
}).listen(PORT, () => {
  console.log(`Site : http://localhost:${PORT}\nBack office : http://localhost:${PORT}/admin  (mot de passe : ${process.env.ADMIN_PASSWORD ? '(variable ADMIN_PASSWORD)' : ADMIN_PASSWORD})`);
});
