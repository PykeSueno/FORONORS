export const MODULE_ORDER = ['Dashboard', 'Argent', 'Transactions', 'Items', 'Membres', 'Activité', 'Activités & Payes & Dépenses', 'Jobs', 'Drogues', 'FOUR', 'Braquage', 'Vente objets', 'Logs', 'Admin', 'Autres'] as const;

export const SECTION_ORDER = ['Vue', 'Création', 'Validation', 'Modification', 'Annulation', 'Historique', 'Stats', 'Logs', 'Configuration', 'Technique'] as const;

type PermissionInfo = { module: string; section: string; label: string; hint: string };

function humanize(name: string) {
  return name.split('.').map((part) => part.replace(/_/g, ' ')).join(' · ');
}

function inferModule(name: string) {
  if (name.startsWith('dashboard.')) return 'Dashboard';
  if (name.startsWith('money.') || name.startsWith('payroll.')) return 'Argent';
  if (name.startsWith('transactions.')) return 'Transactions';
  if (name.startsWith('items.')) return 'Items';
  if (name.startsWith('members.') || name.startsWith('roles.') || name.startsWith('account.')) return 'Membres';
  if (name.startsWith('member_ops.') || name.startsWith('activity_payroll.') || name.startsWith('expenses.')) return 'Activités & Payes & Dépenses';
  if (name.startsWith('activity.')) return 'Activité';
  if (name.startsWith('tablet.') || name.startsWith('cigarette.') || name.startsWith('tobacco.processor.') || name.startsWith('jobs.')) return 'Jobs';
  if (name.startsWith('drugs.')) return 'Drogues';
  if (name.startsWith('four.')) return 'FOUR';
  if (name.startsWith('robberies.')) return 'Braquage';
  if (name.startsWith('sale.objects.') || name.startsWith('sale_objects.') || name.startsWith('money.quick_sale.')) return 'Vente objets';
  if (name.startsWith('logs.')) return 'Logs';
  return 'Autres';
}

function inferSection(name: string) {
  if (name.includes('history')) return 'Historique';
  if (name.includes('stats')) return 'Stats';
  if (name.includes('logs')) return 'Logs';
  if (name.includes('create')) return 'Création';
  if (name.includes('validate') || name.includes('receive') || name.includes('pay') || name.includes('reimburse')) return 'Validation';
  if (name.includes('cancel') || name.includes('delete')) return 'Annulation';
  if (name.includes('edit') || name.includes('manage') || name.includes('adjust') || name.includes('configure')) return 'Modification';
  if (name.includes('webhook') || name.includes('sql')) return 'Technique';
  return 'Vue';
}

export const PERMISSION_LABELS: Record<string, PermissionInfo> = {};

export function describePermission(permissionName: string): PermissionInfo {
  const canonical = permissionName.trim();
  const label = humanize(canonical);
  return { module: inferModule(canonical), section: inferSection(canonical), label, hint: `Permission ${label}.` };
}

export function permissionOrder(permissionName: string) {
  const info = describePermission(permissionName);
  const sectionIdx = SECTION_ORDER.indexOf(info.section as (typeof SECTION_ORDER)[number]);
  return sectionIdx === -1 ? 999 : sectionIdx;
}

export type PermissionModuleKey =
  | 'dashboard'
  | 'money'
  | 'transactions'
  | 'items'
  | 'members'
  | 'member_ops'
  | 'activity'
  | 'jobs'
  | 'drugs'
  | 'four'
  | 'robberies'
  | 'sale_objects'
  | 'logs'
  | 'admin';

export type SimplePermission = {
  key: string;
  label: string;
  permissions: string[];
  partnerSafe?: boolean;
};

export type PermissionModule = {
  key: PermissionModuleKey;
  icon: string;
  title: string;
  description: string;
  permissions: SimplePermission[];
};

