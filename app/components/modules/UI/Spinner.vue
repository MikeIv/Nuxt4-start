<script setup lang="ts">
  interface SpinnerProps {
    text?: string;
    spinnerStyle?: Record<string, string>;
    textStyle?: Record<string, string>;
  }

  const props = defineProps<SpinnerProps>();
</script>

<template>
  <div :class="$style.spinnerWrapper">
    <p v-if="props.text" :class="$style.spinnerText" :style="props.textStyle">
      {{ props.text }}
    </p>
    <span :class="$style.spinner" :style="props.spinnerStyle" />
  </div>
</template>

<style module lang="scss">
  .spinnerWrapper {
    display: flex;
    align-items: center;
    gap: rem(10);
  }

  .spinnerText {
    font-size: rem(16);
    color: var(--a-mainText);
  }

  .spinner {
    width: rem(25);
    height: rem(25);
    border: 3px solid var(--a-borderAccent);
    border-top-color: var(--a-bgDark);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
