export const MODULE_ORDER = ['Dashboard', 'Argent', 'Vente objets', 'Items', 'Transactions', 'Transactions recentes', 'Activite', 'ACTIVITÉS & PAYES & DÉPENSES', 'FOUR', 'Drogues', 'Braquage', 'Travail', 'Membres', 'Roles', 'Logs', 'Compte', 'Autres'] as const;

export const SECTION_ORDER = ['Vue', 'Historique', 'Mouvements', 'Vente objets', 'Creation', 'Passages', 'Modification / Annulation', 'Sessions', 'Transactions', 'Messages', 'Stats', 'Logs', 'Securite', 'Gestion', 'Technique'] as const;

type PermissionInfo = { module: string; section: string; label: string; hint: string };

const EXACT: Record<string, PermissionInfo> = {
  'member_ops.view': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Vue', label: 'Voir le module', hint: 'Rend le module visible.' },
  'member_ops.activities.view': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Vue', label: 'Voir Activités', hint: 'Affiche la page Activités.' },
  'member_ops.activities.logs': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Logs', label: 'Voir logs activités', hint: 'Affiche les logs liés aux activités membres.' },
  'member_ops.payroll.view': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Vue', label: 'Voir Payes', hint: 'Affiche la page Payes.' },
  'member_ops.payroll.pay': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Creation', label: 'Payer un membre', hint: 'Permet de payer un membre.' },
  'member_ops.payroll.adjust': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Gestion', label: 'Ajuster une paye', hint: 'Permet d ajuster une paye.' },
  'member_ops.payroll.report': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Gestion', label: 'Reporter une paye', hint: 'Permet de reporter une paye.' },
  'member_ops.payroll.exclude': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Gestion', label: 'Exclure une paye', hint: 'Permet d exclure un membre de la période.' },
  'member_ops.payroll.logs': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Logs', label: 'Voir logs payes', hint: 'Affiche les logs de payes.' },
  'member_ops.expenses.view': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Vue', label: 'Voir Dépenses', hint: 'Affiche la page Dépenses.' },
  'member_ops.expenses.create': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Creation', label: 'Créer une dépense', hint: 'Permet de créer une dépense en attente.' },
  'member_ops.expenses.edit': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Modification / Annulation', label: 'Modifier une dépense', hint: 'Permet de modifier une dépense en attente.' },
  'member_ops.expenses.reimburse': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Creation', label: 'Rembourser une dépense', hint: 'Permet de rembourser une dépense.' },
  'member_ops.expenses.cancel': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Modification / Annulation', label: 'Annuler une dépense', hint: 'Permet d annuler une dépense en attente.' },
  'member_ops.expenses.logs': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Logs', label: 'Voir logs dépenses', hint: 'Affiche les logs de dépenses.' },
  'member_ops.history.view': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Historique', label: 'Voir historique', hint: 'Compatibilité historique.' },
  'member_ops.logs.view': { module: 'ACTIVITÉS & PAYES & DÉPENSES', section: 'Logs', label: 'Voir logs', hint: 'Compatibilité logs.' },

  'activity_payroll.view': { module: 'Activites & Payes', section: 'Vue', label: 'Voir le module', hint: 'Permet d afficher la bulle et d ouvrir Activites & Payes.' },
  'activity_payroll.global.view': { module: 'Activites & Payes', section: 'Vue', label: 'Voir vue globale', hint: 'Permet d afficher l onglet Vue globale.' },
  'activity_payroll.activities.view': { module: 'Activites & Payes', section: 'Vue', label: 'Voir activites', hint: 'Permet d afficher l onglet Activites.' },
  'activity_payroll.payroll.view': { module: 'Activites & Payes', section: 'Vue', label: 'Voir payes', hint: 'Permet d afficher l onglet Payes.' },
  'activity_payroll.payroll.configure': { module: 'Activites & Payes', section: 'Gestion', label: 'Modifier reglages paye', hint: 'Permet de modifier et sauvegarder les reglages de paye du module.' },
  'activity_payroll.payroll.pay': { module: 'Activites & Payes', section: 'Creation', label: 'Payer un membre', hint: 'Permet de payer un membre depuis Activites & Payes.' },
  'activity_payroll.payroll.adjust': { module: 'Activites & Payes', section: 'Gestion', label: 'Ajuster une paye', hint: 'Permet d ajuster le montant calcule pour un membre.' },
  'activity_payroll.payroll.exclude': { module: 'Activites & Payes', section: 'Gestion', label: 'Exclure un membre', hint: 'Permet d exclure ou reinclure un membre de la paye.' },
  'activity_payroll.history.view': { module: 'Activites & Payes', section: 'Historique', label: 'Voir historique', hint: 'Permet de consulter l historique des payes du module.' },
  'activity_payroll.logs.view': { module: 'Activites & Payes', section: 'Logs', label: 'Voir logs', hint: 'Permet de consulter les logs Activites & Payes.' },

  'expenses.view': { module: 'Dépenses', section: 'Vue', label: 'Voir le module', hint: 'Permet d afficher la bulle et d ouvrir Dépenses.' },
  'expenses.create': { module: 'Dépenses', section: 'Creation', label: 'Ajouter une dépense', hint: 'Permet de créer une dépense en attente pour un membre.' },
  'expenses.edit': { module: 'Dépenses', section: 'Modification / Annulation', label: 'Modifier une dépense', hint: 'Permet de modifier une dépense en attente.' },
  'expenses.reimburse': { module: 'Dépenses', section: 'Creation', label: 'Rembourser une dépense', hint: 'Permet de sortir l argent du groupe et passer une dépense en remboursée.' },
  'expenses.history.view': { module: 'Dépenses', section: 'Historique', label: 'Voir remboursées', hint: 'Permet de consulter les dépenses remboursées.' },
  'expenses.stats.view': { module: 'Dépenses', section: 'Stats', label: 'Voir stats', hint: 'Permet de consulter les statistiques Dépenses.' },
  'expenses.logs.view': { module: 'Dépenses', section: 'Logs', label: 'Voir logs', hint: 'Permet de consulter les logs Dépenses.' },
  'expenses.delete': { module: 'Dépenses', section: 'Modification / Annulation', label: 'Annuler une dépense', hint: 'Permet d annuler une dépense non remboursée.' },

  'dashboard.preview': { module: 'Dashboard', section: 'Vue', label: 'Voir la bulle Dashboard', hint: 'Permet d afficher la bulle Dashboard.' },
  'dashboard.access': { module: 'Dashboard', section: 'Vue', label: 'Acceder au dashboard', hint: 'Permet d ouvrir le dashboard.' },
  'dashboard.view': { module: 'Dashboard', section: 'Vue', label: 'Voir les widgets Dashboard', hint: 'Permet d afficher les widgets du dashboard.' },
  'money.access': { module: 'Argent', section: 'Vue', label: 'Acceder au module Argent', hint: 'Permet d ouvrir la page Argent.' },
  'money.preview': { module: 'Argent', section: 'Vue', label: 'Voir la bulle Argent', hint: 'Permet d afficher la bulle Argent.' },
  'money.pay.access': { module: 'Argent', section: 'Vue', label: 'Voir la page Paye', hint: 'Permet d ouvrir la page Paye existante.' },
  'payroll.view': { module: 'Argent', section: 'Vue', label: 'Voir le module Paye', hint: 'Permet d afficher la page Paye.' },
  'payroll.configure': { module: 'Argent', section: 'Gestion', label: 'Configurer les regles de paye', hint: 'Permet de modifier les regles de la page Paye.' },
  'payroll.adjust': { module: 'Argent', section: 'Gestion', label: 'Ajuster les montants par membre', hint: 'Permet d ajuster les montants proposes.' },
  'payroll.validate': { module: 'Argent', section: 'Creation', label: 'Valider une paye hebdomadaire', hint: 'Permet de valider et figer une paye.' },
  'payroll.history': { module: 'Argent', section: 'Historique', label: 'Voir historique paye', hint: 'Permet de consulter l historique Paye.' },
  'payroll.logs': { module: 'Argent', section: 'Logs', label: 'Voir logs paye', hint: 'Permet de lire les logs Paye.' },
  'members.access': { module: 'Membres', section: 'Vue', label: 'Acceder a Membres', hint: 'Permet d ouvrir le module Membres.' },
  'members.preview': { module: 'Membres', section: 'Vue', label: 'Voir la bulle Membres', hint: 'Permet d afficher la bulle Membres.' },
  'members.view': { module: 'Membres', section: 'Vue', label: 'Voir les membres', hint: 'Permet de consulter les membres.' },
  'roles.manage': { module: 'Roles', section: 'Gestion', label: 'Gerer roles et permissions', hint: 'Permet de gerer les roles et permissions.' },
  'roles.rename': { module: 'Roles', section: 'Gestion', label: 'Renommer un role', hint: 'Permet de modifier le nom d un role existant.' },
  'four.partner.view': { module: 'FOUR', section: 'Vue', label: 'Voir Partenaire', hint: 'Affiche la page Partenaire du module FOUR.' },
  'four.partner.config': { module: 'FOUR', section: 'Gestion', label: 'Configurer cycle partenaire', hint: 'Permet de modifier les trois partenaires et le jour off.' },
  'four.partner.sell': { module: 'FOUR', section: 'Creation', label: 'Valider vente partenaire', hint: 'Permet de retirer kits/disqueuses, ajouter les objets rapportes et gerer le paiement.' },
  'four.partner.history.view': { module: 'FOUR', section: 'Historique', label: 'Voir historique partenaire', hint: 'Affiche les ventes partenaires FOUR.' },
  'four.partner.stats.view': { module: 'FOUR', section: 'Stats', label: 'Voir stats partenaire', hint: 'Affiche les statistiques partenaires FOUR.' },
  'four.partner.logs': { module: 'FOUR', section: 'Logs', label: 'Voir logs partenaire', hint: 'Permet de consulter les logs lies aux ventes partenaires.' },
  'logs.webhooks.tablet.view': { module: 'Logs', section: 'Technique', label: 'Voir webhook Tablette', hint: 'Affiche la configuration du webhook Discord Tablette.' },
  'logs.webhooks.tablet.edit': { module: 'Logs', section: 'Technique', label: 'Configurer webhook Tablette', hint: 'Permet d enregistrer et tester le webhook Discord Tablette.' },
  'robberies.view': { module: 'Braquage', section: 'Vue', label: 'Voir le module Braquage', hint: 'Permet d afficher la page Braquage.' },
  'robberies.create': { module: 'Braquage', section: 'Creation', label: 'Creer un braquage', hint: 'Permet de valider un braquage.' },
  'robberies.fleeca.multi_roles': { module: 'Braquage', section: 'Gestion', label: 'Gerer multi-roles Fleeca', hint: 'Permet de saisir plusieurs roles pour un meme participant Fleeca.' },
  'robberies.fleeca.verify_no_consume': { module: 'Braquage', section: 'Creation', label: 'Verifier Petoire et balles', hint: 'Permet de valider Fleeca en verifiant Petoire et balles sans les consommer.' },
  'robberies.arrested': { module: 'Braquage', section: 'Creation', label: 'Declarer un braquage arrete', hint: 'Permet de valider un braquage arrete.' },
  'robberies.cancel': { module: 'Braquage', section: 'Modification / Annulation', label: 'Annuler un brouillon braquage', hint: 'Permet d annuler la saisie braquage.' },
  'robberies.stats': { module: 'Braquage', section: 'Stats', label: 'Voir les stats braquage', hint: 'Permet de consulter les statistiques Braquage.' },
  'robberies.logs': { module: 'Braquage', section: 'Logs', label: 'Voir les logs braquage', hint: 'Permet de consulter l historique Braquage.' },
  'logs.access': { module: 'Logs', section: 'Vue', label: 'Acceder a Logs', hint: 'Permet d ouvrir la page Logs.' },
  'logs.view': { module: 'Logs', section: 'Logs', label: 'Voir les logs', hint: 'Permet de consulter les logs applicatifs.' },
  'account.password.update': { module: 'Compte', section: 'Securite', label: 'Modifier son mot de passe', hint: 'Permet de modifier son mot de passe.' }
  ,
  'activity.processor.view': { module: 'Activite', section: 'Vue', label: 'Voir activite Processeur', hint: 'Permet de consulter les activites Processeur.' },
  'activity.processor.create': { module: 'Activite', section: 'Creation', label: 'Creer activite Processeur', hint: 'Permet de creer une activite Processeur.' },
  'activity.processor.edit': { module: 'Activite', section: 'Gestion', label: 'Modifier activite Processeur', hint: 'Permet de modifier une activite Processeur.' },
  'activity.processor.cancel': { module: 'Activite', section: 'Modification / Annulation', label: 'Annuler activite Processeur', hint: 'Permet d annuler une activite Processeur.' },
  'tobacco.processor.sale.view': { module: 'Travail', section: 'Vue', label: 'Voir vente Processeur', hint: 'Permet de consulter la vente Processeur.' },
  'tobacco.processor.sale.validate': { module: 'Travail', section: 'Creation', label: 'Valider vente Processeur', hint: 'Permet de valider une vente Processeur.' },
  'tobacco.processor.sale.edit': { module: 'Travail', section: 'Gestion', label: 'Modifier vente Processeur', hint: 'Permet de modifier une vente Processeur.' },
  'tobacco.processor.sale.cancel': { module: 'Travail', section: 'Modification / Annulation', label: 'Annuler vente Processeur', hint: 'Permet d annuler une vente Processeur.' },
  'jobs.tablet.webhook.view': { module: 'Travail', section: 'Technique', label: 'Voir webhook Tablette Discord', hint: 'Affiche le statut du webhook Discord Tablette.' },
  'jobs.tablet.webhook.edit': { module: 'Travail', section: 'Technique', label: 'Configurer webhook Tablette Discord', hint: 'Permet d enregistrer et tester le webhook Discord Tablette.' },
  'jobs.stone.view': { module: 'Travail', section: 'Vue', label: 'Voir Jobs Pierre', hint: 'Affiche la page Pierre.' },
  'jobs.stone.sell': { module: 'Travail', section: 'Creation', label: 'Vendre Saphir Brut', hint: 'Permet de valider une vente Pierre.' },
  'jobs.stone.history.view': { module: 'Travail', section: 'Historique', label: 'Historique Pierre', hint: 'Permet de consulter les ventes Pierre.' },
  'jobs.stone.stats.view': { module: 'Travail', section: 'Stats', label: 'Stats Pierre', hint: 'Permet de consulter les statistiques Pierre.' },
  'jobs.stone.logs': { module: 'Travail', section: 'Logs', label: 'Logs Pierre', hint: 'Permet de consulter les logs Pierre.' }
};

