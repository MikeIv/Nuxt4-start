// app/middleware/auth.ts
import { useUserStore } from "~/stores/userData";

interface ApiError {
  response?: {
    status?: number;
    data?: { message?: string };
  };
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;

  const userStore = useUserStore();
  const authStore = useAuthStore();
  const { fetchUser } = useUserData();
  const token = useCookie("access_token").value;
  const isLoginPage = to.path === "/login";

  if (token && !authStore.token) {
    authStore.setToken(token);
  }

  if (!authStore.isAuthenticated && !isLoginPage) {
    return navigateTo("/login");
  }

  if (authStore.isAuthenticated && isLoginPage) {
    return navigateTo("/");
  }

  if (authStore.isAuthenticated && !userStore.user && !userStore.isLoading) {
    try {
      await fetchUser();
    } catch (error: unknown) {
      const err = error as ApiError;
      if (err?.response?.status === 401) {
        // Пробуем обновить токен
        try {
          await authStore.refreshToken();
          await fetchUser(); // повторяем запрос с новым токеном
        } catch {
          // Если refresh тоже не сработал → logout и редирект
          await authStore.logOut();
          return navigateTo("/login");
        }
      } else {
        console.error("Failed to fetch user data:", error);
      }
    }
  }
});
