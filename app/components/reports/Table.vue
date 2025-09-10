<script setup lang="ts">
  import {
    useVueTable,
    FlexRender,
    getCoreRowModel,
    getSortedRowModel,
    type SortingState,
  } from "@tanstack/vue-table";
  import IconEdit from "~/assets/icons/edit-icon.svg";
  import IconSort from "~/assets/icons/sort-alt.svg";
  import IconSortAsc from "~/assets/icons/sort-up.svg";
  import IconSortDesc from "~/assets/icons/sort-down.svg";

  const $style = useCssModule();

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

  interface Props {
    headers: TableHeader[];
    reports: Report[];
    pagination?: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
    };
  }

  const props = defineProps<Props>();
  const emit = defineEmits(["pageChange", "sortChange", "selectionChange"]);

  // Состояние для выбранных элементов
  const selectedReports = ref<Set<number>>(new Set());
  const isAllSelected = ref(false);

  // Функция для массового выбора/снятия выбора
  const toggleAllSelection = () => {
    if (isAllSelected.value) {
      selectedReports.value.clear();
    } else {
      // Выбираем только черновики
      props.reports.forEach((report) => {
        if (report.status === "Draft" && report.can_edit) {
          selectedReports.value.add(report.id);
        }
      });
    }
    isAllSelected.value = !isAllSelected.value;
    emitSelectionChange();
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
    const draftReports = props.reports.filter(
      (r) => r.status === "Draft" && r.can_edit,
    );
    isAllSelected.value =
      draftReports.length > 0 &&
      draftReports.every((r) => selectedReports.value.has(r.id));

    emitSelectionChange();
  };

  // Эмитим событие с выбранными отчетами
  const emitSelectionChange = () => {
    emit("selectionChange", Array.from(selectedReports.value));
  };

  const sortedReports = computed(() => {
    return [...props.reports].sort((a, b) => {
      const endA = new Date(a.period.split(" - ")[1] ?? a.period).getTime();
      const endB = new Date(b.period.split(" - ")[1] ?? b.period).getTime();

      return endB - endA;
    });
  });

  const columns = computed(() => {
    const selectColumn = {
      id: "select",
      size: 60,
      header: () => h("div", { class: $style.headerLabel }, ""), // заголовок пустой
      cell: ({ row }: { row: { original: Report; index: number } }) => {
        const report = row.original;
        if (report.status !== "Draft" || !report.can_edit) return null;

        return h("input", {
          type: "checkbox",
          checked: selectedReports.value.has(report.id),
          onChange: () => toggleReportSelection(report.id, report.status),
          class: $style.rowCheckbox,
          title: "Выбрать черновик",
        });
      },
    };

    const otherColumns = props.headers.map((header) => {
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

      // Специальные обработчики для определенных полей
      switch (header.key) {
        case "id":
          return {
            ...baseColumn,
            size: 60,
            cell: ({ row }: { row: { original: Report; index: number } }) => {
              if (!props.pagination) return row.index + 1;

              const { currentPage, perPage } = props.pagination;
              const number = (currentPage - 1) * perPage + row.index + 1;
              return number < 10 ? `0${number}` : number;
            },
          };
        case "period":
          return {
            ...baseColumn,
            size: 200,
            cell: ({ row }: { row: { original: Report; index: number } }) => {
              const [startRow, endRow] = row.original.period.split(" - ");
              const start = startRow ?? row.original.period;
              const end = endRow ?? row.original.period;

              const startDate = new Date(start).toLocaleDateString();
              const endDate = new Date(end).toLocaleDateString();
              return `${startDate} - ${endDate}`;
            },
          };
        case "status":
          return {
            ...baseColumn,
            size: 180,
            cell: ({ row }: { row: { original: Report; index: number } }) => {
              const statusMap: Record<string, string> = {
                CorrectionRequested: "Запрошено исправление",
                Submitted: "Сформирован",
                Draft: "Черновик",
              };
              return statusMap[row.original.status] || row.original.status;
            },
          };
        case "turnover_amount":
        case "turnover_fee":
          return {
            ...baseColumn,
            cell: ({ row }: { row: { original: Report; index: number } }) => {
              const key = header.key as keyof Report;
              const value = row.original[key] as number;
              return value.toLocaleString() + " ₽";
            },
          };
        case "can_edit":
          return {
            ...baseColumn,
            size: 120,
            header: () =>
              h("div", { class: $style.headerWithCheckbox }, [
                h("span", { class: $style.headerLabel }, header.label),
              ]),
            cell: ({ row }: { row: { original: Report; index: number } }) => {
              const report = row.original;

              // Если это не черновик или нельзя редактировать, показываем только кнопку редактирования
              if (report.status !== "Draft" || !report.can_edit) {
                if (!report.can_edit) return null;

                return h(
                  "button",
                  {
                    class: $style.editButton,
                    onClick: (e) => {
                      e.stopPropagation();
                      navigateTo(`/reports/edit/${report.id}`);
                    },
                  },
                  [h(IconEdit, { class: $style.editIcon })],
                );
              }

              // Для черновиков показываем чекбокс и кнопку редактирования
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
                  [h(IconEdit, { class: $style.editIcon })],
                ),
              ]);
            },
          };
        case "can_download_documents":
          return {
            ...baseColumn,
            cell: ({ row }: { row: { original: Report; index: number } }) => {
              if (!row.original.can_download_documents) return null;
              return h(
                "button",
                {
                  class: $style.downloadButton,
                  onClick: (e) => {
                    e.stopPropagation();
                    // Здесь будет обработчик скачивания
                  },
                },
                "Скачать",
              );
            },
          };

        case "can_request_correction":
          return {
            ...baseColumn,
            size: 150,
            cell: ({ row }: { row: { original: Report; index: number } }) => {
              if (!row.original.can_request_correction) return null;

              return h(
                "button",
                {
                  class: $style.requestButton,
                  onClick: async (e) => {
                    console.log(e);
                    // ... обработчик клика
                  },
                },
                "Запросить",
              );
            },
          };

        default:
          return baseColumn;
      }
    });

    return [selectColumn, ...otherColumns];
  });

  const sorting = ref<SortingState>([]);

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
      emit("sortChange", sorting.value);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  watch(
    () => props.pagination?.currentPage,
    (newVal, oldVal) => {
      if (newVal !== oldVal) {
        sorting.value = [...sorting.value];
      }
    },
  );

  const pageNumbers = computed(() => {
    if (!props.pagination) return [];
    const { currentPage, lastPage } = props.pagination;
    const range: (number | string)[] = [];

    range.push(1);

    if (currentPage > 3) {
      range.push("left...");
    }

    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(lastPage - 1, currentPage + 1);
      i++
    ) {
      range.push(i);
    }

    if (currentPage < lastPage - 2) {
      range.push("right...");
    }

    if (lastPage > 1) {
      range.push(lastPage);
    }

    return range;
  });

  const handlePageChange = (page: number) => {
    if (
      props.pagination &&
      page >= 1 &&
      page <= props.pagination.lastPage &&
      page !== props.pagination.currentPage
    ) {
      emit("pageChange", page);
    }
  };

  const buttonClasses = computed(() => {
    return pageNumbers.value.map((page) => ({
      [$style.pageButton]: true,
      [$style.active]: page === (props.pagination?.currentPage || 1),
      [$style.disabled]: page === "...",
    }));
  });
