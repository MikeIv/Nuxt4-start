import { ref } from "vue";
import { useApi } from "~/composables/useApi";
import type { ReportApiResponse } from "~/types";

export const useReports = () => {
  const perPage = ref(12);
  const isRefreshing = ref(false);

  const {
    callApi: loadReports,
    data: apiResponse,
    isLoading,
    error,
  } = useApi<ReportApiResponse>();

  const fetchReports = async (page = 1, perPageParam?: number) => {
    if (!apiResponse.value) {
      // Первая загрузка
      await loadReports(
        `/tenants/reports?page=${page}&perPage=${perPageParam ?? perPage.value}`,
      );
    } else {
      // Обновление
      isRefreshing.value = true;
      await loadReports(
        `/tenants/reports?page=${page}&perPage=${perPageParam ?? perPage.value}`,
      );
      isRefreshing.value = false;
    }
  };

  const loadPage = async (page: number) => {
    await fetchReports(page);
  };

  const refreshReports = async (page: number) => {
    await fetchReports(page);
  };

  const handlePerPageChange = async (newPerPage: number | "all") => {
    const perPageParam = newPerPage === "all" ? 10000 : newPerPage;
    perPage.value = perPageParam;
    await fetchReports(1, perPageParam);
  };

  // initial load
  const init = async () => {
    await fetchReports();
  };

  return {
    perPage,
    isRefreshing,
    apiResponse,
    isLoading,
    error,
    init,
    loadPage,
    refreshReports,
    handlePerPageChange,
  };
};
