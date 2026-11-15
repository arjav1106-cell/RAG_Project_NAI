import { useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { AuthContext } from "./auth-context";
import type { User } from "./types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (
    email: string,
    password: string,
    createAccount = false,
  ) => {
    const nextUser = createAccount
      ? await api.register(email, password)
      : await api.login(email, password);
    setUser(nextUser);
  };

  const signOut = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
