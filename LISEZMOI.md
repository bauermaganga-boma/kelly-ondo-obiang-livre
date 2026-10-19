# Site « L'espoir doit mourir en dernier »

Lancer : `node server.js` (Node 22.5+), puis ouvrir http://localhost:3000

- Site public : `/` et `/auteur`
- Back office : `/admin`. Définissez le mot de passe avec la variable `ADMIN_PASSWORD` (sinon un mot de passe aléatoire est affiché dans la console à chaque démarrage).
- Prix, frais de livraison, numéro WhatsApp et numéro Mobile Money : `config.json` (valeurs actuelles = exemples à remplacer).
- Commandes stockées dans `data/commandes.db` : montez un volume persistant sur `data/` en production et sauvegardez ce fichier.
