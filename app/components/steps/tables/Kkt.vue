<script setup lang="ts">
  import { useSaveFile } from "~/composables/useSaveFile";
  import type { FileData, KktTableRow } from "~/types/tables";
  import { useFileHandling } from "~/composables/useFileHandling";
  import { useKktInput } from "~/composables/tables/useKktInput";
  import { useNumberFields } from "~/composables/tables/useNumberFields";
  import { useKktCalculations } from "~/composables/tables/useKktCalculations";

  interface KktTableProps {
    headers?: unknown[];
    initialData?: KktTableRow[];
    initialAddedRowsIndices?: number[];
    loading?: boolean;
    error?: string | boolean;
  }

  const props = withDefaults(defineProps<KktTableProps>(), {
    headers: () => [],
    initialData: () => [],
    initialAddedRowsIndices: () => [],
    addedRowsIndices: () => [],
    loading: false,
    error: false,
  });

  const emit = defineEmits<{
    (
      e: "update:totalSumm" | "update:totalVAT" | "update:tableData",
      value: number | KktTableRow[],
    ): void;
    (e: "rows-added", indices: number[]): void;
    (e: "rows-removed", index: number): void;
    (
      e: "files-uploaded",
      payload: {
        index: number;
        filesData: FileData[];
      },
    ): void;
    (
      e: "file-removed",
      payload: {
        index: number;
        fileIndex: number;
      },
    ): void;
  }>();

  const editableRows = ref<KktTableRow[]>([]);
  const kktErrors = ref<Record<number, string>>({});
  const numberErrors = ref<Record<number, string>>({});
  const addedRowsIndices = ref<number[]>([]);
  const tableMessage = ref("");
  const showRemoveButton = ref(false);

  const { loading: fileLoading } = useSaveFile();

  function createEmptyRow(): KktTableRow {
    return {
      id: "",
      name: "",
      registration_number: "",
      start_meter_reading: "",
      end_meter_reading: "",
      amount_without_advance_with_nds: "",
      amount_without_advance_nds: "",
      advance_without_certificates_with_nds: "",
      advance_without_certificates_nds: "",
      file_ids: [],
      files: [],
      isNew: true,
    };
  }

  const initializeData = () => {
    if (props.initialData?.length) {
      editableRows.value = props.initialData.map((row, index) => ({
        ...createEmptyRow(),
        ...row,
        name: row.name || `Касса${index + 1}`,
        start_meter_reading: row.start_meter_reading || "",
        end_meter_reading: row.end_meter_reading || "",
        amount_without_advance_with_nds:
          row.amount_without_advance_with_nds || "",
        amount_without_advance_nds: row.amount_without_advance_nds || "",
        advance_without_certificates_with_nds:
          row.advance_without_certificates_with_nds || "",
        advance_without_certificates_nds:
          row.advance_without_certificates_nds || "",
        isNew: false,
      }));
      // Проверяем все номера ККТ на корректность
      editableRows.value.forEach((_, index) => validateKktNumber(index));

      addedRowsIndices.value = [];
    } else {
      const newRow = createEmptyRow();
      newRow.name = `Касса1`;
      editableRows.value = [newRow];
      addedRowsIndices.value = [0];
      showRemoveButton.value = false;
    }
  };

  onMounted(() => {
    initializeData();
  });

  watch(() => props.initialData, initializeData, { deep: true });
  watch(
    () => props.initialAddedRowsIndices,
    (newIndices) => {
      addedRowsIndices.value = [...(newIndices || [])];
      showRemoveButton.value = addedRowsIndices.value.length > 0;
    },
    { deep: true },
  );

  watch(
    editableRows,
    (rows) => {
      rows.forEach((_, index) => validateKktNumber(index));
    },
    { deep: true, immediate: true },
  );

  const addRow = (): void => {
    const newRow = createEmptyRow();
    newRow.name = `Касса${editableRows.value.length + 1}`;

    const newIndex = editableRows.value.length;
    editableRows.value.push(newRow);
    addedRowsIndices.value.push(newIndex);

    showRemoveButton.value = true;
    tableMessage.value = "Добавлена касса";
    emit("rows-added", [...addedRowsIndices.value]);

    nextTick(() => {
      registrationNumberInputs.value[newIndex]?.focus();
    });
  };

  const removeLastRow = (): void => {
    if (addedRowsIndices.value.length > 0) {
      // Удаляем последнюю добавленную строку
      const lastAddedIndex = addedRowsIndices.value.pop()!;
      editableRows.value.splice(lastAddedIndex, 1);

      // Обновляем индексы оставшихся добавленных строк
      addedRowsIndices.value = addedRowsIndices.value
        .filter((index) => index !== lastAddedIndex)
        .map((index) => (index > lastAddedIndex ? index - 1 : index));

      showRemoveButton.value = addedRowsIndices.value.length > 0;
      tableMessage.value = "Касса удалена";
      emit("rows-removed", lastAddedIndex);
      emit("rows-added", [...addedRowsIndices.value]);
    }
  };

  const { calculateWithNds, totalWithVAT, totalVAT } =
    useKktCalculations(editableRows);

  const {
    handleKktInput,
    validateKktNumber,
    shouldShowError: shouldShowErrorKkt,
    preventNonNumericInput,
  } = useKktInput(editableRows, kktErrors, emit);

  const fieldValidations = {
    start_meter_reading: { required: true, min: 0, allowZero: true },
    end_meter_reading: { required: true, min: 0, allowZero: true },
    amount_without_advance_nds: { required: true, min: 0 },
    advance_without_certificates_with_nds: { required: true, min: 0 },
    advance_without_certificates_nds: { required: true, min: 0 },
  } as const;

  const { handleNumberInput, handleNumberBlur, shouldShowError } =
    useNumberFields(editableRows, numberErrors, fieldValidations);

  const { handleFileUploaded, handleFileRemoved } =
    useFileHandling<KktTableRow>({
      editableRows,
      emit,
      getFileIds: (row) => row.file_ids,
      setFileData: (row, fileData) => ({
        ...row,
        files: fileData,
        file_ids: fileData.map((file) => Number(file.id)),
      }),
    });

  const getTableData = () => ({
    rows: [...editableRows.value],
    totals: {
      withVAT: Number(totalWithVAT.value),
      VAT: Number(totalVAT.value),
    },
  });

  const setData = (newData: KktTableRow[]) => {
    editableRows.value = [...newData];
  };

  defineExpose({
    getTableData,
    setData,
  });

  const registrationNumberInputs = ref<(HTMLInputElement | null)[]>([]);

  const setRegistrationNumberRef = (
    el: HTMLInputElement | null,
    index: number,
  ) => {
    registrationNumberInputs.value[index] = el;
  };
