type NumberField =
  | "start_meter_reading"
  | "end_meter_reading"
  | "amount_without_advance_nds"
  | "advance_without_certificates_with_nds"
  | "advance_without_certificates_nds";

type ValidationRules = {
  min?: number;
  max?: number;
  required?: boolean;
  allowZero?: boolean;
  customValidator?: (value: string) => string | null;
};

type NumberRow = Record<NumberField, string>;

export const useNumberFields = (
  editableRows: Ref<NumberRow[]>,
  numberErrors: Ref<Record<number, string>>,
  fieldValidations: Partial<Record<NumberField, ValidationRules>> = {},
) => {
  const displayValues = ref<
    Record<number, Partial<Record<NumberField, string>>>
  >({});

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

    if (cleaned.startsWith(",")) {
      cleaned = cleaned.replace(/^,/, "");
    }

    const commaIndex = cleaned.indexOf(",");
    if (commaIndex !== -1) {
      const integerPart = cleaned.slice(0, commaIndex);
      let decimalPart = cleaned.slice(commaIndex + 1).replace(/,/g, "");

      if (decimalPart.length > 2) {
        decimalPart = decimalPart.slice(0, 2);
      }

      cleaned = integerPart + "," + decimalPart;
    }

    return cleaned;
  };

  const formatNumberBlur = (value: string): string => {
    if (!value) return "";

    // Добавляем .00 если нет десятичной части
    if (!value.includes(",")) {
      return `${value},00`;
    }

    // Дополняем до 2 знаков после запятой
    const [integer, decimal] = value.split(",");
    const paddedDecimal = (decimal || "").padEnd(2, "0").slice(0, 2);
    return `${integer},${paddedDecimal}`;
  };

  const handleNumberInput = (
    event: Event,
    field: NumberField,
    index: number,
  ): void => {
    const target = event.target as HTMLInputElement;
    let value = target.value;

    const selectionStart = target.selectionStart;

    value = formatNumberInput(value);

    editableRows.value[index][field] = value;

    const display = formatNumberDisplay(value);

    if (!displayValues.value[index]) displayValues.value[index] = {};
    displayValues.value[index][field] = display;

    target.value = display;

    const newCursorPos = Math.min(selectionStart ?? 0, display.length);
    target.setSelectionRange(newCursorPos, newCursorPos);

    clearFieldError(index, field);
  };

  /**
   * Обработчик потери фокуса для числовых полей
   */
  const handleNumberBlur = (field: NumberField, index: number): void => {
    let value = editableRows.value[index][field];

    // Форматируем значение при потере фокуса
    value = formatNumberBlur(value);
    editableRows.value[index][field] = value;

    if (!displayValues.value[index]) displayValues.value[index] = {};
    displayValues.value[index][field] = formatNumberDisplay(value);

    validateField(field, index);

    if (field === "start_meter_reading" || field === "end_meter_reading") {
      validateMeterReadings(index);
    }
  };

  const validateField = (field: NumberField, index: number): boolean => {
    const value = editableRows.value[index][field];
    const rules = fieldValidations[field] || {};
    let error: string | null = null;

    if (rules.required && !value) {
      error = "";
    } else if (value === "" && !rules.allowZero && rules.required) {
      error = "";
    } else if (rules.min !== undefined && value) {
      const numValue = parseFloat(value.replace(",", "."));
      if (numValue < rules.min) {
        error = `Значение не может быть меньше ${rules.min.toFixed(2).replace(".", ",")}`;
      }
    } else if (rules.max !== undefined && value) {
      const numValue = parseFloat(value.replace(",", "."));
      if (numValue > rules.max) {
        error = `Значение не может быть больше ${rules.max.toFixed(2).replace(".", ",")}`;
      }
    } else if (rules.customValidator && value) {
      error = rules.customValidator(value);
    }

    if (error) {
      numberErrors.value[index] = error;
      return false;
    }

    clearFieldError(index, field);
    return true;
  };

  /**
   * Специальная валидация для показаний счетчиков
   */
  const validateMeterReadings = (index: number): void => {
    const startStr = editableRows.value[index].start_meter_reading || "";
    const endStr = editableRows.value[index].end_meter_reading || "";

    // Если оба поля заполнены
    if (startStr && endStr) {
      const start = parseFloat(startStr.replace(",", "."));
      const end = parseFloat(endStr.replace(",", "."));

      if (start > end) {
        numberErrors.value[index] =
          "Начальное значение не может быть больше конечного";
      } else {
        // Если ошибка была именно про показания счетчиков - очищаем
        if (
          numberErrors.value[index] ===
          "Начальное значение не может быть больше конечного"
        ) {
          clearFieldError(index, "start_meter_reading");
        }
      }
    }
  };

  const clearFieldError = (index: number, field?: NumberField): void => {
    if (!field) return; // очищаем только конкретное поле
    const currentError = numberErrors.value[index];

    // Если ошибка про показания счётчиков — не сбрасываем при вводе в другом поле
    if (
      field !== "start_meter_reading" &&
      field !== "end_meter_reading" &&
      currentError === "Начальное значение не может быть больше конечного"
    ) {
      return;
    }

    numberErrors.value[index] = undefined;
  };

  const shouldShowError = (index: number, field: NumberField): boolean => {
    const value = editableRows.value[index][field];
    const error = numberErrors.value[index];
    const rules = fieldValidations[field] || {};

    if (error) return true;

    if (rules.required && !value) return true;

    return false;
  };

  return {
    handleNumberInput,
    handleNumberBlur,
    shouldShowError,
    validateField,
    displayValues,
    formatNumberDisplay,
  };
};
