<script setup lang="ts">
  import { useAuthStore } from "~/stores/auth";
  import { useUserStore } from "~/stores/userData";
  import { useApi } from "~/composables/useApi";
  import { useStepTwoStore } from "~/stores/stepTwo";
  import { useUserData } from "../../composables/useUser";

  const userStore = useUserStore();
  const { fetchUser } = useUserData();

  const authStore = useAuthStore();
  const { isLoading, error } = useApi<unknown>();

  const userInfo = computed(() => {
    console.log("USER from userData store HEADER:", userStore.user);

    const user = userStore.user;
    if (!user) return null;

    return [
      user?.tenant_name,
      user?.brand,
      user?.contract_number ? `Договор ${user?.contract_number}` : null,
    ]
      .filter(Boolean)
      .join(", ");
  });

  const showLogoutConfirm = ref(false);
  const showLogoutBg = ref(false);

  const handleLogoutConfirm = async (proceed: boolean) => {
    if (!proceed) {
      showLogoutConfirm.value = false;
      return;
    }

    showLogoutBg.value = true;

    try {
      isLoading.value = true;

      const stepOneStore = useStepOneStore();
      const stepTwoStore = useStepTwoStore();
      stepOneStore.reset();
      stepTwoStore.$reset();

      await authStore.logOut();

      userStore.clearUser();

      if (import.meta.env.VITE_API_DATA_ONLY_MODE) {
        authStore.$patch({
          token: null,
          error: null,
          isLoading: false,
        });
      }
    } catch (e) {
      error.value =
        e instanceof Error ? e : new Error("Ошибка выхода из системы");
      console.error("Logout error:", e);

      useToast().add({
        title: "Ошибка выхода",
        description: "Не удалось завершить сеанс",
        color: "primary",
        icon: "i-heroicons-x-circle",
        ui: {
          wrapper: "",
          title: "text-[#292d3e]",
          description: "text-[#e37508]",
        },
      });
    } finally {
      isLoading.value = false;
      showLogoutBg.value = false;
    }
  };

  const contracts = computed(() => userStore.user?.contracts ?? []);

  const hasContractsToShow = computed(() => contracts.value.length > 0);

  const activeContractId = computed(() => userStore.user?.id ?? null);

  const handleContractChange = async (id: number) => {
    console.log("contract change@", id);
    try {
      isLoading.value = true;
      error.value = null;

      await fetchUser(id);

      await refreshNuxtData();

      await navigateTo({ path: "/" }, { replace: true });
    } catch (e: unknown) {
      const errorMessage =
        e instanceof Error ? e.message : "Ошибка переключения договора";
      error.value = new Error(errorMessage, { cause: e });

      console.error("Failed to change contract:", error.value);

      useToast().add({
        title: "Ошибка переключения",
        description: "Не удалось изменить текущий договор",
        type: "custom-error",
      });
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(async () => {
    if (!userStore.user) {
      console.log("Fetching user data...");
      await fetchUser();
    }
    console.log("User data from userData store:", userStore.user);
  });
</script>

<template>
  <section :class="$style.header">
    <div :class="$style.topRow">
      <div :class="$style.callLeft">
        <h1 :class="$style.callTitle">Личный кабинет арендатора</h1>
        <p :class="$style.callText">
          Удобный инструмент для формирования и хранения <br />
          финансовых отчетов, подачи заявок на их редактирование <br />
          и отслеживание статусов, а также управление списком ККТ
        </p>
      </div>

      <div :class="$style.statusBtns">
        <ModuleLogoutPopover
          :is-loading="isLoading"
          @confirm="handleLogoutConfirm"
          @show-bg="showLogoutBg"
        />
        <ModuleContractPopover
          :is-loading="isLoading"
          :has-contracts-to-show="hasContractsToShow"
          :contracts="contracts"
          :active-contract-id="activeContractId"
          @change="handleContractChange"
        />
      </div>
    </div>
    <div :class="$style.bottomRow">
      <p v-if="userInfo">{{ userInfo }}</p>
      <p v-else-if="userStore.isLoading">Загрузка данных пользователя...</p>
      <p v-else-if="userStore.error">Ошибка: {{ userStore.error }}</p>
      <p v-else>Пользователь не авторизован</p>
    </div>

    <div v-if="error" :class="$style.error">
      {{ error }}
    </div>

    <div v-if="isLoading" :class="$style.loading">Загрузка данных...</div>
  </section>
</template>

<style module lang="scss">
  .header {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: rem(200);
  }

  .topRow {
    display: flex;
    justify-content: space-between;
    padding: rem(20) rem(40);
  }

  .callLeft {
    display: flex;
    flex-direction: column;
  }

  .statusBtns {
    display: flex;
    flex-direction: column;
  }

  .callTitle {
    margin-bottom: rem(6);
    font-size: rem(26);
    font-weight: bold;
    text-transform: uppercase;
  }

  .callText {
    font-size: rem(14);
    font-weight: bold;
    line-height: 1.2;
  }

  .bottomRow {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: rem(60);
    padding: 0 rem(40);
    font-size: rem(21);
    font-weight: bold;
    color: var(--a-white);
    background-color: var(--a-bgGray);
    text-transform: uppercase;
  }

  .error {
    padding: rem(10) rem(20);
    color: var(--a-error);
    background-color: var(--a-errorBg);
    font-size: rem(14);
  }

  .loading {
    padding: rem(10) rem(20);
    color: var(--a-info);
    background-color: var(--a-infoBg);
    font-size: rem(14);
  }
</style>
