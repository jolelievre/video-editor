<template>
  <div class="timeline">
    <div class="timeline-toolbar">
      <div class="toolbar-left">
        <button class="play-btn" @click="$emit('togglePlay')">
          {{ isPlaying ? '\u23F8' : '\u25B6' }}
        </button>
        <button class="cut-btn" title="Cut clip at playhead (C)" @click="$emit('cut')">
          &#9986;
        </button>
        <span>Timeline</span>
        <button class="add-text-btn" title="Add text track" @click="store.addTextTrack()">
          T+
        </button>
      </div>
      <div class="zoom-controls">
        <button @click="tl.setZoom(tl.zoomLevel.value - zoomStep)">-</button>
        <span class="zoom-label">{{ zoomPercent }}%</span>
        <button @click="tl.setZoom(tl.zoomLevel.value + zoomStep)">+</button>
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
          :style="{ left: 100 + tl.timeToPixels(tl.playheadPosition.value) + 'px' }"
        />
        <div v-if="config.timeline.tracks.length === 0" class="empty-track">
          Drop a source here to start
        </div>
        <div
          v-for="track in config.timeline.tracks"
          :key="track.id"
          class="track"
          :class="{
            'audio-track': (track.type ?? 'video') === 'audio',
            'text-track': track.type === 'text',
            'selected-track': track.id === store.selectedTrackId,
          }"
          @mousedown="store.selectTrack(track.id)"
        >
          <div class="track-label">
            <span v-if="(track.type ?? 'video') === 'audio'" class="track-icon">&#9835;</span>
            <span v-else-if="track.type === 'text'" class="track-icon text-icon">T</span>
            <span v-else class="track-icon media-icon">&#9654;</span>
            {{ track.name }}
            <button
              v-if="track.type === 'text'"
              class="add-clip-btn"
              title="Add text clip"
              @click.stop="store.addTextClip(track.id, tl.playheadPosition.value)"
            >
              +
            </button>
            <button
              v-if="track.type === 'text'"
              class="remove-track-btn"
              title="Remove text track"
              @click.stop="store.removeTrack(track.id)"
            >
              &times;
            </button>
          </div>
          <div class="track-clips">
            <!-- Group handles for contiguous media clips -->
            <div
              v-for="group in contiguousGroups.filter((g) => g.trackId === track.id)"
              :key="'group-' + group.clipIds[0]"
              class="group-handle"
              :style="{ left: group.startPx + 'px', width: group.widthPx + 'px' }"
              @mousedown.stop="startGroupDrag(group, $event)"
            />
            <!-- Media clips (video/audio tracks) -->
            <TimelineClip
              v-for="clip in track.clips"
              :key="clip.id"
              :clip="clip"
              :track-clips="track.clips"
              :track-type="track.type ?? 'video'"
              :source="config.sources.find((s) => s.id === clip.sourceId)"
              :zoom="tl.zoomLevel.value"
              :active="clip.id === activeClipId"
              :selected="clip.id === store.selectedClipId"
              :project-id="config.id"
              @move="store.moveClip(clip.id, $event, tl.zoomLevel.value)"
              @trim="onTrim(track.clips, clip, $event)"
              @remove="$emit('removeClip', clip.id)"
              @select="store.selectClip(clip.id)"
            />
            <!-- Text clips (text tracks) -->
            <TimelineTextClip
              v-for="tc in track.textClips ?? []"
              :key="tc.id"
              :text-clip="tc"
              :zoom="tl.zoomLevel.value"
              :active="false"
              :selected="tc.id === store.selectedClipId"
              @move="store.moveTextClip(tc.id, $event)"
              @trim="onTextTrim(tc.id, $event)"
              @remove="store.removeTextClip(tc.id)"
              @select="store.selectClip(tc.id)"
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
import TimelineTextClip from './TimelineTextClip.vue';

const props = defineProps<{
  config: ProjectConfig;
  tl: TimelineControls;
  activeClipId: string | null;
  isPlaying?: boolean;
}>();

