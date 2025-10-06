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

type TableRowWithAmounts = { amount_with_nds: string; amount_nds: string };

interface StepTwoState {
  kkt: TableData<KktTableRow>;
  cashKkt: TableData<CashTableRow>;
  nonCash: TableData<NonCashTableRow>;
  otherSum: TableData<OtherSumTableRow>;
  isChanged: boolean;
  addedKktRows: number[];
  addedCashKktRows: number[];
  addedNonCashRows: number[];
  addedOtherSumRows: number[];
}

export const useStepTwoStore = defineStore("stepTwo", {
  state: (): StepTwoState => ({
    kkt: { rows: [], withVAT: 0, VAT: 0 },
    cashKkt: { rows: [], withVAT: 0, VAT: 0 },
    nonCash: { rows: [], withVAT: 0, VAT: 0 },
    otherSum: { rows: [], withVAT: 0, VAT: 0 },
    isChanged: false,
    addedKktRows: [],
    addedCashKktRows: [],
    addedNonCashRows: [],
    addedOtherSumRows: [],
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

    updateAddedRows(
      table: "kkt" | "cashKkt" | "nonCash" | "otherSum",
      indices: number[],
    ) {
      switch (table) {
        case "kkt":
          this.addedKktRows = indices;
          break;
        case "cashKkt":
          this.addedCashKktRows = indices;
          break;
        case "nonCash":
          this.addedNonCashRows = indices;
          break;
        case "otherSum":
          this.addedOtherSumRows = indices;
          break;
      }
      this.isChanged = true;
    },

    removeRowFromTable(
      table: "kkt" | "cashKkt" | "nonCash" | "otherSum",
      index: number,
    ) {
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

      switch (table) {
        case "kkt":
          this.addedKktRows = this.addedKktRows.filter((i) => i !== index);
          break;
        case "cashKkt":
          this.addedCashKktRows = this.addedCashKktRows.filter(
            (i) => i !== index,
          );
          break;
        case "nonCash":
          this.addedNonCashRows = this.addedNonCashRows.filter(
            (i) => i !== index,
          );
          break;
        case "otherSum":
          this.addedOtherSumRows = this.addedOtherSumRows.filter(
            (i) => i !== index,
          );
          break;
      }
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
    paths: [
      "kkt",
      "cashKkt",
      "nonCash",
      "otherSum",
      "addedKktRows",
      "addedCashKktRows",
      "addedNonCashRows",
      "addedOtherSumRows",
    ],
  },
});
