<template>
  <div class="export-wrapper">
    <button :disabled="exporting" @click="doExport">
      {{ exporting ? `Exporting ${progress}%` : 'Export' }}
    </button>
    <a v-if="downloadReady" :href="downloadUrl" class="download-link"> Download </a>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as api from '../api/client';

const props = defineProps<{
  projectId: string;
}>();

const exporting = ref(false);
const progress = ref(0);
const downloadReady = ref(false);
const downloadUrl = ref('');

async function doExport() {
  exporting.value = true;
  downloadReady.value = false;
  progress.value = 0;

  await api.startExport(props.projectId);

  const poll = setInterval(async () => {
    const status = await api.getExportStatus(props.projectId);
    progress.value = status.percent;

    if (status.status === 'done') {
      clearInterval(poll);
      exporting.value = false;
      downloadReady.value = true;
      downloadUrl.value = api.getExportDownloadUrl(props.projectId);
    } else if (status.status === 'error') {
      clearInterval(poll);
      exporting.value = false;
      alert(`Export failed: ${status.error}`);
    }
  }, 1000);
}
</script>

<style scoped>
.export-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.download-link {
  color: #6c63ff;
  font-size: 13px;
}
</style>
