<script setup lang="ts">
  import { useStepTwoStore } from "~/stores/stepTwo";
  import { useStepOneStore } from "~/stores/stepOne";

  const handleBack = () => {
    console.log("Back");
    navigateTo("/record/1");
  };

  const userStore = useUserStore();
  const stepOneStore = useStepOneStore();
  const stepTwoStore = useStepTwoStore();

  console.log("userStore user:", userStore.user);
  console.log("userStore isLoading:", userStore.isLoading);
  console.log("stepOne dateRange", stepOneStore.dateRange);

  const {
    callApi: loadReport,
    data: report,
    isLoading,
    error,
  } = useApi<UserData>();

  const isUserReady = ref(false);
  const loadError = ref<string | null>(null);

  const tableKkt = computed(() => report.value?.report?.kkts || {});
  const tableCashKkt = computed(
    () => report.value?.report?.cash_turnovers_without_kkt || {},
  );
  const tableNonCash = computed(
    () => report.value?.report?.cash_turnovers_non_cash || {},
  );
  const tableOtherSum = computed(
    () => report.value?.report?.cash_turnovers_other || {},
  );

  const kktTableRef = ref();
  const cashKktTableRef = ref();
  const nonCashTableRef = ref();
  const otherSumTableRef = ref();

  const { validateForm } = useFormValidation(
    kktTableRef,
    cashKktTableRef,
    nonCashTableRef,
    otherSumTableRef,
  );

  const validationResult = computed(() => validateForm());
  const isFormValid = computed(() => validationResult.value.isValid);
  const validationError = ref("");

  watch(
    validationResult,
    (result) => {
      validationError.value = result.error;
    },
    { immediate: true },
  );

  const { isSaving, saveReport, updateStores } = useSaveReport({
    tableRefs: {
      kkt: kktTableRef,
      cashKkt: cashKktTableRef,
      nonCash: nonCashTableRef,
      otherSum: otherSumTableRef,
    },
    stepOneStore,
    store: stepTwoStore,
    loadReport,
    stepType: "stepTwo",
  });

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const loadReportWithHeaders = async () => {
    try {
      if (!userStore.user?.id) {
        console.error("User ID not found");
        loadError.value = "Данные пользователя не загружены";
        return null;
      }

      const headers = {
        "contract-id": userStore.user.id.toString(),
      };

      console.log("Sending contract-id header:", headers["contract-id"]);

      const params: Record<string, string> = {};

      if (stepOneStore.dateRange?.[0]) {
        const startDate = new Date(stepOneStore.dateRange[0]);
        params.start = formatDate(startDate);
      }

      if (stepOneStore.dateRange?.[1]) {
        const endDate = new Date(stepOneStore.dateRange[1]);
        params.end = formatDate(endDate);
      }

      console.log("Request params:", params);

      return await loadReport("/tenants/reports/-1", {
        method: "GET",
        headers,
        params: Object.keys(params).length > 0 ? params : undefined,
      });
    } catch (err) {
      console.error("Error loading report:", err);
      loadError.value = "Ошибка загрузки отчета";
      return null;
    }
  };

  const setTableData = (ref: unknown, storeData: unknown, apiData: unknown) => {
    if (storeData?.rows?.length > 0) {
      ref.value?.setData?.(storeData.rows);
    } else if (apiData?.body?.length > 0) {
      ref.value?.setData?.(apiData.body);
    }
  };

  const validateAndNext = () => {
    if (!isFormValid.value) {
      console.error("Ошибка валидации данных:", validationError.value);
      return;
    }

    const tablesData = {
      kkt: kktTableRef.value?.getTableData(),
      cashKkt: cashKktTableRef.value?.getTableData(),
      nonCash: nonCashTableRef.value?.getTableData(),
      otherSum: otherSumTableRef.value?.getTableData(),
    };

    console.log("tablesData", tablesData);
    updateStores(tablesData);
    navigateTo("/record/3");
  };

  const saveSuccess = ref(false);
  const saveSuccessMessage = ref("");

  const saveData = async () => {
    const saved = await saveReport("Draft");
    if (saved) {
      const tablesData = {
        kkt: kktTableRef.value?.getTableData(),
        cashKkt: cashKktTableRef.value?.getTableData(),
        nonCash: nonCashTableRef.value?.getTableData(),
        otherSum: otherSumTableRef.value?.getTableData(),
      };
      updateStores(tablesData);

      saveSuccess.value = true;
      saveSuccessMessage.value = "Данные успешно сохранены как черновик";

      setTimeout(() => {
        saveSuccess.value = false;
        saveSuccessMessage.value = "";
      }, 3000);
    }
  };

  const isDataChanged = ref(false);

  const checkDataChanges = () => {
    isDataChanged.value = true;
  };

  const handleTableChange = (
    tableName: "kkt | cashKkt | nonCash | otherSum",
  ) => {
    const tableRefMap = {
      kkt: kktTableRef,
      cashKkt: cashKktTableRef,
      nonCash: nonCashTableRef,
      otherSum: otherSumTableRef,
    };

    const tableRef = tableRefMap[tableName];

    if (!tableRef.value) return;

    const tableData = tableRef.value.getTableData?.();

    if (!tableData) return;

    stepTwoStore.updateTable(tableName, {
      rows: tableData.rows,
      withVAT: tableData.totals?.withVAT ?? 0,
      VAT: tableData.totals?.VAT ?? 0,
    });

    isDataChanged.value = true;
    checkDataChanges();
  };

  watch(
    () => userStore.user,
    (newUser) => {
      if (newUser) {
        isUserReady.value = true;
        console.log("User data loaded:", newUser.id);
      }
    },
    { immediate: true },
  );

  onMounted(async () => {
    try {
      if (!userStore.user && userStore.isLoading) {
        console.log("Waiting for user data to load...");

        await new Promise((resolve, reject) => {
          const unwatch = watch(
            () => userStore.user,
            (user) => {
              if (user) {
                unwatch();
                resolve(true);
              }
            },
          );

          setTimeout(() => {
            unwatch();
            reject(new Error("Timeout waiting for user data"));
          }, 10000);
        });
      }

      if (!userStore.user) {
        throw new Error("Данные пользователя не загружены");
      }

      await loadReportWithHeaders();
      await nextTick();

      setTableData(kktTableRef, stepTwoStore.kkt, tableKkt.value);
      setTableData(cashKktTableRef, stepTwoStore.cashKkt, tableCashKkt.value);
      setTableData(nonCashTableRef, stepTwoStore.nonCash, tableNonCash.value);
      setTableData(
        otherSumTableRef,
        stepTwoStore.otherSum,
        tableOtherSum.value,
      );
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error);
      loadError.value = error.message;

      // Показываем уведомление пользователю
      useToast().add({
        title: "Ошибка загрузки",
        description: error.message,
        color: "red",
        icon: "i-heroicons-exclamation-triangle",
      });
    }
  });

  onBeforeUnmount(() => {
    const refs = [
      kktTableRef,
      cashKktTableRef,
      nonCashTableRef,
      otherSumTableRef,
    ];

    refs.forEach((ref) => {
      ref.value?.$el?.removeEventListener("change", handleTableChange);
    });
  });
