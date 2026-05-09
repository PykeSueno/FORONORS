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
  'jobs.tablet.webhook.edit': { module: 'Travail', section: 'Technique', label: 'Configurer webhook Tablette Discord', hint: 'Permet d enregistrer et tester le webhook Discord Tablette.' }
};

const PREFIX_MODULES: Array<[string, string]> = [
  ['dashboard.', 'Dashboard'], ['money.', 'Argent'], ['payroll.', 'Argent'], ['expenses.', 'ACTIVITÉS & PAYES & DÉPENSES'], ['sale.objects.', 'Vente objets'], ['sale_objects.', 'Vente objets'], ['items.', 'Items'], ['transactions.recent.', 'Transactions recentes'], ['transactions.', 'Transactions'], ['member_ops.', 'ACTIVITÉS & PAYES & DÉPENSES'], ['activity_payroll.', 'ACTIVITÉS & PAYES & DÉPENSES'], ['activity.', 'Activite'], ['four.', 'FOUR'], ['drugs.', 'Drogues'], ['robberies.', 'Braquage'], ['tablet.', 'Travail'], ['cigarette.', 'Travail'], ['tobacco.processor.', 'Travail'], ['members.', 'Membres'], ['roles.', 'Roles'], ['logs.', 'Logs'], ['account.', 'Compte']
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
