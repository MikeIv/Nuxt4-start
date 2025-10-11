<script setup lang="ts">
  import { useStepOneStore } from "~/stores/stepOne";
  import { useStepTwoStore } from "~/stores/stepTwo";
  import { useStepThreeStore } from "~/stores/stepThree";
  import { useStepFourStore } from "~/stores/stepFour";

  const stepOneStore = useStepOneStore();
  const stepTwoStore = useStepTwoStore();
  const stepThreeStore = useStepThreeStore();
  const stepFourStore = useStepFourStore();

  const router = useRouter();

  // Подписка на смену роутов
  const unsubscribe = router.afterEach(() => {
    if (shouldResetOnLeave.value) {
      stepOneStore.reset();
      stepTwoStore.$reset();
      stepThreeStore.$reset();
      stepFourStore.$reset();
      shouldResetOnLeave.value = false;
    }
  });

  // Отписываемся при уничтожении компонента
  onBeforeUnmount(() => {
    unsubscribe();
  });

  // const tableRef = ref();

  // const isSavingDraft = ref(false);
  const saveSuccess = ref(false);
  const saveSuccessMessage = ref("");

  // const saveDraft = async () => {
  //   isSavingDraft.value = true;
  //   try {
  //     const draft = {
  //       status: "Draft",
  //       report: {
  //         visitors_count: stepOneStore.visitorsCount || 0,
  //         receipts_count: stepOneStore.checksCount || 0,
  //         period: {
  //           start: stepOneStore.dateRange?.[0] || new Date().toISOString(),
  //           end: stepOneStore.dateRange?.[1] || new Date().toISOString(),
  //         },
  //         kkts: stepTwoStore.kkt?.rows || [],
  //         cash_turnovers_without_kkt: stepTwoStore.cashKkt?.rows || [],
  //         cash_turnovers_non_cash: stepTwoStore.nonCash?.rows || [],
  //         cash_turnovers_other: stepTwoStore.otherSum?.rows || [],
  //         kkts_exclusions: stepThreeStore.refunds?.rows || [],
  //         cash_turnover_exclusions_other:
  //           stepThreeStore.otherAmounts?.rows || [],
  //         turnover_calculation: tableRef.value?.getTableData()?.rows || [],
  //       },
  //     };

  //     await loadReport("/tenants/reports", {
  //       method: "POST",
  //       body: draft,
  //     });

  //     saveSuccess.value = true;
  //     saveSuccessMessage.value = "Данные успешно сохранены в черновик";

  //     setTimeout(() => {
  //       saveSuccess.value = false;
  //       saveSuccessMessage.value = "";
  //     }, 3000);
  //   } catch (err) {
  //     console.error("Ошибка сохранения черновика:", err);
  //     useToast().add({
  //       title: "Ошибка",
  //       description: "Не удалось сохранить черновик",
  //       color: "red",
  //     });
  //   } finally {
  //     isSavingDraft.value = false;
  //   }
  // };

  const handleBack = () => {
    console.log("Back");
    navigateTo("/record/3");
  };

  const {
    handleFormattedBaseInput,
    handleFormattedBaseBlur,
    shouldShowBaseError,
    preventNonNumericInput,
    formatCurrency,
    savingReport,
    isSavingReport,
    reportSaved,
    shouldResetOnLeave,
    sumWithVAT,
    sumWithoutVAT,
    displayBaseValue,
    rentPercentage,
    percentageWithVAT,
    percentageWithoutVAT,
    paymentWithVAT,
    paymentWithoutVAT,
    loadReport,
    isLoading,
    reportData,
  } = useReportCalculation();

  console.log("loadReport", loadReport);
  console.log("isLoading", isLoading);

  const { downloadingReport, downloadReport } = useDownloadReport();

  const reportId = computed(() => reportData.value?.id);

  const resulTableData = ref({
    header: [
      { key: "name", label: "" },
      { key: "nds", label: "с НДС" },
      { key: "without_nds", label: "без НДС" },
    ],
    body: [
      {
        name: "Итого Денежный оборот в Помещении",
        with_nds: sumWithVAT || "0",
        without_nds: sumWithoutVAT || "0",
      },
      {
        name: "Процент с Денежного оборота, %",
        rentPercentage: rentPercentage || "0",
      },
      {
        name: "Процент с Денежного оборота, руб",
        with_nds: percentageWithVAT,
        without_nds: percentageWithoutVAT,
      },
      {
        name: "База сравнения за отчетный период, руб.",
        sum: "0",
      },
      {
        name: "Плата с Денежного оборота, руб.",
        with_nds: paymentWithVAT,
        without_nds: paymentWithoutVAT,
      },
    ],
  });

  const handleDownloadReport = async () => {
    if (!reportId.value) return;
    try {
      await downloadReport(reportId.value);
    } catch (error) {
      console.error("Ошибка при скачивании отчета:", error);
    }
  };

  onMounted(async () => {
    await loadReport("/tenants/reports/-1");
  });
