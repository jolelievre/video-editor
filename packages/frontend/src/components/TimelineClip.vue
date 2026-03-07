<template>
  <div class="clip" :class="{ selected, active }" :style="clipStyle" @mousedown.stop="onSelect">
    <div class="handle left" @mousedown.stop="startTrim('in', $event)" />
    <div class="clip-body" @mousedown.stop="startDrag($event)">
      <span class="clip-label">{{ source?.filename ?? 'Unknown' }}</span>
      <span class="clip-duration">{{ formatDuration(clip.outPoint - clip.inPoint) }}</span>
    </div>
    <div class="handle right" @mousedown.stop="startTrim('out', $event)" />
    <button class="remove-btn" @click.stop="$emit('remove')">&times;</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Clip, SourceFile } from '@video-editor/shared';

const props = defineProps<{
  clip: Clip;
  trackClips: Clip[];
  source: SourceFile | undefined;
  zoom: number;
  active: boolean;
}>();

const emit = defineEmits<{
  update: [changes: Partial<Clip>];
  trim: [changes: Partial<Clip>];
  remove: [];
}>();

const selected = ref(false);

const clipStyle = computed(() => ({
  left: `${props.clip.timelineStart * props.zoom}px`,
  width: `${(props.clip.outPoint - props.clip.inPoint) * props.zoom}px`,
}));

function getSiblingBounds() {
  const clipDuration = props.clip.outPoint - props.clip.inPoint;
  const clipEnd = props.clip.timelineStart + clipDuration;
  let prevEnd = 0;
  let nextStart = Infinity;

  for (const other of props.trackClips) {
    if (other.id === props.clip.id) continue;
    const otherEnd = other.timelineStart + (other.outPoint - other.inPoint);
    if (otherEnd <= props.clip.timelineStart + 0.01) {
      prevEnd = Math.max(prevEnd, otherEnd);
    }
    if (other.timelineStart >= clipEnd - 0.01) {
      nextStart = Math.min(nextStart, other.timelineStart);
    }
  }

  return { prevEnd, nextStart };
}

function onSelect() {
  selected.value = true;
}

function startDrag(e: MouseEvent) {
  const startX = e.clientX;
  const startPos = props.clip.timelineStart;
  const clipDuration = props.clip.outPoint - props.clip.inPoint;
  const { prevEnd, nextStart } = getSiblingBounds();

  function onMove(ev: MouseEvent) {
    const dx = ev.clientX - startX;
    let newStart = startPos + dx / props.zoom;
    newStart = Math.max(prevEnd, newStart);
    newStart = Math.min(nextStart - clipDuration, newStart);
    newStart = Math.max(0, newStart);
    emit('update', { timelineStart: Math.round(newStart * 100) / 100 });
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function startTrim(side: 'in' | 'out', e: MouseEvent) {
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
      const newOut = Math.min(maxOut, Math.max(startIn + 0.1, startOut + dt));
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
  height: 42px;
  background: #2d4a7a;
  border-radius: 4px;
  display: flex;
  align-items: center;
  cursor: grab;
  user-select: none;
  min-width: 20px;
  border: 1px solid transparent;
  transition: border-color 0.15s;
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

.handle {
  width: 6px;
  height: 100%;
  cursor: ew-resize;
  flex-shrink: 0;
}

.handle.left {
  border-radius: 4px 0 0 4px;
  background: rgba(108, 99, 255, 0.4);
}

.handle.right {
  border-radius: 0 4px 4px 0;
  background: rgba(108, 99, 255, 0.4);
}

.clip-body {
  flex: 1;
  overflow: hidden;
  padding: 0 4px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.clip-label {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-duration {
  font-size: 9px;
  color: #aaa;
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
}

.clip:hover .remove-btn {
  display: flex;
}
</style>
