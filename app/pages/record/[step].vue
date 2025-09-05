<!-- pages/record/[step].vue -->
<script setup>
  const route = useRoute();
  const step = route.params.step;

  // Валидация шага (опционально): UPD - так, как добавлен middleware record-steps-global, код ниже не отрабатывает.
  //  middleware добавлен для невозможности перехода между шагами по прямой ссылке
  // if (!["1", "2", "3", "4"].includes(step)) {
  //   throw createError({ statusCode: 404, statusMessage: "Шаг не найден" });
  // }
</script>

<template>
  <div :class="$style.container">
    <StepsOne v-if="step === '1'" :class="$style.wrapper" />
    <StepsTwo v-if="step === '2'" :class="$style.wrapper" />
    <StepsThree v-if="step === '3'" :class="$style.wrapper" />
    <StepsFour v-if="step === '4'" :class="$style.wrapper" />
  </div>
</template>

<style module lang="scss">
  .container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      width: rem(8);
      height: rem(8);
    }

    &::-webkit-scrollbar-track {
      background: var(--a-bgLight);
      border-radius: rem(4);
      margin: rem(4) 0;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--a-borderAccent);
      border-radius: rem(4);
      transition: background 0.3s ease;

      &:hover {
        background: var(--a-mainBg);
      }
    }

    /* Стили для Firefox */
    scrollbar-width: thin;
    scrollbar-color: var(--a-borderAccent) var(--a-bgLight);

    /* Стили для IE/Edge */
    -ms-overflow-style: -ms-autohiding-scrollbar;
  }

  .wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex-grow: 1;
  }
</style>
