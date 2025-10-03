<script setup lang="ts">
  import { FlexRender } from "@tanstack/vue-table";
  import { useDownloadReport } from "#imports";
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
    loading?: boolean;
  }

  const handlePerPageChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    const value = target.value === "all" ? "all" : Number(target.value);
    emit("perPageChange", value);
  };

  const { downloadReport } = useDownloadReport();

  const props = defineProps<Props>();

  const localReports = ref<Report[]>([...props.reports]);

  const statusColors: Record<string, string> = {
    CorrectionRequested: "#F18D1E",
    Submitted: "#86C03F",
    Draft: "#000",
    Overdue: "#FF0000",
    Editable: "#F18D1E",
  };

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

  // Эмитим событие с выбранными отчетами
  const emitSelectionChange = () => {
    emit("selectionChange", Array.from(selectedReports.value));
  };

  const { selectedReports, isAllSelected, hasDrafts, toggleAllSelection } =
    useDraftSelection(localReports, emitSelectionChange);

  const perPageValue = computed<string>(() => {
    if (!props.pagination) return "all";
    return props.pagination.perPage >= props.pagination.total
      ? "all"
      : String(props.pagination.perPage);
  });

  const {
    showCorrectionModal,
    correctionText,
    openCorrectionModal,
    closeCorrectionModal,
    submitCorrection,
    showDeleteModal,
    confirmDeleteReport,
    handleConfirmDelete,
    handleCancelDelete,
    deleteAllSelectedReports,
    isDeleting,
    deletedRows,
    // deletingReports,
    currentPageRef,
  } = useReportsModals(
    localReports,
    selectedReports,
    emitSelectionChange,
    emit,
    props,
  );

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

  const { table } = useReportsTable({
    headers: props.headers,
    reports: localReports,
    pagination: props.pagination
      ? (toRef(props, "pagination") as Ref<{
          currentPage: number;
          lastPage: number;
          perPage: number;
          total: number;
        }>)
      : undefined,
    selectedReports,
    isDeleting,
    // deletingReports,
    statusColors,
    downloadReport,
    openCorrectionModal,
    confirmDeleteReport,
    emitSortChange: (s) => emit("sortChange", s),
    $style,
    navigateTo,
  });
</script>

<template>
  <div :key="pagination?.currentPage" :class="$style.tableContainer">
    <template v-if="props.reports.length">
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
              >
                <div :class="$style.headerContent">
                  <FlexRender
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                  <span
                    v-if="header.column.getCanSort()"
                    :class="$style.sortIcon"
                    @click.stop="header.column.toggleSorting()"
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
          </tbody>
        </table>
      </div>
      <!-- Подтверждение удаления -->
      <div v-if="showDeleteModal" :class="$style.modalOverlay">
        <div :class="$style.modalContent">
          <p>Вы уверены, что хотите удалить?</p>
          <div :class="$style.modalButtons">
            <button :class="$style.confirmButton" @click="handleConfirmDelete">
              Удалить
            </button>
            <button :class="$style.cancelButton" @click="handleCancelDelete">
              Отмена
            </button>
          </div>
        </div>
      </div>
      <!-- Запрос исправления -->
      <div v-if="showCorrectionModal" :class="$style.modalOverlay">
        <div :class="$style.modalContent">
          <h3>Запросить исправление</h3>
          <input
            v-model="correctionText"
            type="text"
            placeholder="Введите комментарий"
            :class="$style.modalInput"
          />
          <div :class="$style.modalButtons">
            <button :class="$style.confirmButton" @click="submitCorrection">
              Отправить
            </button>
            <button :class="$style.cancelButton" @click="closeCorrectionModal">
              Отмена
            </button>
          </div>
        </div>
      </div>
      <div :class="$style.footerBtnWrapper">
        <button
          v-if="hasDrafts && selectedReports.size >= 1"
          :class="$style.selectAllButton"
          :disabled="isDeleting"
          @click="toggleAllSelection"
        >
          {{ isAllSelected ? "Отменить выбор" : "Выбрать все черновики" }}
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
    </template>
    <template v-else>
      <div class="text-gray-500">Нет данных для отображения</div>
    </template>
  </div>
</template>

<style module lang="scss">
  .tableContainer {
    display: flex;
    flex-direction: column;
    height: rem(680);
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
    margin-top: auto;
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
      padding: rem(10) rem(8);
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
    gap: rem(4);
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
      background: var(--a-bgGrayLight);
      border-color: var(--a-bgGrayDark);
    }

    &.active {
      background: var(--a-bgAccentDark);
      color: var(--a-white);
      border-color: var(--a-borderAccentDark);
      &:hover {
        cursor: not-allowed;
        background: var(--a-bgAccentDark);
        border-color: var(--a-borderAccentDark);
      }
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
    transition: all 0.3s;

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
    border: rem(3) solid var(--a-borderAccent);
    border-top-color: var(---a-bgDark);
    border-radius: 50%;
    width: rem(35);
    height: rem(35);
    animation: spin 0.8s linear infinite;
    display: inline-block;

    &.spinnerDownloading {
      border-width: rem(2);
      width: rem(15);
      height: rem(15);
    }
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

  .modalInput {
    width: 100%;
    padding: rem(8);
    font-size: rem(14);
    margin-top: rem(10);
    border: 1px solid var(--a-borderAccent);
    border-radius: rem(6);
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

  .downloadButton {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: rem(10);
    margin: auto;
    cursor: pointer;
  }

  .downloadIcon {
    cursor: pointer;
    width: rem(15);
    height: auto;
  }
</style>