export const SIMPLE_PERMISSION_MODULES: PermissionModule[] = [
  {
    key: 'dashboard',
    icon: '🏠',
    title: 'DASHBOARD',
    description: 'Bulles visibles sur l’accueil.',
    permissions: [
      { key: 'dashboard.view', label: 'Voir Dashboard', permissions: ['dashboard.access', 'dashboard.preview', 'dashboard.view'] },
      { key: 'dashboard.money', label: 'Argent', permissions: ['money.preview', 'dashboard.money.movements.preview'] },
      { key: 'dashboard.transactions', label: 'Transactions', permissions: ['transactions.preview'] },
      { key: 'dashboard.items', label: 'Items', permissions: ['items.preview', 'dashboard.stock.movements.preview'] },
      { key: 'dashboard.members', label: 'Membres', permissions: ['members.preview'] },
      { key: 'dashboard.activity', label: 'Activité', permissions: ['activity.preview'] },
      { key: 'dashboard.member_ops', label: 'Activités & Payes & Dépenses', permissions: ['member_ops.view'] },
      { key: 'dashboard.jobs', label: 'Jobs', permissions: ['tablet.preview', 'cigarette.preview'] },
      { key: 'dashboard.drugs', label: 'Drogues', permissions: ['drugs.preview'] },
      { key: 'dashboard.four', label: 'FOUR', permissions: ['four.preview'] },
      { key: 'dashboard.robberies', label: 'Braquage', permissions: ['robberies.view'] },
      { key: 'dashboard.sale_objects', label: 'Vente objets', permissions: ['sale.objects.preview', 'money.quick_sale.preview'] },
      { key: 'dashboard.logs', label: 'Logs', permissions: ['logs.preview'] }
    ]
  },
  {
    key: 'money',
    icon: '💰',
    title: 'ARGENT',
    description: 'Caisse groupe et mouvements.',
    permissions: [
      { key: 'money.view', label: 'Voir page Argent', permissions: ['money.access'] },
      { key: 'money.edit', label: 'Modifier le montant', permissions: ['money.edit'] },
      { key: 'money.movement', label: 'Ajouter un mouvement', permissions: ['money.edit'] },
      { key: 'money.history', label: 'Historique', permissions: ['money.history.view', 'money.movements.view'] }
    ]
  },
  {
    key: 'transactions',
    icon: '🔄',
    title: 'TRANSACTIONS',
    description: 'Entrées, sorties et historique.',
    permissions: [
      { key: 'transactions.view', label: 'Voir page Transactions', permissions: ['transactions.access'] },
      { key: 'transactions.validate', label: 'Valider transaction', permissions: ['transactions.create'] },
      { key: 'transactions.edit', label: 'Modifier transaction', permissions: ['transactions.edit.own', 'transactions.edit.any', 'transactions.recent.edit.own', 'transactions.recent.edit.any'] },
      { key: 'transactions.cancel', label: 'Annuler transaction', permissions: ['transactions.cancel.own', 'transactions.cancel.any', 'transactions.recent.cancel.own', 'transactions.recent.cancel.any'] },
      { key: 'transactions.history', label: 'Historique', permissions: ['transactions.recent.access'] }
    ]
  },
  {
    key: 'items',
    icon: '📦',
    title: 'ITEMS',
    description: 'Catalogue et stock.',
    permissions: [
      { key: 'items.view', label: 'Voir page Items', partnerSafe: true, permissions: ['items.access'] },
      { key: 'items.create', label: 'Créer item', permissions: ['items.create'] },
      { key: 'items.edit', label: 'Modifier item', permissions: ['items.edit'] },
      { key: 'items.delete', label: 'Supprimer item', permissions: ['items.delete'] },
      { key: 'items.history', label: 'Historique', permissions: ['items.movements.view'] }
    ]
  },
  {
    key: 'members',
    icon: '👥',
    title: 'MEMBRES',
    description: 'Membres, rôles et identifiants.',
    permissions: [
      { key: 'members.view', label: 'Voir page Membres', permissions: ['members.access', 'members.view'] },
      { key: 'members.create', label: 'Nouveau membre', permissions: ['members.create'] },
      { key: 'members.edit', label: 'Gérer membre', permissions: ['members.edit', 'members.password.view', 'members.password.copy', 'members.password.edit', 'members.credentials.copy', 'account.password.update'] },
      { key: 'members.delete', label: 'Supprimer membre', permissions: ['members.delete'] },
      { key: 'members.roles', label: 'Gérer rôles', permissions: ['roles.manage'] },
      { key: 'members.rename_roles', label: 'Modifier rôles', permissions: ['roles.rename'] }
    ]
  },
  {
    key: 'member_ops',
    icon: '💸',
    title: 'ACTIVITÉS & PAYES & DÉPENSES',
    description: 'Activités membres, payes, dépenses.',
    permissions: [
      { key: 'member_ops.view', label: 'Voir page', permissions: ['member_ops.view', 'activity_payroll.view', 'activity_payroll.global.view'] },
      { key: 'member_ops.activities', label: 'Activités', permissions: ['member_ops.activities.view', 'activity_payroll.activities.view'] },
      { key: 'member_ops.payroll', label: 'Payes', permissions: ['member_ops.payroll.view', 'activity_payroll.payroll.view', 'money.pay.access', 'payroll.view', 'payroll.preview'] },
      { key: 'member_ops.expenses', label: 'Dépenses', permissions: ['member_ops.expenses.view', 'expenses.view'] },
      { key: 'member_ops.history', label: 'Historique', permissions: ['member_ops.history.view', 'activity_payroll.history.view', 'expenses.history.view', 'payroll.history'] },
      { key: 'member_ops.logs', label: 'Logs', permissions: ['member_ops.activities.logs', 'member_ops.payroll.logs', 'member_ops.expenses.logs', 'member_ops.logs.view', 'activity_payroll.logs.view', 'expenses.logs.view', 'payroll.logs'] },
      { key: 'member_ops.edit', label: 'Modifier', permissions: ['member_ops.payroll.adjust', 'member_ops.payroll.report', 'member_ops.payroll.exclude', 'member_ops.expenses.edit', 'activity_payroll.payroll.configure', 'activity_payroll.payroll.adjust', 'activity_payroll.payroll.exclude', 'payroll.configure', 'payroll.adjust', 'expenses.edit'] },
      { key: 'member_ops.validate', label: 'Valider', permissions: ['member_ops.payroll.pay', 'member_ops.expenses.create', 'member_ops.expenses.reimburse', 'activity_payroll.payroll.pay', 'money.pay.create', 'payroll.validate', 'expenses.create', 'expenses.reimburse'] },
      { key: 'member_ops.cancel', label: 'Annuler', permissions: ['member_ops.expenses.cancel', 'expenses.delete'] }
    ]
  },
  {
    key: 'activity',
    icon: '🎯',
    title: 'ACTIVITÉ',
    description: 'Activités groupe et stats.',
    permissions: [
      { key: 'activity.view', label: 'Voir page Activité', partnerSafe: true, permissions: ['activity.access', 'activity.view', 'activity.processor.view'] },
      { key: 'activity.create', label: 'Valider une activité', permissions: ['activity.create', 'activity.processor.create'] },
      { key: 'activity.edit', label: 'Modifier activité', permissions: ['activity.edit.own', 'activity.edit.any', 'activity.manage.own', 'activity.manage.any', 'activity.processor.edit'] },
      { key: 'activity.cancel', label: 'Annuler activité', permissions: ['activity.cancel.own', 'activity.cancel.any', 'activity.processor.cancel'] },
      { key: 'activity.stats', label: 'Stats', permissions: ['activity.stats.view'] }
    ]
  },
  {
    key: 'jobs',
    icon: '🚬',
    title: 'JOBS',
    description: 'Tablette, cigarette, processeur et pierre.',
    permissions: [
      { key: 'jobs.view', label: 'Voir page Jobs', partnerSafe: true, permissions: ['tablet.access', 'cigarette.access', 'tobacco.processor.view', 'jobs.stone.view'] },
      { key: 'jobs.tablet', label: 'Tablette', permissions: ['tablet.access', 'jobs.tablet.webhook.view'] },
      { key: 'jobs.cigarette', label: 'Cigarette', permissions: ['cigarette.access'] },
      { key: 'jobs.processor', label: 'Processeur', permissions: ['tobacco.processor.view', 'tobacco.processor.sale.view'] },
      { key: 'jobs.stone', label: 'Pierre', permissions: ['jobs.stone.view'] },
      { key: 'jobs.validate', label: 'Valider passage', permissions: ['tablet.passage.create', 'cigarette.passage.create', 'cigarette.passage.create.any', 'tobacco.processor.sale.validate', 'jobs.stone.sell'] },
      { key: 'jobs.deposit', label: 'Dépôt', permissions: ['tablet.daily.manage', 'cigarette.daily.manage'] },
      { key: 'jobs.edit', label: 'Modifier', permissions: ['jobs.tablet.webhook.edit', 'cigarette.edit.own', 'cigarette.edit.any', 'tobacco.processor.sale.edit', 'tobacco.processor.sale.cancel'] },
      { key: 'jobs.history', label: 'Historique', partnerSafe: true, permissions: ['jobs.history.view', 'tablet.history.view', 'cigarette.history.view', 'tobacco.processor.sale.view', 'jobs.stone.history.view'] },
      { key: 'jobs.stats', label: 'Stats', permissions: ['tablet.stats.view', 'cigarette.stats.view', 'tobacco.processor.stats', 'jobs.stone.stats.view'] },
      { key: 'jobs.logs', label: 'Logs', permissions: ['tablet.logs.view', 'cigarette.logs.view', 'tobacco.processor.logs', 'jobs.stone.logs'] }
    ]
  },
  {
    key: 'drugs',
    icon: '🧪',
    title: 'DROGUES',
    description: 'Transformation, vente, production, GoFast.',
    permissions: [
      { key: 'drugs.view', label: 'Voir page Drogues', permissions: ['drugs.access', 'drugs.transfo.view', 'drugs.sales.view', 'drugs.production.access', 'drugs.gofast.view'] },
      { key: 'drugs.transfo', label: 'Transformation', permissions: ['drugs.transfo.view'] },
      { key: 'drugs.sales', label: 'Vente de drogue', permissions: ['drugs.sales.view'] },
      { key: 'drugs.production', label: 'Production', permissions: ['drugs.production.access', 'drugs.production.history.view'] },
      { key: 'drugs.gofast', label: 'GoFast', permissions: ['drugs.gofast.view'] },
      { key: 'drugs.validate', label: 'Valider', permissions: ['drugs.transfo.receive.validate', 'drugs.production.coke.create', 'drugs.production.meth.create'] },
      { key: 'drugs.manage', label: 'Gérer', permissions: ['drugs.production.create', 'drugs.gofast.create'] },
      { key: 'drugs.send', label: 'Envoyer', permissions: ['drugs.sales.create', 'drugs.transfo.create'] },
      { key: 'drugs.cancel', label: 'Annuler', permissions: ['drugs.transfo.cancel', 'drugs.transfo.cancel.own', 'drugs.transfo.cancel.any', 'drugs.sales.cancel', 'drugs.sales.cancel.own', 'drugs.sales.cancel.any', 'drugs.production.cancel', 'drugs.production.cancel.own', 'drugs.production.cancel.any', 'drugs.gofast.cancel'] },
      { key: 'drugs.edit', label: 'Modifier', permissions: ['drugs.transfo.edit', 'drugs.transfo.edit.own', 'drugs.transfo.edit.any', 'drugs.sales.edit', 'drugs.sales.edit.own', 'drugs.sales.edit.any', 'drugs.production.edit', 'drugs.production.edit.own', 'drugs.production.edit.any'] }
    ]
  },
  {
    key: 'four',
    icon: '🔥',
    title: 'FOUR',
    description: 'Transactions, partenaire, messages et stats.',
    permissions: [
      { key: 'four.view', label: 'Voir page FOUR', partnerSafe: true, permissions: ['four.access'] },
      { key: 'four.transactions', label: 'Transactions', permissions: ['four.transaction.validate'] },
      { key: 'four.history', label: 'Historique', permissions: ['four.history.view'] },
      { key: 'four.stats', label: 'Stats', permissions: ['four.stats.view'] },
      { key: 'four.partner', label: 'Partenaire', partnerSafe: true, permissions: ['four.partner.view', 'four.partner.sell', 'four.partner.history.view', 'four.partner.stats.view'] },
      { key: 'four.messages', label: 'Messages', partnerSafe: true, permissions: ['four.messages.view'] },
      { key: 'four.create', label: 'Créer', permissions: ['four.transaction.validate'] },
      { key: 'four.validate', label: 'Valider', permissions: ['four.transaction.validate', 'four.partner.sell'] },
      { key: 'four.edit', label: 'Modifier', permissions: ['four.transaction.edit.own', 'four.transaction.edit.any', 'four.transaction.manage', 'four.transaction.manage.own', 'four.transaction.manage.any', 'four.transaction.recent.edit.own', 'four.transaction.recent.edit.any', 'four.partner.config', 'four.messages.manage'] },
      { key: 'four.cancel', label: 'Annuler', permissions: ['four.transaction.cancel.own', 'four.transaction.cancel.any'] },
      { key: 'four.reset', label: 'Réinitialiser', permissions: ['four.transaction.manage', 'four.transaction.manage.own', 'four.transaction.manage.any'] },
      { key: 'four.logs', label: 'Logs', permissions: ['four.logs.view', 'four.partner.logs'] }
    ]
  },
  {
    key: 'robberies',
    icon: '🔫',
    title: 'BRAQUAGE',
    description: 'Braquages, historiques et stats.',
    permissions: [
      { key: 'robberies.view', label: 'Voir page Braquage', permissions: ['robberies.view'] },
      { key: 'robberies.create', label: 'Créer braquage', permissions: ['robberies.create'] },
      { key: 'robberies.validate', label: 'Valider braquage', permissions: ['robberies.create', 'robberies.arrested', 'robberies.fleeca.verify_no_consume'] },
      { key: 'robberies.edit', label: 'Modifier braquage', permissions: ['robberies.fleeca.multi_roles'] },
      { key: 'robberies.cancel', label: 'Annuler braquage', permissions: ['robberies.cancel'] },
      { key: 'robberies.suggestions', label: 'Suggestions', permissions: ['robberies.fleeca.multi_roles'] },
      { key: 'robberies.history', label: 'Historique', permissions: ['robberies.history.view'] },
      { key: 'robberies.rankings', label: 'Classements', permissions: ['robberies.stats'] },
      { key: 'robberies.stats', label: 'Stats', permissions: ['robberies.stats'] },
      { key: 'robberies.logs', label: 'Logs', permissions: ['robberies.logs'] }
    ]
  },
  {
    key: 'sale_objects',
    icon: '🧰',
    title: 'VENTE OBJETS',
    description: 'Ventes, reçus et historique.',
    permissions: [
      { key: 'sale_objects.view', label: 'Voir page Vente objets', permissions: ['sale.objects.access', 'money.quick_sale.access'] },
      { key: 'sale_objects.validate', label: 'Valider vente', permissions: ['sale.objects.create', 'money.quick_sale.create'] },
      { key: 'sale_objects.receive', label: 'Marquer reçu', permissions: ['sale.objects.receive'] },
      { key: 'sale_objects.edit', label: 'Modifier vente', permissions: ['sale.objects.edit.own', 'sale.objects.edit.any', 'sale_objects.routing.edit'] },
      { key: 'sale_objects.cancel', label: 'Annuler vente', permissions: ['sale.objects.cancel.own', 'sale.objects.cancel.any'] },
      { key: 'sale_objects.details', label: 'Voir détail', permissions: ['money.quick_sale.details.view'] },
      { key: 'sale_objects.history', label: 'Historique', permissions: ['sale.objects.history.view', 'money.quick_sale.history.view', 'sale_objects.routing.view'] }
    ]
  },
  {
    key: 'logs',
    icon: '📜',
    title: 'LOGS',
    description: 'Logs, webhooks et export.',
    permissions: [
      { key: 'logs.view', label: 'Voir page Logs', permissions: ['logs.access', 'logs.view'] },
      { key: 'logs.webhooks', label: 'Webhooks', permissions: ['logs.webhook.manage', 'logs.webhooks.tablet.view', 'logs.webhooks.tablet.edit'] },
      { key: 'logs.export', label: 'Export', permissions: ['logs.view'] }
    ]
  },
  {
    key: 'admin',
    icon: '⚙️',
    title: 'ADMIN',
    description: 'Configuration sensible.',
    permissions: [
      { key: 'admin.view', label: 'Voir admin', permissions: ['roles.manage'] },
      { key: 'admin.permissions', label: 'Permissions', permissions: ['roles.manage', 'roles.rename'] },
      { key: 'admin.config', label: 'Configuration', permissions: ['roles.manage', 'four.partner.config', 'four.partner.logs'] },
      { key: 'admin.sql', label: 'SQL', permissions: ['roles.manage'] },
      { key: 'admin.webhooks', label: 'Webhooks', permissions: ['logs.webhook.manage', 'logs.webhooks.tablet.edit', 'jobs.tablet.webhook.edit'] }
    ]
  }
];

