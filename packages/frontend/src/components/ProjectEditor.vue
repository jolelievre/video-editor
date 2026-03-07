<template>
  <div v-if="store.loading" class="loading">Loading project...</div>
  <div v-else-if="store.config" class="editor">
    <header class="toolbar">
      <button class="back" @click="$router.push('/')">&larr; Projects</button>
      <h2>{{ store.config.name }}</h2>
      <div class="actions">
        <span v-if="store.saving" class="save-indicator">Saving...</span>
        <button @click="store.save()">Save</button>
        <ExportButton :project-id="store.config.id" />
      </div>
    </header>
    <div class="panels">
      <div class="left-panel">
        <FileUploader
          :project-id="store.config.id"
          :sources="store.config.sources"
          @uploaded="onSourceUploaded"
          @add-to-timeline="store.addClipToTimeline($event)"
        />
      </div>
      <div class="right-panel">
        <VideoPreview
          :project-id="store.config.id"
          :stream-url="preview.streamUrl.value"
          :source-time="preview.sourceTime.value"
          :is-playing="preview.isPlaying.value"
          :playhead-position="tl.playheadPosition.value"
          :total-duration="tl.totalDuration.value"
          :active-clip-id="preview.activeClip.value?.id ?? null"
          @toggle-play="togglePlay"
        />
      </div>
    </div>
    <Timeline
      :config="store.config"
      :tl="tl"
      :active-clip-id="preview.activeClip.value?.id ?? null"
      :is-playing="preview.isPlaying.value"
      @remove-clip="store.removeClip($event)"
      @seek="preview.seek($event)"
      @toggle-play="togglePlay"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project';
import { useTimeline } from '../composables/useTimeline';
import { useVideoPreview } from '../composables/useVideoPreview';
import type { SourceFile } from '@video-editor/shared';
import FileUploader from './FileUploader.vue';
import VideoPreview from './VideoPreview.vue';
import Timeline from './Timeline.vue';
import ExportButton from './ExportButton.vue';

const route = useRoute();
const store = useProjectStore();

const tl = useTimeline(() => store.config);
const preview = useVideoPreview(
  () => store.config,
  tl.playheadPosition,
  tl.totalDuration,
  route.params.id as string,
);

function togglePlay() {
  if (preview.isPlaying.value) {
    preview.pause();
  } else {
    preview.play();
  }
}

onMounted(() => {
  store.load(route.params.id as string);
});

function onSourceUploaded(source: SourceFile) {
  if (store.config) {
    store.config.sources.push(source);
    store.debouncedSave();
  }
}
</script>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: #0f3460;
  border-bottom: 1px solid #4a4e69;
}

.toolbar h2 {
  flex: 1;
  font-size: 16px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-indicator {
  font-size: 12px;
  color: #6c63ff;
}

.back {
  background: transparent;
  padding: 4px 8px;
}

.panels {
  display: flex;
  flex: 1;
  min-height: 0;
}

.left-panel {
  width: 280px;
  border-right: 1px solid #4a4e69;
  overflow-y: auto;
}

.right-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a1a;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-size: 18px;
}
</style>