const PREFIX_MODULES: Array<[string, string]> = [
  ['dashboard.', 'Dashboard'], ['money.', 'Argent'], ['payroll.', 'Argent'], ['expenses.', 'ACTIVITÉS & PAYES & DÉPENSES'], ['sale.objects.', 'Vente objets'], ['sale_objects.', 'Vente objets'], ['items.', 'Items'], ['transactions.recent.', 'Transactions recentes'], ['transactions.', 'Transactions'], ['member_ops.', 'ACTIVITÉS & PAYES & DÉPENSES'], ['activity_payroll.', 'ACTIVITÉS & PAYES & DÉPENSES'], ['activity.', 'Activite'], ['four.', 'FOUR'], ['drugs.', 'Drogues'], ['robberies.', 'Braquage'], ['tablet.', 'Travail'], ['cigarette.', 'Travail'], ['tobacco.processor.', 'Travail'], ['jobs.stone.', 'Travail'], ['members.', 'Membres'], ['roles.', 'Roles'], ['logs.', 'Logs'], ['account.', 'Compte']
];

function humanize(name: string) {
  return name.split('.').map((part) => part.replace(/_/g, ' ')).join(' · ');
}

function inferSection(name: string) {
  if (name.includes('history')) return 'Historique';
  if (name.includes('logs')) return 'Logs';
  if (name.includes('stats') || name.includes('preview')) return 'Stats';
  if (name.includes('create') || name.includes('pay') || name.includes('validate')) return 'Creation';
  if (name.includes('edit') || name.includes('delete') || name.includes('cancel') || name.includes('adjust') || name.includes('exclude') || name.includes('configure') || name.includes('manage')) return 'Gestion';
  if (name.includes('password') || name.includes('credentials')) return 'Securite';
  if (name.includes('movement')) return 'Mouvements';
  return 'Vue';
}

