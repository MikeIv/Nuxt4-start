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
  } = useApi<UserData>();
  const stepOneStore = useStepOneStore();
  const stepTwoStore = useStepTwoStore();
  const stepThreeStore = useStepThreeStore();
  const stepFourStore = useStepFourStore();

  const hasChanges = ref(false);
  const baseComparisonValue = ref<number | null>(null);
  const baseComparisonError = ref(true);
  const isSavingReport = ref(false);
  const reportSaved = ref(false);
  const shouldResetOnLeave = ref(false);

  const normalizeNumber = (
    value: string | number | null | undefined,
  ): number => {
    if (value === null || value === undefined || value === "") return 0.0;

    // Приводим к строке
    let s = String(value);

    s = s.replace(/\u00A0/g, " ").replace(/\s+/g, "");

    s = s.replace(/,/g, ".");

    // Оставляем только цифры, минус и точку
    s = s.replace(/[^0-9.]/g, "");

    if (s === "" || s === ".") return 0.0;

    const parsed = Number(s);
    if (isNaN(parsed)) return 0.0;

    // Возвращаем число с 2 знаками (как number, не как строку)
    return Number(parsed.toFixed(2));
  };

  baseComparisonValue.value = stepFourStore.baseComparisonValue;
  baseComparisonError.value = baseComparisonValue.value === null;

  const rentPercentage = computed(() => {
    const raw = reportData.value?.report?.rent_percentage;
    return raw ? parseFloat(raw) : 0;
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
    return Math.max(
      0,
      (percentageWithoutVAT.value - baseComparisonValue.value) * 1.2,
    );
  });

  const paymentWithoutVAT = computed(() => {
    return Math.max(0, percentageWithoutVAT.value - baseComparisonValue.value);
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

    // Разрешаем цифры
    if (/^\d$/.test(event.key)) return;

    // Разрешаем одну запятую (если в строке ещё нет)
    const target = event.target as HTMLInputElement;
    if (event.key === "," && !target.value.includes(",")) return;

    // Всё остальное блокируем
    event.preventDefault();
  };

  // Проверка ошибки (для красного бордера)
  const shouldShowBaseError = () => {
    return baseComparisonError.value;
  };

  const savingReport = async () => {
    isSavingReport.value = true;
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
          comparison_base: normalizeNumber(baseComparisonValue.value) || 0,
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

      if (response) {
        reportSaved.value = true;
      }
      shouldResetOnLeave.value = true;

      return response;
    } catch (err) {
      console.error("Ошибка при сохранении отчета:", err);
      throw err;
    } finally {
      isSavingReport.value = false;
    }
  };

  const displayBaseValue = ref<string>("");

  const formatNumberDisplay = (value: string): string => {
    if (!value) return "";

    // Если пользователь только начал вводить запятую, не теряем её
    if (value.endsWith(",")) {
      const integerPart = value
        .slice(0, -1)
        .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      return `${integerPart},`;
    }

    const [integerPart, decimalPart] = value.split(",");
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    return decimalPart !== undefined
      ? `${formattedInteger},${decimalPart}`
      : formattedInteger;
  };

  const formatNumberInput = (value: string): string => {
    let cleaned = value.replace(/[^\d,]/g, "");
    if (cleaned.startsWith(",")) cleaned = cleaned.slice(1);

    const commaIndex = cleaned.indexOf(",");
    if (commaIndex !== -1) {
      const integerPart = cleaned.slice(0, commaIndex);
      let decimalPart = cleaned.slice(commaIndex + 1).replace(/,/g, "");
      if (decimalPart.length > 2) decimalPart = decimalPart.slice(0, 2);
      cleaned = integerPart + "," + decimalPart;
    }

    return cleaned;
  };

  const formatNumberBlur = (value: string): string => {
    if (!value) return "";
    if (!value.includes(",")) return `${value},00`;

    const [integer, decimal] = value.split(",");
    const paddedDecimal = (decimal || "").padEnd(2, "0").slice(0, 2);
    return `${integer},${paddedDecimal}`;
  };

  const handleFormattedBaseInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const rawValue = target.value;
    const cursorPos = target.selectionStart || 0;

    // чистим значение
    let cleanedValue = formatNumberInput(rawValue);
    if (cleanedValue.startsWith(",")) cleanedValue = cleanedValue.slice(1);

    // формат для отображения
    const display = formatNumberDisplay(cleanedValue);

    // считаем чистое значение для хранения
    const numericValue = parseFloat(
      cleanedValue.replace(/\s/g, "").replace(",", "."),
    );
    baseComparisonValue.value = isNaN(numericValue) ? null : numericValue;
    stepFourStore.setBaseComparisonValue(baseComparisonValue.value);

    // курсор
    let digitsBeforeCursor = 0;
    for (let i = 0; i < cursorPos; i++) {
      if (/[0-9]/.test(rawValue[i])) digitsBeforeCursor++;
      if (rawValue[i] === "," && i === cursorPos - 1) digitsBeforeCursor++;
    }

    let newCursorPos = 0;
    let digitCount = 0;
    while (digitCount < digitsBeforeCursor && newCursorPos < display.length) {
      if (/[0-9]/.test(display[newCursorPos])) digitCount++;
      newCursorPos++;
    }

    if (rawValue[cursorPos - 1] === ",") newCursorPos++;

    target.value = display;
    target.setSelectionRange(newCursorPos, newCursorPos);
    displayBaseValue.value = target.value;

    baseComparisonError.value = baseComparisonValue.value === null;
  };

  const handleFormattedBaseBlur = (event: FocusEvent) => {
    const target = event.target as HTMLInputElement;
    let value = target.value;
    value = formatNumberBlur(value);
    target.value = formatNumberDisplay(value);
  };

  return {
    hasChanges,
    baseComparisonValue,
    isSavingReport,
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
    preventNonNumericInput,
    handleFormattedBaseInput,
    handleFormattedBaseBlur,
    formatNumberDisplay,
    shouldShowBaseError,
    savingReport,
    loadReport,
    displayBaseValue,
    isLoading,
    error,
    reportData,
    stepTwoStore,
    stepThreeStore,
  };
};
