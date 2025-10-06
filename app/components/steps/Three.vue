<script setup lang="ts">
  // import { useStepOneStore } from "~/stores/stepOne";
  import { useStepTwoStore } from "~/stores/stepTwo";
  import { useStepThreeStore } from "~/stores/stepThree";

  const handleBack = () => {
    const tablesData = {
      refunds: refundsTableRef.value?.getTableData() || {
        rows: [],
        totals: { withVAT: 0, VAT: 0 },
      },
      otherAmounts: otherAmountsTableRef.value?.getTableData() || {
        rows: [],
        totals: { withVAT: 0, VAT: 0 },
      },
    };

    // Сохраняем таблицы в Pinia перед возвратом
    stepThreeStore.updateTable("refunds", {
      rows: tablesData.refunds.rows,
      withVAT: tablesData.refunds.totals.withVAT,
      VAT: tablesData.refunds.totals.VAT,
    });

    stepThreeStore.updateTable("otherAmounts", {
      rows: tablesData.otherAmounts.rows,
      withVAT: tablesData.otherAmounts.totals.withVAT,
      VAT: tablesData.otherAmounts.totals.VAT,
    });

    navigateTo("/record/2");
  };

  const {
    callApi: loadReport,
    data: report,
    isLoading,
    error,
  } = useApi<UserData>();

  const tableRefunds = computed(
    () => report.value?.report?.kkts_exclusions || {},
  );
  const tableOtherAmouts = computed(
    () => report.value?.report?.cash_turnover_exclusions_other || {},
  );

  const refundsTableRef = ref();
  const otherAmountsTableRef = ref();

  // const stepOneStore = useStepOneStore();
  const stepTwoStore = useStepTwoStore();
  const stepThreeStore = useStepThreeStore();

  const isDataChanged = ref(false);

  const checkDataChanges = () => {
    isDataChanged.value = true;
  };

  const handleTableChange = (tableName: "refunds" | "otherAmounts") => {
    const tableRefMap = {
      refunds: refundsTableRef,
      otherAmounts: otherAmountsTableRef,
    };

    const tableRef = tableRefMap[tableName];

    if (!tableRef.value) return;

    const tableData = tableRef.value.getTableData?.();

    if (!tableData) return;

    stepThreeStore.updateTable(tableName, {
      rows: tableData.rows,
      withVAT: tableData.totals?.withVAT ?? 0,
      VAT: tableData.totals?.VAT ?? 0,
    });

    isDataChanged.value = true;

    checkDataChanges();
  };

  // Функция для проверки наличия ненулевых значений в строке возвратов
  const hasNonZeroValuesInRefundsRow = (row: unknown): boolean => {
    const numericFields = [
      "returns_goods_services_with_nds",
      "returns_goods_services_nds",
      "gift_certificates_sold_with_nds",
      "gift_certificates_sold_nds",
    ];

    return numericFields.some((field) => {
      const value = row[field];
      if (typeof value === "string") {
        const numericValue = parseFloat(value.replace(",", "."));
        return !isNaN(numericValue) && numericValue > 0;
      }
      return false;
    });
  };

  // Валидация обязательных полей таблиц
  const validateForm = () => {
    const refundsData = refundsTableRef.value?.getTableData?.() || { rows: [] };
    const otherAmountsData = otherAmountsTableRef.value?.getTableData?.() || {
      rows: [],
    };

    // Проверяем обязательные поля для таблицы возвратов
    for (const [index, row] of refundsData.rows.entries()) {
      if (!row.name || !row.registration_number) {
        return {
          isValid: false,
          error: "Заполните все обязательные поля в таблице Возвратов",
        };
      }

      // Проверяем, что если есть ненулевые значения, то должны быть файлы
      if (
        hasNonZeroValuesInRefundsRow(row) &&
        (!row.files || row.files.length === 0)
      ) {
        return {
          isValid: false,
          error: `Для строки ${index + 1} в таблице Возвратов необходимо прикрепить файлы, так как есть ненулевые значения`,
        };
      }

      // Валидация номера ККТ (ровно 16 цифр)
      if (
        row.registration_number &&
        !/^\d{16}$/.test(row.registration_number)
      ) {
        return {
          isValid: false,
          error: `Номер ККТ в строке ${index + 1} должен содержать ровно 16 цифр`,
        };
      }
    }

    // Проверяем обязательные поля для таблицы иных сумм
    for (const [index, row] of otherAmountsData.rows.entries()) {
      if (!row.name) {
        return {
          isValid: false,
          error: "Заполните все обязательные поля в таблице Иных сумм",
        };
      }

      // Проверяем, что если есть ненулевые значения, то должно быть описание
      const hasAmount =
        row.amount && parseFloat(row.amount.replace(",", ".")) > 0;
      if (hasAmount && !row.description) {
        return {
          isValid: false,
          error: `Для строки ${index + 1} в таблице Иных сумм необходимо заполнить описание, так как указана сумма`,
        };
      }
    }

    return { isValid: true, error: "" };
  };

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

  watch(
    () => stepTwoStore.kkt.rows,
    () => {
      stepThreeStore.syncRefundsWithKkts();

      nextTick(() => {
        refundsTableRef.value?.setData?.(stepThreeStore.refunds.rows);
      });
    },
    { deep: true },
  );

  // const { saveReport, updateStores } = useSaveReport({
  //   tableRefs: {
  //     refunds: refundsTableRef,
  //     otherAmounts: otherAmountsTableRef,
  //   },
  //   stepOneStore,
  //   stepTwoStore,
  //   store: stepThreeStore,
  //   loadReport,
  //   stepType: "stepThree",
  // });

  const saveSuccess = ref(false);
  const saveSuccessMessage = ref("");

  // const saveData = async () => {
  //   const saved = await saveReport("Draft");
  //   if (saved) {
  //     const tablesData = {
  //       refunds: refundsTableRef.value?.getTableData(),
  //       otherAmounts: otherAmountsTableRef.value?.getTableData(),
  //     };
  //     updateStores(tablesData);

  //     saveSuccess.value = true;
  //     saveSuccessMessage.value = "Данные успешно сохранены как черновик";

  //     isDataChanged.value = false;

  //     setTimeout(() => {
  //       saveSuccess.value = false;
  //       saveSuccessMessage.value = "";
  //     }, 3000);
  //   }
  // };

  const validateAndNext = () => {
    const tablesData = {
      refunds: refundsTableRef.value?.getTableData() || {
        rows: [],
        totals: { withVAT: 0, VAT: 0 },
      },
      otherAmounts: otherAmountsTableRef.value?.getTableData() || {
        rows: [],
        totals: { withVAT: 0, VAT: 0 },
      },
    };

    try {
      stepThreeStore.updateTable("refunds", {
        rows: tablesData.refunds.rows,
        withVAT: tablesData.refunds.totals.withVAT,
        VAT: tablesData.refunds.totals.VAT,
      });

      stepThreeStore.updateTable("otherAmounts", {
        rows: tablesData.otherAmounts.rows,
        withVAT: tablesData.otherAmounts.totals.withVAT,
        VAT: tablesData.otherAmounts.totals.VAT,
      });

      console.log("Данные успешно сохранены:", tablesData);

      // useToast().add({
      //   title: "Данные сохранены",
      //   description: "Данные успешно сохранены перед переходом",
      //   color: "green",
      // });

      navigateTo("/record/4");
    } catch (error) {
      console.error("Ошибка сохранения:", error);
    }
  };

  const setTableData = (ref: unknown, storeData: unknown, apiData: unknown) => {
    if (storeData?.rows?.length > 0) {
      ref.value?.setData?.(storeData.rows);
    } else if (apiData?.body?.length > 0) {
      ref.value?.setData?.(apiData.body);
    }
  };

  onMounted(async () => {
    try {
      await loadReport("/tenants/reports/-1");

      await nextTick();

      stepThreeStore.syncRefundsWithKkts();

      setTableData(refundsTableRef, stepThreeStore.refunds, tableRefunds.value);
      setTableData(
        otherAmountsTableRef,
        stepThreeStore.otherAmounts,
        tableOtherAmouts.value,
      );

      // Добавляем обработчики изменений для таблиц
      if (refundsTableRef.value) {
        refundsTableRef.value.$el?.addEventListener(
          "change",
          handleTableChange,
        );
      }
      if (otherAmountsTableRef.value) {
        otherAmountsTableRef.value.$el?.addEventListener(
          "change",
          handleTableChange,
        );
      }
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error);

      useToast().add({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить данные",
        color: "red",
      });
    }
  });

  onBeforeUnmount(() => {
    if (refundsTableRef.value) {
      refundsTableRef.value.$el?.removeEventListener(
        "change",
        handleTableChange,
      );
    }
    if (otherAmountsTableRef.value) {
      otherAmountsTableRef.value.$el?.removeEventListener(
        "change",
        handleTableChange,
      );
    }
  });
