<script setup lang="ts">
  const userStore = useUserStore();

  const { user, fetchUser, isLoading } = useUser();

  const saveMessage = ref("");
  const isError = ref(false);

  const kktData = computed(
    () =>
      userStore.user?.kkts?.map((kktNumber) => ({
        registration_number: kktNumber,
      })) || [],
  );

  const userFields = computed(() => [
    { label: "Юридическое лицо", value: userStore.user?.tenant_name },
    { label: "Бренд", value: userStore.user?.brand },
    { label: "Номер помещения", value: userStore.user?.room_number },
    { label: "Номер договора", value: userStore.user?.contract_number },
    { label: "Тип договора", value: userStore.user?.contract_type },
    {
      label: "Дата заключения договора",
      value: userStore.user?.contract_date,
    },
  ]);

  console.log("userFields", userFields.value);

  const showMessage = (message: string, error = false) => {
    saveMessage.value = message;
    isError.value = error;
    setTimeout(() => {
      saveMessage.value = "";
    }, 3000);
  };

  onMounted(async () => {
    try {
      await fetchUser();
    } catch (err) {
      console.log(err);
      showMessage("Ошибка при загрузке данных пользователя", true);
    }
  });
</script>

<template>
  <section class="home-view">
    <h2 class="home-view__title">Данные арендатора</h2>

    <div
      v-if="saveMessage"
      class="home-view__message"
      :class="{ error: isError }"
    >
      {{ saveMessage }}
    </div>

    <ul v-if="!isLoading && user" class="home-view__list">
      <li
        v-for="(field, index) in userFields"
        :key="index"
        class="home-view__item"
      >
        <span class="home-view__item-text medium">{{ field.label }}</span>
        <span class="home-view__item-text">{{ field.value ?? "-" }}</span>
      </li>

      <template v-if="kktData.length">
        <li
          v-for="(kkt, index) in kktData"
          :key="`kkt-${index}`"
          class="home-view__item"
          :class="{ 'border-b-0': index === kktData.length - 1 }"
        >
          <span class="home-view__item-text medium">
            Регистрационный номер ККТ {{ index + 1 }}
          </span>
          <span class="home-view__item-text">{{
            kkt.registration_number
          }}</span>
        </li>
      </template>

      <li v-else class="home-view__item">
        <span class="home-view__item-text">Нет данных о ККТ</span>
      </li>
    </ul>
  </section>
</template>

<style lang="scss">
  .home-view {
    display: flex;
    flex-direction: column;
    width: 100%;

    &__title {
      margin-bottom: rem(40);
      font-size: rem(26);
      font-weight: bold;
      color: var(--a-accentTextDark);
      text-transform: uppercase;
    }

    &__message {
      padding: rem(10);
      margin-bottom: rem(20);
      border-radius: rem(4);

      &.error {
        background-color: var(--a-mainBg);
        color: var(--a-bgWarning);
      }

      &.success {
        background-color: var(--a-bgLight);
        color: var(--a-successText);
      }
    }

    &__list {
      display: flex;
      flex-direction: column;
      max-width: rem(900);
    }

    &__item {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: rem(36);
      margin-bottom: rem(18);
      border-bottom: rem(1) solid var(--a-borderAccentLight);

      &-text {
        font-size: rem(18);

        &.medium {
          font-weight: 600;
        }
      }
    }

    .text-error {
      color: var(--a-bgWarning);
    }

    .retry-button {
      margin-left: rem(10);
      padding: rem(2) rem(8);
      background: #f5f5f5;
      border: rem(1) solid var(--a-borderAccentLight);
      border-radius: rem(4);
      cursor: pointer;
      font-size: rem(14);

      &:hover {
        background: var(--a-bgTable);
      }
    }
  }
</style>
