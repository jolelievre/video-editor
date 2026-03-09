<template>
  <div
    class="clip"
    :class="{ selected, active, 'audio-clip': trackType === 'audio', 'image-clip': isImage }"
    :style="clipStyle"
    @mousedown.stop="onSelect"
  >
    <!-- Volume envelope SVG overlay -->
    <svg
      v-if="showEnvelope"
      class="volume-envelope"
      :viewBox="`0 0 ${clipWidthPx} 48`"
      preserveAspectRatio="none"
    >
      <path
        :d="envelopePath"
        fill="rgba(255, 200, 50, 0.25)"
        stroke="rgba(255, 200, 50, 0.8)"
        stroke-width="1.5"
      />
    </svg>

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
        <img :src="imageStreamUrl" class="thumb" draggable="false" />
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
  trackType: 'video' | 'audio' | 'text';
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

// Volume envelope: 100% at 2/3 of clip height (leaving room for >100% volumes)
// Max displayed volume is 1.5 (150%), mapped to full height
const ENVELOPE_HEIGHT = 48;
const MAX_DISPLAY_VOLUME = 1.5;
const ADJACENT_THRESHOLD = 0.05; // seconds — clips closer than this are considered adjacent

function volumeToY(vol: number): number {
  const clamped = Math.min(vol, MAX_DISPLAY_VOLUME);
  return ENVELOPE_HEIGHT * (1 - clamped / MAX_DISPLAY_VOLUME);
}

function clipEnd(c: Clip): number {
  return c.timelineStart + (c.outPoint - c.inPoint);
}

const adjacentVolumes = computed(() => {
  const sorted = [...props.trackClips].sort((a, b) => a.timelineStart - b.timelineStart);
  const idx = sorted.findIndex((c) => c.id === props.clip.id);
  let prevVol = 0;
  let nextVol = 0;
  if (idx > 0) {
    const prev = sorted[idx - 1];
    if (Math.abs(clipEnd(prev) - props.clip.timelineStart) < ADJACENT_THRESHOLD) {
      prevVol = prev.volume ?? 1;
    }
  }
  if (idx >= 0 && idx < sorted.length - 1) {
    const next = sorted[idx + 1];
    if (Math.abs(clipEnd(props.clip) - next.timelineStart) < ADJACENT_THRESHOLD) {
      nextVol = next.volume ?? 1;
    }
  }
  return { prevVol, nextVol };
});

const showEnvelope = computed(() => {
  const vol = props.clip.volume ?? 1;
  return (props.clip.fadeIn ?? 0) > 0 || (props.clip.fadeOut ?? 0) > 0 || vol !== 1;
});

const envelopePath = computed(() => {
  const w = clipWidthPx.value;
  const clipDuration = props.clip.outPoint - props.clip.inPoint;
  if (clipDuration <= 0 || w <= 0) return '';

  const vol = props.clip.volume ?? 1;
  const fadeInPx = Math.min((props.clip.fadeIn ?? 0) * props.zoom, w);
  const fadeOutPx = Math.min((props.clip.fadeOut ?? 0) * props.zoom, w);
  const { prevVol, nextVol } = adjacentVolumes.value;
  const volY = volumeToY(vol);
  const fadeInStartY = volumeToY(prevVol);
  const fadeOutEndY = volumeToY(nextVol);
  const bottomY = ENVELOPE_HEIGHT;

  const points: string[] = [];
  // Bottom-left corner
  points.push(`M 0 ${bottomY}`);
  // Fade-in start point (at adjacent clip's volume or bottom)
  if (fadeInPx > 0) {
    points.push(`L 0 ${fadeInStartY}`);
    points.push(`L ${fadeInPx} ${volY}`);
  } else {
    points.push(`L 0 ${volY}`);
  }
  // Flat at clip volume
  if (fadeOutPx > 0) {
    points.push(`L ${w - fadeOutPx} ${volY}`);
    points.push(`L ${w} ${fadeOutEndY}`);
  } else {
    points.push(`L ${w} ${volY}`);
  }
  // Bottom-right and close
  points.push(`L ${w} ${bottomY}`);
  points.push('Z');

  return points.join(' ');
});

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

.volume-envelope {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  width: 100%;
  height: 100%;
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