const emit = defineEmits<{
  removeClip: [clipId: string];
  seek: [time: number];
  togglePlay: [];
  cut: [];
}>();

const store = useProjectStore();
const scrollContainer = ref<HTMLElement | null>(null);

interface ClipGroup {
  trackId: string;
  clipIds: string[];
  startPx: number;
  widthPx: number;
  startTime: number;
}

const ADJACENT_THRESHOLD = 0.05;

const contiguousGroups = computed<ClipGroup[]>(() => {
  const groups: ClipGroup[] = [];
  for (const track of props.config.timeline.tracks) {
    const trackType = track.type ?? 'video';
    if (trackType !== 'video' && trackType !== 'audio') continue;
    if (track.clips.length < 2) continue;

    const sorted = [...track.clips].sort((a, b) => a.timelineStart - b.timelineStart);
    let currentGroup: typeof sorted = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = currentGroup[currentGroup.length - 1];
      const prevEnd = prev.timelineStart + (prev.outPoint - prev.inPoint);
      if (sorted[i].timelineStart - prevEnd < ADJACENT_THRESHOLD) {
        currentGroup.push(sorted[i]);
      } else {
        if (currentGroup.length >= 2) {
          const first = currentGroup[0];
          const last = currentGroup[currentGroup.length - 1];
          const lastEnd = last.timelineStart + (last.outPoint - last.inPoint);
          groups.push({
            trackId: track.id,
            clipIds: currentGroup.map((c) => c.id),
            startPx: first.timelineStart * props.tl.zoomLevel.value,
            widthPx: (lastEnd - first.timelineStart) * props.tl.zoomLevel.value,
            startTime: first.timelineStart,
          });
        }
        currentGroup = [sorted[i]];
      }
    }
    if (currentGroup.length >= 2) {
      const first = currentGroup[0];
      const last = currentGroup[currentGroup.length - 1];
      const lastEnd = last.timelineStart + (last.outPoint - last.inPoint);
      groups.push({
        trackId: track.id,
        clipIds: currentGroup.map((c) => c.id),
        startPx: first.timelineStart * props.tl.zoomLevel.value,
        widthPx: (lastEnd - first.timelineStart) * props.tl.zoomLevel.value,
        startTime: first.timelineStart,
      });
    }
  }
  return groups;
});