</script>

<template>
  <div>
    <StepsCoreHeader
      step-title="Суммы, подлежащие включению в размер Денежного оборота в Помещении"
      :step-current="2"
      :step-total="4"
    />

    <StepsCoreMain>
      <section :class="$style.wrapper">
        <StepsCoreContentTitle
          text="2.1 Денежный оборот, полученный при расчетах с использованием ККТ, установленных в Помещении"
        />
        <div class="table-container">
          <StepsTablesKkt
            ref="kktTableRef"
            :headers="tableKkt?.header"
            :initial-data="tableKkt?.body"
            :loading="isLoading"
            :error="error"
            @change="handleTableChange('kkt')"
          />
        </div>
      </section>

      <section :class="$style.wrapper">
        <StepsCoreContentTitle
          text="2.2 Денежный оборот, полученный на расчетные счета Арендатора без использования ККТ, установленных в Помещении"
        />
        <div class="table-container">
          <StepsTablesCashKkt
            ref="cashKktTableRef"
            :headers="tableCashKkt?.header"
            :initial-data="tableCashKkt?.body"
            :loading="isLoading"
            :error="error"
            @change="handleTableChange('cashKkt')"
          />
        </div>
      </section>

      <section :class="$style.wrapper">
        <StepsCoreContentTitle
          text="2.3 Денежный оборот, полученный в качестве неденежных форм расчетов"
        />
        <div class="table-container">
          <StepsTablesNonCash
            ref="nonCashTableRef"
            :headers="tableNonCash?.header"
            :initial-data="tableNonCash?.body"
            :loading="isLoading"
            :error="error"
            @change="handleTableChange('nonCash')"
          />
        </div>
      </section>

      <section :class="$style.wrapper">
        <StepsCoreContentTitle
          text="2.4 Иные суммы, подлежащие включению в Денежный оборот в Помещении"
        />
        <div class="table-container">
          <StepsTablesOtherSum
            ref="otherSumTableRef"
            :headers="tableOtherSum?.header"
            :initial-data="tableOtherSum?.body"
            :loading="isLoading"
            :error="error"
            @change="handleTableChange('')"
          />
        </div>
      </section>
    </StepsCoreMain>

    <StepsCoreNavigation :step="2" :show-back="true" :show-next="true">
      <template #back>
        <UButton class="steps-nav-btn ghost" @click="handleBack">Назад</UButton>
      </template>
      <template #action>
        <UTooltip :text="!isFormValid && !isDataChanged ? validationError : ''">
          <UButton
            class="steps-nav-btn ghost"
            :loading="isSaving"
            :disabled="!isDataChanged && !isFormValid"
            @click="saveData"
          >
            Сохранить как черновик
          </UButton>
        </UTooltip>
      </template>
      <template #next>
        <UTooltip :text="!isFormValid ? validationError : ''">
          <UButton
            class="steps-nav-btn solid"
            :disabled="!isFormValid"
            @click="validateAndNext"
          >
            Далее
          </UButton>
        </UTooltip>

        <transition
          enter-active-class="transition-opacity duration-300"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-300"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="saveSuccess"
            class="flex items-center text-green-600 text-sm font-medium"
          >
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 mr-1" />
            {{ saveSuccessMessage }}
          </div>
        </transition>
      </template>
    </StepsCoreNavigation>
  </div>
</template>

<style module lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-bottom: rem(18);
  }
</style>
