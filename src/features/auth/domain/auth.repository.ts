export type SignInInput = {
  username: string;
  password: string;
};

export interface AuthRepository {
  signIn(input: SignInInput): Promise<void>;
  signOut(): Promise<void>;
  hasAdminAccount(): Promise<boolean>;
  bootstrapAdminAccount(): Promise<void>;
}
