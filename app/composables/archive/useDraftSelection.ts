import { ref, computed, watch } from "vue";

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

export function useDraftSelection(
  reports: Ref<Report[]>,
  emitSelectionChange: (selectedIds: number[]) => void,
) {
  // Состояние для выбранных элементов
  const selectedReports = ref<Set<number>>(new Set());
  const isAllSelected = ref(false);

  const hasDrafts = computed(() =>
    reports.value.some((r) => r.status === "Draft" && r.can_edit),
  );

  // Функция для массового выбора/снятия выбора
  const toggleAllSelection = () => {
    if (isAllSelected.value) {
      selectedReports.value.clear();
    } else {
      // Выбираем только черновики
      reports.value.forEach((report) => {
        if (report.status === "Draft" && report.can_edit) {
          selectedReports.value.add(report.id);
        }
      });
    }
    isAllSelected.value = !isAllSelected.value;
    emitSelectionChange(Array.from(selectedReports.value));
  };

  // Функция для переключения выбора отдельного отчета
  const toggleReportSelection = (reportId: number, status: string) => {
    if (status !== "Draft") return;

    if (selectedReports.value.has(reportId)) {
      selectedReports.value.delete(reportId);
    } else {
      selectedReports.value.add(reportId);
    }

    // Обновляем состояние массового выбора
    const draftReports = reports.value.filter(
      (r) => r.status === "Draft" && r.can_edit,
    );
    isAllSelected.value =
      draftReports.length > 0 &&
      draftReports.every((r) => selectedReports.value.has(r.id));

    emitSelectionChange(Array.from(selectedReports.value));
  };

  // Синхронизируем выбранные отчеты при изменении списка
  watch(reports, () => {
    const draftIds = reports.value
      .filter((r) => r.status === "Draft" && r.can_edit)
      .map((r) => r.id);
    selectedReports.value.forEach((id) => {
      if (!draftIds.includes(id)) selectedReports.value.delete(id);
    });
    isAllSelected.value =
      draftIds.length > 0 &&
      draftIds.every((id) => selectedReports.value.has(id));
  });

  return {
    selectedReports,
    isAllSelected,
    hasDrafts,
    toggleAllSelection,
    toggleReportSelection,
  };
}
