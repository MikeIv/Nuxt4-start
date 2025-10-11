<script setup lang="ts">
  import type { RefundsTableRow, FileData } from "~/types/tables";
  import { useKktInput } from "~/composables/tables/useKktInput";
  import { useNumberFields } from "~/composables/tables/useNumberFields";
  import { useRefundsCalculations } from "~/composables/tables/useRefundsCalculations";
  import { useSaveFile } from "~/composables/useSaveFile";
  import { useFileHandling } from "~/composables/useFileHandling";

  interface RefundsTableProps {
    headers?: unknown[];
    initialData?: RefundsTableRow[];
    loading?: boolean;
    error?: string | boolean;
  }

  const props = withDefaults(defineProps<RefundsTableProps>(), {
    headers: () => [],
    initialData: () => [],
    loading: false,
    error: false,
  });

  const dependentErrors = ref<
    Record<number, { returnGoods?: string; gift?: string }>
  >({});

  const emit = defineEmits<{
    (
      e: "update:totalSumm" | "update:totalVAT" | "update:tableData",
      value: number | RefundsTableRow[],
    ): void;
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

  const state = reactive({
    editableRows: [...props.initialData] as RefundsTableRow[],
    kktErrors: {} as Record<number, string>,
    numberErrors: {} as Record<number, string>,
    tableMessage: "",
  });

  const { editableRows, kktErrors, numberErrors, tableMessage } = toRefs(state);
  const { loading: fileLoading } = useSaveFile();

  // --- Функции для создания и нормализации строк ---
  function createEmptyRow(): RefundsTableRow {
    return {
      id: "",
      name: "",
      registration_number: "",
      returns_goods_services_with_nds: "0,00",
      returns_goods_services_nds: "0,00",
      gift_certificates_sold_with_nds: "0,00",
      gift_certificates_sold_nds: "0,00",
      file_ids: [],
      files: [],
    };
  }

  function normalizeRow(row: RefundsTableRow): RefundsTableRow {
    return {
      ...createEmptyRow(),
      ...row,
      returns_goods_services_with_nds:
        typeof row.returns_goods_services_with_nds === "number"
          ? row.returns_goods_services_with_nds.toFixed(2).replace(".", ",")
          : row.returns_goods_services_with_nds || "0,00",
      returns_goods_services_nds:
        typeof row.returns_goods_services_nds === "number"
          ? row.returns_goods_services_nds.toFixed(2).replace(".", ",")
          : row.returns_goods_services_nds || "0,00",
      gift_certificates_sold_with_nds:
        typeof row.gift_certificates_sold_with_nds === "number"
          ? row.gift_certificates_sold_with_nds.toFixed(2).replace(".", ",")
          : row.gift_certificates_sold_with_nds || "0,00",
      gift_certificates_sold_nds:
        typeof row.gift_certificates_sold_nds === "number"
          ? row.gift_certificates_sold_nds.toFixed(2).replace(".", ",")
          : row.gift_certificates_sold_nds || "0,00",
    };
  }

  // --- Инициализация данных при загрузке ---
  watch(
    () => props.initialData,
    (newData) => {
      if (JSON.stringify(newData) !== JSON.stringify(editableRows.value)) {
        editableRows.value = newData?.length
          ? newData.map(normalizeRow)
          : [createEmptyRow()];
      }
    },
    { immediate: true },
  );

  const {
    handleKktInput,
    validateKktNumber,
    shouldShowError: shouldShowErrorKkt,
  } = useKktInput(editableRows, kktErrors, emit);

  const fieldValidations = {
    returns_goods_services_with_nds: { required: false, min: 0 },
    returns_goods_services_nds: { required: false, min: 0 },
    gift_certificates_sold_with_nds: { required: false, min: 0 },
    gift_certificates_sold_nds: { required: false, min: 0 },
  } as const;

  const {
    handleNumberInput,
    displayValues,
    shouldShowError,
    handleNumberBlurRefunds,
  } = useNumberFields(editableRows, numberErrors, fieldValidations);

  const { handleFileUploaded, handleFileRemoved } =
    useFileHandling<RefundsTableRow>({
      editableRows,
      emit,
      getFileIds: (row) => row.file_ids,
      setFileData: (row, fileData) => ({
        ...row,
        files: fileData,
        file_ids: fileData.map((file) => Number(file.id)),
      }),
    });

  const { totalWithVAT, totalVAT } = useRefundsCalculations(editableRows);
  // Функция для проверки, есть ли ненулевые значения в строке
  const hasNonZeroValues = (row: RefundsTableRow): boolean => {
    const numericFields = [
      "returns_goods_services_with_nds",
      "returns_goods_services_nds",
      "gift_certificates_sold_with_nds",
      "gift_certificates_sold_nds",
    ];

    return numericFields.some((field) => {
      const value = row[field as keyof RefundsTableRow];
      if (typeof value === "string") {
        const numericValue = parseFloat(value.replace(",", "."));
        return !isNaN(numericValue) && numericValue > 0;
      }
      return false;
    });
  };

  const getTableData = () => ({
    rows: [...editableRows.value],
    totals: {
      withVAT: Number(totalWithVAT.value),
      VAT: Number(totalVAT.value),
    },
  });

  const setData = (newData: RefundsTableRow[]) => {
    editableRows.value = newData.map(normalizeRow);
  };

  defineExpose({
    getTableData,
    setData,
    dependentErrors,
  });

  const handleNumberFocus = (
    event: Event,
    field:
      | "returns_goods_services_with_nds"
      | "returns_goods_services_nds"
      | "gift_certificates_sold_with_nds"
      | "gift_certificates_sold_nds",
    index: number,
  ): void => {
    const target = event.target as HTMLInputElement;
    if (target.value === "0,00" || target.value.trim() === "") {
      target.value = "";
      editableRows.value[index][field] = "";
      if (!displayValues.value[index]) displayValues.value[index] = {};
      displayValues.value[index][field] = "";
    }
  };

  const validateDependentFields = (row: RefundsTableRow, index: number) => {
    const errors: { returnGoods?: string; gift?: string } = {};

    const returnGoodsWithNds = row.returns_goods_services_with_nds
      ?.toString()
      .replace(",", ".");
    const returnGoodsNds = row.returns_goods_services_nds
      ?.toString()
      .replace(",", ".");
    if (returnGoodsNds) {
      const returnGoodsWithNdsNumber = parseFloat(returnGoodsWithNds);
      const retrunGoodsNdsNumber = parseFloat(returnGoodsNds);
      if (returnGoodsWithNdsNumber > 0 && retrunGoodsNdsNumber === 0) {
        errors.returnGoods = "НДС не может быть равен нулю";
      } else if (
        retrunGoodsNdsNumber >= returnGoodsWithNdsNumber &&
        returnGoodsWithNdsNumber > 0
      ) {
        errors.returnGoods = "НДС не может быть больше суммы с НДС";
      }
    }

    // Проверка advance_without_certificates_nds
    const giftSertificatesWithNds = row.gift_certificates_sold_with_nds
      ?.toString()
      .replace(",", ".");
    const giftSertificatesNds = row.gift_certificates_sold_nds
      ?.toString()
      .replace(",", ".");

    if (giftSertificatesNds) {
      const giftSertificatesWithNdsNumber = parseFloat(giftSertificatesWithNds);
      const giftSertificatesNdsNumber = parseFloat(giftSertificatesNds);
      if (
        giftSertificatesWithNdsNumber > 0 &&
        giftSertificatesNdsNumber === 0
      ) {
        errors.gift = "НДС не может быть равен нулю";
      } else if (
        giftSertificatesNdsNumber >= giftSertificatesWithNdsNumber &&
        giftSertificatesWithNdsNumber > 0
      ) {
        errors.gift = "НДС не может быть больше суммы с НДС";
      }
    }

    dependentErrors.value[index] = errors;
  };

  watch(
    editableRows,
    (rows) => {
      rows.forEach((row, index) => validateDependentFields(row, index));
    },
    { deep: true, immediate: true },
  );
</script>

<template>
  <StepsCoreEditableBlock
    title=""
    :headers="headers"
    :model-value="editableRows"
    grid-template-columns="44px 120px 160px 300px 300px 240px"
    :loading="loading"
    :error="error"
    :message="tableMessage"
    is-table
  >
    <template #row="{ item: row, index }">
      <div class="cell body-cell" :class="$style.centre">
        {{ index + 1 }}
      </div>

      <div class="cell body-cell">
        <span v-if="row.name">{{ row.name }}</span>
        <span v-else>Основание {{ index + 1 }}</span>
      </div>

      <div class="cell body-cell">
        <input
          type="text"
          :value="row?.registration_number"
          placeholder="Ровно 16 цифр"
          maxlength="16"
          inputmode="numeric"
          readonly
          :class="[
            $style.inputField,
            { [$style.errorInput]: shouldShowErrorKkt(index) },
            $style.inputFieldNumber,
          ]"
          @input="handleKktInput($event, index)"
          @blur="validateKktNumber(index)"
        />
        <div v-if="shouldShowErrorKkt(index)" :class="$style.errorMessage">
          {{ kktErrors[index] }}
        </div>
      </div>

      <div class="cell" :class="$style.cellRow">
        <div>
          <input
            type="text"
            :value="
              displayValues[index]?.returns_goods_services_with_nds ||
              row.returns_goods_services_with_nds
            "
            placeholder="0,00"
            :class="[
              $style.inputField,
              {
                [$style.errorInput]: shouldShowError(
                  index,
                  'returns_goods_services_with_nds',
                ),
              },
            ]"
            @input="
              handleNumberInput(
                $event,
                'returns_goods_services_with_nds',
                index,
              )
            "
            @blur="
              handleNumberBlurRefunds('returns_goods_services_with_nds', index)
            "
            @focus="
              handleNumberFocus(
                $event,
                'returns_goods_services_with_nds',
                index,
              )
            "
          />
        </div>
        <div :class="$style.inputWrapper">
          <input
            type="text"
            :value="
              displayValues[index]?.returns_goods_services_nds ||
              row.returns_goods_services_nds
            "
            placeholder="0,00"
            :class="[
              $style.inputField,
              {
                [$style.errorInput]:
                  shouldShowError(index, 'returns_goods_services_nds') ||
                  dependentErrors[index]?.returnGoods,
              },
            ]"
            @input="
              handleNumberInput($event, 'returns_goods_services_nds', index)
            "
            @blur="handleNumberBlurRefunds('returns_goods_services_nds', index)"
            @focus="
              handleNumberFocus($event, 'returns_goods_services_nds', index)
            "
          />
          <div
            v-if="dependentErrors[index]?.returnGoods"
            :class="$style.errorMessage"
          >
            {{ dependentErrors[index].returnGoods }}
          </div>
        </div>
      </div>

      <div class="cell" :class="$style.cellRow">
        <div>
          <input
            type="text"
            :value="
              displayValues[index]?.gift_certificates_sold_with_nds ||
              row.gift_certificates_sold_with_nds
            "
            placeholder="0,00"
            :class="[
              $style.inputField,
              {
                [$style.errorInput]: shouldShowError(
                  index,
                  'gift_certificates_sold_with_nds',
                ),
              },
            ]"
            @input="
              handleNumberInput(
                $event,
                'gift_certificates_sold_with_nds',
                index,
              )
            "
            @blur="
              handleNumberBlurRefunds('gift_certificates_sold_with_nds', index)
            "
            @focus="
              handleNumberFocus(
                $event,
                'gift_certificates_sold_with_nds',
                index,
              )
            "
          />
        </div>
        <div :class="$style.inputWrapper">
          <input
            type="text"
            :value="
              displayValues[index]?.gift_certificates_sold_nds ||
              row.gift_certificates_sold_nds
            "
            placeholder="0,00"
            :class="[
              $style.inputField,
              {
                [$style.errorInput]:
                  shouldShowError(index, 'gift_certificates_sold_nds') ||
                  dependentErrors[index]?.gift,
              },
            ]"
            @input="
              handleNumberInput($event, 'gift_certificates_sold_nds', index)
            "
            @blur="handleNumberBlurRefunds('gift_certificates_sold_nds', index)"
            @focus="
              handleNumberFocus($event, 'gift_certificates_sold_nds', index)
            "
          />
          <div v-if="dependentErrors[index]?.gift" :class="$style.errorMessage">
            {{ dependentErrors[index].gift }}
          </div>
        </div>
      </div>

      <div class="cell body-cell">
        <StepsCoreFileUploader
          :index="index"
          prefix="refunds-file"
          :loading="fileLoading"
          :multiple="true"
          :max-files="10"
          :files="row.files || []"
          :file-ids="row.file_ids || []"
          :is-required="hasNonZeroValues(row)"
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

  .inputFieldNumber {
    cursor: default;

    &:focus {
      outline: none;
      border-color: var(--a-borderAccentLight);
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
