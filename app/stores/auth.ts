import { defineStore } from "pinia";

interface TokenResponse {
  success: boolean;
  message: string;
  payload: {
    access_token: string;
    refresh_token: string;
  };
}

const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 60 минут в секундах (для cookie)
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 дней в секундах (для cookie)
const REFRESH_DELAY = 60 * 60 * 1000; // 60 минут для setInterval

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const refreshInterval = ref<NodeJS.Timeout | null>(null);
  const config = useRuntimeConfig();
  const router = useRouter();

  const setToken = (accessToken: string, refreshToken?: string) => {
    token.value = accessToken;

    if (import.meta.client) {
      const accessCookie = useCookie("access_token", {
        maxAge: ACCESS_TOKEN_MAX_AGE,
        secure: true,
        sameSite: "strict",
      });
      accessCookie.value = accessToken;

      if (refreshToken) {
        const refreshCookie = useCookie("refresh_token", {
          maxAge: REFRESH_TOKEN_MAX_AGE,
          secure: true,
          sameSite: "strict",
        });
        refreshCookie.value = refreshToken;
      }
    }

    startRefreshInterval();
  };

  const clearToken = () => {
    token.value = null;

    if (import.meta.client) {
      const accessCookie = useCookie("access_token");
      const refreshCookie = useCookie("refresh_token");

      accessCookie.value = null;
      refreshCookie.value = null;
    }

    stopRefreshInterval();
  };

  const startRefreshInterval = () => {
    if (!import.meta.client) return;

    stopRefreshInterval();
    refreshInterval.value = setInterval(async () => {
      try {
        await refreshToken();
      } catch (err) {
        console.error("Failed to refresh token:", err);
        await logOut();
      }
    }, REFRESH_DELAY);
  };

  const stopRefreshInterval = () => {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value);
      refreshInterval.value = null;
    }
  };

  const refreshToken = async (): Promise<TokenResponse> => {
    try {
      const refreshTokenCookie = import.meta.client
        ? useCookie("refresh_token").value
        : null;

      if (!refreshTokenCookie) {
        await logOut();
        throw new Error("Refresh token not found");
      }

      const response = await $fetch<TokenResponse>("/auth/refresh", {
        baseURL: config.public.apiBase,
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(refreshTokenCookie
            ? { Authorization: `Bearer ${refreshTokenCookie}` }
            : {}),
        },
      });

      if (response.success) {
        setToken(response.payload.access_token, response.payload.refresh_token);
      }

      return response;
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } } | Error;
      error.value =
        "data" in e && e.data?.message
          ? e.data.message
          : e instanceof Error
            ? e.message
            : "Ошибка обновления токена";
      throw err;
    }
  };

  const logIn = async (credentials: { email: string; password: string }) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<TokenResponse>("/auth/login", {
        baseURL: config.public.apiBase,
        method: "POST",
        body: credentials,
        credentials: "include",
      });

      if (response.success) {
        setToken(response.payload.access_token, response.payload.refresh_token);
      }

      return response;
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } } | Error;
      error.value =
        "data" in e && e.data?.message
          ? e.data.message
          : e instanceof Error
            ? e.message
            : "Ошибка авторизации";
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const logOut = async () => {
    try {
      const currentToken = token.value;
      await $fetch("/auth/logout", {
        baseURL: config.public.apiBase,
        method: "POST",
        credentials: "include",
        headers: currentToken
          ? {
              Authorization: `Bearer ${currentToken}`,
            }
          : {},
      }).catch((err) => {
        console.warn("Server logout failed:", err.message);
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      clearToken();
      if (import.meta.client) {
        await router.push("/login");
      }
    }
  };

  const init = () => {
    if (!import.meta.client) return;

    const savedToken = useCookie("access_token").value;
    if (savedToken) {
      token.value = savedToken;
      startRefreshInterval();
    }
  };

  if (import.meta.client) {
    init();
  }

  const isAuthenticated = computed(() => !!token.value);

  return {
    token,
    isLoading,
    error,
    isAuthenticated,
    logIn,
    logOut,
    refreshToken,
    setToken,
  };
});
