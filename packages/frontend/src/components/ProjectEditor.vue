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
          @remove-source="onSourceRemoved"
        />
        <ClipInspector
          :clip="selectedClip"
          :source="selectedSource"
          @update="onClipUpdate"
        />
      </div>
      <div class="right-panel">
        <VideoPreview
          :project-id="store.config.id"
          :stream-url="preview.streamUrl.value"
          :audio-stream-url="preview.audioStreamUrl.value"
          :source-time="preview.sourceTime.value"
          :audio-source-time="preview.audioSourceTime.value"
          :is-playing="preview.isPlaying.value"
          :playhead-position="tl.playheadPosition.value"
          :total-duration="tl.totalDuration.value"
          :active-clip-id="preview.activeVideoClip.value?.id ?? null"
          :active-audio-clip-id="preview.activeAudioClip.value?.id ?? null"
          :active-source-type="preview.activeSourceType.value"
          :clip-volume="preview.activeVideoClip.value?.volume ?? 1"
          :clip-fade-in="preview.activeVideoClip.value?.fadeIn ?? 0"
          :clip-fade-out="preview.activeVideoClip.value?.fadeOut ?? 0"
          :clip-timeline-start="preview.activeVideoClip.value?.timelineStart ?? 0"
          :clip-duration="(preview.activeVideoClip.value?.outPoint ?? 0) - (preview.activeVideoClip.value?.inPoint ?? 0)"
          :clip-prev-volume="videoAdjacentVols.prev"
          :clip-next-volume="videoAdjacentVols.next"
          :audio-clip-volume="preview.activeAudioClip.value?.volume ?? 1"
          :audio-clip-fade-in="preview.activeAudioClip.value?.fadeIn ?? 0"
          :audio-clip-fade-out="preview.activeAudioClip.value?.fadeOut ?? 0"
          :audio-clip-timeline-start="preview.activeAudioClip.value?.timelineStart ?? 0"
          :audio-clip-duration="(preview.activeAudioClip.value?.outPoint ?? 0) - (preview.activeAudioClip.value?.inPoint ?? 0)"
          :audio-clip-prev-volume="audioAdjacentVols.prev"
          :audio-clip-next-volume="audioAdjacentVols.next"
          :image-url="imagePreviewUrl"
          :seek-generation="preview.seekGeneration.value"
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
      @cut="cutAtPlayhead"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project';
import { useTimeline } from '../composables/useTimeline';
import { useVideoPreview } from '../composables/useVideoPreview';
import type { SourceFile, Clip } from '@video-editor/shared';
import { getStreamUrl } from '../api/client';
import FileUploader from './FileUploader.vue';
import VideoPreview from './VideoPreview.vue';
import Timeline from './Timeline.vue';
import ExportButton from './ExportButton.vue';
import ClipInspector from './ClipInspector.vue';

const route = useRoute();
const store = useProjectStore();

const tl = useTimeline(() => store.config);
const preview = useVideoPreview(
  () => store.config,
  tl.playheadPosition,
  tl.totalDuration,
  route.params.id as string,
);

const selectedClip = computed<Clip | null>(() => {
  if (!store.config || !store.selectedClipId) return null;
  for (const track of store.config.timeline.tracks) {
    const clip = track.clips.find((c) => c.id === store.selectedClipId);
    if (clip) return clip;
  }
  return null;
});

const selectedSource = computed<SourceFile | null>(() => {
  if (!store.config || !selectedClip.value) return null;
  return store.config.sources.find((s) => s.id === selectedClip.value!.sourceId) ?? null;
});

const ADJACENT_THRESHOLD = 0.05;

function clipEnd(c: Clip): number {
  return c.timelineStart + (c.outPoint - c.inPoint);
}

function getAdjacentVolumes(clip: Clip | null, trackType: 'video' | 'audio'): { prev: number; next: number } {
  if (!clip || !store.config) return { prev: 0, next: 0 };
  const track = store.config.timeline.tracks.find((t) => (t.type ?? 'video') === trackType);
  if (!track) return { prev: 0, next: 0 };
  const sorted = [...track.clips].sort((a, b) => a.timelineStart - b.timelineStart);
  const idx = sorted.findIndex((c) => c.id === clip.id);
  let prev = 0;
  let next = 0;
  if (idx > 0) {
    const prevClip = sorted[idx - 1];
    if (Math.abs(clipEnd(prevClip) - clip.timelineStart) < ADJACENT_THRESHOLD) {
      prev = prevClip.volume ?? 1;
    }
  }
  if (idx >= 0 && idx < sorted.length - 1) {
    const nextClip = sorted[idx + 1];
    if (Math.abs(clipEnd(clip) - nextClip.timelineStart) < ADJACENT_THRESHOLD) {
      next = nextClip.volume ?? 1;
    }
  }
  return { prev, next };
}

const videoAdjacentVols = computed(() => getAdjacentVolumes(preview.activeVideoClip.value, 'video'));
const audioAdjacentVols = computed(() => getAdjacentVolumes(preview.activeAudioClip.value, 'audio'));

const imagePreviewUrl = computed<string | null>(() => {
  if (preview.activeSourceType.value !== 'image') return null;
  const source = preview.activeVideoSource.value;
  if (!source) return null;
  return getStreamUrl(route.params.id as string, source.id);
});

function togglePlay() {
  if (preview.isPlaying.value) {
    preview.pause();
  } else {
    preview.play();
  }
}

function onClipUpdate(changes: Partial<Clip>) {
  if (store.selectedClipId) {
    store.updateClip(store.selectedClipId, changes);
  }
}

function cutAtPlayhead() {
  store.splitClipAtPlayhead(tl.playheadPosition.value);
}

function onKeyDown(e: KeyboardEvent) {
  // Ignore when typing in inputs
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    cutAtPlayhead();
  }
}

// Auto-fit zoom when project first loads
watch(
  () => store.config,
  (cfg) => {
    if (!cfg) return;
    nextTick(() => {
      const timelineEl = document.querySelector('.timeline-scroll');
      if (timelineEl) {
        tl.fitToWidth(timelineEl.clientWidth);
      }
    });
  },
  { once: true },
);

onMounted(() => {
  store.load(route.params.id as string);
  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
});

function onSourceUploaded(source: SourceFile) {
  if (store.config) {
    store.config.sources.push(source);
    store.debouncedSave();
  }
}

function onSourceRemoved() {
  // Reload config from server (which already removed source, file, and related clips)
  store.load(route.params.id as string);
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
  display: flex;
  flex-direction: column;
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
