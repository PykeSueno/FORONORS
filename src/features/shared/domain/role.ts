export const APP_ROLES = ['super_admin', 'admin', 'member'] as const;

export type AppRole = (typeof APP_ROLES)[number];