export const PERMISSION_LABELS: Record<string, PermissionInfo> = EXACT;

export function describePermission(permissionName: string): PermissionInfo {
  const canonical = permissionName.trim();
  if (EXACT[canonical]) return EXACT[canonical];
  const moduleName = PREFIX_MODULES.find(([prefix]) => canonical.startsWith(prefix))?.[1] ?? 'Autres';
  return { module: moduleName, section: inferSection(canonical), label: humanize(canonical), hint: `Permission ${humanize(canonical)}.` };
}

export function permissionOrder(permissionName: string) {
  const info = describePermission(permissionName);
  const sectionIdx = SECTION_ORDER.indexOf(info.section as (typeof SECTION_ORDER)[number]);
  return sectionIdx === -1 ? 999 : sectionIdx;
}

export type PermissionModuleKey =
  | 'dashboard'
  | 'stock'
  | 'money'
  | 'activity'
  | 'member_ops'
  | 'jobs'
  | 'four'
  | 'robberies'
  | 'members'
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
    description: 'Accueil, bulles et widgets.',
    permissions: [
      { key: 'dashboard.view', label: 'Voir', permissions: ['dashboard.access', 'dashboard.preview', 'dashboard.view'] }
    ]
  },
  {
    key: 'stock',
    icon: '📦',
    title: 'STOCK',
    description: 'Items, stock et mouvements.',
    permissions: [
      { key: 'stock.view', label: 'Voir', partnerSafe: true, permissions: ['items.access', 'items.preview', 'dashboard.stock.movements.preview', 'dashboard.stock.movements.access'] },
      { key: 'stock.create', label: 'CrÃ©er', permissions: ['items.create'] },
      { key: 'stock.edit', label: 'Modifier', permissions: ['items.edit'] },
      { key: 'stock.delete', label: 'Supprimer', permissions: ['items.delete'] },
      { key: 'stock.history', label: 'Historique', permissions: ['items.movements.view'] },
      { key: 'stock.transactions', label: 'Transactions', permissions: ['transactions.access', 'transactions.create', 'transactions.edit.own', 'transactions.edit.any', 'transactions.cancel.own', 'transactions.cancel.any', 'transactions.manage.own', 'transactions.manage.any', 'transactions.preview', 'transactions.recent.access', 'transactions.recent.edit.own', 'transactions.recent.edit.any', 'transactions.recent.cancel.own', 'transactions.recent.cancel.any', 'transactions.recent.manage.own', 'transactions.recent.manage.any', 'transactions.recent.preview'] },
      { key: 'stock.sales', label: 'Vente objets', permissions: ['sale.objects.preview', 'sale.objects.access', 'sale.objects.create', 'sale.objects.receive', 'sale.objects.edit.own', 'sale.objects.edit.any', 'sale.objects.cancel.own', 'sale.objects.cancel.any', 'sale.objects.history.view', 'sale_objects.routing.view', 'sale_objects.routing.edit', 'money.quick_sale.access', 'money.quick_sale.preview', 'money.quick_sale.create', 'money.quick_sale.history.view', 'money.quick_sale.details.view'] },
      { key: 'stock.logs', label: 'Logs', permissions: ['money.quick_sale.logs.view'] }
    ]
  },
  {
    key: 'money',
    icon: '💰',
    title: 'ARGENT',
    description: 'Caisse groupe et mouvements.',
    permissions: [
      { key: 'money.view', label: 'Voir', permissions: ['money.access', 'money.preview', 'dashboard.money.movements.preview', 'dashboard.money.movements.access'] },
      { key: 'money.edit', label: 'Modifier', permissions: ['money.edit'] },
      { key: 'money.movement', label: 'Ajouter mouvement', permissions: ['money.movement.create'] },
      { key: 'money.history', label: 'Historique', permissions: ['money.history.view', 'money.movements.view'] },
      { key: 'money.logs', label: 'Logs', permissions: ['money.logs.view'] }
    ]
  },
  {
    key: 'activity',
    icon: '🎯',
    title: 'ACTIVITÉ',
    description: 'Activités, création et statistiques.',
    permissions: [
      { key: 'activity.view', label: 'Voir', partnerSafe: true, permissions: ['activity.access', 'activity.view', 'activity.preview', 'activity.processor.view', 'drugs.access', 'drugs.preview', 'drugs.transfo.view', 'drugs.sales.view', 'drugs.sales.preview', 'drugs.production.access', 'drugs.gofast.view'] },
      { key: 'activity.create', label: 'Créer activité', permissions: ['activity.create', 'activity.processor.create', 'drugs.transfo.create', 'drugs.transfo.receive.validate', 'drugs.sales.create', 'drugs.production.create', 'drugs.production.coke.create', 'drugs.production.meth.create', 'drugs.gofast.create'] },
      { key: 'activity.edit', label: 'Modifier', permissions: ['activity.edit.own', 'activity.edit.any', 'activity.manage.own', 'activity.manage.any', 'activity.processor.edit', 'drugs.transfo.edit', 'drugs.transfo.edit.own', 'drugs.transfo.edit.any', 'drugs.sales.edit', 'drugs.sales.edit.own', 'drugs.sales.edit.any', 'drugs.production.edit', 'drugs.production.edit.own', 'drugs.production.edit.any'] },
      { key: 'activity.delete', label: 'Supprimer', permissions: ['activity.cancel.own', 'activity.cancel.any', 'activity.processor.cancel', 'drugs.transfo.cancel', 'drugs.transfo.cancel.own', 'drugs.transfo.cancel.any', 'drugs.sales.cancel', 'drugs.sales.cancel.own', 'drugs.sales.cancel.any', 'drugs.production.cancel', 'drugs.production.cancel.own', 'drugs.production.cancel.any', 'drugs.gofast.cancel'] },
      { key: 'activity.history', label: 'Historique', permissions: ['drugs.production.history', 'drugs.production.history.view'] },
      { key: 'activity.stats', label: 'Stats', permissions: ['activity.stats.view', 'drugs.stats.view', 'drugs.transfo.stats.view', 'drugs.sales.stats.view', 'drugs.gofast.stats', 'drugs.gofast.stats.view'] },
      { key: 'activity.logs', label: 'Logs', permissions: ['activity.logs.view', 'drugs.logs.view', 'drugs.transfo.logs.view', 'drugs.sales.logs.view', 'drugs.gofast.logs', 'drugs.gofast.logs.view', 'drugs.gofast.arrested'] }
    ]
  },
  {
    key: 'member_ops',
    icon: '💸',
    title: 'ACTIVITÉS & PAYES & DÉPENSES',
    description: 'Payes, dépenses et logs opérationnels.',
    permissions: [
      { key: 'member_ops.view', label: 'Voir', permissions: ['member_ops.view', 'member_ops.activities.view', 'member_ops.payroll.view', 'member_ops.expenses.view', 'activity_payroll.view', 'activity_payroll.global.view', 'activity_payroll.activities.view', 'activity_payroll.payroll.view', 'expenses.view', 'money.pay.access', 'payroll.view', 'payroll.preview'] },
      { key: 'member_ops.activities', label: 'Gérer activités', permissions: ['member_ops.activities.view', 'activity_payroll.activities.view'] },
      { key: 'member_ops.payroll', label: 'Gérer payes', permissions: ['member_ops.payroll.pay', 'member_ops.payroll.adjust', 'member_ops.payroll.report', 'member_ops.payroll.exclude', 'activity_payroll.payroll.configure', 'activity_payroll.payroll.pay', 'activity_payroll.payroll.adjust', 'activity_payroll.payroll.exclude', 'money.pay.create', 'money.pay.history', 'money.pay.history.view', 'money.pay.logs', 'money.pay.logs.view', 'payroll.configure', 'payroll.adjust', 'payroll.validate'] },
      { key: 'member_ops.expenses', label: 'Gérer dépenses', permissions: ['member_ops.expenses.create', 'member_ops.expenses.edit', 'member_ops.expenses.reimburse', 'member_ops.expenses.cancel', 'expenses.create', 'expenses.edit', 'expenses.reimburse', 'expenses.delete', 'expenses.stats.view'] },
      { key: 'member_ops.edit', label: 'Modifier', permissions: ['member_ops.payroll.adjust', 'member_ops.expenses.edit', 'activity_payroll.payroll.configure', 'activity_payroll.payroll.adjust', 'expenses.edit', 'payroll.adjust'] },
      { key: 'member_ops.delete', label: 'Supprimer', permissions: ['member_ops.payroll.exclude', 'member_ops.expenses.cancel', 'activity_payroll.payroll.exclude', 'expenses.delete'] },
      { key: 'member_ops.history', label: 'Historique', permissions: ['member_ops.history.view', 'activity_payroll.history.view', 'expenses.history.view', 'payroll.history'] },
      { key: 'member_ops.logs', label: 'Logs', permissions: ['member_ops.activities.logs', 'member_ops.payroll.logs', 'member_ops.expenses.logs', 'member_ops.logs.view', 'activity_payroll.logs.view', 'expenses.logs.view', 'payroll.logs'] }
    ]
  },
  {
    key: 'jobs',
    icon: '🚬',
    title: 'JOBS',
    description: 'Tablette, cigarette, processeur et pierre.',
    permissions: [
      { key: 'jobs.view', label: 'Voir', partnerSafe: true, permissions: ['tablet.access', 'tablet.preview', 'cigarette.access', 'cigarette.preview', 'tobacco.processor.view', 'tobacco.processor.sale.view', 'jobs.stone.view'] },
      { key: 'jobs.tablet', label: 'Tablette', permissions: ['tablet.passage.create', 'jobs.tablet.webhook.view'] },
      { key: 'jobs.cigarette', label: 'Cigarette', permissions: ['cigarette.passage.create', 'cigarette.passage.create.any'] },
      { key: 'jobs.processor', label: 'Processeur', permissions: ['tobacco.processor.create', 'tobacco.processor.production', 'tobacco.processor.sale', 'tobacco.processor.sale.validate'] },
      { key: 'jobs.stone', label: 'Pierre', permissions: ['jobs.stone.view', 'jobs.stone.sell'] },
      { key: 'jobs.edit', label: 'Modifier', permissions: ['tablet.daily.manage', 'jobs.tablet.webhook.edit', 'cigarette.daily.manage', 'cigarette.edit.own', 'cigarette.edit.any', 'tobacco.processor.sale.edit', 'tobacco.processor.sale.cancel'] },
      { key: 'jobs.history', label: 'Historique', partnerSafe: true, permissions: ['jobs.history.view', 'tablet.history.view', 'cigarette.history.view', 'tobacco.processor.sale.view', 'jobs.stone.history.view'] },
      { key: 'jobs.stats', label: 'Stats', permissions: ['tablet.stats.view', 'cigarette.stats.view', 'tobacco.processor.stats', 'jobs.stone.stats.view'] },
      { key: 'jobs.logs', label: 'Logs', permissions: ['tablet.logs.view', 'cigarette.logs.view', 'tobacco.processor.logs', 'jobs.stone.logs'] }
    ]
  },
  {
    key: 'four',
    icon: '🔥',
    title: 'FOUR',
    description: 'Transactions, partenaire, messages et stats.',
    permissions: [
      { key: 'four.view', label: 'Voir', partnerSafe: true, permissions: ['four.access', 'four.preview'] },
      { key: 'four.transactions', label: 'Transactions', permissions: ['four.transaction.validate'] },
      { key: 'four.partner', label: 'Partenaire', partnerSafe: true, permissions: ['four.partner.view', 'four.partner.sell', 'four.partner.history.view', 'four.partner.stats.view'] },
      { key: 'four.messages', label: 'Messages', partnerSafe: true, permissions: ['four.messages.view'] },
      { key: 'four.edit', label: 'Modifier', permissions: ['four.transaction.edit.own', 'four.transaction.edit.any', 'four.transaction.cancel.own', 'four.transaction.cancel.any', 'four.transaction.manage', 'four.transaction.manage.own', 'four.transaction.manage.any', 'four.transaction.recent.edit.own', 'four.transaction.recent.edit.any', 'four.partner.config', 'four.messages.manage'] },
      { key: 'four.history', label: 'Historique', permissions: ['four.history.view'] },
      { key: 'four.stats', label: 'Stats', permissions: ['four.stats.view'] },
      { key: 'four.logs', label: 'Logs', permissions: ['four.logs.view', 'four.partner.logs'] }
    ]
  },
  {
    key: 'robberies',
    icon: '🔫',
    title: 'BRAQUAGE',
    description: 'Braquages, historiques, stats et logs.',
    permissions: [
      { key: 'robberies.view', label: 'Voir', permissions: ['robberies.view'] },
      { key: 'robberies.create', label: 'Créer braquage', permissions: ['robberies.create', 'robberies.arrested', 'robberies.fleeca.multi_roles', 'robberies.fleeca.verify_no_consume'] },
      { key: 'robberies.edit', label: 'Modifier', permissions: ['robberies.edit'] },
      { key: 'robberies.delete', label: 'Supprimer', permissions: ['robberies.cancel'] },
      { key: 'robberies.history', label: 'Historique', permissions: ['robberies.history.view'] },
      { key: 'robberies.stats', label: 'Stats', permissions: ['robberies.stats'] },
      { key: 'robberies.logs', label: 'Logs', permissions: ['robberies.logs'] }
    ]
  },
  {
    key: 'members',
    icon: '👥',
    title: 'MEMBRES',
    description: 'Membres, grades et identifiants.',
    permissions: [
      { key: 'members.view', label: 'Voir', permissions: ['members.access', 'members.view', 'members.preview', 'members.activities.view'] },
      { key: 'members.create', label: 'Creer', permissions: ['members.create'] },
      { key: 'members.edit', label: 'Modifier', permissions: ['members.edit', 'members.password.view', 'members.password.copy', 'members.password.edit', 'members.credentials.copy', 'account.password.update'] },
      { key: 'members.delete', label: 'Supprimer', permissions: ['members.delete'] },
      { key: 'members.grades', label: 'Grades', permissions: ['roles.rename'] }
    ]
  },
  {
    key: 'logs',
    icon: '📜',
    title: 'LOGS',
    description: 'Logs, webhooks et export.',
    permissions: [
      { key: 'logs.view', label: 'Voir', permissions: ['logs.access', 'logs.preview', 'logs.view'] },
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
      { key: 'admin.permissions', label: 'Permissions', permissions: ['roles.manage', 'roles.rename'] },
      { key: 'admin.config', label: 'Configuration', permissions: ['roles.manage', 'four.partner.config', 'four.partner.logs'] },
      { key: 'admin.sql', label: 'SQL', permissions: ['admin.sql.access'] },
      { key: 'admin.webhooks', label: 'Webhooks', permissions: ['logs.webhook.manage', 'logs.webhooks.tablet.edit', 'jobs.tablet.webhook.edit'] }
    ]
  }
];