</script>

<template>
  <div>
    <StepsCoreHeader
      step-title="Расчет платы с Денежного оборота в Помещении"
      :step-current="4"
      :step-total="4"
    />

    <StepsCoreMain>
      <section :class="$style.section">
        <div :class="$style.table">
          <div :class="$style.tableRow">
            <div
              v-for="(col, index) in resulTableData?.header"
              :key="index"
              :class="[
                $style.tableHeaderCell,
                { [$style.spanColumns]: index === 0 },
              ]"
            >
              {{ col.label }}
            </div>
          </div>

          <div
            v-for="(row, rowIndex) in resulTableData?.body"
            :key="rowIndex"
            :class="$style.tableRow"
          >
            <div
              :class="[
                $style.tableCell,
                $style.nameCell,
                {
                  [$style.firstCell]: rowIndex === 0,
                  [$style.lastCell]:
                    rowIndex === resulTableData.body.length - 1,
                },
              ]"
            >
              {{ row.name }}
            </div>

            <template
              v-if="row.name === 'База сравнения за отчетный период, руб.'"
            >
              <div :class="[$style.tableCell, $style.sumCell]" :colspan="2">
                <input
                  :value="displayBaseValue"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  required
                  placeholder="0"
                  :class="[
                    $style.baseInput,
                    { [$style.errorInput]: shouldShowBaseError() },
                  ]"
                  @input="handleFormattedBaseInput"
                  @blur="handleFormattedBaseBlur"
                  @keypress="preventNonNumericInput"
                />
                <span>₽</span>
              </div>
            </template>
            <template v-else-if="row.name === 'Процент с Денежного оборота, %'">
              <div :class="[$style.tableCell, $style.sumCell]" :colspan="2">
                {{ rentPercentage }}%
              </div>
            </template>
            <template
              v-else-if="row.name === 'Процент с Денежного оборота, руб'"
            >
              <div :class="$style.tableCell">
                {{ row.with_nds ? formatCurrency(row.with_nds) : "0 ₽" }}
              </div>
              <div :class="$style.tableCell">
                {{ row.without_nds ? formatCurrency(row.without_nds) : "0 ₽" }}
              </div>
            </template>
            <template
              v-else-if="row.name === 'Плата с Денежного оборота, руб.'"
            >
              <div :class="$style.tableCell">
                {{ formatCurrency(row.with_nds) }}
              </div>
              <div :class="[$style.tableCell, $style.bottomRightCell]">
                {{ formatCurrency(row.without_nds) }}
              </div>
            </template>
            <template v-else>
              <div :class="$style.tableCell">
                {{
                  row.with_nds
                    ? formatCurrency(parseFloat(row.with_nds))
                    : "0 ₽"
                }}
              </div>
              <div :class="$style.tableCell">
                {{
                  row.without_nds
                    ? formatCurrency(parseFloat(row.without_nds))
                    : "0 ₽"
                }}
              </div>
            </template>
          </div>
        </div>
      </section>
    </StepsCoreMain>

    <StepsCoreNavigation :step="4" :show-back="true" :show-next="false">
      <template #back>
        <UButton
          class="steps-nav-btn ghost"
          :disabled="reportSaved || isSaving"
          @click="handleBack"
        >
          Назад
        </UButton>
      </template>
      <template #action>
        <!-- <UButton
          class="steps-nav-btn ghost"
          :loading="isSavingDraft"
          :disabled="reportSaved"
          @click="saveDraft"
        >
          Сохранить как черновик
        </UButton> -->

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
        <UButton
          class="steps-nav-btn ghost"
          :loading="isSavingReport"
          :disabled="reportSaved || shouldShowBaseError()"
          @click="savingReport"
        >
          {{ isSavingReport ? "Формирование..." : "Сформировать отчет" }}
        </UButton>
      </template>
      <template #next>
        <UButton
          class="steps-nav-btn solid"
          :disabled="downloadingReport || !reportId"
          @click="handleDownloadReport"
        >
          {{ downloadingReport ? "Скачивание..." : "Скачать отчет" }}
        </UButton>

        <transition name="fade">
          <div v-if="reportSaved" class="saved">
            <p>Отчет успешно сформирован</p>
          </div>
        </transition>
      </template>
    </StepsCoreNavigation>
  </div>
