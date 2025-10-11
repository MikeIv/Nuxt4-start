<script setup lang="ts">
  import type { FileData, OverSumTableRow } from "~/types/tables";
  import { useNdsValidation } from "~/composables/tables/useNdsValidation";

  const stepTwoStore = useStepTwoStore();

  const props = defineProps({
    headers: {
      type: Array,
      default: () => [],
    },
    initialData: {
      type: Array as () => OverSumTableRow[],
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
      value: number | OverSumTableRow[],
    ): void;
    (e: "rows-added", indices: number[]): void;
    (e: "rows-removed", index: number): void;
    (
      e: "files-uploaded",
      payload: { index: number; filesData: FileData[] },
    ): void;
    (e: "file-removed", payload: { index: number; fileIndex: number }): void;
  }>();

  const editableRows = ref<OverSumTableRow[]>([]);
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

  type NumberField = "amount_with_nds" | "amount_nds";

  const displayValues = ref<
    Record<NumberField, Partial<Record<number, string>>>
  >({ amount_with_nds: {}, amount_nds: {} });

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
    field: "amount_with_nds" | "amount_nds",
    index: number,
  ): void => {
    const target = event.target as HTMLInputElement;
    const rawValue = target.value;
    const cursorPos = target.selectionStart || 0;

    // чистим значение
    let cleanedValue = formatNumberInput(rawValue);
    if (cleanedValue.startsWith(",")) cleanedValue = cleanedValue.slice(1);

    // ограничиваем 2 знака после запятой
    const commaIndex = cleanedValue.indexOf(",");
    if (commaIndex !== -1) {
      const integerPart = cleanedValue.slice(0, commaIndex);
      let decimalPart = cleanedValue.slice(commaIndex + 1).replace(/,/g, "");
      if (decimalPart.length > 2) decimalPart = decimalPart.slice(0, 2);
      cleanedValue = integerPart + "," + decimalPart;
    }

    editableRows.value[index][field] = cleanedValue;

    const display = formatNumberDisplay(cleanedValue);
    if (!displayValues.value[index]) displayValues.value[index] = {};
    displayValues.value[index][field] = display;

    if (field === "amount_with_nds") {
      const ndsValue = editableRows.value[index].amount_nds;
      if (ndsValue === "0,00") {
        editableRows.value[index].amount_nds = "";
        if (!displayValues.value[index]) displayValues.value[index] = {};
        displayValues.value[index].amount_nds = "";
      }
    }

    // пересчитываем курсор
    let digitsBeforeCursor = 0;
    for (let i = 0; i < cursorPos; i++) {
      if (/[0-9]/.test(rawValue[i])) digitsBeforeCursor++;
      // если пользователь ввел запятую в конце, считаем её как позицию
      if (rawValue[i] === "," && i === cursorPos - 1) digitsBeforeCursor++;
    }

    let newCursorPos = 0;
    let digitCount = 0;
    while (digitCount < digitsBeforeCursor && newCursorPos < display.length) {
      if (/[0-9]/.test(display[newCursorPos])) digitCount++;
      newCursorPos++;
    }

    // если пользователь только что ввел запятую, ставим курсор после неё
    if (rawValue[cursorPos - 1] === ",") newCursorPos++;

    target.value = display;
    target.setSelectionRange(newCursorPos, newCursorPos);

    markFieldAsModified(index, field);
    validateRow(index);
    emitUpdate();
  };

  const handleNumberBlur = (
    field: "amount_with_nds" | "amount_nds",
    index: number,
  ): void => {
    let value = editableRows.value[index][field];

    if (!value || value.trim() === "") {
      value = "0,00";
    } else {
      // иначе форматируем до 2 знаков после запятой
      value = formatNumberBlur(value);
    }
    editableRows.value[index][field] = value;

    if (!displayValues.value[index]) displayValues.value[index] = {};
    displayValues.value[index][field] = formatNumberDisplay(value);

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

  const shouldShowError = (
    index: number,
    field: "amount_with_nds" | "amount_nds" | "name" | "files",
  ): boolean => {
    return invalidFields.value[index]?.includes(field) || false;
  };

  const validateRow = (index: number) => {
    const errors: string[] = [];
    const row = editableRows.value[index];

    const name = row.name;
    const amountWithNds = row.amount_with_nds;
    const amountNds = row.amount_nds;
    const hasFileIds = row.file_ids && row.file_ids.length > 0;

    // проверка числовых форматов
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

    row.filesRequired = true;
    if (!name) errors.push("name");
    if (!hasFileIds) errors.push("files");
    if (!amountWithNds || amountWithNds === "0,00")
      errors.push("amount_with_nds");
    if (!amountNds || amountNds === "0,00") errors.push("amount_nds");

    invalidFields.value[index] = errors;

    return errors.length === 0;
  };

  const { loading: fileLoading } = useSaveFile();
  const {
    handleFileUploaded: baseHandleFileUploaded,
    handleFileRemoved: baseHandleFileRemoved,
  } = useFileHandling<OverSumTableRow>({
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

  const { totalWithVAT, totalVAT } = useCashCalculations(editableRows);

  const createEmptyRow = (): OverSumTableRow => ({
    id: "",
    name: "",
    amount_with_nds: "0,00",
    amount_nds: "0,00",
    file_ids: [],
    files: [],
    isNew: true,
  });

  const normalizeRowData = (row: OverSumTableRow): OverSumTableRow => {
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

    const tableKey = "otherSum";
    stepTwoStore.updateAddedRows(tableKey, [...addedRowsIndices.value]);

    showRemoveButton.value = true;

    editingNameIndex.value = newIndex;
    await nextTick();

    tableMessage.value = "Основание добавлено";
    emitUpdate();
    emit("rows-added", [newIndex]);

    // Валидируем новую строку
    validateRow(newIndex);
  };

  const removeLastRow = () => {
    // Проверяем, есть ли добавленные строки для удаления
    if (addedRowsIndices.value.length === 0) {
      showRemoveButton.value = false;
      return;
    }

    // Находим последний добавленный индекс (самый большой)
    const lastAddedIndex = Math.max(...addedRowsIndices.value);

    // Удаляем строку
    editableRows.value.splice(lastAddedIndex, 1);

    // Удаляем индекс из массива добавленных индексов
    addedRowsIndices.value = addedRowsIndices.value.filter(
      (index) => index !== lastAddedIndex,
    );

    // Обновляем остальные индексы (уменьшаем на 1 те, что больше удаленного)
    addedRowsIndices.value = addedRowsIndices.value.map((index) =>
      index > lastAddedIndex ? index - 1 : index,
    );

    // Обновляем invalidFields
    const newInvalidFields: Record<number, string[]> = {};
    Object.entries(invalidFields.value).forEach(([key, value]) => {
      const numKey = Number(key);
      if (numKey !== lastAddedIndex) {
        newInvalidFields[numKey > lastAddedIndex ? numKey - 1 : numKey] = value;
      }
    });
    invalidFields.value = newInvalidFields;

    // Обновляем modifiedFields
    const newModifiedFields: Record<number, Set<string>> = {};
    Object.entries(modifiedFields.value).forEach(([key, value]) => {
      const numKey = Number(key);
      if (numKey !== lastAddedIndex) {
        newModifiedFields[numKey > lastAddedIndex ? numKey - 1 : numKey] =
          value;
      }
    });
    modifiedFields.value = newModifiedFields;

    // Обновляем стор
    stepTwoStore.removeRowFromTable("otherSum", lastAddedIndex);
    const tableKey = "otherSum";
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
    validateRow(index);

    const name = editableRows.value[index].name?.trim();
    if (!name) {
      validateRow(index);
    }
    editingNameIndex.value = null;

    emitUpdate();
  };

  // Watchers
  watch(
    () => props.initialData,
    (newData) => {
      const normalized = (newData || []).map(normalizeRowData);

      // Восстанавливаем добавленные строки из Pinia
      const storedAddedRows = stepTwoStore.addedOtherSumRows;
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

  const isFileRequired = (row: OverSumTableRow, index: number) => {
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

  const setData = (newData: OverSumTableRow[]) => {
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
    if (target.value === "0,00" || target.value.trim() === "") {
      target.value = "";
      editableRows.value[index][field] = "";
      if (!displayValues.value[index]) displayValues.value[index] = {};
      displayValues.value[index][field] = "";
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
    grid-template-columns="44px 320px 400px 240px"
    :loading="loading"
    :error="error"
    :message="tableMessage"
    :min-rows="0"
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
              'name-input',
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
          <span :class="$style.editable" @click="editingNameIndex = index">
            {{ row?.name || " " }}
          </span>
        </template>
      </div>

      <div class="cell" :class="$style.cellRow">
        <div>
          <input
            type="text"
            :value="
              displayValues[index]?.amount_with_nds || row.amount_with_nds
            "
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
            :value="displayValues[index]?.amount_nds || row.amount_nds"
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
          prefix="other-sum-file"
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

  .editable {
    cursor: pointer;
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
