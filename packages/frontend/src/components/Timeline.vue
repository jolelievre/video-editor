<template>
  <div class="timeline">
    <div class="timeline-toolbar">
      <div class="toolbar-left">
        <button class="play-btn" @click="$emit('togglePlay')">
          {{ isPlaying ? '\u23F8' : '\u25B6' }}
        </button>
        <span>Timeline</span>
      </div>
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
        <div class="time-ruler" @click="onRulerClick">
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
          :style="{ left: 80 + tl.timeToPixels(tl.playheadPosition.value) + 'px' }"
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
              :track-clips="track.clips"
              :source="config.sources.find((s) => s.id === clip.sourceId)"
              :zoom="tl.zoomLevel.value"
              :active="clip.id === activeClipId"
              @update="$emit('updateClip', { clipId: clip.id, changes: $event })"
              @trim="onTrim(track.clips, clip, $event)"
              @remove="$emit('removeClip', clip.id)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ProjectConfig, Clip } from '@video-editor/shared';
import type { TimelineControls } from '../composables/useTimeline';
import { useProjectStore } from '../stores/project';
import TimelineClip from './TimelineClip.vue';

const props = defineProps<{
  config: ProjectConfig;
  tl: TimelineControls;
  activeClipId: string | null;
  isPlaying?: boolean;
}>();

const emit = defineEmits<{
  updateClip: [payload: { clipId: string; changes: Record<string, number> }];
  removeClip: [clipId: string];
  seek: [time: number];
  togglePlay: [];
}>();

const store = useProjectStore();
const scrollContainer = ref<HTMLElement | null>(null);

const ticks = computed(() => {
  const total = Math.ceil(props.tl.totalDuration.value) + 5;
  const step = props.tl.zoomLevel.value >= 50 ? 1 : props.tl.zoomLevel.value >= 20 ? 5 : 10;
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

function onRulerClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const time = props.tl.pixelsToTime(offsetX);
  emit('seek', time);
}

function onTrim(trackClips: Clip[], trimmedClip: Clip, changes: Partial<Clip>) {
  // Apply the trim to the clip
  const updatedClip = { ...trimmedClip, ...changes };
  const newEnd = updatedClip.timelineStart + (updatedClip.outPoint - updatedClip.inPoint);
  const oldEnd = trimmedClip.timelineStart + (trimmedClip.outPoint - trimmedClip.inPoint);

  // Sort siblings by timelineStart
  const sorted = [...trackClips]
    .filter((c) => c.id !== trimmedClip.id)
    .sort((a, b) => a.timelineStart - b.timelineStart);

  if (changes.outPoint !== undefined && newEnd > oldEnd) {
    // Extending right: push subsequent clips forward
    const overflow = newEnd - oldEnd;
    for (const clip of sorted) {
      if (clip.timelineStart >= oldEnd - 0.01) {
        store.updateClip(clip.id, {
          timelineStart: Math.round((clip.timelineStart + overflow) * 100) / 100,
        });
      }
    }
  } else if (
    changes.timelineStart !== undefined &&
    updatedClip.timelineStart < trimmedClip.timelineStart
  ) {
    // Extending left: push previous clips backward
    const overflow = trimmedClip.timelineStart - updatedClip.timelineStart;
    // Check if there's room — find clips that would be pushed
    const prevClips = sorted.filter((c) => c.timelineStart < trimmedClip.timelineStart).reverse();

    // Push each previous clip left, cascading
    let pushAmount = overflow;
    for (const clip of prevClips) {
      const clipEnd = clip.timelineStart + (clip.outPoint - clip.inPoint);
      if (clipEnd > updatedClip.timelineStart - pushAmount + overflow) {
        const newStart = Math.max(0, clip.timelineStart - pushAmount);
        store.updateClip(clip.id, {
          timelineStart: Math.round(newStart * 100) / 100,
        });
      }
    }
  }

  // Apply the trim change to the trimmed clip itself
  store.updateClip(trimmedClip.id, changes);
}

function onDropOnTimeline(e: DragEvent) {
  const sourceId = e.dataTransfer?.getData('sourceId');
  if (sourceId) {
    store.addClipToTimeline(sourceId);
  }
}

// Auto-scroll to follow playhead during playback
watch(
  () => props.tl.playheadPosition.value,
  (pos) => {
    if (!props.isPlaying || !scrollContainer.value) return;
    const container = scrollContainer.value;
    const playheadPx = props.tl.timeToPixels(pos) + 80; // account for padding-left
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;

    if (playheadPx > scrollLeft + containerWidth - 50) {
      container.scrollLeft = playheadPx - containerWidth / 2;
    } else if (playheadPx < scrollLeft + 50) {
      container.scrollLeft = playheadPx - containerWidth / 2;
    }
  },
);
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

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.play-btn {
  padding: 2px 10px;
  font-size: 16px;
  background: #2d4a7a;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}

.play-btn:hover {
  background: #3d5a8a;
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
  cursor: pointer;
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
