<script setup lang="ts">
  import { useStepOneStore } from "~/stores/stepOne";
  import { formatDate } from "~/utils/date";
  import { usePeriodCheck } from "~/composables/usePeriodCheck";

  const stepOne = useStepOneStore();

  const dateRangeRef = computed(() => stepOne.dateRange);

  const { isCheckingPeriod, periodExists, checkPeriodExists } =
    usePeriodCheck(dateRangeRef);

  const hasIncompleteDateRange = computed(() => {
    const range = stepOne.dateRange;

    if (!range || range.length < 2) return false;

    const secondDate = formatDate(range[1]);

    // если она равна "--.--.----", значит не выбрана
    if (secondDate === "--.--.----") return true;

    return false;
  });

  const isFormValid = computed(() => {
    return (
      stepOne.dateRange?.length === 2 &&
      stepOne.visitorsCount !== null &&
      stepOne.checksCount !== null &&
      !periodExists.value
    );
  });

  const validateAndNext = async () => {
    if (stepOne.dateRange?.length === 2) {
      await checkPeriodExists();
    }

    if (!isFormValid.value) {
      console.log("Form is not valid");
      return;
    }

    console.log("Data automatically saved in store");
    navigateTo("/record/2");
  };
</script>

<template>
  <div>
    <StepsCoreHeader
      main-title="Формирование отчета"
      step-title="Период и общие данные"
      :step-current="1"
      :step-total="4"
    />
    <StepsCoreMain>
      <div :class="$style.wrapper">
        <StepsCoreContentTitle
          text="Выберите период отчета о денежном обороте, а также укажите количество посетителей и чеков"
        />

        <div :class="$style.item">
          <p :class="$style.title">Период</p>
          <ModuleDatePicker v-model="stepOne.dateRange" />
          <div v-if="stepOne.dateRange?.length === 2" :class="$style.dates">
            Выбран период: {{ formatDate(stepOne.dateRange[0]) }} -
            {{ formatDate(stepOne.dateRange[1]) }}
            <span v-if="isCheckingPeriod">(Проверка...)</span>
          </div>
        </div>

        <div :class="$style.item">
          <p :class="$style.title">Количество посетителей</p>
          <input
            v-model.number="stepOne.visitorsCount"
            :class="$style.input"
            type="number"
            min="0"
            placeholder="внесите данные"
            @input="
              stepOne.visitorsCount =
                $event.target.value === ''
                  ? null
                  : Math.max(0, Number($event.target.value))
            "
          />
        </div>

        <div :class="$style.item">
          <p :class="$style.title">Количество чеков</p>
          <input
            v-model.number="stepOne.checksCount"
            :class="$style.input"
            type="number"
            min="0"
            placeholder="внесите данные"
            @input="
              stepOne.checksCount =
                $event.target.value === ''
                  ? null
                  : Math.max(0, Number($event.target.value))
            "
          />
        </div>
      </div>
    </StepsCoreMain>

    <StepsCoreNavigation :step="1" :show-back="false">
      <template #next>
        <UButton
          class="steps-nav-btn solid"
          :disabled="!isFormValid || hasIncompleteDateRange || isCheckingPeriod"
          @click="validateAndNext"
        >
          Далее
        </UButton>
        <span v-if="hasIncompleteDateRange" :class="$style.errorText">
          Выберите период, состоящий из двух дат (например — 01.01.2020 -
          01.01.2020)
        </span>

        <span v-if="periodExists" :class="$style.errorText">
          Такой отчет уже существует. Поменяйте дату.
        </span>
      </template>
    </StepsCoreNavigation>
  </div>
</template>

<style module lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .item {
    position: relative;
    display: flex;
    flex-direction: column;
    margin-bottom: rem(30);
  }

  .title {
    margin-bottom: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
  }

  .dates {
    position: absolute;
    top: rem(64);
    left: 0;
    font-size: rem(10);
    font-weight: 500;
    color: var(--a-headerText);
  }

  .input {
    display: flex;
    justify-content: center;
    align-content: center;
    width: max-content;
    flex-shrink: 0;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    background-color: var(--a-mainBg);
    border-radius: 0.25rem;
  }

  .errorText {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: rem(4) rem(12);
    font-size: rem(12);
    font-weight: 500;
    color: var(--a-lightText);
    background-color: var(--a-bgWarning);
  }
</style>
