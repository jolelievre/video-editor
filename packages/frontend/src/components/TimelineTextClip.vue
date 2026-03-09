<template>
  <div
    class="text-clip"
    :class="{ selected, active }"
    :style="clipStyle"
    @mousedown.stop="onSelect"
  >
    <div class="handle left" @mousedown.stop="startTrim('left', $event)" />
    <div class="clip-body" @mousedown.stop="startDrag($event)">
      <div class="clip-overlay">
        <span class="clip-label">{{ textClip.content }}</span>
        <span class="clip-duration">{{ formatDuration(textClip.duration) }}</span>
      </div>
    </div>
    <div class="handle right" @mousedown.stop="startTrim('right', $event)" />
    <button class="remove-btn" @click.stop="$emit('remove')">&times;</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TextClip } from '@video-editor/shared';

const props = defineProps<{
  textClip: TextClip;
  zoom: number;
  active: boolean;
  selected: boolean;
}>();

const emit = defineEmits<{
  move: [newTimelineStart: number];
  trim: [changes: { timelineStart?: number; duration?: number }];
  remove: [];
  select: [];
}>();

const clipStyle = computed(() => ({
  left: `${props.textClip.timelineStart * props.zoom}px`,
  width: `${props.textClip.duration * props.zoom}px`,
}));

function onSelect() {
  emit('select');
}

function startDrag(e: MouseEvent) {
  emit('select');
  const startX = e.clientX;
  const startPos = props.textClip.timelineStart;

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

function startTrim(side: 'left' | 'right', e: MouseEvent) {
  emit('select');
  const startX = e.clientX;
  const startTimelineStart = props.textClip.timelineStart;
  const startDuration = props.textClip.duration;

  function onMove(ev: MouseEvent) {
    const dx = ev.clientX - startX;
    const dt = dx / props.zoom;

    if (side === 'left') {
      const newStart = Math.max(0, startTimelineStart + dt);
      const newDuration = startDuration - (newStart - startTimelineStart);
      if (newDuration >= 0.1) {
        emit('trim', {
          timelineStart: Math.round(newStart * 100) / 100,
          duration: Math.round(newDuration * 100) / 100,
        });
      }
    } else {
      const newDuration = Math.max(0.1, startDuration + dt);
      emit('trim', {
        duration: Math.round(newDuration * 100) / 100,
      });
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
.text-clip {
  position: absolute;
  top: 4px;
  height: 48px;
  background: #00897b;
  border-radius: 4px;
  display: flex;
  align-items: stretch;
  cursor: grab;
  user-select: none;
  min-width: 20px;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}

.text-clip:hover {
  border-color: #26a69a;
}

.text-clip.selected {
  border-color: #26a69a;
  box-shadow: 0 0 6px rgba(38, 166, 154, 0.4);
}

.text-clip.active {
  border-color: #ff9f43;
  box-shadow: 0 0 8px rgba(255, 159, 67, 0.5);
}

.handle {
  width: 6px;
  cursor: ew-resize;
  flex-shrink: 0;
  z-index: 2;
}

.handle.left {
  border-radius: 4px 0 0 4px;
  background: rgba(38, 166, 154, 0.5);
}

.handle.right {
  border-radius: 0 4px 4px 0;
  background: rgba(38, 166, 154, 0.5);
}

.clip-body {
  flex: 1;
  overflow: hidden;
  min-width: 0;
  position: relative;
}

.clip-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 4px;
  background: rgba(0, 0, 0, 0.2);
}

.clip-label {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.clip-duration {
  font-size: 9px;
  color: #ccc;
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

.text-clip:hover .remove-btn {
  display: flex;
}
</style>
