import { defineStore } from "pinia";
import { useCookie } from "#app";

interface TokenResponse {
  success: boolean;
  message: string;
  payload: {
    access_token: string;
    refresh_token: string;
  };
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const refreshInterval = ref<NodeJS.Timeout | null>(null);
  const config = useRuntimeConfig();

  const refreshDelay = 13 * 60 * 1000; // 13 минут
  const accessMaxAge = 15 * 60; // 15 минут

  const router = useRouter();
  const authStore = useAuthStore();

  // Сохраняем токен и настраиваем таймер обновления
  const setToken = (accessToken: string, refreshToken?: string) => {
    token.value = accessToken;
    const accessCookie = useCookie("access_token", {
      maxAge: accessMaxAge,
      secure: true,
      sameSite: "strict",
    });
    accessCookie.value = accessToken;

    if (refreshToken) {
      const refreshCookie = useCookie("refresh_token", {
        maxAge: 60 * 60 * 24 * 30, // 30 дней
        secure: true,
        sameSite: "strict",
      });
      refreshCookie.value = refreshToken;
    }

    startRefreshInterval();
  };

  const clearToken = () => {
    token.value = null;

    const accessCookie = useCookie("access_token");
    const refreshCookie = useCookie("refresh_token");

    accessCookie.value = null;
    refreshCookie.value = null;

    stopRefreshInterval();
  };

  // Интервал автообновления access token
  const startRefreshInterval = () => {
    stopRefreshInterval();
    refreshInterval.value = setInterval(async () => {
      try {
        await refreshToken();
      } catch (err) {
        console.error("Failed to refresh token:", err);
        await logOut();
      }
    }, refreshDelay);
  };

  const stopRefreshInterval = () => {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value);
      refreshInterval.value = null;
    }
  };

  // Основной метод обновления токена
  const refreshToken = async (): Promise<TokenResponse> => {
    try {
      const response = await $fetch<TokenResponse>("/auth/refresh", {
        baseURL: config.public.apiBase,
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
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
      await $fetch("/auth/logout", {
        baseURL: config.public.apiBase,
        method: "POST",
        credentials: "include",
        headers: authStore.token
          ? {
              Authorization: `Bearer ${authStore.token}`,
            }
          : {},
      }).catch((err) => {
        // Игнорируем ошибки сервера при logout, так как главное - очистить клиентскую сторону
        console.warn("Server logout failed (may be expected):", err.message);
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      // Всегда очищаем токен на клиенте
      clearToken();
      await router.push("/login");
    }
  };

  const init = () => {
    const savedToken = useCookie("access_token").value;
    if (savedToken) {
      token.value = savedToken;
      startRefreshInterval();
    }
  };

  init();

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
