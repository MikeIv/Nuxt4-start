<script setup lang="ts">
  interface Cashier {
    id?: string | null;
    name: string;
    registration_number: string;
    serial_number: string;
    fn_number: string;
    registered_at: Date | string | null;
    installed_at: Date | string | null;
    order: number;
    isDirty?: boolean;
    isCustom?: boolean;
  }

  const {
    callApi: loadKktData,
    data: kktData,
    isLoading: kktLoading,
  } = useApi<Cashier[]>();

  const {
    callApi: saveKktData,
    isLoading: isSaving,
    fullResponse: saveResponse,
  } = useApi();

  const allTables = ref<Cashier[]>([]);
  const saveMessage = ref("");
  const isError = ref(false);
  const invalidFields = ref<Record<string, boolean>>({});

  console.log("allTables", allTables.value);

  const hasChanges = computed(() => {
    if (kktData.value && allTables.value.length !== kktData.value.length) {
      return true;
    }

    return allTables.value.some((table) => table.isDirty || table.isCustom);
  });

  const { setupGuard } = useUnsavedChangesGuard(hasChanges);

  const addBlock = () => {
    const blockNumber = allTables.value.length + 1;
    const name = `Касса ${blockNumber}`;

    allTables.value.push({
      name,
      _originalName: name,
      registration_number: "",
      serial_number: "",
      fn_number: "",
      registered_at: null,
      installed_at: null,
      order: blockNumber,
      isDirty: true,
      isCustom: true,
    });

    showMessage("Добавлен новый блок");
    nextTick(() => {
      const tables = document.querySelectorAll(".table");
      tables[tables.length - 1]?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const removeBlock = (block: Cashier) => {
    if (!confirm("Вы уверены, что хотите удалить эту кассу?")) return;

    const index = allTables.value.findIndex(
      (b) =>
        (block.id && b.id === block.id) ||
        (!block.id && b.order === block.order),
    );

    if (index !== -1) {
      if (block.id) {
        allTables.value.forEach((t) => (t.isDirty = true));
      }

      allTables.value.splice(index, 1);
      showMessage("Касса удалена");

      allTables.value.forEach((table, idx) => {
        table.order = idx + 1;
      });
    }
  };

  const validateBeforeSave = () => {
    invalidFields.value = {};
    let isValid = true;

    allTables.value.forEach((block, index) => {
      if (!block.isDirty && !block.isCustom) return;

      if (!block.name?.trim()) {
        invalidFields.value[`name-${index}`] = true;
        isValid = false;
      }

      if (
        block.isCustom &&
        (!block.registration_number || block.registration_number.length !== 16)
      ) {
        invalidFields.value[`regNum-${index}`] = true;
        isValid = false;
      }

      if (!block.serial_number?.trim()) {
        invalidFields.value[`serialNum-${index}`] = true;
        isValid = false;
      }

      if (!block.fn_number?.trim()) {
        invalidFields.value[`fnNum-${index}`] = true;
        isValid = false;
      }

      if (!block.registered_at) {
        invalidFields.value[`regDate-${index}`] = true;
        isValid = false;
      }

      if (!block.installed_at) {
        invalidFields.value[`instDate-${index}`] = true;
        isValid = false;
      }
    });

    return isValid;
  };

  const saveData = async () => {
    if (isSaving.value) return;
    if (!validateBeforeSave()) {
      showMessage("Заполните все обязательные поля", true);
      return;
    }

    try {
      const formattedData = {
        kkts: allTables.value.map((table) => ({
          id: table.id || null,
          name: table.name,
          registration_number: table.registration_number,
          serial_number: table.serial_number,
          fn_number: table.fn_number,
          registered_at: formatDateForApi(table.registered_at),
          installed_at: formatDateForApi(table.installed_at),
        })),
      };

      function formatDateForApi(date: Date | string | null): string | null {
        if (!date) return null;
        const d = new Date(date);
        return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
      }

      await saveKktData("/tenants/kkts", {
        method: "POST",
        body: formattedData,
      });

      if (!saveResponse.value || saveResponse.value.success !== true) {
        const errorMsg = saveResponse.value?.message || "Ошибка при сохранении";
        showMessage(errorMsg, true);
        return;
      }

      allTables.value = allTables.value.map((table) => ({
        ...table,
        isDirty: false,
        isCustom: false,
      }));

      showMessage(saveResponse.value.message || "Данные успешно сохранены");

      await loadKktData("/tenants/kkts");
      if (kktData.value) {
        allTables.value = kktData.value.map((table, index) => ({
          ...table,
          order: index + 1,
          isDirty: false,
          isCustom: false,
        }));
      }
    } catch (err) {
      console.error("Ошибка сохранения:", err);
      showMessage("Ошибка при сохранении данных", true);
    }
  };

  const updateData = async () => {
    if (!hasChanges.value) {
      showMessage("Нет изменений для отмены");
      return;
    }

    if (!confirm("Все несохраненные изменения будут потеряны. Продолжить?")) {
      return;
    }

    try {
      await loadKktData("/tenants/kkts");
      if (kktData.value) {
        allTables.value = kktData.value.map((table) => ({
          ...table,
          isDirty: false,
          isCustom: false,
        }));
      }
      showMessage("Изменения отменены");
    } catch (err) {
      console.error("Ошибка при отмене изменений:", err);
      showMessage("Ошибка при отмене изменений", true);
    }
  };

  const hasEmptyFields = computed(() => {
    return allTables.value.some((table) => {
      if (!table.isDirty && !table.isCustom) return false;

      const requiredFieldsValid =
        table.name?.trim() &&
        table.serial_number?.trim() &&
        table.fn_number?.trim() &&
        table.registered_at &&
        table.installed_at;

      if (table.isCustom) {
        return !(
          requiredFieldsValid && table.registration_number?.length === 16
        );
      }

      return !requiredFieldsValid;
    });
  });

  const showMessage = (message: string, error = false) => {
    saveMessage.value = message;
    isError.value = error;
    setTimeout(() => {
      saveMessage.value = "";
    }, 5000);
  };

  let cleanupGuard: (() => void) | null = null;

  onMounted(async () => {
    try {
      await loadKktData("/tenants/kkts");
      if (kktData.value) {
        allTables.value = kktData.value.map((table) => ({
          ...table,
          _originalName: table.name,
          isDirty: false,
          isCustom: false,
        }));
      }

      cleanupGuard = setupGuard();
    } catch (err) {
      console.error("Ошибка загрузки данных:", err);
      showMessage("Ошибка при загрузке данных ККТ", true);
    }
  });

  onUnmounted(() => {
    if (cleanupGuard) {
      cleanupGuard();
    }
  });
</script>

<template>
  <div :class="cashes.cashes">
    <CashiersHeader
      main-title="Мои кассы"
      step-title="Добавляйте и редактируйте информацию о Ваших кассах"
    />

    <section :class="cashes.content">
      <div v-if="kktLoading">Загрузка данных...</div>

      <template v-else>
        <section :class="cashes.section">
          <CashiersTable
            v-for="(block, index) in allTables"
            :key="block.id || `custom-${index}`"
            v-model:block="allTables[index]"
            :index="index"
            :invalid-fields="invalidFields"
            :is-from-api="!!block.id"
            :autofocus="block.isCustom && allTables.length - 1 === index"
            @remove-block="removeBlock"
          />
        </section>
      </template>

      <div :class="cashes.row">
        <div :class="cashes.actions">
          <button :class="[cashes.btn, cashes.btnAction]" @click="addBlock">
            Добавить кассу
          </button>
        </div>
      </div>

      <div :class="cashes.row">
        <button
          :class="[cashes.btn, cashes.btnGhost]"
          :disabled="!hasChanges || isSaving || hasEmptyFields"
          :title="
            !hasChanges
              ? 'Нет изменений для сохранения'
              : hasEmptyFields
                ? 'Заполните все обязательные поля'
                : 'Сохранить изменения'
          "
          @click="saveData"
        >
          <span :class="cashes.btnTitle">
            {{ isSaving ? "Сохранение..." : "Сохранить" }}
          </span>
        </button>

        <button
          :class="[cashes.btn, cashes.btnGhost]"
          :disabled="!hasChanges || isSaving"
          @click="updateData"
        >
          <span :class="cashes.btnTitle">
            {{ isSaving ? "Отмена..." : "Отменить" }}
          </span>
        </button>

        <transition name="fade">
          <div
            v-if="saveMessage"
            :class="[cashes.flagMessage, { error: isError }]"
          >
            {{ saveMessage }}
            <span v-if="hasEmptyFields && isError">
              (Проверьте все кассы с изменениями)
            </span>
          </div>
        </transition>
      </div>
    </section>
  </div>
</template>

<style module="cashes" lang="scss">
  .cashes {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 200px);
    padding: rem(12) rem(8);
    background: var(--a-white);
    overflow: auto;

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

  .content {
    display: flex;
    flex-direction: column;
  }

  .section {
    position: relative;
    display: flex;
    flex-direction: column;
    margin-bottom: rem(40);
  }

  .row {
    position: relative;
    display: flex;
    gap: 1.125rem;
    align-items: center;
    margin-bottom: rem(24);
  }
  .actions {
    display: flex;
    gap: 18px;
  }

  .btn {
    display: flex;
    justify-content: center;
    align-items: center;
    width: max-content;
    flex-shrink: 0;
    padding: rem(4) rem(12);
    font-size: 0.875rem;
    font-weight: 600;
    background-color: var(--a-accentTextDark);
    border-radius: 0.25rem;
    transition: background-color 0.3s;
    cursor: pointer;

    &:disabled {
      padding: rem(2) rem(12);
      background-color: var(--a-bgLight);
      border: 1px solid var(--a-borderAccent);
      opacity: 0.5;
      cursor: not-allowed;

      &:hover {
        color: var(--a-mainText);
        background-color: var(--a-bgLight);
        border: 1px solid var(--a-borderAccent);
      }
    }
    &:hover {
      color: var(--a-white);
      background-color: var(--a-bgAccentDark);
      transition: background-color 0.3s;
    }
  }

  .btnAction {
    color: var(--a-mainText);

    &:hover {
      color: var(--a-white);
      background-color: var(--a-bgAccentDark);
      transition: background-color 0.3s;
    }
  }

  .btnGhost {
    padding: rem(2) rem(12);
    background-color: var(--a-bgLight);
    border: 1px solid var(--a-borderAccent);
  }

  .btnTitle {
    padding: 0;
  }

  .flagMessage {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: rem(4) rem(16);
    height: rem(26);
    font-size: rem(13);
    font-weight: 600;
    color: var(--a-lightText);
    background-color: var(--a-bgGreen);
    border-radius: rem(4);
    z-index: 2;

    &.error {
      background-color: var(--a-bgError);
    }
  }
</style>