function startGroupDrag(group: ClipGroup, e: MouseEvent) {
  e.preventDefault();
  store.beginUndoGroup();
  const startX = e.clientX;
  // Capture original positions at drag start
  const originalPositions = new Map<string, number>();
  for (const track of props.config.timeline.tracks) {
    for (const clip of track.clips) {
      if (group.clipIds.includes(clip.id)) {
        originalPositions.set(clip.id, clip.timelineStart);
      }
    }
  }
  const groupStartTime = group.startTime;

  function onMove(ev: MouseEvent) {
    const dx = ev.clientX - startX;
    const desiredDelta = dx / props.tl.zoomLevel.value;
    // Clamp so group doesn't go before 0
    const clampedDelta = Math.max(-groupStartTime, desiredDelta);

    // Restore original positions then apply delta
    for (const track of props.config.timeline.tracks) {
      for (const clip of track.clips) {
        const orig = originalPositions.get(clip.id);
        if (orig !== undefined) {
          clip.timelineStart = Math.round((orig + clampedDelta) * 100) / 100;
        }
      }
      // Re-sort and resolve overlaps with non-group clips
      track.clips.sort((a, b) => a.timelineStart - b.timelineStart);
      for (let i = 0; i < track.clips.length - 1; i++) {
        const current = track.clips[i];
        const currentEnd = store.getClipEnd(current);
        const nextClip = track.clips[i + 1];
        if (nextClip.timelineStart < currentEnd) {
          nextClip.timelineStart = Math.round(currentEnd * 100) / 100;
        }
      }
    }
    store.debouncedSave();
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    store.endUndoGroup();
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

const DEFAULT_ZOOM = 50;

const zoomPercent = computed(() => Math.round((props.tl.zoomLevel.value / DEFAULT_ZOOM) * 100));

const zoomStep = computed(() => {
  const z = props.tl.zoomLevel.value;
  if (z <= 5) return 1;
  if (z <= 20) return 5;
  return 10;
});

const ticks = computed(() => {
  const total = Math.ceil(props.tl.totalDuration.value) + 5;
  const z = props.tl.zoomLevel.value;
  const step = z >= 50 ? 1 : z >= 20 ? 5 : z >= 5 ? 10 : 30;
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
    // Extending right: only push clips that actually overlap, then cascade
    const subsequent = sorted.filter((c) => c.timelineStart >= oldEnd - 0.01);
    let pushEdge = newEnd;
    for (const clip of subsequent) {
      if (clip.timelineStart < pushEdge - 0.001) {
        const pushed = Math.round(pushEdge * 100) / 100;
        const clipDur = clip.outPoint - clip.inPoint;
        store.updateClip(clip.id, { timelineStart: pushed });
        pushEdge = pushed + clipDur;
      } else {
        break;
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
    const pushAmount = overflow;
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

function onTextTrim(clipId: string, changes: { timelineStart?: number; duration?: number }) {
  store.updateTextClip(clipId, changes);
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
    const playheadPx = props.tl.timeToPixels(pos) + 100; // account for padding-left
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

.cut-btn {
  padding: 2px 10px;
  font-size: 16px;
  background: #2d4a7a;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}

.cut-btn:hover {
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
  padding-left: 100px;
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
  min-height: 58px;
}

.track.audio-track {
  background: rgba(108, 99, 255, 0.05);
}

.track.text-track {
  background: rgba(0, 137, 123, 0.05);
}

.track.selected-track {
  outline: 1px solid #6c63ff;
  outline-offset: -1px;
}

.track.selected-track .track-label {
  color: #6c63ff;
}

.track-label {
  width: 100px;
  margin-left: -100px;
  padding: 8px;
  font-size: 11px;
  color: #888;
  background: #0f0f23;
  display: flex;
  align-items: center;
  gap: 4px;
}

.audio-track .track-label {
  background: #0f0f2a;
}

.track-icon {
  font-size: 14px;
  color: #6c63ff;
}

.track-icon.text-icon {
  color: #00897b;
  font-weight: bold;
}

.track-icon.media-icon {
  color: #2d4a7a;
  font-size: 10px;
}

.add-text-btn {
  padding: 2px 8px;
  font-size: 13px;
  font-weight: bold;
  background: #00897b;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}

.add-text-btn:hover {
  background: #00a08a;
}

.add-clip-btn {
  padding: 0 4px;
  font-size: 14px;
  font-weight: bold;
  background: rgba(0, 137, 123, 0.4);
  border: none;
  border-radius: 3px;
  color: white;
  cursor: pointer;
  line-height: 1.2;
}

.add-clip-btn:hover {
  background: rgba(0, 137, 123, 0.7);
}

.remove-track-btn {
  margin-left: auto;
  padding: 0 4px;
  font-size: 14px;
  font-weight: bold;
  background: transparent;
  border: none;
  border-radius: 3px;
  color: #ff6b6b;
  cursor: pointer;
  line-height: 1.2;
}

.remove-track-btn:hover {
  background: #ff4444;
  color: white;
}

.text-track .track-label {
  background: #0f1423;
}

.track-clips {
  flex: 1;
  position: relative;
  min-height: 62px;
}

.group-handle {
  position: absolute;
  top: 0;
  height: 4px;
  background: rgba(255, 214, 0, 0.6);
  border-radius: 2px;
  cursor: grab;
  z-index: 5;
}

.group-handle:hover {
  background: rgba(255, 214, 0, 0.9);
}

.group-handle:active {
  cursor: grabbing;
}
</style>
