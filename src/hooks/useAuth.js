"use client";
import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

const AuthContext = createContext(null);

// Helper function to decode JWT (without verification)
function decodeJWT(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      // Call server logout to clear cookie
      await axios.post("/api/auth/logout");
    } catch {
      // Ignore errors, just clear local state
    } finally {
      setUser(null);
      // Dispatch custom event for cross-tab sync
      window.dispatchEvent(
        new CustomEvent("auth-change", { detail: "logout" }),
      );
      // Redirect to login
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    // Enable credentials for cookie-based authentication
    axios.defaults.withCredentials = true;

    // Check token expiry if token exists in localStorage (for backwards compatibility)
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = decodeJWT(token);
      if (decoded && decoded.exp < Date.now() / 1000) {
        // Token expired, clear storage
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }

    // Axios response interceptor for 401 errors
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Don't auto-logout on public routes (login, register)
          const publicRoutes = ["/login", "/register"];
          if (!publicRoutes.includes(window.location.pathname)) {
            logout();
          }
        }
        return Promise.reject(error);
      },
    );

    // Call /api/auth/me directly - cookie will be sent automatically
    axios
      .get("/api/auth/me")
      .then((res) => setUser(res.data.user))
      .catch((err) => {
        // 401 means not logged in, which is expected
        if (err.response?.status === 401) {
          setUser(null);
        }
      })
      .finally(() => setLoading(false));

    // Custom event listener for cross-tab sync (for httpOnly cookie approach)
    const handleAuthChange = (e) => {
      if (e.detail === "logout") {
        setUser(null);
      } else if (e.detail === "login" && e.detail.userData) {
        setUser(e.detail.userData);
      }
    };
    window.addEventListener("auth-change", handleAuthChange);

    // Storage event listener for localStorage sync (for backwards compatibility)
    const handleStorageChange = (e) => {
      if (e.key === "token" && !e.newValue) {
        setUser(null);
      }
      if (e.key === "user" && e.newValue) {
        try {
          setUser(JSON.parse(e.newValue));
        } catch {
          setUser(null);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      axios.interceptors.response.eject(interceptor);
      window.removeEventListener("auth-change", handleAuthChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [logout]);

  const login = (token, userData) => {
    // Cookie is set by server, just update local state
    setUser(userData);
    // Dispatch custom event for cross-tab sync
    window.dispatchEvent(
      new CustomEvent("auth-change", { detail: "login", userData }),
    );
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ต้องใช้ภายใน AuthProvider");
  return ctx;
}
