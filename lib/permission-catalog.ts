export const MODULE_ORDER = [
  'Dashboard',
  'Argent',
  'Items',
  'Transactions',
  'Transactions récentes',
  'Logs',
  'Membres',
  'Activité',
  'Tablette',
  'Compte',
  'Rôles',
  'Autres'
] as const;

export const PERMISSION_LABELS: Record<string, { module: string; label: string; hint: string }> = {
  'dashboard.preview': { module: 'Dashboard', label: 'Voir le dashboard', hint: 'Afficher le dashboard et ses cartes de résumé.' },
  'dashboard.access': { module: 'Dashboard', label: 'Accéder au dashboard', hint: 'Autoriser l’ouverture de la page dashboard.' },
  'dashboard.view': { module: 'Dashboard', label: 'Voir les widgets dashboard', hint: 'Afficher les sections internes du dashboard.' },
  'dashboard.stock.movements.preview': { module: 'Dashboard', label: 'Voir le bloc Derniers mouvements de stock', hint: 'Afficher le bloc stock récent sur le dashboard.' },
  'dashboard.stock.movements.access': { module: 'Dashboard', label: 'Accéder aux données des mouvements de stock', hint: 'Lire les données du bloc stock récent.' },
  'dashboard.money.movements.preview': { module: 'Dashboard', label: 'Voir le bloc Derniers mouvements d’argent', hint: 'Afficher le bloc argent récent sur le dashboard.' },
  'dashboard.money.movements.access': { module: 'Dashboard', label: 'Accéder aux données des mouvements d’argent', hint: 'Lire les données du bloc argent récent.' },

  'money.preview': { module: 'Argent', label: 'Voir la bulle Argent', hint: 'Afficher la bulle Argent dans le dashboard.' },
  'money.access': { module: 'Argent', label: 'Accéder à la page Argent', hint: 'Autoriser l’entrée dans le module Argent.' },
  'money.edit': { module: 'Argent', label: 'Créer / modifier les mouvements d’argent', hint: 'Créer et modifier les mouvements de caisse.' },
  'money.history.view': { module: 'Argent', label: 'Voir l’historique des mouvements d’argent', hint: 'Afficher l’historique complet des mouvements.' },

  'items.preview': { module: 'Items', label: 'Voir la bulle Items', hint: 'Afficher la bulle Items dans le dashboard.' },
  'items.access': { module: 'Items', label: 'Accéder à la page Items', hint: 'Autoriser l’ouverture du module Items.' },
  'items.create': { module: 'Items', label: 'Créer un item', hint: 'Ajouter un nouvel item au catalogue.' },
  'items.edit': { module: 'Items', label: 'Modifier un item', hint: 'Modifier les informations d’un item.' },
  'items.delete': { module: 'Items', label: 'Supprimer un item', hint: 'Supprimer un item existant.' },

  'transactions.preview': { module: 'Transactions', label: 'Voir la bulle Transactions', hint: 'Afficher la bulle Transactions sur le dashboard.' },
  'transactions.access': { module: 'Transactions', label: 'Accéder à la page Transactions', hint: 'Entrer dans la page de création des transactions.' },
  'transactions.view': { module: 'Transactions', label: 'Voir les transactions (legacy)', hint: 'Permission héritée conservée pour compatibilité.' },
  'transactions.create': { module: 'Transactions', label: 'Créer une transaction', hint: 'Valider de nouvelles transactions.' },
  'transactions.edit': { module: 'Transactions', label: 'Modifier les transactions', hint: 'Modifier les transactions du module.' },
  'transactions.manage': { module: 'Transactions', label: 'Gérer les transactions', hint: 'Gérer les options avancées de transactions.' },

  'transactions.recent.preview': { module: 'Transactions récentes', label: 'Voir la bulle Transactions récentes', hint: 'Afficher la bulle Transactions récentes sur le dashboard.' },
  'transactions.recent.access': { module: 'Transactions récentes', label: 'Accéder à la page Transactions récentes', hint: 'Entrer dans l’historique des transactions récentes.' },
  'transactions.recent.edit': { module: 'Transactions récentes', label: 'Modifier une transaction récente', hint: 'Corriger une transaction récente.' },
  'transactions.recent.cancel': { module: 'Transactions récentes', label: 'Annuler une transaction récente', hint: 'Annuler une transaction récente.' },

  'logs.preview': { module: 'Logs', label: 'Voir la bulle Logs', hint: 'Afficher la bulle Logs sur le dashboard.' },
  'logs.access': { module: 'Logs', label: 'Accéder à la page Logs', hint: 'Entrer dans le module Logs.' },
  'logs.view': { module: 'Logs', label: 'Voir les logs', hint: 'Lire la liste des logs d’audit.' },
  'logs.webhook.manage': { module: 'Logs', label: 'Gérer le webhook logs', hint: 'Configurer l’URL webhook Discord des logs.' },

  'members.preview': { module: 'Membres', label: 'Voir la bulle Membres', hint: 'Afficher la bulle Membres sur le dashboard.' },
  'members.access': { module: 'Membres', label: 'Accéder à la page Membres', hint: 'Entrer dans la page de gestion des membres.' },
  'members.view': { module: 'Membres', label: 'Voir les membres', hint: 'Afficher la liste complète des membres.' },
  'members.create': { module: 'Membres', label: 'Créer un membre', hint: 'Créer un nouveau membre.' },
  'members.edit': { module: 'Membres', label: 'Modifier un membre', hint: 'Modifier les informations d’un membre.' },
  'members.delete': { module: 'Membres', label: 'Supprimer un membre', hint: 'Supprimer un membre existant.' },
  'members.activities.view': { module: 'Membres', label: 'Voir les activités des membres', hint: 'Consulter l’historique d’activité d’un membre.' },
  'members.password.view': { module: 'Membres', label: 'Voir le mot de passe membre', hint: 'Afficher le mot de passe actuel d’un membre.' },
  'members.password.copy': { module: 'Membres', label: 'Copier le mot de passe membre', hint: 'Copier le mot de passe actuel d’un membre.' },
  'members.password.edit': { module: 'Membres', label: 'Modifier le mot de passe membre', hint: 'Changer le mot de passe d’un membre.' },

  'activity.preview': { module: 'Activité', label: 'Voir la bulle Activité', hint: 'Afficher la bulle Activité sur le dashboard.' },
  'activity.access': { module: 'Activité', label: 'Accéder à la page Activité', hint: 'Entrer dans la page Activité.' },
  'activity.view': { module: 'Activité', label: 'Voir les activités récentes', hint: 'Afficher la liste des activités récentes.' },
  'activity.create': { module: 'Activité', label: 'Créer une activité', hint: 'Créer une nouvelle activité.' },
  'activity.stats.view': { module: 'Activité', label: 'Voir les stats activité', hint: 'Afficher l’onglet stats Activité.' },
  'activity.logs.view': { module: 'Activité', label: 'Voir les logs activité', hint: 'Afficher les journaux liés aux activités.' },
  'activity.edit.own': { module: 'Activité', label: 'Modifier ses activités', hint: 'Modifier uniquement ses propres activités.' },
  'activity.edit.any': { module: 'Activité', label: 'Modifier toutes les activités', hint: 'Modifier les activités de tous les membres.' },
  'activity.cancel.own': { module: 'Activité', label: 'Annuler ses activités', hint: 'Annuler uniquement ses propres activités.' },
  'activity.cancel.any': { module: 'Activité', label: 'Annuler toutes les activités', hint: 'Annuler les activités de tous les membres.' },

  'tablet.preview': { module: 'Tablette', label: 'Voir la bulle Tablette', hint: 'Afficher la bulle Tablette sur le dashboard.' },
  'tablet.access': { module: 'Tablette', label: 'Accéder à la page Tablette', hint: 'Entrer dans la page Tablette.' },
  'tablet.daily.manage': { module: 'Tablette', label: 'Gérer le dépôt journalier', hint: 'Modifier le dépôt journalier tablette.' },
  'tablet.passage.create': { module: 'Tablette', label: 'Créer un passage tablette', hint: 'Ajouter un passage tablette.' },
  'tablet.logs.view': { module: 'Tablette', label: 'Voir les logs tablette', hint: 'Consulter les journaux tablette.' },
  'tablet.stats.view': { module: 'Tablette', label: 'Voir les stats tablette', hint: 'Afficher l’onglet stats tablette.' },

  'account.password.update': { module: 'Compte', label: 'Modifier son mot de passe', hint: 'Changer son propre mot de passe utilisateur.' },

  'roles.manage': { module: 'Rôles', label: 'Gérer les rôles et permissions', hint: 'Créer et modifier rôles et permissions.' }
};

const ORDER_HINTS = ['preview', 'access', 'view', 'create', 'edit', 'delete', 'manage', 'own', 'any', 'stats', 'logs', 'recent'];

export function describePermission(permissionName: string) {
  return PERMISSION_LABELS[permissionName] ?? { module: 'Autres', label: permissionName.replace(/\./g, ' · '), hint: 'Permission personnalisée.' };
}

export function permissionOrder(permissionName: string) {
  const lower = permissionName.toLowerCase();
  const idx = ORDER_HINTS.findIndex((entry) => lower.includes(entry));
  return idx === -1 ? 999 : idx;
}
