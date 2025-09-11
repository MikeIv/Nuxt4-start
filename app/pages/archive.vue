<script setup lang="ts">
  import type { ReportApiResponse } from "~/types";

  const {
    callApi: loadReports,
    data: apiResponse,
    isLoading,
    error,
  } = useApi<ReportApiResponse>();

  onMounted(async () => {
    await loadReports("/tenants/reports?perPage=10");
    console.log(apiResponse);
  });

  const loadPage = (page: number) => {
    loadReports(`/tenants/reports?page=${page}&perPage=10`);
  };
</script>

<template>
  <div>
    <div v-if="isLoading">Загрузка...</div>
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
          @page-change="loadPage"
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
</style>
