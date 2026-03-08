<template>
  <div
    class="clip"
    :class="{ selected, active, 'audio-clip': trackType === 'audio', 'image-clip': isImage }"
    :style="clipStyle"
    @mousedown.stop="onSelect"
  >
    <!-- Fade-in indicator -->
    <div v-if="clip.fadeIn > 0" class="fade-indicator fade-in" :style="fadeInStyle" />
    <!-- Fade-out indicator -->
    <div v-if="clip.fadeOut > 0" class="fade-indicator fade-out" :style="fadeOutStyle" />

    <div class="handle left" @mousedown.stop="startTrim('in', $event)" />
    <div class="clip-body" @mousedown.stop="startDrag($event)">
      <!-- Video: thumbnail strip -->
      <div v-if="trackType === 'video' && !isImage" class="thumb-strip">
        <img
          v-for="thumb in visibleThumbs"
          :key="thumb.index"
          :src="thumb.url"
          class="thumb"
          draggable="false"
        />
      </div>
      <!-- Image: single image covering the clip -->
      <div v-else-if="isImage" class="thumb-strip image-strip">
        <img
          :src="imageStreamUrl"
          class="thumb"
          draggable="false"
        />
      </div>
      <!-- Audio: solid colored bar -->
      <div v-else class="audio-bar" />

      <div class="clip-overlay">
        <span class="clip-label">{{ source?.filename ?? 'Unknown' }}</span>
        <div class="clip-meta">
          <span class="clip-duration">{{ formatDuration(clip.outPoint - clip.inPoint) }}</span>
          <span v-if="(clip.volume ?? 1) !== 1" class="clip-volume">
            {{ Math.round((clip.volume ?? 1) * 100) }}%
          </span>
        </div>
      </div>
    </div>
    <div class="handle right" @mousedown.stop="startTrim('out', $event)" />
    <button class="remove-btn" @click.stop="$emit('remove')">&times;</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Clip, SourceFile } from '@video-editor/shared';
import { getThumbnailUrl, getStreamUrl } from '../api/client';

const THUMB_WIDTH = 80;
const THUMB_COUNT = 6;

const props = defineProps<{
  clip: Clip;
  trackClips: Clip[];
  trackType: 'video' | 'audio';
  source: SourceFile | undefined;
  zoom: number;
  active: boolean;
  selected: boolean;
  projectId: string;
}>();

const emit = defineEmits<{
  move: [newTimelineStart: number];
  trim: [changes: Partial<Clip>];
  remove: [];
  select: [];
}>();

const isImage = computed(() => (props.source?.type ?? 'video') === 'image');

const clipWidthPx = computed(() => (props.clip.outPoint - props.clip.inPoint) * props.zoom);

const clipStyle = computed(() => ({
  left: `${props.clip.timelineStart * props.zoom}px`,
  width: `${clipWidthPx.value}px`,
}));

const fadeInStyle = computed(() => ({
  width: `${Math.min(props.clip.fadeIn * props.zoom, clipWidthPx.value)}px`,
}));

const fadeOutStyle = computed(() => ({
  width: `${Math.min(props.clip.fadeOut * props.zoom, clipWidthPx.value)}px`,
}));

const imageStreamUrl = computed(() => {
  if (!props.source) return '';
  return getStreamUrl(props.projectId, props.source.id);
});

const visibleThumbs = computed(() => {
  if (!props.source) return [];
  const bodyWidth = Math.max(0, clipWidthPx.value - 12); // subtract handle widths
  const count = Math.max(1, Math.floor(bodyWidth / THUMB_WIDTH));
  const result: Array<{ index: number; url: string }> = [];

  for (let i = 0; i < count; i++) {
    // Map position in the clip to a thumbnail index (1-based)
    const fraction = count === 1 ? 0.5 : i / (count - 1);
    // Map the clip's in/out range to the source duration
    const clipTime = props.clip.inPoint + fraction * (props.clip.outPoint - props.clip.inPoint);
    const sourceFraction = props.source.duration > 0 ? clipTime / props.source.duration : 0;
    const thumbIndex = Math.min(
      THUMB_COUNT,
      Math.max(1, Math.round(sourceFraction * (THUMB_COUNT - 1)) + 1),
    );
    result.push({
      index: thumbIndex,
      url: getThumbnailUrl(props.projectId, props.source.id, thumbIndex),
    });
  }

  return result;
});

