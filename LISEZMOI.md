# Site « L'espoir doit mourir en dernier »

Site 100 % statique (GitHub Pages) : `index.html` (vente), `auteur.html` (l'auteur), `admin/` (gestion des ventes et livraisons).

## Réglages
Tout est dans `config.js` : prix (FCFA et €), frais de livraison Gabon / Europe, numéro WhatsApp, numéro Mobile Money.

## Back office (`/admin/`)
- **Sans Supabase (état actuel) : démonstration.** Le back office s'ouvre avec des ventes FICTIVES (Gabon + Europe) pour présenter l'outil. Aucun mot de passe. Les commandes passées sur le site s'ajoutent dans le navigateur seulement.
- **Avec Supabase (mode réel)** : toutes les commandes arrivent dans la base, l'admin demande email + mot de passe.
  1. Créer un projet sur supabase.com.
  2. SQL Editor : coller et exécuter `supabase/install.sql`.
  3. Authentication > Users > Add user : créer le compte administrateur ; désactiver les inscriptions publiques.
  4. Copier l'URL du projet et la clé « anon » dans `config.js` (`supabaseUrl`, `supabaseAnonKey`), puis publier.
