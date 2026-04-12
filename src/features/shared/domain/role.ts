export const APP_ROLES = ['admin', 'manager', 'member'] as const;

export type AppRole = (typeof APP_ROLES)[number];
