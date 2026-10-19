-- À exécuter une fois dans Supabase > SQL Editor.
create table if not exists public.commandes (
  id bigint generated always as identity primary key,
  reference text unique not null,
  date timestamptz not null default now(),
  nom text not null,
  telephone text not null,
  email text default '',
  pays text not null default 'Gabon',
  ville text not null,
  quartier text default '',
  adresse text not null,
  quantite int not null check (quantite between 1 and 50),
  total numeric not null check (total > 0),
  devise text not null default 'FCFA' check (devise in ('FCFA','EUR')),
  paiement text not null,
  statut text not null default 'nouvelle' check (statut in ('nouvelle','confirmée','expédiée','livrée','annulée')),
  paye boolean not null default false,
  note text default ''
);

alter table public.commandes enable row level security;

-- Les visiteurs peuvent seulement ENVOYER une commande (jamais lire celles des autres).
drop policy if exists "visiteurs: passer commande" on public.commandes;
create policy "visiteurs: passer commande" on public.commandes
  for insert to anon
  with check (statut = 'nouvelle' and paye = false);

-- L'administrateur connecté voit et gère tout.
drop policy if exists "admin: tout" on public.commandes;
create policy "admin: tout" on public.commandes
  for all to authenticated using (true) with check (true);

-- Ensuite : Authentication > Users > Add user (email + mot de passe) = compte du back office.
-- Puis Authentication > Providers > Email : désactiver « Allow new users to sign up ».
