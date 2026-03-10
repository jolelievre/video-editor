<template>
  <div class="file-uploader">
    <h3>Sources</h3>
    <div
      class="drop-zone"
      :class="{ dragover }"
      @dragover.prevent="dragover = true"
      @dragleave="dragover = false"
      @drop.prevent="onDrop"
    >
      <p>Drop media files here</p>
      <input
        ref="fileInput"
        type="file"
        accept="video/*,image/*,audio/*"
        multiple
        @change="onFileSelect"
      />
      <button @click="($refs.fileInput as HTMLInputElement).click()">Browse</button>
    </div>
    <div v-if="uploading" class="uploading">Uploading...</div>

    <!-- Video sources -->
    <div v-if="videoSources.length" class="source-group">
      <div class="group-header">Video</div>
      <ul class="source-list">
        <li
          v-for="source in videoSources"
          :key="source.id"
          draggable="true"
          @dragstart="onDragStart($event, source)"
          @mouseenter="startHoverPreview(source.id)"
          @mouseleave="stopHoverPreview(source.id)"
        >
          <div class="thumb-wrapper">
            <img
              :src="getThumbSrc(source.id)"
              :alt="source.filename"
              class="thumb"
              @error="onThumbError($event)"
            />
          </div>
          <div class="source-info">
            <span class="filename">{{ source.filename }}</span>
            <span class="duration">{{ formatDuration(source.duration) }}</span>
          </div>
          <div class="source-actions">
            <button
              class="small add-btn"
              title="Add to timeline"
              @click="$emit('addToTimeline', source.id)"
            >
              +
            </button>
            <button class="small delete-btn" title="Remove source" @click="removeSource(source.id)">
              &times;
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Image sources -->
    <div v-if="imageSources.length" class="source-group">
      <div class="group-header">Images</div>
      <ul class="source-list">
        <li
          v-for="source in imageSources"
          :key="source.id"
          draggable="true"
          @dragstart="onDragStart($event, source)"
        >
          <div class="thumb-wrapper">
            <img
              :src="getStreamSrc(source.id)"
              :alt="source.filename"
              class="thumb"
              @error="onThumbError($event)"
            />
          </div>
          <div class="source-info">
            <span class="filename">{{ source.filename }}</span>
            <span class="duration">Image</span>
          </div>
          <div class="source-actions">
            <button
              class="small add-btn"
              title="Add to timeline"
              @click="$emit('addToTimeline', source.id)"
            >
              +
            </button>
            <button class="small delete-btn" title="Remove source" @click="removeSource(source.id)">
              &times;
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Audio sources -->
    <div v-if="audioSources.length" class="source-group">
      <div class="group-header">Audio</div>
      <ul class="source-list">
        <li
          v-for="source in audioSources"
          :key="source.id"
          draggable="true"
          @dragstart="onDragStart($event, source)"
        >
          <div class="thumb-wrapper audio-thumb">
            <span class="audio-icon">&#9835;</span>
          </div>
          <div class="source-info">
            <span class="filename">{{ source.filename }}</span>
            <span class="duration">{{ formatDuration(source.duration) }}</span>
          </div>
          <div class="source-actions">
            <button
              class="small add-btn"
              title="Add to timeline"
              @click="$emit('addToTimeline', source.id)"
            >
              +
            </button>
            <button class="small delete-btn" title="Remove source" @click="removeSource(source.id)">
              &times;
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
  <ConfirmModal
    v-if="sourceToDelete"
    :title="deleteModalTitle"
    :message="deleteModalMessage"
    :warning="deleteModalWarning"
    :confirm-label="sourceInUse ? undefined : 'Remove'"
    :disable-confirm="sourceInUse"
    :force-label="sourceInUse ? 'Remove anyway' : undefined"
    @confirm="executeRemoveSource"
    @force="forceRemoveSource"
    @cancel="sourceToDelete = null"
  />
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import type { SourceFile, ProjectConfig } from '@video-editor/shared';
import * as api from '../api/client';
import ConfirmModal from './ConfirmModal.vue';

const THUMB_COUNT = 6;
const HOVER_INTERVAL_MS = 600;

const props = defineProps<{
  projectId: string;
  sources: SourceFile[];
  config: ProjectConfig;
}>();

const emit = defineEmits<{
  uploaded: [source: SourceFile];
  addToTimeline: [sourceId: string];
  removeSource: [sourceId: string];
}>();

const dragover = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const hoverIndices = reactive<Record<string, number>>({});
const hoverTimers = new Map<string, ReturnType<typeof setInterval>>();

const videoSources = computed(() => props.sources.filter((s) => (s.type ?? 'video') === 'video'));
const imageSources = computed(() => props.sources.filter((s) => s.type === 'image'));
const audioSources = computed(() => props.sources.filter((s) => s.type === 'audio'));

