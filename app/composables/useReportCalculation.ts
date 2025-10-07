import { useApi } from "~/composables/useApi";
import { useStepOneStore } from "~/stores/stepOne";
import { useStepTwoStore } from "~/stores/stepTwo";
import { useStepThreeStore } from "~/stores/stepThree";
import { useStepFourStore } from "~/stores/stepFour";
import { useUserStore } from "#imports";

const userStore = useUserStore();
const contractId = computed(() => userStore.user?.id || null);

export const useReportCalculation = () => {
  const {
    callApi: loadReport,
    data: reportData,
    isLoading,
    error,
  } = useApi<unknown>();
  const stepOneStore = useStepOneStore();
  const stepTwoStore = useStepTwoStore();
  const stepThreeStore = useStepThreeStore();
  const stepFourStore = useStepFourStore();

  const hasChanges = ref(false);
  const baseComparisonValue = ref<number | null>(null);
  const baseComparisonError = ref(true);
  const isSaving = ref(false);
  const reportSaved = ref(false);
  const shouldResetOnLeave = ref(false);

  const normalizeNumber = (
    value: string | number | null | undefined,
  ): number => {
    if (value === null || value === undefined || value === "") return 0.0;

    const normalized = value.toString().replace(",", ".").trim();
    const parsed = Number(normalized);

    if (isNaN(parsed)) return 0.0;

    // Возвращаем число с фиксированной точностью (2 знака после запятой)
    return Number(parsed.toFixed(2));
  };

  baseComparisonValue.value = stepFourStore.baseComparisonValue;
  baseComparisonError.value = baseComparisonValue.value === null;

  const rentPercentage = computed(() => {
    return reportData.value?.report?.rent_percentage ?? 0;
  });

  const sumWithVAT = computed(() => {
    return stepTwoStore.totalWithVAT - stepThreeStore.totalWithVAT;
  });

  const sumWithoutVAT = computed(() => {
    return stepTwoStore.totalWithoutVAT - stepThreeStore.totalWithoutVAT;
  });

  const percentageWithVAT = computed(() => {
    const total = stepTwoStore.totalWithVAT - stepThreeStore.totalWithVAT;
    return ((total || 0) * (rentPercentage.value || 0)) / 100;
  });

  const percentageWithoutVAT = computed(() => {
    const total = stepTwoStore.totalWithoutVAT - stepThreeStore.totalWithoutVAT;
    return ((total || 0) * (rentPercentage.value || 0)) / 100;
  });

  const paymentWithVAT = computed(() => {
    return Math.max(0, percentageWithVAT.value - baseComparisonValue.value);
  });

  const paymentWithoutVAT = computed(() => {
    return Math.max(
      0,
      (percentageWithVAT.value - baseComparisonValue.value) / 1.2,
    );
  });

  const formatCurrency = (value: number | string): string => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(isNaN(numValue) ? 0 : numValue);
  };

  const handleBaseInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const cleanedValue: number | null = target.value.replace(/\D/g, "")
      ? Number(target.value.replace(/\D/g, ""))
      : null;

    baseComparisonValue.value = cleanedValue;
    stepFourStore.setBaseComparisonValue(cleanedValue); // сохраняем в store

    baseComparisonError.value = cleanedValue === null;

    console.log("baseComparisonValue:", baseComparisonValue.value);
  };

  // Блокировка ввода любых символов кроме цифр
  const preventNonNumericInput = (event: KeyboardEvent) => {
    const allowedKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "Enter",
    ];

    if (allowedKeys.includes(event.key)) return;

    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  };

  // Проверка ошибки (для красного бордера)
  const shouldShowBaseError = () => {
    return baseComparisonError.value;
  };

  const formatBaseValue = (event: FocusEvent) => {
    const target = event.target as HTMLInputElement;
    if (baseComparisonValue.value !== null) {
      target.value = `${baseComparisonValue.value},00`;
    } else {
      target.value = "";
    }
  };

  const savingReport = async () => {
    isSaving.value = true;
    try {
      if (!stepOneStore.dateRange || stepOneStore.dateRange.length < 2) {
        throw new Error("Не указан период отчета");
      }

      // Проверяем наличие данных в хранилищах
      console.log("StepTwoStore data:", stepTwoStore.getAllData());
      console.log("StepThreeStore data:", stepThreeStore.getAllData());

      const reportPayload = {
        status: "Submitted",
        report: {
          visitors_count: stepOneStore.visitorsCount || 0,
          receipts_count: stepOneStore.checksCount || 0,
          comparison_base: baseComparisonValue.value || 0,
          rent_percentage: rentPercentage.value || 0,
          kkts: stepTwoStore.kkt.rows.map((row) => ({
            name: row.name || "",
            registration_number: row.registration_number || "",
            start_meter_reading: normalizeNumber(row.start_meter_reading) || 0,
            end_meter_reading: normalizeNumber(row.end_meter_reading) || 0,
            amount_without_advance_with_nds:
              normalizeNumber(row.amount_without_advance_with_nds) || 0,
            amount_without_advance_nds:
              normalizeNumber(row.amount_without_advance_nds) || 0,
            advance_without_certificates_with_nds:
              normalizeNumber(row.advance_without_certificates_with_nds) || 0,
            advance_without_certificates_nds:
              normalizeNumber(row.advance_without_certificates_nds) || 0,
            file_ids: row.file_ids || [],
          })),
          cash_turnovers_without_kkt: stepTwoStore.cashKkt.rows.map((row) => ({
            name: row.name || "",
            settlement_account_number: row.settlement_account_number || "",
            amount_with_nds: normalizeNumber(row.amount_with_nds) || 0,
            amount_nds: normalizeNumber(row.amount_nds) || 0,
            file_ids: row.file_ids || [],
          })),
          cash_turnovers_non_cash: stepTwoStore.nonCash.rows.map((row) => ({
            name: row.name || "",
            amount_with_nds: normalizeNumber(row.amount_with_nds) || 0,
            amount_nds: normalizeNumber(row.amount_nds) || 0,
            file_ids: row.file_ids || [],
          })),
          cash_turnovers_other: stepTwoStore.otherSum.rows.map((row) => ({
            name: row.name || "",
            amount_with_nds: normalizeNumber(row.amount_with_nds) || 0,
            amount_nds: normalizeNumber(row.amount_nds) || 0,
            file_ids: row.file_ids || [],
          })),
          kkts_exclusions: stepThreeStore.refunds.rows.map((row) => ({
            name: row.name || "",
            registration_number: row.registration_number || "",
            returns_goods_services_with_nds:
              normalizeNumber(row.returns_goods_services_with_nds) || 0,
            returns_goods_services_nds:
              normalizeNumber(row.returns_goods_services_nds) || 0,
            gift_certificates_sold_with_nds:
              normalizeNumber(row.gift_certificates_sold_with_nds) || 0,
            gift_certificates_sold_nds:
              normalizeNumber(row.gift_certificates_sold_nds) || 0,
            file_ids: row.file_ids || [],
          })),
          cash_turnover_exclusions_other: stepThreeStore.otherAmounts.rows.map(
            (row) => ({
              name: row.name || "",
              amount_with_nds: normalizeNumber(row.amount_with_nds) || 0,
              amount_nds: normalizeNumber(row.amount_nds) || 0,
              file_ids: row.file_ids || [],
            }),
          ),
          period: {
            start: new Date(stepOneStore.dateRange[0]).toISOString(),
            end: new Date(stepOneStore.dateRange[1]).toISOString(),
          },
        },
      };

      if (!contractId.value) {
        console.error("Contract ID not available");
        return;
      }

      const headers = {
        "Contract-id": contractId.value.toString(),
      };

      console.log("Sending report payload:", reportPayload);
      const response = await loadReport("/tenants/reports", {
        method: "POST",
        body: reportPayload,
        headers,
      });

      if (!response) {
        throw new Error("Не удалось сохранить отчет");
      }

      reportSaved.value = true;
      shouldResetOnLeave.value = true;

      return response;
    } catch (err) {
      console.error("Ошибка при сохранении отчета:", err);
      throw err;
    } finally {
      isSaving.value = false;
    }
  };

  return {
    hasChanges,
    baseComparisonValue,
    isSaving,
    reportSaved,
    shouldResetOnLeave,
    sumWithVAT,
    sumWithoutVAT,
    rentPercentage,
    percentageWithVAT,
    percentageWithoutVAT,
    paymentWithVAT,
    paymentWithoutVAT,
    formatCurrency,
    handleBaseInput,
    preventNonNumericInput,
    shouldShowBaseError,
    formatBaseValue,
    savingReport,
    loadReport,
    isLoading,
    error,
    reportData,
    stepTwoStore,
    stepThreeStore,
  };
};
