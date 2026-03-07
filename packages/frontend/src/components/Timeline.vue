<template>
  <div class="timeline">
    <div class="timeline-toolbar">
      <span>Timeline</span>
      <div class="zoom-controls">
        <button @click="tl.setZoom(tl.zoomLevel.value - 10)">-</button>
        <span class="zoom-label">{{ tl.zoomLevel.value }}px/s</span>
        <button @click="tl.setZoom(tl.zoomLevel.value + 10)">+</button>
      </div>
    </div>
    <div
      ref="scrollContainer"
      class="timeline-scroll"
      @dragover.prevent
      @drop.prevent="onDropOnTimeline"
    >
      <div class="timeline-content" :style="{ width: tl.totalWidth.value + 'px' }">
        <div class="time-ruler">
          <div
            v-for="tick in ticks"
            :key="tick"
            class="tick"
            :style="{ left: tl.timeToPixels(tick) + 'px' }"
          >
            {{ formatTime(tick) }}
          </div>
        </div>
        <div
          class="playhead"
          :style="{ left: tl.timeToPixels(tl.playheadPosition.value) + 'px' }"
        />
        <div v-if="config.timeline.tracks.length === 0" class="empty-track">
          Drop a source here to start
        </div>
        <div v-for="track in config.timeline.tracks" :key="track.id" class="track">
          <div class="track-label">
            {{ track.name }}
          </div>
          <div class="track-clips">
            <TimelineClip
              v-for="clip in track.clips"
              :key="clip.id"
              :clip="clip"
              :source="config.sources.find((s) => s.id === clip.sourceId)"
              :zoom="tl.zoomLevel.value"
              @update="$emit('updateClip', { clipId: clip.id, changes: $event })"
              @remove="$emit('removeClip', clip.id)"
              @select="$emit('selectSource', clip.sourceId)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ProjectConfig } from '@video-editor/shared';
import { useTimeline } from '../composables/useTimeline';
import { useProjectStore } from '../stores/project';
import TimelineClip from './TimelineClip.vue';

const props = defineProps<{
  config: ProjectConfig;
}>();

defineEmits<{
  updateClip: [payload: { clipId: string; changes: Record<string, number> }];
  removeClip: [clipId: string];
  selectSource: [sourceId: string];
}>();

const store = useProjectStore();
const tl = useTimeline(() => props.config);

const ticks = computed(() => {
  const total = Math.ceil(tl.totalDuration.value) + 5;
  const step = tl.zoomLevel.value >= 50 ? 1 : tl.zoomLevel.value >= 20 ? 5 : 10;
  const result: number[] = [];
  for (let i = 0; i <= total; i += step) {
    result.push(i);
  }
  return result;
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function onDropOnTimeline(e: DragEvent) {
  const sourceId = e.dataTransfer?.getData('sourceId');
  if (sourceId) {
    store.addClipToTimeline(sourceId);
  }
}
</script>

<style scoped>
.timeline {
  background: #0f0f23;
  border-top: 1px solid #4a4e69;
  min-height: 180px;
}

.timeline-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #16213e;
  font-size: 13px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zoom-controls button {
  padding: 2px 10px;
  font-size: 16px;
}

.zoom-label {
  font-size: 11px;
  color: #888;
  min-width: 50px;
  text-align: center;
}

.timeline-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  position: relative;
}

.timeline-content {
  position: relative;
  min-height: 120px;
  padding-left: 80px;
}

.time-ruler {
  height: 24px;
  position: relative;
  border-bottom: 1px solid #333;
}

.tick {
  position: absolute;
  top: 0;
  font-size: 10px;
  color: #666;
  border-left: 1px solid #333;
  padding-left: 4px;
  height: 100%;
  display: flex;
  align-items: center;
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ff4444;
  z-index: 10;
  pointer-events: none;
}

.empty-track {
  padding: 24px;
  text-align: center;
  color: #555;
  font-size: 13px;
}

.track {
  display: flex;
  border-bottom: 1px solid #222;
  min-height: 50px;
}

.track-label {
  width: 80px;
  margin-left: -80px;
  padding: 8px;
  font-size: 11px;
  color: #888;
  background: #0f0f23;
  display: flex;
  align-items: center;
}

.track-clips {
  flex: 1;
  position: relative;
  min-height: 50px;
}
</style>
