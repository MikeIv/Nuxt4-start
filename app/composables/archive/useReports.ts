// app/composables/archive/useReports.ts
import { ref } from "vue";
import { useApi } from "~/composables/useApi";
import type { ReportApiResponse } from "~/types";

export const useReports = () => {
  const perPage = ref(12);
  const isRefreshing = ref(false);
  const sortOrder = ref<"asc" | "desc">("asc"); // направление сортировки
  const sortField = ref<"period" | "created_at">("period"); // поле сортировки

  const {
    callApi: loadReports,
    data: apiResponse,
    isLoading,
    error,
  } = useApi<ReportApiResponse>();

  const getContractIdHeaders = () => {
    const userStore = useUserStore();
    const contractId = userStore.user?.id;

    if (!contractId) {
      console.warn("Contract ID not available");
      return {};
    }

    return {
      "Contract-id": contractId.toString(),
    };
  };

  const buildQueryParams = (page: number, perPageParam: number) => {
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: perPageParam.toString(),
    });

    params.append("sort[0][field]", sortField.value);
    params.append("sort[0][ascending]", sortOrder.value);

    return params.toString();
  };

  const fetchReports = async (page = 1, perPageParam?: number) => {
    const headers = getContractIdHeaders();
    const query = buildQueryParams(page, perPageParam ?? perPage.value);

    if (!apiResponse.value) {
      await loadReports(`/tenants/reports?${query}`, { headers });
    } else {
      isRefreshing.value = true;
      await loadReports(`/tenants/reports?${query}`, { headers });
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
    const perPageParam = newPerPage === "all" ? 1000 : newPerPage;
    perPage.value = perPageParam;
    await fetchReports(1, perPageParam);
  };

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
