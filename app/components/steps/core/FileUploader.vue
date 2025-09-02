<script setup lang="ts">
  import { useSaveFile } from "~/composables/useSaveFile";
  import type { FileData } from "~/types/tables";

  interface Props {
    files?: FileData[] | null;
    fileIds?: number[];
    index: number;
    prefix?: string;
    loading?: boolean;
    multiple?: boolean;
    maxFiles?: number;
    isRequired?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    files: null,
    fileIds: () => [],
    prefix: "file-upload",
    loading: false,
    multiple: false,
    maxFiles: 10,
    isRequired: false,
  });

  const emit = defineEmits<{
    (
      e: "files-uploaded",
      payload: { index: number; filesData: FileData[] },
    ): void;
    (e: "file-removed", payload: { index: number; fileIndex: number }): void;
  }>();

  const { saveFile } = useSaveFile();
  const localLoading = ref(false);

  const inputId = computed(() => `${props.prefix}-${props.index}`);
  const isLoading = computed(() => props.loading || localLoading.value);
  const canAddMoreFiles = computed(() => {
    if (!props.multiple) return !props.files?.length;
    return props.maxFiles ? (props.files?.length || 0) < props.maxFiles : true;
  });

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files?.length) return;

    localLoading.value = true;

    try {
      const responses = await Promise.all(
        Array.from(files).map((file) => saveFile(file)),
      );

      emit("files-uploaded", {
        index: props.index,
        filesData: responses.map(toFileData),
      });
    } catch (error) {
      console.error("File upload error:", error);
    } finally {
      target.value = "";
      localLoading.value = false;
    }
  };

  const removeFile = (fileIndex: number) => {
    emit("file-removed", {
      index: props.index,
      fileIndex,
    });
  };

  const toFileData = (response: unknown): FileData => ({
    id: String(response.id),
    name: response.name,
    url: response.url,
    mime_type: response.mime_type,
    size: response.size,
    created_at: response.created_at,
    updated_at: response.updated_at,
  });
</script>

<template>
  <div :class="$style.container">
    <div v-if="canAddMoreFiles && !isLoading" :class="$style.upload">
      <input
        :id="inputId"
        type="file"
        :class="$style.input"
        :disabled="isLoading"
        :multiple="multiple"
        @change="handleFileUpload"
      />
      <label
        :for="inputId"
        :class="[
          $style.button,
          {
            disabled: isLoading,
            [$style.required]: isRequired && (!files || files.length === 0),
          },
        ]"
      >
        {{ multiple ? "Добавить вложения" : "Добавить вложение" }}
      </label>
      <span v-if="multiple && maxFiles" :class="$style.limit">
        <!-- (максимум {{ maxFiles }}) -->
      </span>
    </div>

    <div v-if="isLoading" :class="$style.loading">Загрузка...</div>

    <div v-if="files && files.length" :class="$style.list">
      <div
        v-for="(file, fileIndex) in files"
        :key="file.id"
        :class="$style.info"
      >
        <a
          v-if="file.url"
          :href="file.url"
          target="_blank"
          :class="$style.name"
        >
          {{ file.name }}
        </a>
        <span v-else :class="$style.name">{{ file.name }}</span>
        <button
          :class="$style.remove"
          :disabled="isLoading"
          @click="removeFile(fileIndex)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 
                2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 3h4a1 
                1 0 011 1v1H9V4a1 1 0 011-1z"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style module lang="scss">
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: rem(8);
  }

  .upload {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .input {
    display: none;
  }

  .button {
    padding: 5px 10px;
    background-color: var(--a-bgAccentLight);
    color: var(--a-mainText);
    border-radius: rem(4);
    cursor: pointer;
    transition: background-color 0.3s;
    border: 1px solid transparent;

    &:hover {
      background-color: var(--a-bgAccentDark);
    }

    &.disabled {
      background-color: var(--a-bgGray);
      cursor: not-allowed;
    }

    &.required {
      background-color: var(--a-bgGrayLight);
      border-color: var(--a-errorText);
      animation: pulse 1.5s infinite;
    }
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: rem(4);
  }

  .info {
    display: flex;
    align-items: center;
    height: rem(18);
    gap: 4px;
  }

  .name {
    max-width: rem(140);
    font-size: rem(10);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .remove {
    background: none;
    border: none;
    color: var(--a-errorText);
    font-size: rem(16);
    cursor: pointer;
    padding: 0 5px;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .loading {
    color: var(--a-accentTextExDark);
  }

  .limit {
    color: var(--a-accentTextExDark);
    font-size: rem(12);
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
    100% {
      opacity: 1;
    }
  }
</style>
