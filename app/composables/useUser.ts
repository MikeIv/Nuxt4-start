import type { UserData } from "~~/shared/types/user";

export const useUserData = () => {
  const userStore = useUserStore();
  const { callApi } = useApi<UserData>();

  const fetchUser = async (contractId?: number): Promise<UserData | null> => {
    userStore.setLoading(true);
    userStore.setError(null);

    try {
      const headers: Record<string, string> = {};

      if (contractId) {
        headers["Contract-id"] = contractId.toString();
      }

      const result = await callApi("/user/me", { headers });
      console.log("result##", result);

      if (result && "payload" in result && result.payload) {
        userStore.setUser(result.payload);
        console.log("user!!.payload", result.payload);
        return result.payload;
      }

      return null;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch user";
      userStore.setError(errorMessage);
      return null;
    } finally {
      userStore.setLoading(false);
    }
  };

  const updateProfile = async (
    profileData: Partial<UserData>,
  ): Promise<UserData | null> => {
    userStore.setLoading(true);
    userStore.setError(null);

    try {
      const result = await callApi("/user/profile", {
        method: "PATCH",
        body: profileData,
      });

      if (result && "payload" in result && result.payload) {
        userStore.setUser(result.payload);
        return result.payload;
      }

      return null;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update profile";
      userStore.setError(errorMessage);
      return null;
    } finally {
      userStore.setLoading(false);
    }
  };

  const deleteAccount = async (): Promise<boolean> => {
    userStore.setLoading(true);
    userStore.setError(null);

    try {
      const result = await callApi("/user/account", {
        method: "DELETE",
      });

      if (result !== null) {
        userStore.clearUser();
        return true;
      }

      return false;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete account";
      userStore.setError(errorMessage);
      return false;
    } finally {
      userStore.setLoading(false);
    }
  };

  return {
    user: computed(() => userStore.user),
    error: computed(() => userStore.error),
    isLoading: computed(() => userStore.isLoading),
    fetchUser,
    updateProfile,
    deleteAccount,
  };
};
