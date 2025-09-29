<script setup lang="ts">
  import {
    useVueTable,
    FlexRender,
    getCoreRowModel,
    getSortedRowModel,
    type SortingState,
  } from "@tanstack/vue-table";
  import { useAuthStore } from "#imports";
  import IconEdit from "~/assets/icons/edit-icon.svg";
  import IconSort from "~/assets/icons/sort-alt.svg";
  import IconSortAsc from "~/assets/icons/sort-up.svg";
  import IconSortDesc from "~/assets/icons/sort-down.svg";
  import IconDelete from "~/assets/icons/delete-icon.svg";

  const $style = useCssModule();

  const isDeleting = ref(false);
  const deletingReports = ref<Set<number>>(new Set());
  const deletedRows = ref<Set<number>>(new Set());

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
    loading?: boolean;
  }

  type ApiResponsePayload<T = unknown> = T;

  type ApiResponse<T = unknown> = {
    success: boolean;
    message?: string;
    payload?: ApiResponsePayload<T>;
  };

  const authStore = useAuthStore();
  const config = useRuntimeConfig();

  const props = defineProps<Props>();

  const localReports = ref<Report[]>([...props.reports]);

  const currentPageRef = ref<number>(props.pagination?.currentPage ?? 1);

  const statusColors: Record<string, string> = {
    CorrectionRequested: "#F18D1E",
    Submitted: "#86C03F",
    Draft: "#000",
    Overdue: "#FF0000",
    Editable: "#F18D1E",
  };

  const showDeleteModal = ref(false);
  const reportToDelete = ref<number | null>(null);

  // Открытие модалки
  const confirmDeleteReport = (reportId: number) => {
    reportToDelete.value = reportId;
    showDeleteModal.value = true;
  };

  // Подтверждение удаления
  const handleConfirmDelete = () => {
    if (reportToDelete.value !== null) {
      deleteReport(reportToDelete.value);
      reportToDelete.value = null;
    }
    showDeleteModal.value = false;
  };

  // Отмена удаления
  const handleCancelDelete = () => {
    reportToDelete.value = null;
    showDeleteModal.value = false;
  };

  watch(
    () => props.pagination?.currentPage,
    (newPage) => {
      const pageNumber = Number(newPage) || 1; // приводим к числу
      if (pageNumber !== currentPageRef.value) {
        currentPageRef.value = pageNumber;
      }
    },
    { immediate: true },
  );

  // Обработка клика по странице
  const handlePageChange = (page: number | string) => {
    if (!props.pagination || page === "...") return;

    const newPage = Math.max(
      1,
      Math.min(Number(page) || 1, props.pagination.lastPage),
    );

    if (newPage !== currentPageRef.value) {
      currentPageRef.value = newPage;
      emit("pageChange", newPage);
    }
  };

  const visiblePages = computed<(number | string)[]>(() => {
    if (!props.pagination) return [];
    const total = props.pagination.lastPage;
    const current = currentPageRef.value;
    const delta = 2; // сколько страниц показывает вокруг текущей
    const range: (number | string)[] = [];

    for (let i = 1; i <= total; i++) {
      if (
        i === 1 ||
        i === total ||
        (i >= current - delta && i <= current + delta)
      ) {
        range.push(i);
      } else if (range[range.length - 1] !== "...") {
        range.push("...");
      }
    }

    return range;
  });

  watch(
    () => props.reports,
    (newReports) => {
      localReports.value = [...newReports];
    },
  );
  const emit = defineEmits([
    "pageChange",
    "sortChange",
    "selectionChange",
    "refreshReports",
    "perPageChange",
  ]);

  // Состояние для выбранных элементов
  const selectedReports = ref<Set<number>>(new Set());
  const isAllSelected = ref(false);

  // Функция для массового выбора/снятия выбора
  const toggleAllSelection = () => {
    if (isAllSelected.value) {
      selectedReports.value.clear();
    } else {
      // Выбираем только черновики
      localReports.value.forEach((report) => {
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
    const draftReports = localReports.value.filter(
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

  const sorting = ref<SortingState>([]);

  const sortedReports = computed(() => {
    return [...localReports.value].sort((a, b) => {
      const aEndStr =
        (a.period.split(" - ")[1] ?? a.period.split(" - ")[0]) || "";
      const bEndStr =
        (b.period.split(" - ")[1] ?? b.period.split(" - ")[0]) || "";

      // Приводим к ISO: "2024-08-29 00:00:00" → "2024-08-29T00:00:00"
      const dateA = new Date(aEndStr.replace(" ", "T")).getTime();
      const dateB = new Date(bEndStr.replace(" ", "T")).getTime();

      return dateB - dateA; // свежие выше
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
          disabled: isDeleting.value || deletingReports.value.has(report.id),
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
                Overdue: "Просрочен",
                Editable: "Доступен к исправлению",
              };

              const statusText =
                statusMap[row.original.status] || row.original.status;
              const color = statusColors[row.original.status];

              return h("div", { class: $style.statusWrapper }, [
                h("span", { class: $style.statusText }, statusText),
                h("div", {
                  class: $style.statusLine,
                  style: { backgroundColor: color },
                }),
              ]);
            },
          };
        case "turnover_amount":
        case "turnover_fee":
          return {
            ...baseColumn,
            size: 190,
            cell: ({ row }: { row: { original: Report; index: number } }) => {
              const key = header.key as keyof Report;
              const value = row.original[key] as number;
              return value.toLocaleString() + " ₽";
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
            cell: ({ row }: { row: { original: Report; index: number } }) => {
              const report = row.original;

              // Для черновиков показываем редактирование и кнопку удалить
              if (report.status === "Draft" && report.can_edit) {
                return h("div", { class: $style.editCell }, [
                  h(
                    "button",
                    {
                      class: $style.editButton,
                      disabled:
                        deletingReports.value.has(report.id) ||
                        selectedReports.value.size > 1 ||
                        (selectedReports.value.size === 1 &&
                          !selectedReports.value.has(report.id)),
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
                        isDeleting.value ||
                        selectedReports.value.size > 1 ||
                        (selectedReports.value.size === 1 &&
                          !selectedReports.value.has(report.id)),
                      onClick: (e: Event) => {
                        e.stopPropagation();
                        confirmDeleteReport(report.id);
                      },
                    },
                    [
                      h(IconDelete, { class: $style.editIcon }),
                      deletingReports.value.has(report.id)
                        ? h("span", { class: $style.spinner })
                        : h("span", { class: $style.editText }, "Удалить"),
                    ],
                  ),
                ]);
              }

              // Для статуса Editable показываем только кнопку редактирования
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

              // Для других статусов показываем только кнопку редактирования, если можно редактировать
              if (!report.can_edit) return null;
            },
          };
        case "can_download_documents":
          return {
            ...baseColumn,
            size: 120,
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
            size: 120,
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

  const hasDrafts = computed(() =>
    localReports.value.some((r) => r.status === "Draft" && r.can_edit),
  );

  const deleteReports = async (reportIds: number[]) => {
    if (!reportIds.length) return;

    isDeleting.value = true;

    try {
      const token = authStore.token;
      if (!token) throw new Error("Пользователь не авторизован");

      // Показываем анимацию удаления
      reportIds.forEach((id) => deletedRows.value.add(id));

      // Отправляем запросы параллельно
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

      // Убираем анимацию через и обновляем текущую страницу
      setTimeout(() => {
        deletedIds.forEach((id) => deletedRows.value.delete(id));
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

  const handlePerPageChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    const value = target.value === "all" ? "all" : Number(target.value);
    emit("perPageChange", value);
  };

  const perPageValue = computed<string>(() => {
    if (!props.pagination) return "all";
    return props.pagination.perPage >= props.pagination.total
      ? "all"
      : String(props.pagination.perPage);
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
              <template v-if="deletedRows.has(row.original.id)">
                <td
                  :colspan="table.getAllColumns().length"
                  :class="$style.deletedRow"
                >
                  Черновик удален
                </td>
              </template>
              <template v-else>
                <td v-for="cell in row.getVisibleCells()" :key="cell.id">
                  <FlexRender
                    :render="cell.column.columnDef.cell"
                    :props="cell.getContext()"
                  />
                </td>
              </template>
            </tr>
            <div v-if="loading" :class="$style.overlay">
              <span :class="$style.spinner" />
            </div>
            <div v-if="showDeleteModal" :class="$style.modalOverlay">
              <div :class="$style.modalContent">
                <p>Вы уверены, что хотите удалить?</p>
                <div :class="$style.modalButtons">
                  <button
                    :class="$style.confirmButton"
                    @click="handleConfirmDelete"
                  >
                    Удалить
                  </button>
                  <button
                    :class="$style.cancelButton"
                    @click="handleCancelDelete"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </tbody>
          <tfoot>
            <tr>
              <td :colspan="4">
                <div :class="$style.footerBtnWrapper">
                  <button
                    v-if="hasDrafts"
                    :class="$style.selectAllButton"
                    :disabled="isDeleting"
                    @click="toggleAllSelection"
                  >
                    {{
                      isAllSelected ? "Отменить выбор" : "Выбрать все черновики"
                    }}
                  </button>
                  <button
                    v-if="selectedReports.size > 1"
                    :class="$style.deleteAllButton"
                    :disabled="isDeleting"
                    @click="deleteAllSelectedReports"
                  >
                    {{ isDeleting ? "Удаление..." : "Удалить все выбранные" }}
                  </button>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>

    <footer :class="$style.footer">
      <div :class="$style.perPageSelector">
        <label>Показывать отчеты:</label>
        <select :value="perPageValue" @change="handlePerPageChange">
          <option value="12">12</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="all">Все</option>
        </select>
      </div>
      <div v-if="pagination" :class="$style.pagination">
        <button
          :class="[
            $style.pageButton,
            { [$style.disabled]: currentPageRef <= 1 },
          ]"
          :disabled="currentPageRef <= 1"
          @click="handlePageChange(currentPageRef - 1)"
        >
          Назад
        </button>

        <div :class="$style.pageNumbers">
          <button
            v-for="page in visiblePages"
            :key="page"
            :class="[
              $style.pageButton,
              {
                [$style.active]:
                  page !== '...' && Number(page) === currentPageRef,
                [$style.disabled]: page === '...',
              },
            ]"
            @click="handlePageChange(page)"
          >
            {{ page }}
          </button>
        </div>

        <button
          :class="[
            $style.pageButton,
            { [$style.disabled]: currentPageRef >= pagination.lastPage },
          ]"
          :disabled="currentPageRef >= pagination.lastPage"
          @click="handlePageChange(currentPageRef + 1)"
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
    height: rem(700);
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

  .footer {
    flex: 0;
    display: flex;
    align-items: center;
  }

  .footer > div:first-child {
    flex: 1;
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
      padding: rem(10) rem(14);
      text-align: center;
      font-size: rem(12);
      font-weight: 600;
      line-height: 1.2;
      color: var(--a-mainText);
      border-bottom: 1px solid var(--a-borderAccent);
      border-right: 1px solid var(--a-borderLght);

      &:last-child {
        border-right: none;
        border-top-right-radius: rem(20);
      }

      &:first-child {
        border-top-left-radius: rem(20);
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
    justify-content: center;
    gap: rem(10);
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

      &:last-child {
        td:first-child {
          border-bottom-left-radius: rem(15);
        }
        td:last-child {
          border-bottom-right-radius: rem(15);
        }
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

  .editButton,
  .deleteButton {
    display: inline-flex;
    align-items: center;
    gap: rem(6);
    padding: rem(3);
    border-radius: rem(4);
    border: 1px solid var(--a-borderAccent);
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
    width: rem(13);
    height: rem(13);
    color: var(--a-bgAccentDark);
  }

  .editText {
    line-height: 1;
  }

  .pagination {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 0;
    flex: 0;
    margin: 0 auto;
  }

  .reportTotal {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
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
    border-radius: rem(4);
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
    width: rem(180);
    height: rem(25);
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

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .download-btn {
    background: var(--a-bgAccentExLight);
    color: white;
    border: none;
    padding: rem(6) rem(12);
    border-radius: rem(4);
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--a-bgAccent);
    }
  }

  .spinner {
    border: 2px solid var(--a-bgAccentExLight);
    border-top: 2px solid var(--a-bgAccentDark);
    border-radius: 50%;
    width: 14px;
    height: 14px;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .deletedRow {
    text-align: center;
    font-weight: 600;
    color: var(--code-ident);
    background-color: var(--a-bgLight);
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .spinner {
    width: rem(35);
    height: rem(35);
    border: 3px solid var(--a-borderAccent);
    border-top-color: var(--a-bgDark);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .statusWrapper {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: rem(2);
  }

  .statusText {
    display: inline-block;
  }

  .statusLine {
    width: 100%;
    max-width: 100%;
    height: rem(2);
  }

  .modalOverlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modalContent {
    background: var(--a-white);
    padding: rem(20);
    border-radius: rem(10);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: rem(400);
  }

  .modalButtons {
    margin-top: rem(20);
    display: flex;
    gap: rem(30);
  }

  .cancelButton,
  .confirmButton {
    padding: rem(6) rem(12);
    font-size: rem(14);
    font-weight: 600;
    border-radius: rem(6);
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }

  .cancelButton {
    background: var(--a-bgGrayLight);
    &:hover {
      background: var(--a-bgGray);
    }
  }

  .confirmButton {
    background: #f44336;
    color: var(--a-white);
    &:hover {
      background: #d32f2f;
    }
  }

  .perPageSelector {
    display: flex;
    align-items: center;
    gap: rem(8);
    margin-right: rem(20);

    label {
      font-size: rem(12);
      font-weight: 600;
      color: var(--a-mainText);
    }

    select {
      padding: rem(4) rem(8);
      font-size: rem(12);
      border: 1px solid var(--a-borderAccent);
      border-radius: rem(4);
      cursor: pointer;
    }
  }
</style>