function getThumbSrc(sourceId: string): string {
  const index = hoverIndices[sourceId] ?? 1;
  return api.getThumbnailUrl(props.projectId, sourceId, index);
}

function getStreamSrc(sourceId: string): string {
  return api.getStreamUrl(props.projectId, sourceId);
}

function startHoverPreview(sourceId: string) {
  if (hoverTimers.has(sourceId)) return;
  let index = 1;
  hoverIndices[sourceId] = index;
  const timer = setInterval(() => {
    index = (index % THUMB_COUNT) + 1;
    hoverIndices[sourceId] = index;
  }, HOVER_INTERVAL_MS);
  hoverTimers.set(sourceId, timer);
}

function stopHoverPreview(sourceId: string) {
  const timer = hoverTimers.get(sourceId);
  if (timer) {
    clearInterval(timer);
    hoverTimers.delete(sourceId);
  }
  hoverIndices[sourceId] = 1;
}

function onThumbError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.style.display = 'none';
}

async function uploadFiles(files: FileList) {
  uploading.value = true;
  try {
    for (const file of files) {
      const source = await api.uploadSource(props.projectId, file);
      emit('uploaded', source);
    }
  } finally {
    uploading.value = false;
  }
}

function onDrop(e: DragEvent) {
  dragover.value = false;
  if (e.dataTransfer?.files.length) {
    uploadFiles(e.dataTransfer.files);
  }
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) {
    uploadFiles(input.files);
    input.value = '';
  }
}

const sourceToDelete = ref<string | null>(null);

const sourceInUse = computed(() => {
  if (!sourceToDelete.value) return false;
  return props.config.timeline.tracks.some((track) =>
    track.clips.some((c) => c.sourceId === sourceToDelete.value),
  );
});

const deleteSourceFile = computed(() => props.sources.find((s) => s.id === sourceToDelete.value));

const deleteModalTitle = computed(() => 'Remove source');

const deleteModalMessage = computed(() => {
  const name = deleteSourceFile.value?.filename ?? 'this source';
  if (sourceInUse.value) {
    return `"${name}" is currently used in the timeline.`;
  }
  return `Are you sure you want to remove "${name}"?`;
});

const deleteModalWarning = computed(() => {
  if (sourceInUse.value) {
    return 'Removing it will also delete all clips using this source from the timeline.';
  }
  return undefined;
});

function removeSource(sourceId: string) {
  sourceToDelete.value = sourceId;
}

async function executeRemoveSource() {
  if (!sourceToDelete.value) return;
  const id = sourceToDelete.value;
  sourceToDelete.value = null;
  try {
    await api.deleteSource(props.projectId, id);
  } catch (err) {
    console.error('Failed to delete source:', err);
  }
  emit('removeSource', id);
}

async function forceRemoveSource() {
  await executeRemoveSource();
}

function onDragStart(e: DragEvent, source: SourceFile) {
  e.dataTransfer?.setData('sourceId', source.id);
  e.dataTransfer?.setData('sourceType', source.type ?? 'video');
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.file-uploader {
  padding: 12px;
}

h3 {
  margin-bottom: 12px;
  font-size: 14px;
  color: #6c63ff;
}

.drop-zone {
  border: 2px dashed #4a4e69;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  margin-bottom: 12px;
  transition: border-color 0.2s;
}

.drop-zone.dragover {
  border-color: #6c63ff;
  background: rgba(108, 99, 255, 0.1);
}

.drop-zone input {
  display: none;
}

.drop-zone p {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.uploading {
  font-size: 12px;
  color: #6c63ff;
  margin-bottom: 8px;
}

.source-group {
  margin-bottom: 8px;
}

.group-header {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 0;
  border-bottom: 1px solid #333;
  margin-bottom: 4px;
}

.source-list {
  list-style: none;
}

.source-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #16213e;
  border-radius: 4px;
  margin-bottom: 4px;
  cursor: grab;
  font-size: 13px;
}

.source-list li:hover {
  background: #1a1a4e;
}

.thumb-wrapper {
  width: 120px;
  height: 68px;
  flex-shrink: 0;
  background: #0a0a1a;
  border-radius: 3px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumb-wrapper.audio-thumb {
  background: #1a2a4a;
}

.audio-icon {
  font-size: 24px;
  color: #6c63ff;
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.source-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.duration {
  font-size: 11px;
  color: #888;
}

.source-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.small {
  padding: 2px 8px;
  font-size: 14px;
  font-weight: bold;
}

.delete-btn {
  color: #ff6b6b;
}

.delete-btn:hover {
  background: #ff4444;
  color: white;
}
</style>
