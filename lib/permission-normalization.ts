const LEGACY_TO_CANONICAL: Record<string, string> = {};

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
