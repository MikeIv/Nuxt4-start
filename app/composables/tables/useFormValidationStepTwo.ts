export interface TableData {
  rows: unknown[];
  totals: {
    withVAT: number;
    VAT: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  error: string;
}

export const useFormValidation = (
  kktTableRef: Ref<unknown>,
  cashKktTableRef: Ref<unknown>,
  nonCashTableRef: Ref<unknown>,
  otherSumTableRef: Ref<unknown>,
) => {
  const validateForm = (): ValidationResult => {
    const getTableData = (ref: Ref<unknown>): TableData =>
      ref.value?.getTableData?.() || {
        rows: [],
        totals: { withVAT: 0, VAT: 0 },
      };

    const tablesData = {
      kkt: getTableData(kktTableRef),
      cashKkt: getTableData(cashKktTableRef),
      nonCash: getTableData(nonCashTableRef),
      otherSum: getTableData(otherSumTableRef),
    };

    if (tablesData.kkt.rows.length === 0) {
      return { isValid: false, error: "Таблица ККТ не может быть пустой" };
    }

    const kktInvalid = tablesData.kkt.rows.some(
      (row) =>
        !row.registration_number ||
        row.registration_number.length !== 16 ||
        isNaN(parseFloat(row.start_meter_reading)) ||
        isNaN(parseFloat(row.end_meter_reading)) ||
        (row.file_ids?.length ?? 0) === 0,
    );

    if (kktInvalid) {
      return {
        isValid: false,
        error: "Заполните все обязательные поля в таблице ККТ",
      };
    }

    const validateNonEmptyTable = (
      table: TableData,
      tableName: string,
    ): string | null => {
      if (table.rows.length > 0) {
        const invalidRow = table.rows.find(
          (row) =>
            // !row.name ||
            isNaN(parseFloat(row.amount_with_nds)) ||
            isNaN(parseFloat(row.amount_nds)),
          // (row.file_ids?.length ?? 0) === 0,
        );

        return invalidRow
          ? `Заполните все обязательные поля в таблице ${tableName}`
          : null;
      }
      return null;
    };

    const cashKktInvalid = tablesData.cashKkt.rows.some((row, index) => {
      const amountWithNdsFilled =
        row.amount_with_nds && row.amount_with_nds !== "0,00";
      const amountNdsFilled = row.amount_nds && row.amount_nds !== "0,00";
      const settlementFilled =
        row.settlement_account_number &&
        row.settlement_account_number.trim() !== "";
      const nameFilled = row.name && row.name.trim() !== "";
      const hasFiles = (row.file_ids?.length ?? 0) > 0;

      if (index < 4) {
        const isEmptyRowTab2 =
          !amountWithNdsFilled &&
          !amountNdsFilled &&
          !settlementFilled &&
          !hasFiles;
        if (isEmptyRowTab2) return false; // полностью пустая строка игнорируется

        // Если 3-я колонка заполнена, все остальные поля обязательны
        if (settlementFilled) {
          if (
            !amountWithNdsFilled ||
            !amountNdsFilled ||
            !nameFilled ||
            !hasFiles
          )
            return true;
          return false;
        }

        // Если 3-я колонка пустая, только она обязательна при заполненных остальных
        if (amountWithNdsFilled || amountNdsFilled || nameFilled || hasFiles) {
          return !settlementFilled;
        }

        return false;
      }

      // строки с 5-й и далее — все поля обязательны
      if (
        !nameFilled ||
        !settlementFilled ||
        !amountWithNdsFilled ||
        !amountNdsFilled ||
        !hasFiles
      )
        return true;

      return false;
    });

    if (cashKktInvalid) {
      return {
        isValid: false,
        error: "Заполните все обязательные поля в таблице 2.2",
      };
    }

    const nonCashInvalid = tablesData.nonCash.rows.some((row, index) => {
      const amountWithNdsFilled =
        row.amount_with_nds && row.amount_with_nds !== "0,00";
      const amountNdsFilled = row.amount_nds && row.amount_nds !== "0,00";
      const nameFilled = row.name && row.name.trim() !== "";
      const hasFiles = (row.file_ids?.length ?? 0) > 0;

      if (index < 3) {
        const isEmptyRowTab3 =
          !amountNdsFilled && !amountWithNdsFilled && !hasFiles;

        if (isEmptyRowTab3) return false;
      }

      if (!nameFilled || !hasFiles || !amountNdsFilled || !amountWithNdsFilled)
        return true;

      return false;
    });

    if (nonCashInvalid) {
      return {
        isValid: false,
        error: "Заполните все обязательные поля в таблице 2.3",
      };
    }

    const otherSumInvalid = tablesData.otherSum.rows.some(
      (row) =>
        !row.name ||
        isNaN(parseFloat(row.amount_with_nds)) ||
        isNaN(parseFloat(row.amount_nds)) ||
        (row.file_ids?.length ?? 0) === 0,
    );

    if (otherSumInvalid) {
      return {
        isValid: false,
        error: "Заполните все обязательные поля в таблице 2.4",
      };
    }

    const nonCashError = validateNonEmptyTable(tablesData.nonCash, "2.3");

    return {
      isValid:
        !cashKktInvalid || !nonCashInvalid || !otherSumInvalid || !nonCashError,
      error: cashKktInvalid
        ? "Заполните все обязательные поля в таблице 2.2"
        : nonCashInvalid
          ? "Заполните все обязательные поля в таблице 2.3"
          : otherSumInvalid
            ? "Заполните все обязательные поля в таблице 2.4"
            : "",
    };
  };

  return {
    validateForm,
  };
};
