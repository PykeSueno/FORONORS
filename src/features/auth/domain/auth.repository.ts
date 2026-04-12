export type SignInInput = {
  username: string;
  password: string;
};

export interface AuthRepository {
  signIn(input: SignInInput): Promise<void>;
  signOut(): Promise<void>;

  /**
   * Vérifie si un premier compte administrateur existe déjà.
   */
  hasAdminAccount(): Promise<boolean>;

  /**
   * Crée le premier compte administrateur (bootstrap).
   */
  bootstrapAdminAccount(): Promise<void>;
}