</script>

<template>
  <div>
    <StepsCoreHeader
      step-title="Суммы, подлежащие исключению из размера Денежного оборота в Помещении"
      :step-current="3"
      :step-total="4"
    />

    <StepsCoreMain>
      <section :class="$style.wrapper">
        <StepsCoreContentTitle text="3.1 Возвраты" />
        <div class="table-container">
          <StepsTablesRefunds
            ref="refundsTableRef"
            :headers="tableRefunds?.header"
            :initial-data="tableRefunds?.body"
            :loading="isLoading"
            :error="error"
            @change="handleTableChange('refunds')"
          />
        </div>
      </section>

      <section :class="$style.wrapper">
        <StepsCoreContentTitle
          text="3.2 Иные суммы, подлежащие исключению из Денежного оборота"
        />
        <div class="table-container">
          <StepsTablesOtherAmounts
            ref="otherAmountsTableRef"
            :headers="tableOtherAmouts?.header"
            :initial-data="tableOtherAmouts?.body"
            :loading="isLoading"
            :error="error"
            @change="handleTableChange('otherAmounts')"
          />
        </div>
      </section>
    </StepsCoreMain>

    <StepsCoreNavigation :step="3" :show-back="true" :show-next="true">
      <template #back>
        <UButton class="steps-nav-btn ghost" @click="handleBack">Назад</UButton>
      </template>
      <template #action>
        <UTooltip :text="!isFormValid && !isDataChanged ? validationError : ''">
          <!-- <UButton
            class="steps-nav-btn ghost"
            :loading="isSaving"
            :disabled="!isDataChanged || !isFormValid"
            @click="saveData"
          >
            Сохранить как черновик
          </UButton> -->
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
            class="flex items-center text-green-600 text-sm font-medium ml-2"
          >
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 mr-1" />
            {{ saveSuccessMessage }}
          </div>
        </transition>
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
