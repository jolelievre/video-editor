<template>
  <div class="video-preview">
    <video v-if="streamUrl" ref="videoEl" :src="streamUrl" controls />
    <div v-else class="placeholder">
      <p>Select a source or clip to preview</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SourceFile } from '@video-editor/shared';
import { getStreamUrl } from '../api/client';

const props = defineProps<{
  projectId: string;
  sources: SourceFile[];
  selectedSourceId: string | null;
}>();

const streamUrl = computed(() => {
  if (!props.selectedSourceId) return null;
  return getStreamUrl(props.projectId, props.selectedSourceId);
});
</script>

<style scoped>
.video-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

video {
  max-width: 100%;
  max-height: 100%;
}

.placeholder {
  color: #555;
  font-size: 14px;
}
</style>
