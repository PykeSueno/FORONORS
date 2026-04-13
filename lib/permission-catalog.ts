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

export const PERMISSION_LABELS: Record<string, { module: string; label: string }> = {
  'dashboard.preview': { module: 'Dashboard', label: 'Voir le dashboard' },
  'dashboard.access': { module: 'Dashboard', label: 'Accéder au dashboard' },
  'dashboard.view': { module: 'Dashboard', label: 'Voir les widgets dashboard' },

  'money.preview': { module: 'Argent', label: 'Voir la bulle Argent' },
  'money.access': { module: 'Argent', label: 'Accéder à la page Argent' },
  'money.edit': { module: 'Argent', label: 'Créer / modifier les mouvements d’argent' },
  'money.history.view': { module: 'Argent', label: 'Voir l’historique des mouvements d’argent' },

  'items.preview': { module: 'Items', label: 'Voir la bulle Items' },
  'items.access': { module: 'Items', label: 'Accéder à la page Items' },
  'items.create': { module: 'Items', label: 'Créer un item' },
  'items.edit': { module: 'Items', label: 'Modifier un item' },
  'items.delete': { module: 'Items', label: 'Supprimer un item' },

  'transactions.preview': { module: 'Transactions', label: 'Voir la bulle Transactions' },
  'transactions.access': { module: 'Transactions', label: 'Accéder à la page Transactions' },
  'transactions.create': { module: 'Transactions', label: 'Créer une transaction' },
  'transactions.edit': { module: 'Transactions', label: 'Modifier les transactions' },
  'transactions.manage': { module: 'Transactions', label: 'Gérer les transactions' },

  'transactions.recent.preview': { module: 'Transactions récentes', label: 'Voir la bulle Transactions récentes' },
  'transactions.recent.access': { module: 'Transactions récentes', label: 'Accéder à la page Transactions récentes' },
  'transactions.recent.edit': { module: 'Transactions récentes', label: 'Modifier une transaction récente' },
  'transactions.recent.cancel': { module: 'Transactions récentes', label: 'Annuler une transaction récente' },

  'logs.preview': { module: 'Logs', label: 'Voir la bulle Logs' },
  'logs.access': { module: 'Logs', label: 'Accéder à la page Logs' },
  'logs.view': { module: 'Logs', label: 'Voir les logs' },
  'logs.webhook.manage': { module: 'Logs', label: 'Gérer le webhook logs' },

  'members.preview': { module: 'Membres', label: 'Voir la bulle Membres' },
  'members.access': { module: 'Membres', label: 'Accéder à la page Membres' },
  'members.view': { module: 'Membres', label: 'Voir les membres' },
  'members.create': { module: 'Membres', label: 'Créer un membre' },
  'members.edit': { module: 'Membres', label: 'Modifier un membre' },
  'members.delete': { module: 'Membres', label: 'Supprimer un membre' },
  'members.activities.view': { module: 'Membres', label: 'Voir les activités des membres' },

  'activity.preview': { module: 'Activité', label: 'Voir la bulle Activité' },
  'activity.access': { module: 'Activité', label: 'Accéder à la page Activité' },
  'activity.view': { module: 'Activité', label: 'Voir les activités récentes' },
  'activity.create': { module: 'Activité', label: 'Créer une activité' },
  'activity.stats.view': { module: 'Activité', label: 'Voir les stats activité' },
  'activity.logs.view': { module: 'Activité', label: 'Voir les logs activité' },
  'activity.edit.own': { module: 'Activité', label: 'Modifier ses activités' },
  'activity.edit.any': { module: 'Activité', label: 'Modifier toutes les activités' },
  'activity.cancel.own': { module: 'Activité', label: 'Annuler ses activités' },
  'activity.cancel.any': { module: 'Activité', label: 'Annuler toutes les activités' },

  'tablet.preview': { module: 'Tablette', label: 'Voir la bulle Tablette' },
  'tablet.access': { module: 'Tablette', label: 'Accéder à la page Tablette' },
  'tablet.daily.manage': { module: 'Tablette', label: 'Gérer le dépôt journalier' },
  'tablet.passage.create': { module: 'Tablette', label: 'Créer un passage tablette' },
  'tablet.logs.view': { module: 'Tablette', label: 'Voir les logs tablette' },
  'tablet.stats.view': { module: 'Tablette', label: 'Voir les stats tablette' },

  'account.password.update': { module: 'Compte', label: 'Modifier son mot de passe' },

  'dashboard.stock.movements.preview': { module: 'Dashboard', label: 'Voir le bloc Derniers mouvements de stock' },
  'dashboard.stock.movements.access': { module: 'Dashboard', label: 'Accéder aux données des mouvements de stock' },
  'dashboard.money.movements.preview': { module: 'Dashboard', label: 'Voir le bloc Derniers mouvements d’argent' },
  'dashboard.money.movements.access': { module: 'Dashboard', label: 'Accéder aux données des mouvements d’argent' },

  'roles.manage': { module: 'Rôles', label: 'Gérer les rôles et permissions' }
};

export function describePermission(permissionName: string) {
  return PERMISSION_LABELS[permissionName] ?? { module: 'Autres', label: permissionName.replace(/\./g, ' · ') };
}
