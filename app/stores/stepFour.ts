import { defineStore } from "pinia";

export const useStepFourStore = defineStore("stepFour", {
  state: () => ({
    baseComparisonValue: null as number | null,
  }),
  actions: {
    setBaseComparisonValue(value: number | null) {
      this.baseComparisonValue = value;
    },
  },
});