export const SIMPLE_PERMISSION_BY_KEY = Object.fromEntries(
  SIMPLE_PERMISSION_MODULES.flatMap((module) => module.permissions.map((permission) => [permission.key, permission]))
) as Record<string, SimplePermission>;

export const SIMPLE_ROLE_PRESETS: Record<string, string[]> = {
  ADMIN: SIMPLE_PERMISSION_MODULES.flatMap((module) => module.permissions.map((permission) => permission.key)),
  PATRON: SIMPLE_PERMISSION_MODULES.flatMap((module) => module.permissions.map((permission) => permission.key)).filter((key) => key !== 'admin.sql'),
  GESTION: [
    'dashboard.view',
    'stock.view',
    'stock.create',
    'stock.edit',
    'stock.delete',
    'stock.history',
    'stock.transactions',
    'stock.sales',
    'stock.logs',
    'money.view',
    'money.edit',
    'money.movement',
    'money.history',
    'money.logs',
    'activity.view',
    'activity.create',
    'activity.edit',
    'activity.delete',
    'activity.history',
    'activity.stats',
    'activity.logs',
    'member_ops.view',
    'member_ops.activities',
    'member_ops.payroll',
    'member_ops.expenses',
    'member_ops.edit',
    'member_ops.delete',
    'member_ops.history',
    'member_ops.logs',
    'jobs.view',
    'jobs.tablet',
    'jobs.cigarette',
    'jobs.processor',
    'jobs.stone',
    'jobs.edit',
    'jobs.history',
    'jobs.stats',
    'jobs.logs',
    'four.view',
    'four.transactions',
    'four.partner',
    'four.messages',
    'four.edit',
    'four.history',
    'four.stats',
    'four.logs',
    'robberies.view',
    'robberies.create',
    'robberies.edit',
    'robberies.delete',
    'robberies.stats',
    'robberies.logs',
    'members.view',
    'members.create',
    'members.edit',
    'members.delete',
    'members.grades',
    'logs.view'
  ],
  MEMBRE: [
    'dashboard.view',
    'stock.view',
    'activity.view',
    'activity.create',
    'jobs.view',
    'jobs.tablet',
    'jobs.cigarette',
    'jobs.processor',
    'jobs.stone',
    'jobs.history',
    'four.view',
    'four.partner'
  ],
  PARTENAIRE: ['stock.view', 'four.view', 'four.partner', 'four.messages']
};

export function permissionsForSimpleKeys(simpleKeys: string[]) {
  return Array.from(
    new Set(
      simpleKeys.flatMap((key) => SIMPLE_PERMISSION_BY_KEY[key]?.permissions ?? [])
    )
  );
}

export const ALL_SIMPLE_PERMISSION_NAMES = permissionsForSimpleKeys(
  SIMPLE_PERMISSION_MODULES.flatMap((module) => module.permissions.map((permission) => permission.key))
);
