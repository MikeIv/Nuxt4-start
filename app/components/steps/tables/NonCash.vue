<script setup lang="ts">
  import type { FileData, NonCashTableRow } from "~/types/tables";

  const props = defineProps({
    headers: {
      type: Array,
      default: () => [],
    },
    initialData: {
      type: Array as () => NonCashTableRow[],
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
      value: number | NonCashTableRow[],
    ): void;
    (e: "rows-added", indices: number[]): void;
    (e: "rows-removed", index: number): void;
    (
      e: "files-uploaded",
      payload: { index: number; filesData: FileData[] },
    ): void;
    (e: "file-removed", payload: { index: number; fileIndex: number }): void;
  }>();

  const editableRows = ref<NonCashTableRow[]>([]);
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

  const { loading: fileLoading } = useSaveFile();
  const { handleFileUploaded, handleFileRemoved } =
    useFileHandling<NonCashTableRow>({
      editableRows,
      emit,
      getFileIds: (row) => row.file_ids,
      setFileData: (row, fileData) => ({
        ...row,
        files: fileData,
        file_ids: fileData.map((file) => Number(file.id)),
      }),
    });

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

    const amountWithNds = row.amount_with_nds;
    const amountNds = row.amount_nds;
    const name = row.name;
    const hasFileIds = row.file_ids && row.file_ids.length > 0;

    // Валидация числовых полей (проверяем только если значение не пустое и не "0,00")
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

    const isNewlyAddedRow = addedRowsIndices.value.includes(index);
    if (isNewlyAddedRow) {
      // Для новых строк все поля обязательны
      if (!name || name.trim() === "") errors.push("name");
      if (!amountWithNds || amountWithNds === "0,00")
        errors.push("amount_with_nds");
      if (!amountNds || amountNds === "0,00") errors.push("amount_nds");
      if (!hasFileIds) errors.push("files");
    } else {
      // Для существующих строк проверяем только измененные поля
      let hasNonEmptyModifiedField = false;
      const modifiedFieldsForRow = modifiedFields.value[index];

      if (modifiedFieldsForRow) {
        for (const field of modifiedFieldsForRow) {
          if (field === "name" && name && name.trim() !== "")
            hasNonEmptyModifiedField = true;
          if (
            field === "amount_with_nds" &&
            amountWithNds &&
            amountWithNds !== "0,00"
          )
            hasNonEmptyModifiedField = true;
          if (field === "amount_nds" && amountNds && amountNds !== "0,00")
            hasNonEmptyModifiedField = true;
        }
      }

      if (hasNonEmptyModifiedField) {
        // Проверяем только те поля, которые были изменены ИЛИ связанные обязательные поля
        if (
          modifiedFieldsForRow?.has("name") &&
          (!name || name.trim() === "")
        ) {
          errors.push("name");
        }
        if (
          modifiedFieldsForRow?.has("amount_with_nds") &&
          (!amountWithNds || amountWithNds === "0,00")
        ) {
          errors.push("amount_with_nds");
        }
        if (
          modifiedFieldsForRow?.has("amount_nds") &&
          (!amountNds || amountNds === "0,00")
        ) {
          errors.push("amount_nds");
        }
        if (!hasFileIds) errors.push("files");
      }

      // Очищаем modifiedFields если нет непустых измененных полей
      if (modifiedFieldsForRow && !hasNonEmptyModifiedField) {
        const { [index]: _, ...rest } = modifiedFields.value;
        modifiedFields.value = rest;
      }
    }

    invalidFields.value = {
      ...invalidFields.value,
      [index]: errors,
    };

    return errors.length === 0;
  };

  const hasAmountInRow = (row: NonCashTableRow, index: number): boolean => {
    const isNewlyAddedRow = addedRowsIndices.value.includes(index);
    if (isNewlyAddedRow) return true;

    let hasNonEmptyModifiedField = false;
    if (modifiedFields.value[index]) {
      const hasAmountWithNds =
        row.amount_with_nds && row.amount_with_nds !== "0,00";
      const hasAmountNds = row.amount_nds && row.amount_nds !== "0,00";
      const hasName = row.name && row.name.trim() !== "";

      for (const field of modifiedFields.value[index]) {
        if (field === "name" && hasName) hasNonEmptyModifiedField = true;
        if (field === "amount_with_nds" && hasAmountWithNds)
          hasNonEmptyModifiedField = true;
        if (field === "amount_nds" && hasAmountNds)
          hasNonEmptyModifiedField = true;
      }
    }
    return hasNonEmptyModifiedField;
  };

  const { totalWithVAT, totalVAT } = useCashCalculations(editableRows);

  const createEmptyRow = (): NonCashTableRow => ({
    id: "",
    name: "",
    amount_with_nds: "0,00",
    amount_nds: "0,00",
    file_ids: [],
    files: [],
    isNew: true,
  });

  const normalizeRowData = (row: NonCashTableRow): NonCashTableRow => {
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
    emitUpdate();
  };

  watch(
    () => props.initialData,
    (newData) => {
      if (JSON.stringify(newData) !== JSON.stringify(editableRows.value)) {
        editableRows.value = newData?.length
          ? newData.map(normalizeRowData)
          : [createEmptyRow()];
        addedRowsIndices.value = [];
        invalidFields.value = {};
        modifiedFields.value = {};

        editableRows.value.forEach((_, index) => validateRow(index));
      }
    },
    { immediate: true },
  );

  const getTableData = () => ({
    rows: [...editableRows.value],
    totals: {
      withVAT: Number(totalWithVAT.value),
      VAT: Number(totalVAT.value),
    },
  });

  const setData = (newData: NonCashTableRow[]) => {
    editableRows.value = newData.map(normalizeRowData);
    invalidFields.value = {};
    modifiedFields.value = {};
    editableRows.value.forEach((_, index) => validateRow(index));
  };

  defineExpose({
    getTableData,
    setData,
  });
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
          <span>{{ row.name || " " }}</span>
        </template>
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
          />
        </div>
        <div>
          <input
            type="text"
            :value="row.amount_nds"
            placeholder="0,00"
            :class="[
              $style.inputField,
              {
                [$style.errorInput]: shouldShowError(index, 'amount_nds'),
              },
            ]"
            @input="handleNumberInput($event, 'amount_nds', index)"
            @blur="handleNumberBlur('amount_nds', index)"
          />
        </div>
      </div>

      <div class="cell body-cell">
        <StepsCoreFileUploader
          :index="index"
          prefix="non-cash-file"
          :loading="fileLoading"
          :multiple="true"
          :max-files="3"
          :files="row.files || []"
          :file-ids="row.file_ids || []"
          :is-required="hasAmountInRow(row, index)"
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
    border-color: var(--a-borderError) !important;
    background-color: var(--a-bgErrorLight) !important;
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

    &.errorInput {
      border-color: var(--a-borderError) !important;
      background-color: var(--a-bgErrorLight) !important;
    }
  }
</style>
