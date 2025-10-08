<script setup lang="ts">
  import { onMounted } from "vue";
  import { useReports } from "~/composables/archive/useReports";

  const {
    isRefreshing,
    apiResponse,
    isLoading,
    error,
    init,
    loadPage,
    toggleSortOrder,
    refreshReports,
    handlePerPageChange,
  } = useReports();

  onMounted(async () => {
    await init();
  });
</script>

<template>
  <div>
    <div v-if="isLoading && !isRefreshing" :class="$style.overlay">
      Идет загрузка
      <span :class="$style.spinner" />
    </div>

    <div v-else-if="error" class="text-red-500">{{ error }}</div>

    <div v-else-if="apiResponse?.data" :class="$style.wrapper">
      <CashiersHeader main-title="Архив отчетов" step-title="" />

      <section :class="$style.content">
        <ReportsTable
          :headers="apiResponse.data.header"
          :reports="apiResponse.data.body"
          :pagination="{
            currentPage: apiResponse.current_page,
            lastPage: apiResponse.last_page,
            perPage: apiResponse.per_page,
            total: apiResponse.total,
          }"
          :loading="isRefreshing"
          @refresh-reports="refreshReports"
          @page-change="loadPage"
          @per-page-change="handlePerPageChange"
          @sort-change="
            ({ order }) => toggleSortOrder(order, apiResponse.current_page)
          "
        />
      </section>
    </div>
  </div>
</template>

<style module lang="scss">
  .wrapper,
  .content {
    display: flex;
    flex-direction: column;
    overflow: auto;
  }

  .overlay {
    display: flex;
    justify-content: start;
    align-items: center;
    font-style: rem(25);
  }

  .spinner {
    margin-left: rem(20);
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