</script>

<template>
  <StepsCoreEditableBlock
    title=""
    :headers="headers"
    :model-value="editableRows"
    grid-template-columns="40px 120px 160px minmax(140px, 250px) minmax(140px, 250px) minmax(280px, 1fr) minmax(280px, 1fr) 180px"
    :loading="loading"
    :error="error"
    :message="tableMessage"
    add-button-text="Добавить кассу"
    remove-button-text="Отменить добавление"
    :show-remove-button="showRemoveButton"
    is-table
    @add="addRow"
    @remove="removeLastRow"
  >
    <template #row="{ item: row, index }">
      <div class="cell body-cell" :class="$style.centre">{{ index + 1 }}</div>
      <div class="cell body-cell">
        <span v-if="row.name">{{ row.name }}</span>
        <span v-else>Касса {{ index + 1 }}</span>
      </div>
      <div class="cell body-cell">
        <input
          :ref="(el) => setRegistrationNumberRef(el, index)"
          type="text"
          :value="row?.registration_number"
          placeholder="Ровно 16 цифр"
          maxlength="16"
          inputmode="numeric"
          pattern="[0-9]*"
          required
          :disabled="!row.isNew"
          class="kkt-table__input-reg-number"
          :class="[
            {
              [$style.errorInput]: shouldShowErrorKkt(index),
              [$style.readonlyField]: !addedRowsIndices.includes(index),
            },
            {
              [$style.pulse]:
                index === editableRows.length - 1 &&
                !row?.registration_number &&
                addedRowsIndices.includes(index),
            },
          ]"
          @input="row.isNew && handleKktInput($event, index)"
          @blur="validateKktNumber(index)"
          @keypress="row.isNew && preventNonNumericInput($event)"
        />
        <div v-if="shouldShowErrorKkt(index)" :class="$style.errorMessage">
          {{ kktErrors[index] }}
        </div>
      </div>
      <div class="cell body-cell">
        <input
          :value="row.start_meter_reading"
          placeholder="0,00"
          required
          :class="[
            $style.inputField,
            {
              [$style.errorInput]: shouldShowError(
                index,
                'start_meter_reading',
              ),
              [$style.requiredField]:
                fieldValidations['start_meter_reading']?.required,
            },
          ]"
          @input="handleNumberInput($event, 'start_meter_reading', index)"
          @blur="handleNumberBlur('start_meter_reading', index)"
        />
        <div
          v-if="shouldShowError(index, 'start_meter_reading')"
          :class="$style.errorMessage"
        >
          {{ numberErrors[index] }}
        </div>
      </div>
      <div class="cell body-cell">
        <input
          :value="row.end_meter_reading"
          placeholder="0,00"
          required
          :class="[
            $style.inputField,
            {
              [$style.errorInput]: shouldShowError(index, 'end_meter_reading'),
              [$style.requiredField]:
                fieldValidations['end_meter_reading']?.required,
            },
          ]"
          @input="handleNumberInput($event, 'end_meter_reading', index)"
          @blur="handleNumberBlur('end_meter_reading', index)"
        />
        <div
          v-if="shouldShowError(index, 'end_meter_reading')"
          :class="$style.errorMessage"
        >
          {{ numberErrors[index] }}
        </div>
      </div>
      <div class="cell" :class="$style.cellRow">
        <div :class="$style.subCell">
          <span>{{ calculateWithNds(row).toFixed(2).replace(".", ",") }}</span>
        </div>
        <div :class="$style.subCell">
          <input
            type="text"
            :value="row.amount_without_advance_nds"
            placeholder="0,00"
            required
            :class="[
              $style.inputField,
              {
                [$style.errorInput]: shouldShowError(
                  index,
                  'amount_without_advance_nds',
                ),
                [$style.requiredField]:
                  fieldValidations['amount_without_advance_nds']?.required,
              },
            ]"
            @input="
              handleNumberInput($event, 'amount_without_advance_nds', index)
            "
            @blur="handleNumberBlur('amount_without_advance_nds', index)"
          />
        </div>
      </div>
      <div class="cell" :class="$style.cellRow">
        <div>
          <input
            type="text"
            :value="row.advance_without_certificates_with_nds"
            placeholder="0,00"
            required
            :class="[
              $style.inputField,
              {
                [$style.errorInput]: shouldShowError(
                  index,
                  'advance_without_certificates_with_nds',
                ),
                [$style.requiredField]:
                  fieldValidations['advance_without_certificates_with_nds']
                    ?.required,
              },
            ]"
            @input="
              handleNumberInput(
                $event,
                'advance_without_certificates_with_nds',
                index,
              )
            "
            @blur="
              handleNumberBlur('advance_without_certificates_with_nds', index)
            "
          />
        </div>
        <div>
          <input
            type="text"
            :value="row.advance_without_certificates_nds"
            placeholder="0,00"
            required
            :class="[
              $style.inputField,
              {
                [$style.errorInput]: shouldShowError(
                  index,
                  'advance_without_certificates_nds',
                ),
                [$style.requiredField]:
                  fieldValidations['advance_without_certificates_nds']
                    ?.required,
              },
            ]"
            @input="
              handleNumberInput(
                $event,
                'advance_without_certificates_nds',
                index,
              )
            "
            @blur="handleNumberBlur('advance_without_certificates_nds', index)"
          />
        </div>
      </div>
      <div class="cell body-cell">
        <StepsCoreFileUploader
          :index="index"
          prefix="kkt-file"
          :loading="fileLoading"
          :multiple="true"
          :max-files="10"
          :files="row.files || []"
          :file-ids="row.file_ids || []"
          :is-required="true"
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

