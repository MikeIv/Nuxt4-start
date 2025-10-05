import { defineStore } from "pinia";
import type { RefundsTableRow, OtherAmountsTableRow } from "~/types/tables";

type TableRowWithAmounts = { amount_with_nds: string; amount_nds: string };

interface TableData<T> {
  rows: T[];
  withVAT: number;
  VAT: number;
}

interface StepThreeState {
  refunds: TableData<RefundsTableRow>;
  otherAmounts: TableData<OtherAmountsTableRow>;
  isChanged: boolean;
  addedRefundRows: number[];
  addedOtherAmountRows: number[];
}

export const useStepThreeStore = defineStore("stepThree", {
  state: (): StepThreeState => ({
    refunds: { rows: [], withVAT: 0, VAT: 0 },
    otherAmounts: { rows: [], withVAT: 0, VAT: 0 },
    isChanged: false,
    addedRefundRows: [],
    addedOtherAmountRows: [],
  }),

  getters: {
    totalWithVAT: (state) => state.refunds.withVAT + state.otherAmounts.withVAT,
    totalVAT: (state) => state.refunds.VAT + state.otherAmounts.VAT,
    totalWithoutVAT: (state) => state.totalWithVAT - state.totalVAT,
  },

  actions: {
    reset() {
      this.$reset();
      localStorage.removeItem("step-three-storage");
    },

    updateTable<T extends keyof StepThreeState>(
      table: T,
      data: { rows: StepThreeState[T]["rows"]; withVAT: number; VAT: number },
    ) {
      this[table] = data;
      this.isChanged = true;
    },

    updateAddedRows(table: "refunds" | "otherAmounts", indices: number[]) {
      if (table === "refunds") this.addedRefundRows = indices;
      else this.addedOtherAmountRows = indices;
      this.isChanged = true;
    },

    removeLastAddedRow(table: "refunds" | "otherAmounts", index: number) {
      if (table === "refunds") {
        this.addedRefundRows = this.addedRefundRows.filter((i) => i !== index);
      } else {
        this.addedOtherAmountRows = this.addedOtherAmountRows.filter(
          (i) => i !== index,
        );
      }
      this.isChanged = true;
    },

    removeRowFromTable(table: "refunds" | "otherAmounts", index: number) {
      const rows = this[table].rows as TableRowWithAmounts[];
      rows.splice(index, 1);

      this[table].withVAT = rows.reduce(
        (sum, r) => sum + parseFloat(r.amount_with_nds || "0"),
        0,
      );
      this[table].VAT = rows.reduce(
        (sum, r) => sum + parseFloat(r.amount_nds || "0"),
        0,
      );

      if (table === "otherAmounts") {
        this.addedOtherAmountRows = this.addedOtherAmountRows.filter(
          (i) => i !== index,
        );
      } else {
        this.addedRefundRows = this.addedRefundRows.filter((i) => i !== index);
      }

      this.isChanged = true;
    },

    getAllData() {
      return {
        refunds: { ...this.refunds },
        otherAmounts: { ...this.otherAmounts },
      };
    },
  },

  persist: {
    key: "step-three-storage",
    paths: [
      "refunds",
      "otherAmounts",
      "addedRefundRows",
      "addedOtherAmountRows",
    ],
  },
});
