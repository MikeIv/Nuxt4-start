import { defineStore } from "pinia";
import type { RefundsTableRow, OtherAmountsTableRow } from "~/types/tables";

interface TableData<T> {
  rows: T[];
  withVAT: number;
  VAT: number;
}

interface StepThreeState {
  refunds: TableData<RefundsTableRow>;
  otherAmounts: TableData<OtherAmountsTableRow>;
  isChanged: boolean;
}

export const useStepThreeStore = defineStore("stepThree", {
  state: (): StepThreeState => ({
    refunds: { rows: [], withVAT: 0, VAT: 0 },
    otherAmounts: { rows: [], withVAT: 0, VAT: 0 },
    isChanged: false,
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

    getAllData() {
      return {
        refunds: { ...this.refunds },
        otherAmounts: { ...this.otherAmounts },
      };
    },
  },

  persist: {
    key: "step-three-storage",
    paths: ["refunds", "otherAmounts"],
  },
});
