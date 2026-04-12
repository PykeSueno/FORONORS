/**
 * Configuration du premier compte admin.
 *
 * Les valeurs sont prévues pour être lues côté serveur uniquement,
 * et utilisées lors d'une phase de bootstrap contrôlée.
 */
export type BootstrapAdminConfig = {
  email: string;
  temporaryPassword: string;
  fullName: string;
};

export function getBootstrapAdminConfig(): BootstrapAdminConfig {
  return {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? '',
    temporaryPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '',
    fullName: process.env.BOOTSTRAP_ADMIN_FULL_NAME ?? 'Admin FORONORS',
  };
}