<style lang="scss">
  .kkt-table__input-reg-number {
    width: 100%;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--a-borderAccentLight);
    background-color: var(--a-mainBg);
    border-radius: 0.25rem;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--a-primary);
    }
  }
</style>

<style module lang="scss">
  .centre {
    align-items: center;
  }

  .cellRow {
    display: flex;
    align-items: center;
    gap: rem(8);
    font-size: rem(12);
    font-weight: bold;
    border-right: 1px solid var(--a-borderLght);
    background-color: var(--a-bgTable);
    border-bottom: 1px solid var(--a-borderAccentLight);
  }

  .subCell {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 50%;
  }

  .bodyCell {
    display: flex;
    flex-direction: column;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.5rem;
    background-color: var(--a-bgTable);
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
      border-color: var(--a-primary);
    }
  }

  .requiredField:not(:focus):placeholder-shown {
    border-color: var(--a-borderError);
  }

  .errorInput {
    border: 1px solid var(--a-borderError) !important;
    border-radius: 0.25rem !important;
  }

  .errorMessage {
    color: var(--a-errorText);
    font-size: rem(10);
    margin-top: rem(4);
  }

  .readonlyField {
    background-color: var(--a-bgDisabled);
    cursor: pointer;
    color: var(--a-textDisabled);

    &:focus {
      outline: none;
      border-color: var(--a-borderDisabled);
    }
  }

  .pulse {
    color: var(--a-errorText);
    background-color: var(--a-bgWarning);
    animation: pulse 1.5s infinite;
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
