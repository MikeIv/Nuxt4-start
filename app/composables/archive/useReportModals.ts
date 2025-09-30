import { ref } from "vue";
import { useAuthStore } from "#imports";

type ReportsEmits = {
  (e: "pageChange", page: number): void;
  (e: "selectionChange", selected: number[]): void;
  (e: "refreshReports"): void;
  (e: "perPageChange", perPage: number | "all"): void;
};

interface UseReportsModalsProps {
  pagination?: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
}

type ApiResponsePayload<T = unknown> = T;

type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  payload?: ApiResponsePayload<T>;
};

interface Report {
  id: number;
  period: string;
  turnover_amount: number;
  turnover_fee: number;
  status: string;
  can_edit: boolean;
  can_download_documents: boolean;
  can_request_correction: boolean;
}

export function useReportsModals(
  localReports: Ref<Report[]>,
  selectedReports: Ref<Set<number>>,
  emitSelectionChange: () => void,
  emit: ReportsEmits,
  props: UseReportsModalsProps,
) {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();

  // ----------------- Модалка исправления -----------------
  const showCorrectionModal = ref(false);
  const reportToCorrect = ref<number | null>(null);
  const correctionText = ref("");

  const openCorrectionModal = (reportId: number) => {
    reportToCorrect.value = reportId;
    correctionText.value = "";
    showCorrectionModal.value = true;
  };

  const closeCorrectionModal = () => {
    reportToCorrect.value = null;
    correctionText.value = "";
    showCorrectionModal.value = false;
  };

  const submitCorrection = () => {
    console.log(
      "Запрос исправления:",
      reportToCorrect.value,
      correctionText.value,
    );
    closeCorrectionModal();
  };

  // ----------------- Модалка удаления -----------------
  const showDeleteModal = ref(false);
  const reportToDelete = ref<number | null>(null);

  const isDeleting = ref(false);
  const deletedRows = ref<Set<number>>(new Set());
  const deletingReports = ref<Set<number>>(new Set());

  const currentPageRef = ref(props.pagination?.currentPage ?? 1);

  const confirmDeleteReport = (reportId: number) => {
    reportToDelete.value = reportId;
    showDeleteModal.value = true;
  };

  const handleCancelDelete = () => {
    reportToDelete.value = null;
    showDeleteModal.value = false;
  };

  const deleteReports = async (reportIds: number[]) => {
    if (!reportIds.length) return;

    isDeleting.value = true;

    try {
      const token = authStore.token;
      if (!token) throw new Error("Пользователь не авторизован");

      // Показываем анимацию удаления
      reportIds.forEach((id) => {
        deletedRows.value.add(id);
        deletingReports.value.add(id);
      });

      const results = await Promise.allSettled(
        reportIds.map((id) =>
          $fetch<ApiResponse>(`/tenants/reports/${id}`, {
            baseURL: config.public.apiBase,
            method: "DELETE",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }),
        ),
      );

      const deletedIds: number[] = [];
      results.forEach((res, idx) => {
        const id = reportIds[idx];
        if (
          id !== undefined &&
          res.status === "fulfilled" &&
          res.value.success
        ) {
          deletedIds.push(id);
        }
      });

      // Обновляем локальное состояние
      localReports.value = localReports.value.filter(
        (report) => !deletedIds.includes(report.id),
      );

      // Убираем удаленные из selectedReports
      deletedIds.forEach((id) => selectedReports.value.delete(id));
      emitSelectionChange();

      // Корректировка текущей страницы
      if (props.pagination) {
        const totalAfterDelete = props.pagination.total - deletedIds.length;
        const perPage = props.pagination.perPage;
        const lastPage = Math.ceil(totalAfterDelete / perPage) || 1;

        if (currentPageRef.value > lastPage) {
          currentPageRef.value = lastPage;
        }
      }

      const DELETE_ANIMATION_DURATION = 1000;
      setTimeout(() => {
        deletedIds.forEach((id) => {
          deletedRows.value.delete(id);
          deletingReports.value.delete(id);
        });
        emit("pageChange", currentPageRef.value);
      }, DELETE_ANIMATION_DURATION);
    } catch (err: unknown) {
      console.error(err);
      alert("Ошибка при удалении отчётов: " + (err as Error).message);
    } finally {
      isDeleting.value = false;
    }
  };

  const deleteReport = (reportId: number) => {
    deleteReports([reportId]);
  };

  const deleteAllSelectedReports = () => {
    deleteReports(Array.from(selectedReports.value));
  };

  const handleConfirmDelete = () => {
    if (reportToDelete.value !== null) {
      deleteReport(reportToDelete.value);
      reportToDelete.value = null;
    }
    showDeleteModal.value = false;
  };

  return {
    // Модалка исправления
    showCorrectionModal,
    reportToCorrect,
    correctionText,
    openCorrectionModal,
    closeCorrectionModal,
    submitCorrection,

    // Модалка удаления
    showDeleteModal,
    reportToDelete,
    confirmDeleteReport,
    handleConfirmDelete,
    handleCancelDelete,
    deleteAllSelectedReports,

    // Состояния удаления
    isDeleting,
    deletedRows,
    deletingReports,
    currentPageRef,
  };
}
