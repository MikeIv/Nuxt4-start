<script setup lang="ts">
  import { Popover, PopoverButton, PopoverPanel } from "@headlessui/vue";
  import type { PropType } from "vue";

  interface Contract {
    id: number;
    name?: string;
  }

  defineProps({
    isLoading: { type: Boolean, default: false },
    hasContractsToShow: { type: Boolean, default: false },
    filteredContracts: {
      type: Array as PropType<Contract[]>,
      default: () => [],
    },
  });

  const emit = defineEmits(["change"]);

  const handleContractChange = (contractId: number, close: () => void) => {
    emit("change", contractId);
    close();
  };
</script>

<template>
  <Popover v-slot="{ close, open }" :class="$style.popover">
    <PopoverButton
      :class="[$style.btn, $style.btnSwitch, open ? $style.btnOpen : '']"
      :disabled="!hasContractsToShow || isLoading"
      aria-label="Переключиться между договорами"
    >
      <UIcon name="i-switch-icon" :class="$style.iconSwitch" />
      <span :class="$style.btnText">Переключиться</span>
    </PopoverButton>
    <PopoverPanel v-if="hasContractsToShow" :class="$style.popoverBlock">
      <ul :class="$style.switchList">
        <li
          v-for="contract in filteredContracts"
          :key="contract.id"
          :class="[
            filteredContracts.length === 1
              ? $style.switchItemOne
              : $style.switchItem,
          ]"
          @click="() => handleContractChange(contract.id, close)"
        >
          {{ contract?.name || `Договор ${contract.id}` }}
        </li>
      </ul>
    </PopoverPanel>
  </Popover>
</template>

<style module lang="scss">
  @use "@/assets/styles/variables/_z-index.scss" as z;

  .popover {
    display: flex;
    width: 100%;
    position: relative;
  }

  .btn {
    display: flex;
    align-items: center;
    width: 100%;
    padding: rem(10) rem(12);
    font-size: rem(16);
    font-weight: bold;
    transition: background-color 0.2s ease;

    &:focus {
      outline: none;
      box-shadow: 0 0 0 rem(1) var(--a-bgAccent);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .btnOpen {
    background-color: var(--a-bgAccent);
  }

  .btnSwitch {
    border: 1px solid var(--a-bgAccent);
    border-radius: 0 0 rem(8) rem(8);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;

    &:hover:not(:disabled) {
      background-color: var(--a-bgAccent);
    }
  }

  .btnText {
    margin-right: rem(25);
  }

  .iconSwitch {
    display: flex;
    justify-content: center;
    align-items: center;
    width: rem(24);
    height: rem(24);
    color: var(--a-white);
    font-size: rem(12);
  }

  .popoverBlock {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    margin-top: rem(4);
    border: 1px solid var(--a-borderAccentLight);
    border-radius: rem(8);
    background-color: var(--a-mainBg);
    z-index: z.z(modal, nav-menu);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform-origin: top center;
  }

  .switchList {
    display: flex;
    flex-direction: column;
    max-height: 60vh;
    overflow-y: auto;
  }

  .switchItem {
    padding: rem(10) rem(12);
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover:first-child {
      background-color: var(--a-bgAccentLight);
      border-radius: rem(8) rem(8) 0 0;
    }

    &:hover {
      background-color: var(--a-bgAccentLight);
    }

    &:hover:last-child {
      background-color: var(--a-bgAccentLight);
      border-radius: 0 0 rem(8) rem(8);
    }
  }

  .switchItemOne {
    padding: rem(10) rem(12);
    cursor: pointer;
    transition: background-color 0.15s ease;
    border-radius: rem(8);

    &:hover {
      background-color: var(--a-bgAccentLight);
    }
  }
</style>
