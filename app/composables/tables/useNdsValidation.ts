import { computed } from "vue";
import type { Ref } from "vue";

export interface AmountRow {
  amount_with_nds: string;
  amount_nds: string;
}

export function useNdsValidation(rows: Ref<AmountRow[]>) {
  const getNdsError = (row: unknown) => {
    const r = row as AmountRow;

    const amountWithNds = parseFloat(r.amount_with_nds.replace(",", "."));
    const amountNds = parseFloat(r.amount_nds.replace(",", "."));

    if (isNaN(amountWithNds) || isNaN(amountNds)) return null;

    if (amountWithNds > 0 && amountNds === 0) {
      return "НДС не может быть равен нулю";
    }

    if (amountNds >= amountWithNds && amountWithNds > 0) {
      return "НДС не может быть больше суммы с НДС";
    }

    return null;
  };

  const ndsErrors = computed(() => {
    return rows.value.map((row) => getNdsError(row));
  });

  return {
    getNdsError,
    ndsErrors,
  };
}
