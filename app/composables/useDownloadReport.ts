export function useDownloadReport() {
  const downloadingReport = ref(false);
  const downloadingId = ref<string | number | null>(null);
  const error = ref<string | null>(null);
  const authStore = useAuthStore();
  const config = useRuntimeConfig();

  async function downloadReport(id: string | number) {
    downloadingReport.value = true;
    downloadingId.value = id;
    error.value = null;

    try {
      // Явно указываем полный URL API
      const apiUrl = `${config.public.apiBase}/tenants/reports/${id}/pdf`;

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Accept: "application/pdf",
          Authorization: `Bearer ${authStore.token}`,
          ...(authStore.contractId && {
            "contract-id": authStore.contractId.toString(),
          }),
        },
      });

      if (!response.ok) {
        throw new Error(
          `Ошибка сервера: ${response.status} ${response.statusText}`,
        );
      }

      // Проверяем Content-Type
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/pdf")) {
        throw new Error(`Неверный тип ответа: ${contentType}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `report_${id}.pdf`;
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err: unknown) {
      if (err instanceof Error) {
        error.value = err.message;
        console.error("Download error:", {
          error: err,
          message: err.message,
        });
      } else {
        error.value = "Ошибка при скачивании отчета";
        console.error("Download error:", err);
      }
      throw err;
    } finally {
      downloadingReport.value = false;
      downloadingId.value = null;
    }
  }

  return {
    downloadingReport,
    downloadingId,
    error,
    downloadReport,
  };
}
