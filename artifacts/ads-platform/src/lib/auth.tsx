import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  logout: () => {},
});

const TOKEN_KEY = "adshub_token";

// Register the token getter immediately (covers app boot before AuthProvider mounts).
setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(
    localStorage.getItem(TOKEN_KEY),
  );
  const [, setLocation] = useLocation();

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(newToken);
  };

  const logout = () => {
    setToken(null);
    setLocation("/login");
  };

  useEffect(() => {
    const path = window.location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ""), "");
    if (!token && path !== "/login" && !path.endsWith("/login")) {
      setLocation("/login");
    }
  }, [token, setLocation]);

  return (
    <AuthContext.Provider value={{ token, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