</script>

<template>
  <div :key="pagination?.currentPage" :class="$style.tableContainer">
    <div v-if="!headers || !reports" class="text-gray-500">
      Нет данных для отображения
    </div>
    <template v-else>
      <div :class="$style.tableWrapper">
        <table :class="$style.reportsTable">
          <thead :class="$style.tableHeader">
            <tr
              v-for="headerGroup in table.getHeaderGroups()"
              :key="headerGroup.id"
            >
              <th
                v-for="header in headerGroup.headers"
                :key="header.id"
                :style="{ width: `${header.column.getSize()}px` }"
                @click="
                  header.column.getCanSort()
                    ? header.column.toggleSorting()
                    : null
                "
              >
                <div :class="$style.headerContent">
                  <FlexRender
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                  <span
                    v-if="header.column.getCanSort()"
                    :class="$style.sortIcon"
                  >
                    <template v-if="header.column.getIsSorted() === false">
                      <IconSort />
                    </template>
                    <template v-else-if="header.column.getIsSorted() === 'asc'">
                      <IconSortAsc />
                    </template>
                    <template
                      v-else-if="header.column.getIsSorted() === 'desc'"
                    >
                      <IconSortDesc />
                    </template>
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody :class="$style.tableBody">
            <tr v-for="row in table.getRowModel().rows" :key="row.id">
              <td v-for="cell in row.getVisibleCells()" :key="cell.id">
                <FlexRender
                  :render="cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td :colspan="3">
                <div :class="$style.footerBtnWrapper">
                  <button
                    :class="$style.selectAllButton"
                    @click="toggleAllSelection"
                  >
                    {{
                      isAllSelected ? "Отменить выбор" : "Выбрать все черновики"
                    }}
                  </button>
                  <button v-if="isAllSelected" :class="$style.deleteAllButton">
                    Удалить все выбранные
                  </button>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>

    <footer :class="$style.footer">
      <div v-if="pagination" :class="$style.pagination">
        <button
          :class="{
            [$style.pageButton]: true,
            [$style.disabled]: pagination.currentPage === 1,
          }"
          @click="handlePageChange(pagination.currentPage - 1)"
        >
          Назад
        </button>
        <div :class="$style.pageNumbers">
          <button
            v-for="(page, index) in pageNumbers"
            :key="`page-${index}-${page}`"
            :class="buttonClasses[index]"
            @click="typeof page === 'number' && handlePageChange(page)"
          >
            {{ page === "..." ? "..." : page }}
          </button>
        </div>

        <button
          :class="{
            [$style.pageButton]: true,
            [$style.disabled]: pagination.currentPage === pagination.lastPage,
          }"
          @click="handlePageChange(pagination.currentPage + 1)"
        >
          Вперед
        </button>
      </div>
      <div :class="$style.reportTotal">
        <div>
          <span :class="$style.title">Всего отчетов:</span>
          <span :class="$style.data">{{ pagination?.total }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style module lang="scss">
  .tableContainer {
    display: flex;
    flex-direction: column;
    height: rem(600);
    overflow: hidden;
  }

  .tableWrapper {
    flex: 1;
    overflow: auto;
    position: relative;

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

    scrollbar-width: thin;
    scrollbar-color: var(--a-borderAccent) var(--a-bgLight);
    -ms-overflow-style: -ms-autohiding-scrollbar;
  }

  .reportsTable {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  .tableHeader {
    position: sticky;
    top: 0;
    z-index: 10;
    background-color: var(--a-bgAccentExLight);

    th {
      position: sticky;
      top: 0;
      padding: rem(12) rem(14);
      text-align: center;
      font-size: rem(12);
      font-weight: 600;
      line-height: 1.2;
      color: var(--a-mainText);
      border-bottom: 1px solid var(--a-borderAccent);
      border-right: 1px solid var(--a-borderLght);

      &:last-child {
        border-right: none;
      }
    }
  }

  .headerContent {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: rem(12);
    user-select: none;
  }

  .headerWithCheckbox {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: rem(8);
  }

  .headerLabel {
    font-size: rem(12);
    font-weight: 600;
  }

  .rowCheckbox {
    width: rem(16);
    height: rem(16);
    cursor: pointer;
    background-color: var(--a-bgAccentDark);
    color: var(--a-errorText);

    &:checked {
      background-color: var(--a-bgAccentDark);
      color: var(--a-errorText);
    }
  }

  .editCell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: rem(8);
  }

  .sortIcon {
    svg {
      width: rem(16);
      height: rem(16);
    }

    color: var(--a-bgAccentDark);
    cursor: pointer;
  }

  .tableBody {
    tr {
      background-color: var(--a-bgLight);

      &:hover {
        background-color: var(--a-bgTableLight);
      }
    }

    td {
      padding: rem(12) rem(14);
      vertical-align: center;
      text-align: center;
      font-size: rem(12);
      font-weight: 600;
      line-height: 1.2;
      border-bottom: 1px solid var(--a-bgAccentExLight);
      border-right: 1px solid var(--a-borderAccentLight);

      &:last-child {
        border-right: none;
      }
    }
  }

  .editButton {
    background: none;
    border: none;
    padding: rem(4);
    border-radius: rem(4);
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--a-bgAccentExLight);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .editIcon {
    width: rem(16);
    height: rem(16);
    color: var(--a-bgAccentDark);
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .pagination {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 0;
    margin-top: auto;
  }

  .reportTotal {
    display: flex;
    align-items: center;
    padding-right: rem(40);
  }

  .title {
    margin-right: rem(16);
    font-size: rem(16);
    font-weight: 600;
    color: var(--a-mainText);
  }

  .data {
    font-size: rem(18);
    font-weight: 600;
    color: var(--a-accentTextExDark);
  }

  .pageNumbers {
    display: flex;
    gap: 4px;
  }

  .pageButton {
    padding: rem(4) rem(8);
    font-size: rem(12);
    font-weight: 600;
    color: var(--a-mainText);
    line-height: 1.2;
    border: 1px solid var(--a-borderAccent);
    background: var(--a-bgAccentExLight);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(.disabled) {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    &.active {
      background: var(--a-bgAccentDark);
      color: var(--a-white);
      border-color: var(--a-borderAccentDark);
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .footerBtnWrapper {
    display: inline-flex;
    margin-top: rem(10);
    gap: rem(10);
  }

  .selectAllButton,
  .deleteAllButton {
    width: rem(120);
    height: rem(36);
    padding: rem(4) rem(8);
    font-size: rem(12);
    font-weight: 600;
    color: var(--a-mainText);
    line-height: 1;
    border: 1px solid var(--a-borderAccent);
    background: var(--a-bgAccentExLight);
    border-radius: rem(4);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: var(--a-white);
      background-color: var(--a-bgAccentDark);
    }
  }

  .download-btn {
    background: var(--a-bgAccentExLight);
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--a-bgAccent);
    }
  }
</style>
