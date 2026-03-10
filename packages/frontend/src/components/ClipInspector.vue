<template>
  <div class="clip-inspector" :class="{ 'has-selection': !!clip }" :style="accentStyle">
    <h3>Clip Properties</h3>
    <div v-if="clip && source" class="inspector-content">
      <div class="thumbnail-container">
        <img v-if="thumbnailUrl" :src="thumbnailUrl" class="thumbnail" />
        <div v-else class="thumbnail-placeholder">&#9835;</div>
      </div>
      <div class="field">
        <label>Source</label>
        <span class="value filename">{{ source.filename }}</span>
      </div>
      <div class="field">
        <label>Type</label>
        <span class="value">{{ source.type ?? 'video' }}</span>
      </div>
      <div class="field">
        <label>In / Out</label>
        <span class="value">{{ formatTime(clip.inPoint) }} - {{ formatTime(clip.outPoint) }}</span>
      </div>
      <div class="field">
        <label>Duration</label>
        <span class="value">{{ formatTime(clip.outPoint - clip.inPoint) }}</span>
      </div>

      <div class="separator" />

      <div class="field">
        <label>Volume</label>
        <div class="slider-row">
          <input
            type="range"
            min="0"
            max="150"
            step="1"
            :value="Math.round((clip.volume ?? 1) * 100)"
            @input="onVolumeChange"
          />
          <span class="slider-value">{{ Math.round((clip.volume ?? 1) * 100) }}%</span>
        </div>
      </div>

      <div class="field">
        <label>Fade In</label>
        <div class="slider-row">
          <input
            type="range"
            min="0"
            :max="maxFade"
            step="0.1"
            :value="clip.fadeIn ?? 0"
            @input="onFadeInChange"
          />
          <span class="slider-value">{{ (clip.fadeIn ?? 0).toFixed(1) }}s</span>
        </div>
      </div>

      <div class="field">
        <label>Fade Out</label>
        <div class="slider-row">
          <input
            type="range"
            min="0"
            :max="maxFade"
            step="0.1"
            :value="clip.fadeOut ?? 0"
            @input="onFadeOutChange"
          />
          <span class="slider-value">{{ (clip.fadeOut ?? 0).toFixed(1) }}s</span>
        </div>
      </div>
    </div>
    <div v-else class="empty">
      <p>Select a clip to edit</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Clip, SourceFile } from '@video-editor/shared';
import { getThumbnailUrl, getStreamUrl } from '../api/client';

const ACCENT_COLORS: Record<string, string> = {
  video: '#2d4a7a',
  image: '#2d6a4f',
  audio: '#3a2d6e',
};

const props = defineProps<{
  clip: Clip | null;
  source: SourceFile | null;
  projectId: string;
}>();

const emit = defineEmits<{
  update: [changes: Partial<Clip>];
}>();

const maxFade = computed(() => {
  if (!props.clip) return 10;
  return Math.max(0.1, props.clip.outPoint - props.clip.inPoint);
});

const sourceType = computed(() => props.source?.type ?? 'video');

const accentColor = computed(() => ACCENT_COLORS[sourceType.value] ?? ACCENT_COLORS.video);

const accentStyle = computed(() => ({ '--accent': accentColor.value }));

const thumbnailUrl = computed<string | null>(() => {
  if (!props.clip || !props.source) return null;
  const type = sourceType.value;
  if (type === 'video') {
    return getThumbnailUrl(props.projectId, props.source.id, 3);
  }
  if (type === 'image') {
    return getStreamUrl(props.projectId, props.source.id);
  }
  return null;
});

function onVolumeChange(e: Event) {
  const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
  emit('update', { volume: Math.round(val * 100) / 100 });
}

function onFadeInChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  emit('update', { fadeIn: Math.round(val * 10) / 10 });
}

function onFadeOutChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  emit('update', { fadeOut: Math.round(val * 10) / 10 });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}
</script>

<style scoped>
.clip-inspector {
  padding: 12px;
  border: 2px solid transparent;
  border-radius: 4px;
}

.clip-inspector.has-selection {
  border-color: var(--accent, #6c63ff);
}

h3 {
  font-size: 13px;
  color: var(--accent, #6c63ff);
  margin-bottom: 12px;
}

.thumbnail-container {
  aspect-ratio: 16 / 9;
  background: #111;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  font-size: 32px;
  color: #555;
}

.inspector-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.value {
  font-size: 12px;
  color: #ccc;
}

.value.filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.separator {
  border-top: 1px solid #333;
  margin: 4px 0;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-row input[type='range'] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #333;
  border-radius: 2px;
  outline: none;
}

.slider-row input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent, #6c63ff);
  cursor: pointer;
}

.slider-row input[type='range']::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent, #6c63ff);
  border: none;
  cursor: pointer;
}

.slider-value {
  font-size: 11px;
  color: #ccc;
  min-width: 40px;
  text-align: right;
}

.empty {
  color: #555;
  font-size: 12px;
  text-align: center;
  padding: 16px 0;
}
</style>
