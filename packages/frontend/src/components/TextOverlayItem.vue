<template>
  <div
    class="text-overlay-item"
    :class="{ selected: isSelected }"
    :style="itemStyle"
    @mousedown.stop="startDrag"
  >
    {{ textClip.content }}
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
}>();

const emit = defineEmits<{
  'update:position': [payload: { clipId: string; x: number; y: number }];
  select: [clipId: string];
}>();

const itemStyle = computed(() => ({
  left: `${props.textClip.position.x}%`,
  top: `${props.textClip.position.y}%`,
  fontFamily: `'${props.textClip.style.fontFamily}', sans-serif`,
  fontSize: `${props.textClip.style.fontSize * props.scaleFactor}px`,
  color: props.textClip.style.color,
  fontWeight: props.textClip.style.bold ? '700' : '400',
  fontStyle: props.textClip.style.italic ? 'italic' : 'normal',
}));

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
  transform: translate(-50%, -50%);
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
