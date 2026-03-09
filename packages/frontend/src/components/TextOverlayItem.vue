<template>
  <div
    class="text-overlay-item"
    :class="{ selected: isSelected }"
    :style="itemStyle"
    @mousedown.stop="startDrag"
  >
    {{ displayText }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TextClip } from '@video-editor/shared';

const props = defineProps<{
  textClip: TextClip;
  scaleFactor: number;
  isSelected: boolean;
  containerWidth: number;
  containerHeight: number;
  playheadPosition: number;
}>();

const emit = defineEmits<{
  'update:position': [payload: { clipId: string; x: number; y: number }];
  select: [clipId: string];
}>();

const displayText = computed(() => {
  const animIn = props.textClip.animationIn;
  if (animIn?.type === 'typewriter' && animIn.duration > 0) {
    const elapsed = props.playheadPosition - props.textClip.timelineStart;
    if (elapsed < animIn.duration) {
      const progress = Math.max(0, Math.min(1, elapsed / animIn.duration));
      const charCount = Math.floor(progress * props.textClip.content.length);
      return props.textClip.content.slice(0, charCount);
    }
  }
  return props.textClip.content;
});

const itemStyle = computed(() => {
  const elapsed = props.playheadPosition - props.textClip.timelineStart;
  const remaining = props.textClip.duration - elapsed;
  const animIn = props.textClip.animationIn;
  const animOut = props.textClip.animationOut;

  // Opacity (fade)
  let opacity = 1;
  if (animIn?.type === 'fade' && animIn.duration > 0 && elapsed < animIn.duration) {
    opacity *= Math.max(0, Math.min(1, elapsed / animIn.duration));
  }
  if (animOut?.type === 'fade' && animOut.duration > 0 && remaining < animOut.duration) {
    opacity *= Math.max(0, Math.min(1, remaining / animOut.duration));
  }

  // Typewriter with left alignment: anchor at left edge instead of center
  const isLeftAligned =
    animIn?.type === 'typewriter' && animIn.duration > 0 && animIn.alignment === 'left';
  const baseTx = isLeftAligned ? 0 : -50;

  // Slide offset in pixels — use container dimensions to guarantee fully off-screen
  let slideXPx = 0;
  let slideYPx = 0;

  if (animIn?.type === 'slide' && animIn.duration > 0 && elapsed < animIn.duration) {
    const t = 1 - Math.max(0, Math.min(1, elapsed / animIn.duration));
    const dir = animIn.direction ?? 'left';
    if (dir === 'left') slideXPx -= t * props.containerWidth;
    else if (dir === 'right') slideXPx += t * props.containerWidth;
    else if (dir === 'top') slideYPx -= t * props.containerHeight;
    else if (dir === 'bottom') slideYPx += t * props.containerHeight;
  }

  if (animOut?.type === 'slide' && animOut.duration > 0 && remaining < animOut.duration) {
    const t = 1 - Math.max(0, Math.min(1, remaining / animOut.duration));
    const dir = animOut.direction ?? 'left';
    if (dir === 'left') slideXPx -= t * props.containerWidth;
    else if (dir === 'right') slideXPx += t * props.containerWidth;
    else if (dir === 'top') slideYPx -= t * props.containerHeight;
    else if (dir === 'bottom') slideYPx += t * props.containerHeight;
  }

  return {
    left: `${props.textClip.position.x}%`,
    top: `${props.textClip.position.y}%`,
    fontFamily: `'${props.textClip.style.fontFamily}', sans-serif`,
    fontSize: `${props.textClip.style.fontSize * props.scaleFactor}px`,
    color: props.textClip.style.color,
    fontWeight: props.textClip.style.bold ? '700' : '400',
    fontStyle: props.textClip.style.italic ? 'italic' : 'normal',
    opacity,
    transform: `translate(calc(${baseTx}% + ${slideXPx}px), calc(-50% + ${slideYPx}px))`,
  };
});

function startDrag(e: MouseEvent) {
  emit('select', props.textClip.id);

  const startX = e.clientX;
  const startY = e.clientY;
  const initialX = props.textClip.position.x;
  const initialY = props.textClip.position.y;

  function onMove(ev: MouseEvent) {
    const deltaXPx = ev.clientX - startX;
    const deltaYPx = ev.clientY - startY;
    const newX = Math.max(0, Math.min(100, initialX + (deltaXPx / props.containerWidth) * 100));
    const newY = Math.max(0, Math.min(100, initialY + (deltaYPx / props.containerHeight) * 100));
    emit('update:position', {
      clipId: props.textClip.id,
      x: Math.round(newX * 10) / 10,
      y: Math.round(newY * 10) / 10,
    });
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
</script>

<style scoped>
.text-overlay-item {
  position: absolute;
  white-space: nowrap;
  pointer-events: auto;
  cursor: move;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  padding: 2px 4px;
  border: 2px solid transparent;
  border-radius: 2px;
}

.text-overlay-item.selected {
  border-color: rgba(38, 166, 154, 0.8);
  border-style: dashed;
}
</style>
