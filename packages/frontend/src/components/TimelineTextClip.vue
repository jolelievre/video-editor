<template>
  <div
    class="text-clip"
    :class="{ selected, active }"
    :style="clipStyle"
    @mousedown.stop="onSelect"
  >
    <div class="handle left" @mousedown.stop="startTrim('left', $event)" />
    <div class="clip-body" @mousedown.stop="startDrag($event)">
      <div
        v-if="animInWidthPx > 0"
        class="anim-zone anim-in"
        :style="{ width: animInWidthPx + 'px' }"
      >
        <span class="anim-icon">{{ animInIcon }}</span>
      </div>
      <div
        v-if="animOutWidthPx > 0"
        class="anim-zone anim-out"
        :style="{ width: animOutWidthPx + 'px' }"
      >
        <span class="anim-icon">{{ animOutIcon }}</span>
      </div>
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
import { useProjectStore } from '../stores/project';

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

const store = useProjectStore();

const clipStyle = computed(() => ({
  left: `${props.textClip.timelineStart * props.zoom}px`,
  width: `${props.textClip.duration * props.zoom}px`,
}));

const ANIM_ICONS: Record<string, string> = {
  fade: '\u25D0',
  slide: '\u2192',
  typewriter: 'Aa',
};

const animInWidthPx = computed(() => {
  const anim = props.textClip.animationIn;
  if (!anim || anim.type === 'none' || !anim.duration) return 0;
  return Math.min(anim.duration * props.zoom, props.textClip.duration * props.zoom * 0.45);
});

const animOutWidthPx = computed(() => {
  const anim = props.textClip.animationOut;
  if (!anim || anim.type === 'none' || !anim.duration) return 0;
  return Math.min(anim.duration * props.zoom, props.textClip.duration * props.zoom * 0.45);
});

const animInIcon = computed(() => ANIM_ICONS[props.textClip.animationIn?.type ?? ''] ?? '');
const animOutIcon = computed(() => ANIM_ICONS[props.textClip.animationOut?.type ?? ''] ?? '');

function onSelect() {
  emit('select');
}

function startDrag(e: MouseEvent) {
  e.preventDefault();
  emit('select');
  store.beginUndoGroup();
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
    store.endUndoGroup();
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function startTrim(side: 'left' | 'right', e: MouseEvent) {
  e.preventDefault();
  emit('select');
  store.beginUndoGroup();
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
    store.endUndoGroup();
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
  top: 8px;
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
  border-color: #ffd600;
  box-shadow: 0 0 6px rgba(255, 214, 0, 0.4);
}

.text-clip.selected .handle.left,
.text-clip.selected .handle.right {
  background: rgba(255, 214, 0, 0.6);
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

.anim-zone {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
  background: repeating-linear-gradient(
    -45deg,
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.08) 3px,
    transparent 3px,
    transparent 6px
  );
  border-right: 1px solid rgba(255, 255, 255, 0.25);
}

.anim-zone.anim-in {
  left: 0;
  border-radius: 0;
  justify-content: flex-start;
  padding-left: 2px;
}

.anim-zone.anim-out {
  right: 0;
  border-right: none;
  border-left: 1px solid rgba(255, 255, 255, 0.25);
  justify-content: flex-end;
  padding-right: 2px;
}

.anim-icon {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  line-height: 1;
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
