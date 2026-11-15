import { createContext, useContext } from "react";
import type { User } from "./types";

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
    createAccount?: boolean,
  ) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
