import { ref, computed, h } from "vue";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/vue-table";
import type { Ref } from "vue";
import IconEdit from "~/assets/icons/edit-icon.svg";
import IconDelete from "~/assets/icons/delete-icon.svg";
import IconDownload from "~/assets/icons/icon-download.svg";

interface TableHeader {
  key: string;
  label: string;
}

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

interface UseReportsTableParams {
  headers: TableHeader[];
  reports: Ref<Report[]>;
  pagination?: Ref<{
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  }>;
  selectedReports: Ref<Set<number>>;
  isDeleting: Ref<boolean>;
  // deletingReports: Ref<Set<number>>;
  statusColors: Record<string, string>;
  downloadingId: Ref<number | null>;
  downloadReport: (id: number) => Promise<void>;
  openCorrectionModal: (id: number) => void;
  confirmDeleteReport: (id: number) => void;
  emitSortChange: (sorting: SortingState) => void;
  $style: Record<string, string>;
  navigateTo: (path: string) => void;
}

export function useReportsTable({
  headers,
  reports,
  pagination,
  selectedReports,
  isDeleting,
  // deletingReports,
  statusColors,
  downloadingId,
  downloadReport,
  openCorrectionModal,
  confirmDeleteReport,
  emitSortChange,
  $style,
  navigateTo,
}: UseReportsTableParams) {
  const sorting = ref<SortingState>([]);

  const sortedReports = computed(() => {
    return [...reports.value].sort((a, b) => {
      const aEndStr =
        (a.period.split(" - ")[1] ?? a.period.split(" - ")[0]) || "";
      const bEndStr =
        (b.period.split(" - ")[1] ?? b.period.split(" - ")[0]) || "";
      const dateA = new Date(aEndStr.replace(" ", "T")).getTime();
      const dateB = new Date(bEndStr.replace(" ", "T")).getTime();
      return dateB - dateA;
    });
  });

  const sortedHeaders = computed(() => {
    return headers.filter(
      (header) =>
        header.key !== "can_edit" && header.key !== "can_request_correction",
    );
  });

  const columns = computed(() => {
    // const selectColumn = {
    //   id: "select",
    //   size: 60,
    //   header: () => h("div", { class: $style.headerLabel }, ""),
    //   cell: ({ row }: { row: { original: Report; index: number } }) => {
    //     const report = row.original;
    //     if (report.status !== "Draft" || !report.can_edit) return null;

    //     return h("input", {
    //       type: "checkbox",
    //       checked: selectedReports.value.has(report.id),
    //       disabled: isDeleting.value || deletingReports.value.has(report.id),
    //       onChange: () => {
    //         if (selectedReports.value.has(report.id))
    //           selectedReports.value.delete(report.id);
    //         else selectedReports.value.add(report.id);
    //       },
    //       class: $style.rowCheckbox,
    //       title: "Выбрать черновик",
    //     });
    //   },
    // };

    const otherColumns = sortedHeaders.value.map((header) => {
      const baseColumn = {
        accessorKey: header.key,
        header: header.label,
        size: 150,
        enableSorting: [
          "period",
          "turnover_amount",
          "turnover_fee",
          "status",
        ].includes(header.key),
      };

      switch (header.key) {
        case "id":
          return {
            ...baseColumn,
            size: 60,
            cell: ({ row }: { row: { original: Report; index: number } }) => {
              if (!pagination?.value) return row.index + 1;
              const { currentPage, perPage } = pagination.value;
              const number = (currentPage - 1) * perPage + row.index + 1;
              return number < 10 ? `0${number}` : number;
            },
          };
        case "period":
          return {
            ...baseColumn,
            size: 200,
            cell: ({ row }: { row: { original: Report } }) => {
              const [startRow, endRow] = row.original.period.split(" - ");
              const start = startRow ?? row.original.period;
              const end = endRow ?? row.original.period;
              return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
            },
          };
        case "status":
          return {
            ...baseColumn,
            size: 180,
            cell: ({ row }: { row: { original: Report } }) => {
              const statusMap: Record<string, string> = {
                CorrectionRequested: "Запрошено исправление",
                Submitted: "Сформирован",
                Draft: "Черновик",
                Overdue: "Просрочен",
                Editable: "Доступен к исправлению",
              };
              return h("div", { class: $style.statusWrapper }, [
                h(
                  "span",
                  { class: $style.statusText },
                  statusMap[row.original.status] || row.original.status,
                ),
                h("div", {
                  class: $style.statusLine,
                  style: { backgroundColor: statusColors[row.original.status] },
                }),
              ]);
            },
          };
        case "turnover_amount":
        case "turnover_fee":
          return {
            ...baseColumn,
            size: 190,
            cell: ({ row }: { row: { original: Report } }) => {
              const key = header.key as keyof Report;
              return (row.original[key] as number).toLocaleString() + " ₽";
            },
          };
        case "can_edit":
          return {
            ...baseColumn,
            size: 200,
            header: () =>
              h("div", { class: $style.headerWithCheckbox }, [
                h("span", { class: $style.headerLabel }, header.label),
              ]),
            cell: ({ row }: { row: { original: Report } }) => {
              const report = row.original;
              if (report.status === "Draft" && report.can_edit) {
                return h("div", { class: $style.editCell }, [
                  h(
                    "button",
                    {
                      class: $style.editButton,
                      disabled:
                        isDeleting.value || selectedReports.value.size > 1,
                      onClick: (e) => {
                        e.stopPropagation();
                        navigateTo(`/reports/edit/${report.id}`);
                      },
                    },
                    [
                      h(IconEdit, { class: $style.editIcon }),
                      h("span", { class: $style.editText }, "Редактировать"),
                    ],
                  ),
                  h(
                    "button",
                    {
                      class: $style.deleteButton,
                      disabled:
                        isDeleting.value || selectedReports.value.size > 1,
                      onClick: (e) => {
                        e.stopPropagation();
                        confirmDeleteReport(report.id);
                      },
                    },
                    [
                      h(IconDelete, { class: $style.editIcon }),
                      h("span", { class: $style.editText }, "Удалить"),
                    ],
                  ),
                ]);
              }
              if (report.status === "Editable" && report.can_edit) {
                return h("div", { class: $style.editCell }, [
                  h(
                    "button",
                    {
                      class: $style.editButton,
                      onClick: (e) => {
                        e.stopPropagation();
                        navigateTo(`/reports/edit/${report.id}`);
                      },
                    },
                    [
                      h(IconEdit, { class: $style.editIcon }),
                      h("span", { class: $style.editText }, "Редактировать"),
                    ],
                  ),
                ]);
              }
              return null;
            },
          };
        case "can_download_documents":
          return {
            ...baseColumn,
            size: 120,
            cell: ({ row }: { row: { original: Report } }) => {
              const report = row.original;
              if (report.status === "Draft" || report.status === "Overdue")
                return null;
              const isDownloading = downloadingId.value === report.id;
              return h(
                "button",
                {
                  disabled: isDownloading,
                  onClick: async (e) => {
                    e.stopPropagation();
                    await downloadReport(report.id);
                  },
                },
                isDownloading
                  ? h("span", {
                      class: [$style.spinner, $style.spinnerDownloading],
                    })
                  : h(IconDownload, { class: $style.downloadIcon }),
              );
            },
          };
        case "can_request_correction":
          return {
            ...baseColumn,
            size: 120,
            cell: ({ row }: { row: { original: Report } }) => {
              if (!row.original.can_request_correction) return null;
              return h(
                "button",
                {
                  class: $style.editButton,
                  onClick: (e) => {
                    e.stopPropagation();
                    openCorrectionModal(row.original.id);
                  },
                },
                h("span", { class: $style.editText }, "Запросить"),
              );
            },
          };
        default:
          return baseColumn;
      }
    });

    return [...otherColumns];
  });

  const table = useVueTable({
    get data() {
      return sortedReports.value;
    },
    get columns() {
      return columns.value;
    },
    state: {
      get sorting() {
        return sorting.value;
      },
    },
    onSortingChange: (updater) => {
      sorting.value =
        typeof updater === "function" ? updater(sorting.value) : updater;
      emitSortChange(sorting.value);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return { table, sorting, sortedReports };
}
