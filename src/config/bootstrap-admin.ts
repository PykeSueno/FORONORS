/**
 * Configuration du premier compte admin à injecter au bootstrap.
 *
 * Utilisée uniquement côté serveur.
 */
export type BootstrapAdminConfig = {
  username: string;
  password: string;
  role: 'super_admin';
  isActive: true;
};

export function getBootstrapAdminConfig(): BootstrapAdminConfig {
  return {
    username: process.env.BOOTSTRAP_ADMIN_USERNAME ?? 'pyke',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'santa',
    role: 'super_admin',
    isActive: true,
  };
}
