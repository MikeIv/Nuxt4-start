import { useUserStore } from "#imports";

const userStore = useUserStore();
const contractId = computed(() => userStore.user?.id || null);

export const usePeriodCheck = (dateRange: Ref<[Date, Date] | null>) => {
  const { callApi } = useApi();
  const toast = useToast();

  const isCheckingPeriod = ref(false);
  const periodExists = ref(false);

  const checkPeriodExists = async () => {
    if (!dateRange.value || dateRange.value.length !== 2) {
      periodExists.value = false;
      return;
    }

    isCheckingPeriod.value = true;
    periodExists.value = false;

    if (!contractId.value) {
      console.error("Contract ID not available");
      return;
    }

    const headers = {
      "Contract-id": contractId.value.toString(),
    };

    try {
      const response = await callApi<{
        start_at: string;
        end_at: string;
      }>("/tenants/reports/exists", {
        method: "POST",
        body: {
          start_at: dateRange.value[0].toISOString().split("T")[0],
          end_at: dateRange.value[1].toISOString().split("T")[0],
        },
        headers,
      });

      if (response?.success && response.payload?.exists) {
        periodExists.value = true;
        toast.add({
          title: "Ошибка",
          description: "Такой отчет уже существует. Поменяйте дату.",
          color: "red",
        });
      } else {
        periodExists.value = false;
      }
    } catch (error) {
      console.error("Error checking period:", error);
      // toast.add({
      //   title: "Ошибка",
      //   description: "Не удалось проверить период",
      //   color: "red",
      // });
    } finally {
      isCheckingPeriod.value = false;
    }
  };

  watch(
    dateRange,
    (newVal) => {
      if (newVal?.length === 2) {
        checkPeriodExists();
      } else {
        periodExists.value = false;
      }
    },
    { deep: true },
  );

  return {
    isCheckingPeriod,
    periodExists,
    checkPeriodExists,
  };
};