export const SIMPLE_PERMISSION_BY_KEY = Object.fromEntries(
  SIMPLE_PERMISSION_MODULES.flatMap((module) => module.permissions.map((permission) => [permission.key, permission]))
) as Record<string, SimplePermission>;

export const ALL_SIMPLE_PERMISSION_NAMES = Array.from(
  new Set(SIMPLE_PERMISSION_MODULES.flatMap((module) => module.permissions.flatMap((permission) => permission.permissions)))
);

export const SIMPLE_ROLE_PRESETS: Record<string, string[]> = {
  ADMIN: SIMPLE_PERMISSION_MODULES.flatMap((module) => module.permissions.map((permission) => permission.key)),
  PATRON: SIMPLE_PERMISSION_MODULES.flatMap((module) => module.permissions.map((permission) => permission.key)).filter((key) => key !== 'admin.sql'),
  GESTION: [
    'dashboard.view',
    'dashboard.money',
    'dashboard.transactions',
    'dashboard.items',
    'dashboard.members',
    'dashboard.activity',
    'dashboard.member_ops',
    'dashboard.jobs',
    'dashboard.drugs',
    'dashboard.four',
    'dashboard.robberies',
    'dashboard.sale_objects',
    'dashboard.logs',
    'money.view',
    'money.edit',
    'money.movement',
    'money.history',
    'transactions.view',
    'transactions.validate',
    'transactions.edit',
    'transactions.cancel',
    'transactions.history',
    'items.view',
    'items.create',
    'items.edit',
    'items.delete',
    'items.history',
    'members.view',
    'members.create',
    'members.edit',
    'members.delete',
    'members.roles',
    'members.rename_roles',
    'member_ops.view',
    'member_ops.activities',
    'member_ops.payroll',
    'member_ops.expenses',
    'member_ops.history',
    'member_ops.logs',
    'member_ops.edit',
    'member_ops.validate',
    'member_ops.cancel',
    'activity.view',
    'activity.create',
    'activity.edit',
    'activity.cancel',
    'activity.stats',
    'jobs.view',
    'jobs.tablet',
    'jobs.cigarette',
    'jobs.processor',
    'jobs.stone',
    'jobs.validate',
    'jobs.deposit',
    'jobs.edit',
    'jobs.history',
    'jobs.stats',
    'jobs.logs',
    'drugs.view',
    'drugs.transfo',
    'drugs.sales',
    'drugs.production',
    'drugs.gofast',
    'drugs.validate',
    'drugs.manage',
    'drugs.send',
    'drugs.cancel',
    'drugs.edit',
    'four.view',
    'four.transactions',
    'four.history',
    'four.stats',
    'four.partner',
    'four.messages',
    'four.create',
    'four.validate',
    'four.edit',
    'four.cancel',
    'four.reset',
    'four.logs',
    'robberies.view',
    'robberies.create',
    'robberies.validate',
    'robberies.edit',
    'robberies.cancel',
    'robberies.suggestions',
    'robberies.history',
    'robberies.rankings',
    'robberies.stats',
    'robberies.logs',
    'sale_objects.view',
    'sale_objects.validate',
    'sale_objects.receive',
    'sale_objects.edit',
    'sale_objects.cancel',
    'sale_objects.details',
    'sale_objects.history',
    'logs.view',
    'logs.webhooks',
    'logs.export'
  ],
  MEMBRE: [
    'dashboard.view',
    'dashboard.activity',
    'dashboard.jobs',
    'activity.view',
    'activity.create',
    'jobs.view',
    'jobs.tablet',
    'jobs.cigarette',
    'jobs.processor',
    'jobs.stone',
    'jobs.validate',
    'jobs.history'
  ],
  PARTENAIRE: ['dashboard.view', 'dashboard.items', 'dashboard.four', 'items.view', 'four.view', 'four.partner', 'four.messages']
};

function hasModuleView(module: PermissionModule, selected: Set<string>) {
  if (module.key === 'dashboard') return true;
  return module.permissions.some((permission) => permission.key === `${module.key}.view` && selected.has(permission.key));
}

export function permissionsForSimpleKeys(simpleKeys: string[]) {
  const selected = new Set(simpleKeys);
  return Array.from(
    new Set(
      SIMPLE_PERMISSION_MODULES.flatMap((module) => {
        const allowed = hasModuleView(module, selected);
        return module.permissions.flatMap((permission) => {
          if (!selected.has(permission.key)) return [];
          if (!allowed && permission.key !== `${module.key}.view`) return [];
          return permission.permissions;
        });
      })
    )
  );
}
