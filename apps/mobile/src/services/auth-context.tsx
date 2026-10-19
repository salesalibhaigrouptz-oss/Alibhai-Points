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
  setOnPinChangeRequiredCallback,
  type UserProfile,
} from "./api";
import { supabase } from "./supabase";

export const ACCESS_TOKEN_KEY = "access_token";

export type AppRole = "customer" | "admin";
export type AuthStatus = "signed-in" | "signed-out" | "restoring";

type AuthContextValue = {
  role: AppRole | null;
  phone: string | null;
  mustChangePin: boolean;
  pinChangeSuccess: boolean;
  showPinChangeSuccess: () => void;
  status: AuthStatus;
  signOut: () => Promise<void>;
  pendingRegistrationToken: string | null;
  setPendingRegistrationToken: (token: string | null) => void;
  signIn: (token: string, userRole?: AppRole) => Promise<UserProfile>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<AppRole | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [mustChangePin, setMustChangePin] = useState(false);
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);
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
            setPhone(null);
            setMustChangePin(false);
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
            setPhone(null);
            setMustChangePin(false);
            setStatus("signed-out");
            return;
          }

          setRole(me.role || "customer");
          setPhone(me.profile?.phone || me.phone || null);
          setMustChangePin(me.must_change_pin);
          setStatus("signed-in");
        } catch {
          await setStoredToken(null);
          if (isMounted) {
            setRole(null);
            setPhone(null);
            setMustChangePin(false);
            setStatus("signed-out");
          }
        }
      } catch {
        if (isMounted) {
          setRole(null);
          setPhone(null);
          setMustChangePin(false);
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
        setPhone(null);
        setMustChangePin(false);
      }
    });
    setOnPinChangeRequiredCallback(() => {
      if (isMounted) setMustChangePin(true);
    });

    return () => {
      isMounted = false;
      setOnUnauthorizedCallback(null);
      setOnPinChangeRequiredCallback(null);
    };
  }, [queryClient]);

  const signIn = useCallback(
    async (token: string, userRole?: AppRole) => {
      await setStoredToken(token);
      const me = await fetchMe(token);
      if (me.registered === false) {
        setPendingRegistrationToken(token);
        setRole(null);
        setPhone(me.phone || null);
        setMustChangePin(false);
        setStatus("signed-out");
        return me;
      }
      setRole(me.role || userRole || "customer");
      setPhone(me.profile?.phone || me.phone || null);
      setMustChangePin(me.must_change_pin);
      setStatus("signed-in");
      setPendingRegistrationToken(null);
      return me;
    },
    []
  );

  const signOut = useCallback(async () => {
    await setStoredToken(null);
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    setRole(null);
    setPhone(null);
    setMustChangePin(false);
    setPinChangeSuccess(false);
    setStatus("signed-out");
    setPendingRegistrationToken(null);
    if (error) throw error;
  }, [queryClient]);

  const showPinChangeSuccess = useCallback(() => {
    setPinChangeSuccess(true);
    setTimeout(() => setPinChangeSuccess(false), 3000);
  }, []);

  const value = useMemo(
    () => ({
      role,
      phone,
      mustChangePin,
      pinChangeSuccess,
      showPinChangeSuccess,
      status,
      signOut,
      pendingRegistrationToken,
      setPendingRegistrationToken,
      signIn,
    }),
    [
      role,
      phone,
      mustChangePin,
      pinChangeSuccess,
      showPinChangeSuccess,
      status,
      signOut,
      pendingRegistrationToken,
      signIn,
    ]
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
