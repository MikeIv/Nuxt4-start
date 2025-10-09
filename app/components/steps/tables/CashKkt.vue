<script setup lang="ts">
  import type { FileData, CashTableRow } from "~/types/tables";
  import { useNdsValidation } from "~/composables/tables/useNdsValidation";

  const stepTwoStore = useStepTwoStore();

  const props = defineProps({
    headers: {
      type: Array,
      default: () => [],
    },
    initialData: {
      type: Array as () => CashTableRow[],
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
    error: {
      type: [String, Boolean],
      default: false,
    },
  });

  const emit = defineEmits<{
    (
      e: "update:totalSumm" | "update:totalVAT" | "update:tableData",
      value: number | CashTableRow[],
    ): void;
    (e: "rows-added", indices: number[]): void;
    (e: "rows-removed", index: number): void;
    (
      e: "files-uploaded",
      payload: { index: number; filesData: FileData[] },
    ): void;
    (e: "file-removed", payload: { index: number; fileIndex: number }): void;
  }>();

  const editableRows = ref<CashTableRow[]>([]);
  const addedRowsIndices = ref<number[]>([]);
  const editingNameIndex = ref<number | null>(null);
  const nameInputRefs = ref<HTMLInputElement[]>([]);
  const tableMessage = ref("");
  const showRemoveButton = ref(false);
  const invalidFields = ref<Record<number, string[]>>({});
  const modifiedFields = ref<Record<number, Set<string>>>({});

  const markFieldAsModified = (index: number, field: string) => {
    if (!modifiedFields.value[index]) {
      modifiedFields.value[index] = new Set();
    }
    modifiedFields.value[index].add(field);
  };

  const fieldValidations = {
    amount_with_nds: (value: string) => {
      if (value === "0,00") return true;
      const num = parseFloat(value.replace(",", "."));
      return !isNaN(num) && num > 0;
    },
    amount_nds: (value: string) => {
      if (value === "0,00") return true;
      const num = parseFloat(value.replace(",", "."));
      return !isNaN(num) && num > 0;
    },
  } as const;

  const handleNumberInput = (
    event: Event,
    field: "amount_with_nds" | "amount_nds",
    index: number,
  ): void => {
    const target = event.target as HTMLInputElement;
    let value = target.value;

    value = value.replace(/[^\d,]/g, "");

    const commaParts = value.split(",");
    if (commaParts.length > 2) {
      value = commaParts[0] + "," + commaParts.slice(1).join("");
    }

    if (value.includes(",")) {
      const [integer, decimal] = value.split(",");
      if (decimal && decimal.length > 2) {
        value = integer + "," + decimal.slice(0, 2);
      }
    }

    editableRows.value[index][field] = value;
    target.value = value;

    if (
      field === "amount_with_nds" &&
      editableRows.value[index].amount_nds === "0,00"
    ) {
      editableRows.value[index].amount_nds = "";
      if (value === "0,00" && !editableRows.value[index].amount_nds) {
        editableRows.value[index].amount_nds = "0,00";
      }
    }

    markFieldAsModified(index, field);
    validateRow(index);
    emitUpdate();
  };

  const handleNumberBlur = (
    field: "amount_with_nds" | "amount_nds",
    index: number,
  ): void => {
    let value = editableRows.value[index][field];

    if (!value || value === ",") {
      value = "0,00";
    } else {
      if (!value.includes(",")) {
        value = value + ",00";
      } else {
        const [integer, decimal] = value.split(",");
        const paddedDecimal = (decimal || "").padEnd(2, "0").slice(0, 2);
        value = integer + "," + paddedDecimal;
      }

      if (value.startsWith("0") && value.length > 1 && value[1] !== ",") {
        value = value.replace(/^0+/, "");
        if (value === "" || value.startsWith(",")) {
          value = "0" + value;
        }
      }
    }

    if (
      field === "amount_with_nds" &&
      value === "0,00" &&
      !editableRows.value[index].amount_nds
    ) {
      editableRows.value[index].amount_nds = "0,00";
    }

    editableRows.value[index][field] = value;
    markFieldAsModified(index, field);
    validateRow(index);
    emitUpdate();
  };

  const { loading: fileLoading } = useSaveFile();
  const {
    handleFileUploaded: baseHandleFileUploaded,
    handleFileRemoved: baseHandleFileRemoved,
  } = useFileHandling<CashTableRow>({
    editableRows,
    emit,
    getFileIds: (row) => row.file_ids,
    setFileData: (row, fileData) => ({
      ...row,
      files: fileData,
      file_ids: fileData.map((file) => Number(file.id)),
    }),
  });

  // Оборачиваем валидацией, чтобы подсветка обновлялась сразу
  const handleFileUploaded = async ({
    index,
    filesData,
  }: {
    index: number;
    filesData: FileData[];
  }) => {
    await baseHandleFileUploaded({ index, filesData });
    validateRow(index);
    emitUpdate();
  };

  const handleFileRemoved = async ({
    index,
    fileIndex,
  }: {
    index: number;
    fileIndex: number;
  }) => {
    await baseHandleFileRemoved({ index, fileIndex });
    validateRow(index);
    emitUpdate();
  };

  const isRowFromAPI = (row: CashTableRow): boolean => {
    return !!(row.name && row.name.trim() !== "");
  };

  watch(
    editableRows,
    (newRows) => {
      console.log(
        "Rows data:",
        newRows.map((row) => ({
          id: row.id,
          isNew: row.isNew,
          isApiRow: isRowFromAPI(row),
          name: row.name,
        })),
      );
    },
    { immediate: true, deep: true },
  );

  const shouldShowError = (
    index: number,
    field:
      | "amount_with_nds"
      | "amount_nds"
      | "name"
      | "settlement_account_number"
      | "files",
  ): boolean => {
    return invalidFields.value[index]?.includes(field) || false;
  };

  const validateRow = (index: number) => {
    const errors: string[] = [];
    const row = editableRows.value[index];

    const name = row.name;
    const settlementAccount = row.settlement_account_number;
    const amountWithNds = row.amount_with_nds;
    const amountNds = row.amount_nds;
    const hasFileIds = row.file_ids && row.file_ids.length > 0;

    // Валидация числовых полей
    if (
      amountWithNds &&
      amountWithNds !== "0,00" &&
      !fieldValidations.amount_with_nds(amountWithNds)
    ) {
      errors.push("amount_with_nds");
    }
    if (
      amountNds &&
      amountNds !== "0,00" &&
      !fieldValidations.amount_nds(amountNds)
    ) {
      errors.push("amount_nds");
    }

    if (amountWithNds !== "0,00" && (!amountNds || amountNds === "0,00")) {
      errors.push("amount_nds");
    }

    const isNewRow = addedRowsIndices.value.includes(index) || row.isNew;

    if (isNewRow || index > 4) {
      // новые строки и все после 4-й — обязательны
      row.filesRequired = true;
      if (!name || name.trim() === "") errors.push("name");
      if (!settlementAccount || settlementAccount.trim() === "")
        errors.push("settlement_account_number");
      if (!hasFileIds) errors.push("files");
      if (!amountWithNds || amountWithNds === "0,00")
        errors.push("amount_with_nds");
      if (!amountNds || amountNds === "0,00") errors.push("amount_nds");
    } else {
      // первые 4 строки — обязательны только при суммах, номере или файлах
      const hasAmounts = amountWithNds !== "0,00" || amountNds !== "0,00";
      row.filesRequired = hasAmounts || hasFileIds || settlementAccount;

      if (row.filesRequired) {
        if (!hasFileIds) errors.push("files");
        if (!settlementAccount || settlementAccount.trim() === "")
          errors.push("settlement_account_number");
      }

      if (hasAmounts) {
        if (amountWithNds === "0,00") errors.push("amount_with_nds");
        if (amountNds === "0,00") errors.push("amount_nds");
      }

      if (amountWithNds === "0,00" && row.filesRequired)
        errors.push("amount_with_nds");
      if (amountNds === "0,00" && row.filesRequired) errors.push("amount_nds");
    }

    invalidFields.value[index] = errors;

    return errors.length === 0;
  };

  const handleSettlementInput = (event: Event, index: number) => {
    const target = event.target as HTMLInputElement;
    editableRows.value[index].settlement_account_number = target.value;
    markFieldAsModified(index, "settlement_account_number");
    validateRow(index);
    emitUpdate();
  };

  const handleSettlementBlur = (index: number) => {
    validateRow(index);
  };

  const { totalWithVAT, totalVAT } = useCashCalculations(editableRows);

  const createEmptyRow = (): CashTableRow => ({
    id: "",
    name: "",
    settlement_account_number: "",
    amount_with_nds: "0,00",
    amount_nds: "0,00",
    file_ids: [],
    files: [],
    isNew: true,
    filesRequired: false,
  });

  const normalizeRowData = (row: CashTableRow): CashTableRow => {
    return {
      ...createEmptyRow(),
      ...row,
      amount_with_nds:
        typeof row.amount_with_nds === "number"
          ? row.amount_with_nds.toFixed(2).replace(".", ",")
          : row.amount_with_nds || "0,00",
      amount_nds:
        typeof row.amount_nds === "number"
          ? row.amount_nds.toFixed(2).replace(".", ",")
          : row.amount_nds || "0,00",
      isNew: row.isNew ?? !(row.name && row.name.trim() !== ""),
      hasAmount:
        !!row.amount_with_nds ||
        !!row.amount_nds ||
        !!row.name?.trim() ||
        !!row.settlement_account_number?.trim(),
    };
  };

  const emitUpdate = () => {
    emit("update:tableData", [...editableRows.value]);
    emit("update:totalSumm", Number(totalWithVAT.value));
    emit("update:totalVAT", Number(totalVAT.value));
  };

  const addRow = async () => {
    const newRow = createEmptyRow();
    editableRows.value.push(newRow);
    const newIndex = editableRows.value.length - 1;
    addedRowsIndices.value.push(newIndex);

    const tableKey = "cashKkt";
    stepTwoStore.updateAddedRows(tableKey, [...addedRowsIndices.value]);

    showRemoveButton.value = true;

    editingNameIndex.value = newIndex;
    await nextTick();
    nameInputRefs.value[newIndex]?.focus();

    tableMessage.value = "Основание добавлено";
    emitUpdate();
    emit("rows-added", [newIndex]);

    validateRow(newIndex);
  };

  const removeLastRow = () => {
    if (editableRows.value.length <= 1 || addedRowsIndices.value.length === 0) {
      showRemoveButton.value = false;
      return;
    }

    const currentIndices = [...addedRowsIndices.value];
    const lastAddedIndex = currentIndices[currentIndices.length - 1];

    editableRows.value.splice(lastAddedIndex, 1);

    const { [lastAddedIndex]: _, ...rest } = invalidFields.value;
    invalidFields.value = rest;

    const { [lastAddedIndex]: __, ...restModified } = modifiedFields.value;
    modifiedFields.value = restModified;

    addedRowsIndices.value = currentIndices
      .filter((index) => index !== lastAddedIndex)
      .map((index) => (index > lastAddedIndex ? index - 1 : index));

    // Обновляем стор
    stepTwoStore.removeRowFromTable("cashKkt", lastAddedIndex);
    const tableKey = "cashKkt";
    stepTwoStore.updateAddedRows(tableKey, [...addedRowsIndices.value]);

    showRemoveButton.value = addedRowsIndices.value.length > 0;
    tableMessage.value = "Основание удалено";
    emitUpdate();
    emit("rows-removed", lastAddedIndex);
  };

  const handleNameChange = (index: number, event: Event) => {
    const target = event.target as HTMLInputElement;
    editableRows.value[index].name = target.value;
    markFieldAsModified(index, "name");
    validateRow(index);
    emitUpdate();
  };

  const finishNameEditing = (index: number) => {
    editingNameIndex.value = null;
    validateRow(index);
    emitUpdate();
  };

  watch(
    () => props.initialData,
    (newData) => {
      const normalized = (newData || []).map(normalizeRowData);

      // Восстанавливаем добавленные строки из Pinia
      const storedAddedRows = stepTwoStore.addedCashKktRows;
      addedRowsIndices.value = storedAddedRows?.length
        ? [...storedAddedRows]
        : [];

      // Показываем кнопку удалить, если есть добавленные строки
      showRemoveButton.value = addedRowsIndices.value.length > 0;

      editableRows.value = normalized;

      // Валидируем строки
      editableRows.value.forEach((_, index) => validateRow(index));
    },
    { immediate: true },
  );

  const isFileRequired = (row: CashTableRow, index: number) => {
    return (
      row.filesRequired ||
      invalidFields.value[index]?.includes("files") ||
      false
    );
  };

  const getTableData = () => ({
    rows: [...editableRows.value],
    totals: {
      withVAT: Number(totalWithVAT.value),
      VAT: Number(totalVAT.value),
    },
  });

  const setData = (newData: CashTableRow[]) => {
    editableRows.value = newData.map(normalizeRowData);
    invalidFields.value = {};
    modifiedFields.value = {};
    editableRows.value.forEach((_, index) => validateRow(index));
  };

  defineExpose({
    getTableData,
    setData,
  });

  const handleNumberFocus = (
    event: Event,
    field: "amount_with_nds" | "amount_nds",
    index: number,
  ): void => {
    const target = event.target as HTMLInputElement;
    if (target.value === "0,00") {
      target.value = "";
      editableRows.value[index][field] = "";
    }

    validateRow(index);
    emitUpdate();
  };

  const { getNdsError } = useNdsValidation(editableRows);
</script>

<template>
  <StepsCoreEditableBlock
    title=""
    :headers="headers"
    :model-value="editableRows"
    grid-template-columns="44px 300px 170px 400px 240px"
    :loading="loading"
    :error="error"
    :message="tableMessage"
    add-button-text="Добавить основание"
    remove-button-text="Удалить основание"
    :show-remove-button="showRemoveButton"
    is-table
    @add="addRow"
    @remove="removeLastRow"
  >
    <template #row="{ item: row, index }">
      <div class="cell body-cell" :class="$style.centre">
        {{ index + 1 }}
      </div>
      <div class="cell body-cell">
        <template v-if="row.isNew">
          <input
            :ref="(el) => (nameInputRefs[index] = el as HTMLInputElement)"
            type="text"
            :value="row.name"
            placeholder="Введите название"
            class="name-input"
            :class="[
              {
                [$style.errorInput]: shouldShowError(index, 'name'),
              },
            ]"
            @input="handleNameChange(index, $event)"
            @blur="finishNameEditing(index)"
            @keyup.enter="finishNameEditing(index)"
          />
        </template>
        <template v-else>
          <span>{{ row.name }}</span>
        </template>
      </div>

      <div class="cell body-cell">
        <input
          type="text"
          :value="row.settlement_account_number || ''"
          placeholder="введите номер"
          :class="{
            [$style.errorInput]: shouldShowError(
              index,
              'settlement_account_number',
            ),
          }"
          @input="handleSettlementInput($event, index)"
          @blur="handleSettlementBlur(index)"
        />
      </div>

      <div class="cell" :class="$style.cellRow">
        <div>
          <input
            type="text"
            :value="row.amount_with_nds"
            placeholder="0,00"
            :class="[
              $style.inputField,
              {
                [$style.errorInput]: shouldShowError(index, 'amount_with_nds'),
              },
            ]"
            @input="handleNumberInput($event, 'amount_with_nds', index)"
            @blur="handleNumberBlur('amount_with_nds', index)"
            @focus="handleNumberFocus($event, 'amount_with_nds', index)"
          />
        </div>
        <div :class="$style.inputWrapper">
          <input
            type="text"
            :value="row.amount_nds"
            placeholder="0,00"
            :class="[
              $style.inputField,
              {
                [$style.errorInput]:
                  shouldShowError(index, 'amount_nds') || getNdsError(row),
              },
            ]"
            @input="handleNumberInput($event, 'amount_nds', index)"
            @blur="handleNumberBlur('amount_nds', index)"
            @focus="handleNumberFocus($event, 'amount_nds', index)"
          />
          <div v-if="getNdsError(row)" :class="$style.errorMessage">
            {{ getNdsError(row) }}
          </div>
        </div>
      </div>

      <div class="cell body-cell">
        <StepsCoreFileUploader
          :index="index"
          prefix="cash-kkt-file"
          :loading="fileLoading"
          :multiple="true"
          :max-files="3"
          :files="row.files || []"
          :file-ids="row.file_ids || []"
          :is-required="isFileRequired(row, index)"
          :has-error="shouldShowError(index, 'files')"
          @files-uploaded="
            ({ filesData }) => handleFileUploaded({ index, filesData })
          "
          @file-removed="
            ({ fileIndex }) => handleFileRemoved({ index, fileIndex })
          "
        />
      </div>
    </template>

    <template #footer>
      <StepsCoreTotalSummary
        :total-summ="Number(totalWithVAT)"
        :total-v-a-t="Number(totalVAT)"
      />
    </template>
  </StepsCoreEditableBlock>