function onSelect() {
  emit('select');
}

function startDrag(e: MouseEvent) {
  emit('select');
  const startX = e.clientX;
  const startPos = props.clip.timelineStart;

  function onMove(ev: MouseEvent) {
    const dx = ev.clientX - startX;
    const newStart = Math.max(0, startPos + dx / props.zoom);
    emit('move', Math.round(newStart * 100) / 100);
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function startTrim(side: 'in' | 'out', e: MouseEvent) {
  emit('select');
  const startX = e.clientX;
  const startIn = props.clip.inPoint;
  const startOut = props.clip.outPoint;
  const startTimelineStart = props.clip.timelineStart;

  function onMove(ev: MouseEvent) {
    const dx = ev.clientX - startX;
    const dt = dx / props.zoom;

    if (side === 'in') {
      const newIn = Math.max(0, startIn + dt);
      const newTimelineStart = Math.max(0, startTimelineStart + dt);
      if (newIn < startOut) {
        emit('trim', {
          inPoint: Math.round(newIn * 100) / 100,
          timelineStart: Math.round(newTimelineStart * 100) / 100,
        });
      }
    } else {
      const maxOut = props.source?.duration ?? startOut;
      // For images, allow trimming outPoint freely (no source duration limit)
      const limit = isImage.value ? Infinity : maxOut;
      const newOut = Math.min(limit, Math.max(startIn + 0.1, startOut + dt));
      emit('trim', { outPoint: Math.round(newOut * 100) / 100 });
    }
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds * 10) / 10;
  return `${s}s`;
}
</script>

<style scoped>
.clip {
  position: absolute;
  top: 4px;
  height: 48px;
  background: #2d4a7a;
  border-radius: 4px;
  display: flex;
  align-items: stretch;
  cursor: grab;
  user-select: none;
  min-width: 20px;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}

.clip.audio-clip {
  background: #3a2d6e;
}

.clip.image-clip {
  background: #2d6a4f;
}

.clip:hover {
  border-color: #6c63ff;
}

.clip.selected {
  border-color: #6c63ff;
  box-shadow: 0 0 6px rgba(108, 99, 255, 0.4);
}

.clip.active {
  border-color: #ff9f43;
  box-shadow: 0 0 8px rgba(255, 159, 67, 0.5);
}

.fade-indicator {
  position: absolute;
  top: 0;
  height: 100%;
  z-index: 4;
  pointer-events: none;
}

.fade-indicator.fade-in {
  left: 0;
  background: linear-gradient(to right, rgba(255, 255, 255, 0.3), transparent);
  border-left: 2px solid rgba(255, 255, 255, 0.5);
}

.fade-indicator.fade-out {
  right: 0;
  background: linear-gradient(to left, rgba(255, 255, 255, 0.3), transparent);
  border-right: 2px solid rgba(255, 255, 255, 0.5);
}

.handle {
  width: 6px;
  cursor: ew-resize;
  flex-shrink: 0;
  z-index: 2;
}

.handle.left {
  border-radius: 4px 0 0 4px;
  background: rgba(108, 99, 255, 0.5);
}

.handle.right {
  border-radius: 0 4px 4px 0;
  background: rgba(108, 99, 255, 0.5);
}

.clip-body {
  flex: 1;
  overflow: hidden;
  min-width: 0;
  position: relative;
}

.thumb-strip {
  display: flex;
  height: 100%;
  position: absolute;
  inset: 0;
}

.image-strip {
  overflow: hidden;
}

.thumb {
  height: 100%;
  flex: 1;
  object-fit: cover;
  min-width: 0;
  pointer-events: none;
}

.audio-bar {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    rgba(108, 99, 255, 0.3) 0px,
    rgba(108, 99, 255, 0.1) 2px,
    rgba(108, 99, 255, 0.3) 4px
  );
}

.clip-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 4px;
  background: rgba(0, 0, 0, 0.35);
}

.clip-label {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.clip-meta {
  display: flex;
  gap: 6px;
  align-items: center;
}

.clip-duration {
  font-size: 9px;
  color: #ccc;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.clip-volume {
  font-size: 9px;
  color: #ff9f43;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.remove-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ff4444;
  color: white;
  font-size: 12px;
  line-height: 1;
  padding: 0;
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 3;
}

.clip:hover .remove-btn {
  display: flex;
}
</style>
