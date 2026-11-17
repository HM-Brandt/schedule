import { create } from "zustand";
import type { AuthUser } from "../types";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (token: string, refreshToken: string) => void;
  logout: () => void;
  setUser: (user: AuthUser | null) => void;
  clearAuth: () => void;
}

const storedToken = localStorage.getItem("auth_token");
const storedRefreshToken = localStorage.getItem("refresh_token");

export const useAuthStore = create<AuthState>((set) => ({
  // token: storedToken,
  // refreshToken: storedRefreshToken,
  // isAuthenticated: !!storedToken,

  token: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJST0xFX0FETUlOIl0sInN1YiI6ImNyYW1pcmV6QGhtYnJhbmR0LmNvbSIsImlhdCI6MTc5NDk1MTYwNywiZXhwIjoxNzk0OTUyNTA3fQ.PQgofFPZTHyrOj2XarMayOLuxH_JuSTxR07PppJ9bTQ",
  refreshToken: "2f84a22e-f0b6-43b2-9aea-3fa86c05bde6.bffc937e-7a49-4bca-9bfa-29b2b57daf41",
  isAuthenticated: true,

  user: null,
  login: (token: string, refreshToken: string) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("refresh_token", refreshToken);
    set({ token, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    set({ token: null, refreshToken: null, isAuthenticated: false, user: null });
  },
  setUser: (user) => set({ user }),
  clearAuth: () => set({ user: null, isAuthenticated: false }),
}));