</template>

<style module lang="scss">
  .cellRow {
    display: flex;
    justify-content: space-around;
    align-items: center;
    gap: rem(8);
    font-size: rem(12);
    font-weight: bold;
    border-right: 1px solid var(--a-borderLght);
    background-color: var(--a-bgTable);
    border-bottom: 1px solid var(--a-borderAccentLight);
  }

  .centre {
    align-items: center;
  }

  .inputField {
    width: 100%;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--a-borderAccentLight);
    background-color: var(--a-mainBg);
    border-radius: 0.25rem;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--a-borderAccent);
    }
  }

  .errorInput {
    border: 1px solid var(--a-borderError) !important;
    border-radius: 0.25rem !important;
    animation: pulse 1.5s infinite;
    box-shadow: 0 0 4px 0 var(--a-borderError);
  }

  .inputWrapper {
    position: relative;
    display: inline-block;
  }

  .errorMessage {
    position: absolute;
    bottom: 100%;
    left: 0;
    background-color: var(--a-errorText);
    color: var(--a-white);
    font-size: rem(10);
    padding: rem(2) rem(6);
    border-radius: rem(4);
    white-space: nowrap;
    transform: translateY(-10px);
    z-index: 10;

    &::after {
      content: "";
      position: absolute;
      top: 100%;
      left: 10px;
      border-width: 5px;
      border-style: solid;
      border-color: var(--a-errorText) transparent transparent transparent;
    }
  }

  .name-input {
    width: 100%;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--a-borderAccentLight);
    background-color: var(--a-mainBg);
    border-radius: 0.25rem;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--a-borderAccent);
    }
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
