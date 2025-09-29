<script setup lang="ts">
  import type { ReportApiResponse } from "~/types";

  const {
    callApi: loadReports,
    data: apiResponse,
    isLoading,
    error,
  } = useApi<ReportApiResponse>();

  // флаг фонового обновления
  const isRefreshing = ref(false);

  const perPage = ref(12);

  onMounted(async () => {
    await loadReports(`/tenants/reports?perPage=${perPage.value}`);
  });

  const loadPage = async (page: number) => {
    isRefreshing.value = true;
    await loadReports(`/tenants/reports?page=${page}&perPage=${perPage.value}`);
    isRefreshing.value = false;
  };

  const refreshReports = async (page: number) => {
    isRefreshing.value = true;
    await loadReports(`/tenants/reports?page=${page}&perPage=${perPage.value}`);
    isRefreshing.value = false;
  };

  const handlePerPageChange = async (newPerPage: number | "all") => {
    const perPageParam = newPerPage === "all" ? 10000 : newPerPage;
    perPage.value = perPageParam;
    await loadReports(`/tenants/reports?page=1&perPage=${perPageParam}`);
  };
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
