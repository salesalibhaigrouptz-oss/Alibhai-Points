import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchMe,
  getStoredToken,
  setStoredToken,
  setOnUnauthorizedCallback,
} from "./api";

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
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [pendingRegistrationToken, setPendingRegistrationToken] = useState<
    string | null
  >(null);

  // Restore session on app launch
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const token = await getStoredToken();

        if (!token) {
          if (isMounted) {
            setRole(null);
            setStatus("signed-out");
          }
          return;
        }

        try {
          const me = await fetchMe(token);
          if (!isMounted) return;

          if (me.registered === false) {
            setPendingRegistrationToken(token);
            setRole(null);
            setStatus("signed-out");
            return;
          }

          setRole(me.role || "customer");
          setStatus("signed-in");
        } catch {
          await setStoredToken(null);
          if (isMounted) {
            setRole(null);
            setStatus("signed-out");
          }
        }
      } catch {
        if (isMounted) {
          setRole(null);
          setStatus("signed-out");
        }
      }
    }

    restoreSession();

    // Register 401 callback from Axios interceptor
    setOnUnauthorizedCallback(() => {
      if (isMounted) {
        queryClient.clear();
        setRole(null);
        setStatus("signed-out");
        setPendingRegistrationToken(null);
      }
    });

    return () => {
      isMounted = false;
      setOnUnauthorizedCallback(null);
    };
  }, [queryClient]);

  const signIn = useCallback(
    async (token: string, userRole?: DemoRole) => {
      await setStoredToken(token);
      setRole(userRole || "customer");
      setStatus("signed-in");
      setPendingRegistrationToken(null);
    },
    []
  );

  const signOut = useCallback(async () => {
    await setStoredToken(null);
    queryClient.clear();
    setRole(null);
    setStatus("signed-out");
    setPendingRegistrationToken(null);
  }, [queryClient]);

  const enterDemo = useCallback(
    (nextRole: DemoRole) => {
      queryClient.clear();
      setRole(nextRole);
      setStatus("signed-in");
    },
    [queryClient]
  );

  const value = useMemo(
    () => ({
      role,
      status,
      enterDemo,
      signOut,
      pendingRegistrationToken,
      setPendingRegistrationToken,
      signIn,
    }),
    [role, status, enterDemo, signOut, pendingRegistrationToken, signIn]
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
