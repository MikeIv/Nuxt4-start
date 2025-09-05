import { defineStore } from "pinia";
import type {
  KktTableRow,
  CashTableRow,
  NonCashTableRow,
  OtherSumTableRow,
} from "~/types/tables";

interface TableData<T> {
  rows: T[];
  withVAT: number;
  VAT: number;
}

interface StepTwoState {
  kkt: TableData<KktTableRow>;
  cashKkt: TableData<CashTableRow>;
  nonCash: TableData<NonCashTableRow>;
  otherSum: TableData<OtherSumTableRow>;
  isChanged: boolean;
}

export const useStepTwoStore = defineStore("stepTwo", {
  state: (): StepTwoState => ({
    kkt: { rows: [], withVAT: 0, VAT: 0 },
    cashKkt: { rows: [], withVAT: 0, VAT: 0 },
    nonCash: { rows: [], withVAT: 0, VAT: 0 },
    otherSum: { rows: [], withVAT: 0, VAT: 0 },
    isChanged: false,
  }),

  getters: {
    totalWithVAT: (state) =>
      state.kkt.withVAT +
      state.cashKkt.withVAT +
      state.nonCash.withVAT +
      state.otherSum.withVAT,

    totalVAT: (state) =>
      state.kkt.VAT +
      state.cashKkt.VAT +
      state.nonCash.VAT +
      state.otherSum.VAT,

    totalWithoutVAT: (state) => state.totalWithVAT - state.totalVAT,
  },

  actions: {
    reset() {
      this.$reset();
      localStorage.removeItem("step-two-storage");
    },

    updateTable<T extends keyof StepTwoState>(
      table: T,
      data: { rows: StepTwoState[T]["rows"]; withVAT: number; VAT: number },
    ) {
      this[table] = data;
      this.isChanged = true;
    },

    getAllData() {
      return {
        kkt: { ...this.kkt },
        cashKkt: { ...this.cashKkt },
        nonCash: { ...this.nonCash },
        otherSum: { ...this.otherSum },
      };
    },
  },

  persist: {
    key: "step-two-storage",
    paths: ["kkt", "cashKkt", "nonCash", "otherSum"],
  },
});