</template>

<style scoped>
  .saved {
    padding: 2px 10px;
    height: 25px;
    background-color: var(--a-bgGreen);
    color: var(--a-white);
    border-radius: 5px;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
  }

  .fade-enter-from {
    opacity: 0;
  }

  .fade-enter-to {
    opacity: 1;
  }

  .fade-leave-from {
    opacity: 1;
  }

  .fade-leave-to {
    opacity: 0;
  }
</style>

<style module lang="scss">
  .section {
    margin-bottom: rem(24);
  }

  .table {
    display: grid;
    grid-template-columns: 1fr rem(250) rem(250);
    max-width: rem(900);
    border: none;
    font-size: rem(14);
    margin-left: rem(70);
  }

  .tableRow {
    display: contents;
  }

  .tableHeaderCell {
    display: flex;
    justify-content: center;
    padding: rem(12) rem(8);
    height: rem(40);
    font-weight: bold;
    text-align: center;
    align-items: center;
    background-color: var(--color-primary-200);
    &:not(:first-child):not(:last-child) {
      border-right: 1px solid var(--a-borderAccentLight);
      border-top-left-radius: rem(10);
      -webkit-box-shadow: -5px 5px 20px -4px rgba(0, 0, 0, 0.2);
      -moz-box-shadow: -5px 5px 20px -4px rgba(0, 0, 0, 0.2);
      box-shadow: -5px 5px 20px -4px rgba(0, 0, 0, 0.2);
    }

    &:last-child {
      border-top-right-radius: rem(10);
      -webkit-box-shadow: 5px 5px 20px -4px rgba(0, 0, 0, 0.2);
      -moz-box-shadow: 5px 5px 20px -4px rgba(0, 0, 0, 0.2);
      box-shadow: 5px 5px 10px -4px rgba(0, 0, 0, 0.4);
    }

    &:first-child {
      background-color: transparent;
    }
  }

  .tableCell {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: rem(12) rem(8);
    margin-bottom: rem(7);
    height: rem(65);
    background-color: var(--color-primary-100);
    font-weight: 600;
    color: var(--a-accentTextExDark);
    &:not(:first-child) {
      font-size: rem(18);
      border: 1px solid var(--a-bgGrayLight);
      -webkit-box-shadow: 1px 3px 5px 0px rgba(0, 0, 0, 0.4);
      -moz-box-shadow: 1px 3px 5px 0px rgba(0, 0, 0, 0.4);
      box-shadow: 1px 3px 5px 0px rgba(0, 0, 0, 0.4);
    }
    &:nth-child(3) {
      border-left: none;
    }
  }

  .nameCell {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    font-weight: 600;
    color: var(--a-mainText);
    background-color: var(--color-primary-100);
    -webkit-box-shadow: 0px 3px 5px 0px rgba(0, 0, 0, 0.4);
    -moz-box-shadow: 0px 3px 5px 0px rgba(0, 0, 0, 0.4);
    box-shadow: 0px 3px 5px 0px rgba(0, 0, 0, 0.4);
  }

  .firstCell {
    border-top-left-radius: rem(10);
  }

  .lastCell {
    border-bottom-left-radius: rem(10);
  }

  .bottomRightCell {
    border-bottom-right-radius: rem(10);
  }

  .sumCell {
    display: flex;
    justify-content: center;
    grid-column: span 2;
    text-align: center;
  }

  .baseInput {
    width: 60%;
    margin-right: rem(10);
    padding: rem(4) rem(8);
    text-align: center;
    font-size: rem(18);
    border: 2px solid var(--a-borderMain);
    border-radius: rem(10);
    background-color: var(--a-white);

    &:focus {
      outline: none;
      border-color: var(--a-accentPrimary);
      box-shadow: 0 0 0 2px rgba(var(--a-accentPrimaryRgb), 0.2);
    }
  }

  .errorInput {
    border: 1px solid var(--a-borderError) !important;
    border-radius: 0.25rem !important;
    animation: pulse 1.5s infinite;
    box-shadow: 0 0 4px 0 var(--a-borderError);
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
    100% {
      opacity: 1;
    }
  }
</style>
