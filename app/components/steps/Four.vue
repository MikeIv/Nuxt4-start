<script setup lang="ts">
  import { useStepOneStore } from "~/stores/stepOne";
  import { useStepTwoStore } from "~/stores/stepTwo";
  import { useStepThreeStore } from "~/stores/stepThree";
  import { useToast } from "#imports";

  const stepOneStore = useStepOneStore();
  const stepTwoStore = useStepTwoStore();
  const stepThreeStore = useStepThreeStore();

  const tableRef = ref();

  const isSavingDraft = ref(false);
  const saveSuccess = ref(false);
  const saveSuccessMessage = ref("");

  const saveDraft = async () => {
    isSavingDraft.value = true;
    try {
      const draft = {
        status: "Draft",
        report: {
          visitors_count: stepOneStore.visitorsCount || 0,
          receipts_count: stepOneStore.checksCount || 0,
          period: {
            start: stepOneStore.dateRange?.[0] || new Date().toISOString(),
            end: stepOneStore.dateRange?.[1] || new Date().toISOString(),
          },
          kkts: stepTwoStore.kkt?.rows || [],
          cash_turnovers_without_kkt: stepTwoStore.cashKkt?.rows || [],
          cash_turnovers_non_cash: stepTwoStore.nonCash?.rows || [],
          cash_turnovers_other: stepTwoStore.otherSum?.rows || [],
          kkts_exclusions: stepThreeStore.refunds?.rows || [],
          cash_turnover_exclusions_other:
            stepThreeStore.otherAmounts?.rows || [],
          turnover_calculation: tableRef.value?.getTableData()?.rows || [],
        },
      };

      await loadReport("/tenants/reports", {
        method: "POST",
        body: draft,
      });

      saveSuccess.value = true;
      saveSuccessMessage.value = "Данные успешно сохранены в черновик";

      setTimeout(() => {
        saveSuccess.value = false;
        saveSuccessMessage.value = "";
      }, 3000);
    } catch (err) {
      console.error("Ошибка сохранения черновика:", err);
      useToast().add({
        title: "Ошибка",
        description: "Не удалось сохранить черновик",
        color: "red",
      });
    } finally {
      isSavingDraft.value = false;
    }
  };

  const handleBack = () => {
    console.log("Back");
    navigateTo("/record/3");
  };

  const {
    handleBaseInput,
    formatBaseValue,
    formatCurrency,
    savingReport,
    isSaving,
    sumWithVAT,
    sumWithoutVAT,
    baseComparisonValue,
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
        sum: rentPercentage || "0",
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

  onMounted(async () => {
    try {
      await loadReport("/tenants/reports/-1");
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error);
    }
  });

  const handleDownloadReport = async () => {
    if (!reportId.value) return;

    try {
      await downloadReport(reportId.value);
    } catch (error) {
      console.error("Ошибка при скачивании отчета:", error);
    }
  };
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
            <div :class="[$style.tableCell, $style.nameCell]">
              {{ row.name }}
            </div>

            <template
              v-if="row.name === 'База сравнения за отчетный период, руб.'"
            >
              <div :class="[$style.tableCell, $style.sumCell]" :colspan="2">
                <input
                  :value="baseComparisonValue"
                  type="text"
                  :class="$style.baseInput"
                  @input="handleBaseInput($event)"
                  @blur="formatBaseValue()"
                />
                <span>₽</span>
              </div>
            </template>
            <template v-else-if="row.name === 'Процент с Денежного оборота, %'">
              <div :class="[$style.tableCell, $style.sumCell]" :colspan="2">
                {{
                  Number(row.sum) === Math.floor(row.sum)
                    ? Math.floor(row.sum)
                    : row.sum
                }}%
              </div>
            </template>
            <template
              v-else-if="row.name === 'Процент с Денежного оборота, руб'"
            >
              <div :class="$style.tableCell">
                {{ row.with_nds ? formatCurrency(row.with_nds) : "" }}
              </div>
              <div :class="$style.tableCell">
                {{ row.without_nds ? formatCurrency(row.without_nds) : "" }}
              </div>
            </template>
            <template
              v-else-if="row.name === 'Плата с Денежного оборота, руб.'"
            >
              <div :class="$style.tableCell">
                {{ formatCurrency(row.with_nds) }}
              </div>
              <div :class="$style.tableCell">
                {{ formatCurrency(row.without_nds) }}
              </div>
            </template>
            <template v-else>
              <div :class="$style.tableCell">
                {{
                  row.with_nds ? formatCurrency(parseFloat(row.with_nds)) : ""
                }}
              </div>
              <div :class="$style.tableCell">
                {{
                  row.without_nds
                    ? formatCurrency(parseFloat(row.without_nds))
                    : ""
                }}
              </div>
            </template>
          </div>
        </div>
      </section>
    </StepsCoreMain>

    <StepsCoreNavigation :step="4" :show-back="true" :show-next="false">
      <template #back>
        <UButton class="steps-nav-btn ghost" @click="handleBack">Назад</UButton>
      </template>
      <template #action>
        <UButton
          class="steps-nav-btn ghost"
          :loading="isSavingDraft"
          @click="saveDraft"
        >
          Сохранить как черновик
        </UButton>

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
          :loading="isSaving"
          @click="savingReport"
        >
          {{ isSaving ? "Формирование..." : "Сформировать отчет" }}
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
      </template>
    </StepsCoreNavigation>
  </div>
</template>

<style module lang="scss">
  .section {
    margin-bottom: rem(24);
  }

  .table {
    display: grid;
    grid-template-columns: 1fr 240px 240px;
    max-width: rem(820);
    border: none;
    font-size: rem(14);
  }

  .tableRow {
    display: contents;
  }

  .tableHeaderCell {
    display: flex;
    justify-content: center;
    padding: rem(12) rem(8);
    background-color: var(--a-bgLight);
    font-weight: bold;
    text-align: center;

    &:first-child {
      background-color: transparent;
    }
  }

  .tableCell {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: rem(12) rem(8);
    background-color: var(--a-white);
    border-bottom: 1px solid var(--a-borderLght);
    border-right: 1px solid var(--a-borderLght);
    font-weight: 600;
    color: var(--a-accentTextExDark);
  }

  .nameCell {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    font-weight: 600;
    color: var(--a-mainText);
    background-color: var(--a-white);
  }

  .sumCell {
    display: flex;
    justify-content: center;
    grid-column: span 2;
    text-align: center;
  }

  .baseInput {
    width: 80%;
    padding: rem(4) rem(8);
    text-align: left;
    font-size: rem(14);
    border: 1px solid var(--a-borderMain);
    border-radius: rem(4);
    background-color: var(--a-mainBg);

    &:focus {
      outline: none;
      border-color: var(--a-accentPrimary);
      box-shadow: 0 0 0 2px rgba(var(--a-accentPrimaryRgb), 0.2);
    }
  }
</style>
