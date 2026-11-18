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

  token:
    "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJST0xFX0FETUlOIl0sInN1YiI6ImNyYW1pcmV6QGhtYnJhbmR0LmNvbSIsImlhdCI6MTc5NTAyMjYyOSwiZXhwIjoxNzk1MDIzNTI5fQ.hNsvxoNMumNC_KN8w0LpMDNJP7ZoxIPQGAPnWHQzobs",
  refreshToken:
    "19278119-c02b-4693-a2a9-fcce8e8ff541.1d55481a-f5bc-4a49-b0a2-56e54065cd13",
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
    set({
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      user: null,
    });
  },
  setUser: (user) => set({ user }),
  clearAuth: () => set({ user: null, isAuthenticated: false }),
}));
