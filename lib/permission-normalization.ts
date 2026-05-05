const LEGACY_TO_CANONICAL: Record<string, string> = {
  'transactions.cancel.own': 'transactions.edit.own',
  'transactions.manage.own': 'transactions.edit.own',
  'transactions.cancel.any': 'transactions.edit.any',
  'transactions.manage.any': 'transactions.edit.any',

  'transactions.recent.cancel.own': 'transactions.recent.edit.own',
  'transactions.recent.manage.own': 'transactions.recent.edit.own',
  'transactions.recent.cancel.any': 'transactions.recent.edit.any',
  'transactions.recent.manage.any': 'transactions.recent.edit.any',

  'activity.cancel.own': 'activity.edit.own',
  'activity.manage.own': 'activity.edit.own',
  'activity.cancel.any': 'activity.edit.any',
  'activity.manage.any': 'activity.edit.any',

  'four.transaction.cancel.own': 'four.transaction.edit.own',
  'four.transaction.manage.own': 'four.transaction.edit.own',
  'four.transaction.manage': 'four.transaction.edit.own',
  'four.transaction.cancel.any': 'four.transaction.edit.any',
  'four.transaction.manage.any': 'four.transaction.edit.any',

  'money.quick_sale.access': 'sale.objects.access',
  'money.quick_sale.create': 'sale.objects.create',
  'money.quick_sale.details.view': 'sale.objects.history.view',
  'money.quick_sale.logs.view': 'sale.objects.history.view',

  'money.pay.access': 'member_ops.payroll.view',
  'money.pay.create': 'member_ops.payroll.pay',
  'money.pay.history.view': 'member_ops.payroll.logs',
  'money.pay.logs.view': 'member_ops.payroll.logs',
  'payroll.view': 'member_ops.payroll.view',
  'payroll.preview': 'member_ops.payroll.view',
  'payroll.configure': 'member_ops.payroll.adjust',
  'payroll.adjust': 'member_ops.payroll.adjust',
  'payroll.validate': 'member_ops.payroll.pay',
  'payroll.history': 'member_ops.payroll.logs',
  'payroll.logs': 'member_ops.payroll.logs',

  'activity_payroll.view': 'member_ops.view',
  'activity_payroll.global.view': 'member_ops.view',
  'activity_payroll.activities.view': 'member_ops.activities.view',
  'activity_payroll.payroll.view': 'member_ops.payroll.view',
  'activity_payroll.payroll.pay': 'member_ops.payroll.pay',
  'activity_payroll.payroll.adjust': 'member_ops.payroll.adjust',
  'activity_payroll.payroll.exclude': 'member_ops.payroll.exclude',
  'activity_payroll.history.view': 'member_ops.payroll.logs',
  'activity_payroll.logs.view': 'member_ops.payroll.logs',

  'expenses.view': 'member_ops.expenses.view',
  'expenses.create': 'member_ops.expenses.create',
  'expenses.reimburse': 'member_ops.expenses.reimburse',
  'expenses.history.view': 'member_ops.expenses.logs',
  'expenses.logs.view': 'member_ops.expenses.logs',
  'expenses.delete': 'member_ops.expenses.cancel',
  'member_ops.history.view': 'member_ops.payroll.logs',
  'member_ops.logs.view': 'member_ops.payroll.logs'
};

const CANONICAL_TO_ALIASES = Object.entries(LEGACY_TO_CANONICAL).reduce<Record<string, string[]>>((acc, [legacy, canonical]) => {
  if (!acc[canonical]) acc[canonical] = [];
  acc[canonical].push(legacy);
  return acc;
}, {});

export function toCanonicalPermission(permissionName: string) {
  return LEGACY_TO_CANONICAL[permissionName] ?? permissionName;
}

export function expandPermissionAliases(permissionName: string) {
  const canonical = toCanonicalPermission(permissionName);
  const aliases = CANONICAL_TO_ALIASES[canonical] ?? [];
  return Array.from(new Set([canonical, ...aliases]));
}

export function normalizePermissionNames(permissionNames: string[]) {
  return Array.from(new Set(permissionNames.map((permission) => toCanonicalPermission(permission))));
}

export function isCompatibilityPermission(permissionName: string) {
  return toCanonicalPermission(permissionName) !== permissionName;
}
