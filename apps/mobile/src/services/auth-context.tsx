import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

export const ACCESS_TOKEN_KEY = "access_token";

export type DemoRole = "customer" | "admin";
export type AuthStatus = "signed-in" | "signed-out" | "restoring";

type AuthContextValue = {
  role: DemoRole | null;
  status: AuthStatus;
  enterDemo: (role: DemoRole) => void;
  signOut: () => Promise<void>;
  pendingRegistrationToken: string | null;
  setPendingRegistrationToken: (token: string | null) => void;
  signIn: (token: string, userRole?: DemoRole) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<DemoRole | null>(null);
  const [pendingRegistrationToken, setPendingRegistrationToken] = useState<string | null>(null);

  const enterDemo = useCallback(
    (nextRole: DemoRole) => {
      queryClient.clear();
      setRole(nextRole);
    },
    [queryClient],
  );

  const signIn = useCallback(async (token: string, userRole?: DemoRole) => {
    // Mock implementation - in production, this would validate the token
    setRole(userRole || 'customer');
  }, []);

  const signOut = useCallback(async () => {
    queryClient.clear();
    setRole(null);
    setPendingRegistrationToken(null);
  }, [queryClient]);

  const value = useMemo(
    () => ({
      role,
      status: (role ? "signed-in" : "signed-out") as "signed-in" | "signed-out",
      enterDemo,
      signOut,
      pendingRegistrationToken,
      setPendingRegistrationToken,
      signIn,
    }),
    [role, enterDemo, signOut, pendingRegistrationToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}
