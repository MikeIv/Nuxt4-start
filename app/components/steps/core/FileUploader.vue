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
        <p :class="$style.name">
          {{ file.name }}
        </p>
        <button
          :class="$style.remove"
          :disabled="isLoading"
          @click="removeFile(fileIndex)"
        >
          <UIcon name="delete-icon" :class="$style.buttonIcon" />
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
      box-shadow: 0 0 4px 0 var(--a-borderError);
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

  .buttonIcon {
    margin-top: rem(5);
    width: rem(17);
    height: rem(17);
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
