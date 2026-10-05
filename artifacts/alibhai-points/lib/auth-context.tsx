import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

export type DemoRole = "customer" | "admin";

type AuthContextValue = {
  role: DemoRole | null;
  status: "signed-in" | "signed-out";
  enterDemo: (role: DemoRole) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<DemoRole | null>(null);

  const enterDemo = useCallback(
    (nextRole: DemoRole) => {
      queryClient.clear();
      setRole(nextRole);
    },
    [queryClient],
  );
  const signOut = useCallback(async () => {
    queryClient.clear();
    setRole(null);
  }, [queryClient]);

  const value = useMemo(
    () => ({
      role,
      status: role ? "signed-in" : "signed-out",
      enterDemo,
      signOut,
    }),
    [role, enterDemo, signOut],
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
