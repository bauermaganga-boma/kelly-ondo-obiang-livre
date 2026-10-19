/* Réglages du site. Modifier ici le prix, les frais et les numéros.
   Supabase : laisser vide = mode démonstration (commandes enregistrées dans le navigateur).
   Renseigner l'URL du projet et la clé publique "anon" = mode réel : toutes les commandes arrivent
   dans la base et le back office (/admin) se connecte avec le compte administrateur.
   (La clé "anon" est publique par conception : la sécurité est assurée par les règles RLS, voir supabase/install.sql.) */
window.LIVRE_CONFIG = {
  prix: 25000,                // FCFA
  prixEuro: 38,               // €
  fraisLivraison: 2000,       // FCFA, Gabon
  fraisLivraisonEuro: 3,      // €, Gabon payé en euros
  fraisLivraisonEurope: 8,    // €, France et Europe
  paysEurope: ['France', 'Belgique', 'Suisse', 'Allemagne', 'Espagne', 'Italie', 'Royaume-Uni', "Autre pays d'Europe"],
  whatsapp: '24100000000',    // format international, sans + ni espaces
  mobileMoney: 'Airtel Money / Moov Money : 07 00 00 00',
  supabaseUrl: '',
  supabaseAnonKey: '',
};
