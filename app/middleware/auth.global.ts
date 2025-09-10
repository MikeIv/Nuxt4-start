import { useUserStore } from "~/stores/userData";

interface ApiError {
  response?: {
    status?: number;
    data?: { message?: string };
  };
}

const PUBLIC_ROUTES = ["/login", "/contact"];

// Маршруты API и технические пути которые нужно пропускать
const SKIP_ROUTES = [
  "/api/",
  "_payload.json",
  "/_nuxt/",
  "/__nuxt_dev__/",
  "/__nuxt_debug__/",
];

let isFetchingUser = false;
let lastFetchTime = 0;
const FETCH_DEBOUNCE = 1000;

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || shouldSkipRoute(to.path)) {
    return;
  }

  const userStore = useUserStore();
  const authStore = useAuthStore();
  const { fetchUser } = useUserData();

  const token = useCookie("access_token").value;
  const currentPath = to.path;
  const isPublicRoute = isPublicPath(currentPath);
  const isAuthRoute = currentPath === "/login" || currentPath === "/register";

  await syncTokenWithStore(token, authStore);

  const redirectResult = handleAuthRedirect(
    authStore.isAuthenticated,
    isPublicRoute,
    isAuthRoute,
    currentPath,
  );
  if (redirectResult.shouldRedirect) {
    return navigateTo(redirectResult.redirectTo);
  }

  if (shouldFetchUser(authStore.isAuthenticated, userStore)) {
    await fetchUserDataWithErrorHandling(
      authStore,
      userStore,
      fetchUser,
      isAuthRoute,
      currentPath,
    );
  }
});

function shouldSkipRoute(path: string): boolean {
  return SKIP_ROUTES.some(
    (route) => path.startsWith(route) || path.includes(route),
  );
}

function isPublicPath(path: string): boolean {
  return PUBLIC_ROUTES.some(
    (publicRoute) => path === publicRoute || path.startsWith(publicRoute + "/"),
  );
}

async function syncTokenWithStore(
  token: string | null | undefined,
  authStore: unknown,
): Promise<void> {
  if (token && !authStore.token) {
    try {
      authStore.setToken(token);
      await authStore.refreshToken().catch(() => {
        console.warn("Token synchronization failed");
      });
    } catch (error) {
      console.warn("Token sync error:", error);
    }
  }
}

/**
 * Обрабатывает логику перенаправления на основе статуса авторизации
 */
function handleAuthRedirect(
  isAuthenticated: boolean,
  isPublicRoute: boolean,
  isAuthRoute: boolean,
): { shouldRedirect: boolean; redirectTo?: string } {
  if (!isAuthenticated && !isPublicRoute) {
    return { shouldRedirect: true, redirectTo: "/login" };
  }

  if (isAuthenticated && isAuthRoute) {
    return { shouldRedirect: true, redirectTo: "/" };
  }

  if (isAuthenticated && isPublicRoute && !isAuthRoute) {
    return { shouldRedirect: false };
  }

  return { shouldRedirect: false };
}

/**
 * Проверяет нужно ли загружать данные пользователя
 */
function shouldFetchUser(
  isAuthenticated: boolean,
  userStore: unknown,
): boolean {
  const now = Date.now();
  return (
    isAuthenticated &&
    !userStore.user &&
    !userStore.isLoading &&
    !isFetchingUser &&
    now - lastFetchTime > FETCH_DEBOUNCE
  );
}

async function fetchUserDataWithErrorHandling(
  authStore: unknown,
  fetchUser: () => Promise<void>,
  isAuthRoute: boolean,
  currentPath: string,
): Promise<void> {
  isFetchingUser = true;
  lastFetchTime = Date.now();

  try {
    await fetchUser();
  } catch (error: unknown) {
    const err = error as ApiError;

    if (err?.response?.status === 401 || err?.response?.status === 403) {
      try {
        await authStore.refreshToken();
        await fetchUser();
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        await handleAuthFailure(authStore, isAuthRoute, currentPath);
      }
    } else {
      console.error("Failed to fetch user data:", error);
      // Не критичная ошибка - не разлогиниваем пользователя
    }
  } finally {
    isFetchingUser = false;
  }
}

async function handleAuthFailure(
  authStore: unknown,
  isAuthRoute: boolean,
  currentPath: string,
): Promise<void> {
  await authStore.logOut();

  if (!isAuthRoute && currentPath !== "/login") {
    window.location.href = "/login";
  }
}
