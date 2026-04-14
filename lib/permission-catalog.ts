export const MODULE_ORDER = ['Dashboard', 'Argent', 'Items', 'Transactions', 'Transactions récentes', 'Logs', 'Membres', 'Activité', 'Tablette', 'FOUR', 'Compte', 'Autres'] as const;

export const PERMISSION_LABELS: Record<string, { module: string; label: string; hint: string }> = {
  'dashboard.preview': { module: 'Dashboard', label: 'Voir le dashboard', hint: 'Afficher le dashboard.' },
  'dashboard.access': { module: 'Dashboard', label: 'Accéder au dashboard', hint: 'Entrer sur la page dashboard.' },
  'dashboard.view': { module: 'Dashboard', label: 'Voir les widgets dashboard', hint: 'Afficher les widgets du dashboard.' },
  'dashboard.stock.movements.preview': { module: 'Dashboard', label: 'Voir le bloc stock récent', hint: 'Afficher le bloc Derniers mouvements de stock.' },
  'dashboard.stock.movements.access': { module: 'Dashboard', label: 'Accéder aux données stock récent', hint: 'Lire les données du bloc stock récent.' },
  'dashboard.money.movements.preview': { module: 'Dashboard', label: 'Voir le bloc cash récent', hint: 'Afficher le bloc Derniers mouvements d’argent.' },
  'dashboard.money.movements.access': { module: 'Dashboard', label: 'Accéder aux données cash récent', hint: 'Lire les données du bloc cash récent.' },

  'money.preview': { module: 'Argent', label: 'Voir la bulle Argent', hint: 'Afficher la bulle Argent.' },
  'money.access': { module: 'Argent', label: 'Accéder à Argent', hint: 'Entrer dans le module Argent.' },
  'money.edit': { module: 'Argent', label: 'Créer / modifier des mouvements cash', hint: 'Créer des mouvements d’argent.' },
  'money.history.view': { module: 'Argent', label: 'Voir l’historique cash', hint: 'Afficher l’historique des mouvements.' },

  'items.preview': { module: 'Items', label: 'Voir la bulle Items', hint: 'Afficher la bulle Items.' },
  'items.access': { module: 'Items', label: 'Accéder à Items', hint: 'Entrer dans le module Items.' },
  'items.create': { module: 'Items', label: 'Créer un item', hint: 'Ajouter un item.' },
  'items.edit': { module: 'Items', label: 'Modifier un item', hint: 'Modifier un item.' },
  'items.delete': { module: 'Items', label: 'Supprimer un item', hint: 'Supprimer un item.' },

  'transactions.preview': { module: 'Transactions', label: 'Voir la bulle Transactions', hint: 'Afficher la bulle Transactions.' },
  'transactions.access': { module: 'Transactions', label: 'Accéder à la page Transactions', hint: 'Permet d’ouvrir la page Transactions.' },
  'transactions.create': { module: 'Transactions', label: 'Créer une transaction', hint: 'Permet de créer une transaction.' },
  'transactions.manage.own': { module: 'Transactions', label: 'Modifier/annuler ses transactions', hint: 'Permet de modifier ou annuler uniquement les transactions créées par ce membre.' },
  'transactions.manage.any': { module: 'Transactions', label: 'Modifier/annuler toutes les transactions', hint: 'Permet de modifier ou annuler toutes les transactions, peu importe l’auteur.' },

  'transactions.recent.preview': { module: 'Transactions récentes', label: 'Voir la bulle Transactions récentes', hint: 'Afficher la bulle Transactions récentes.' },
  'transactions.recent.access': { module: 'Transactions récentes', label: 'Accéder à la page Transactions récentes', hint: 'Permet d’ouvrir la page des transactions récentes.' },
  'transactions.recent.manage.own': { module: 'Transactions récentes', label: 'Modifier/annuler ses transactions récentes', hint: 'Permet de modifier ou annuler uniquement ses transactions récentes.' },
  'transactions.recent.manage.any': { module: 'Transactions récentes', label: 'Modifier/annuler toutes les transactions récentes', hint: 'Permet de modifier ou annuler toutes les transactions récentes.' },

  'logs.preview': { module: 'Logs', label: 'Voir la bulle Logs', hint: 'Afficher la bulle Logs.' },
  'logs.access': { module: 'Logs', label: 'Accéder à Logs', hint: 'Entrer dans Logs.' },
  'logs.view': { module: 'Logs', label: 'Voir les logs', hint: 'Afficher les logs.' },
  'logs.webhook.manage': { module: 'Logs', label: 'Gérer le webhook logs', hint: 'Modifier le webhook Discord.' },

  'members.preview': { module: 'Membres', label: 'Voir la bulle Membres', hint: 'Afficher la bulle Membres.' },
  'members.access': { module: 'Membres', label: 'Accéder à Membres', hint: 'Entrer dans Membres.' },
  'members.view': { module: 'Membres', label: 'Voir les membres', hint: 'Afficher les membres.' },
  'members.create': { module: 'Membres', label: 'Créer un membre', hint: 'Créer un membre.' },
  'members.edit': { module: 'Membres', label: 'Modifier un membre', hint: 'Modifier un membre.' },
  'members.delete': { module: 'Membres', label: 'Supprimer un membre', hint: 'Supprimer un membre.' },
  'members.activities.view': { module: 'Membres', label: 'Voir les activités d’un membre', hint: 'Ouvrir la page activités d’un membre.' },
  'members.password.view': { module: 'Membres', label: 'Voir le mot de passe membre', hint: 'Afficher le mot de passe membre.' },
  'members.password.copy': { module: 'Membres', label: 'Copier le mot de passe membre', hint: 'Copier le mot de passe membre.' },
  'members.password.edit': { module: 'Membres', label: 'Modifier le mot de passe membre', hint: 'Modifier le mot de passe membre.' },
  'roles.manage': { module: 'Membres', label: 'Gérer rôles et permissions', hint: 'Créer/modifier les rôles et leurs permissions.' },

  'activity.preview': { module: 'Activité', label: 'Voir la bulle Activité', hint: 'Afficher la bulle Activité.' },
  'activity.access': { module: 'Activité', label: 'Accéder à la page Activité', hint: 'Permet d’ouvrir la page Activité.' },
  'activity.view': { module: 'Activité', label: 'Voir les activités récentes', hint: 'Permet d’afficher le contenu Activité autorisé pour ce rôle.' },
  'activity.create': { module: 'Activité', label: 'Créer une activité', hint: 'Permet de créer une activité.' },
  'activity.stats.view': { module: 'Activité', label: 'Voir les stats activité', hint: 'Afficher les stats activité.' },
  'activity.logs.view': { module: 'Activité', label: 'Voir les logs activité', hint: 'Afficher les logs activité.' },
  'activity.manage.own': { module: 'Activité', label: 'Modifier/annuler ses activités', hint: 'Permet de modifier ou annuler uniquement les activités créées par ce membre.' },
  'activity.manage.any': { module: 'Activité', label: 'Modifier/annuler toutes les activités', hint: 'Permet de modifier ou annuler toutes les activités.' },

  'tablet.preview': { module: 'Tablette', label: 'Voir la bulle Tablette', hint: 'Afficher la bulle Tablette.' },
  'tablet.access': { module: 'Tablette', label: 'Accéder à Tablette', hint: 'Entrer dans Tablette.' },
  'tablet.daily.manage': { module: 'Tablette', label: 'Gérer le dépôt journalier', hint: 'Gérer le dépôt du matin.' },
  'tablet.passage.create': { module: 'Tablette', label: 'Créer un passage tablette', hint: 'Créer un passage tablette.' },
  'tablet.logs.view': { module: 'Tablette', label: 'Voir les logs tablette', hint: 'Afficher les logs tablette.' },
  'tablet.stats.view': { module: 'Tablette', label: 'Voir les stats tablette', hint: 'Afficher les stats tablette.' },

  'four.preview': { module: 'FOUR', label: 'Voir la bulle FOUR', hint: 'Afficher la bulle FOUR.' },
  'four.access': { module: 'FOUR', label: 'Accéder à la page FOUR', hint: 'Permet d’ouvrir la page FOUR.' },
  'four.open': { module: 'FOUR', label: 'Ouvrir une session FOUR', hint: 'Permet d’ouvrir une session FOUR avec un cash initial.' },
  'four.add_movement': { module: 'FOUR', label: 'Ajouter un mouvement FOUR', hint: 'Permet d’ajouter des lignes/mouvements dans la session FOUR en cours.' },
  'four.cash.add': { module: 'FOUR', label: 'Ajouter du cash à la session FOUR', hint: 'Permet d’ajouter de l’argent à la session FOUR ouverte.' },
  'four.transaction.manage': { module: 'FOUR', label: 'Gérer la transaction FOUR en cours', hint: 'Permet de modifier les lignes de la transaction en cours.' },
  'four.transaction.validate': { module: 'FOUR', label: 'Valider une transaction FOUR', hint: 'Permet de valider une transaction client dans la session FOUR.' },
  'four.close': { module: 'FOUR', label: 'Fermer une session FOUR', hint: 'Permet de clôturer la session FOUR et consolider les données.' },
  'four.stats.view': { module: 'FOUR', label: 'Voir les stats FOUR', hint: 'Afficher les stats des sessions FOUR.' },
  'four.history.view': { module: 'FOUR', label: 'Voir l’historique FOUR', hint: 'Afficher l’historique des sessions FOUR.' },
  'four.messages.view': { module: 'FOUR', label: 'Voir les messages FOUR', hint: 'Afficher les messages prédéfinis FOUR.' },
  'four.messages.manage': { module: 'FOUR', label: 'Gérer les messages FOUR', hint: 'Créer/modifier/supprimer les messages FOUR.' },
  'four.logs.view': { module: 'FOUR', label: 'Voir les logs FOUR', hint: 'Afficher les logs FOUR.' },

  'account.password.update': { module: 'Compte', label: 'Modifier son mot de passe', hint: 'Modifier son mot de passe.' }
};

const ORDER_HINTS = ['preview', 'access', 'view', 'create', 'manage', 'own', 'any', 'stats', 'history', 'messages', 'logs', 'edit', 'delete'];

export function describePermission(permissionName: string) {
  return PERMISSION_LABELS[permissionName] ?? { module: 'Autres', label: permissionName.replace(/\./g, ' · '), hint: 'Permission personnalisée.' };
}

export function permissionOrder(permissionName: string) {
  const lower = permissionName.toLowerCase();
  const idx = ORDER_HINTS.findIndex((entry) => lower.includes(entry));
  return idx === -1 ? 999 : idx;
}
