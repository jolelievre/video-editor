<template>
  <div class="video-preview">
    <div class="video-container" :class="{ hidden: !streamUrl }">
      <video ref="videoEl" preload="auto" />
      <div class="controls">
        <button class="play-btn" @click="$emit('togglePlay')">
          {{ isPlaying ? '\u23F8' : '\u25B6' }}
        </button>
        <span class="time-display">{{ formatTime(playheadPosition) }}</span>
        <span class="time-separator">/</span>
        <span class="time-display">{{ formatTime(totalDuration) }}</span>
        <div class="volume-control">
          <button class="volume-btn" @click="toggleMute">
            {{ volumeIcon }}
          </button>
          <input
            type="range"
            class="volume-slider"
            :style="volumeSliderStyle"
            min="0"
            max="100"
            step="1"
            :value="sliderValue"
            @input="onVolumeChange"
          />
        </div>
      </div>
    </div>
    <div v-if="!streamUrl" class="placeholder">
      <p>Add clips to the timeline to preview</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

const props = defineProps<{
  projectId: string;
  streamUrl: string | null;
  sourceTime: number;
  isPlaying: boolean;
  playheadPosition: number;
  totalDuration: number;
  activeClipId: string | null;
}>();

defineEmits<{
  togglePlay: [];
}>();

const videoEl = ref<HTMLVideoElement | null>(null);
const volume = ref(1);
const muted = ref(false);
let volumeBeforeMute = 1;
let loadedUrl: string | null = null;

const sliderValue = computed(() => {
  if (muted.value) return 0;
  return Math.round(volume.value * 100);
});

const volumeSliderStyle = computed(() => ({
  '--fill': `${sliderValue.value}%`,
}));

const volumeIcon = computed(() => {
  if (muted.value || volume.value === 0) return '\uD83D\uDD07';
  if (volume.value < 0.5) return '\uD83D\uDD09';
  return '\uD83D\uDD0A';
});

function applyVolume(video: HTMLVideoElement) {
  video.volume = volume.value;
  video.muted = muted.value;
}

function onVolumeChange(e: Event) {
  const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
  volume.value = val;
  muted.value = val === 0;
  if (videoEl.value) applyVolume(videoEl.value);
}

function toggleMute() {
  if (muted.value) {
    muted.value = false;
    volume.value = volumeBeforeMute || 0.5;
  } else {
    volumeBeforeMute = volume.value;
    muted.value = true;
  }
  if (videoEl.value) applyVolume(videoEl.value);
}

function loadAndSeek(url: string, seekTime: number, shouldPlay: boolean) {
  const video = videoEl.value;
  if (!video) return;

  if (loadedUrl === url) {
    // Same source, just seek
    applyVolume(video);
    video.currentTime = seekTime;
    if (shouldPlay) {
      video.play();
    }
    return;
  }

  // Different source, load it
  loadedUrl = url;
  video.src = url;
  video.addEventListener(
    'canplay',
    () => {
      applyVolume(video);
      video.currentTime = seekTime;
      if (shouldPlay) {
        video.play();
      }
    },
    { once: true },
  );
}

// Watch clip changes — handles both same-source and different-source transitions
watch(
  () => props.activeClipId,
  (clipId) => {
    const video = videoEl.value;
    if (!clipId || !props.streamUrl) {
      // No active clip (gap or past end) — pause the video element
      if (video && !video.paused) {
        video.pause();
      }
      return;
    }
    loadAndSeek(props.streamUrl, props.sourceTime, props.isPlaying);
  },
);

// Initial load on mount
onMounted(() => {
  if (props.streamUrl) {
    loadAndSeek(props.streamUrl, props.sourceTime, false);
  }
});

// Handle streamUrl appearing for the first time (after async config load)
watch(
  () => props.streamUrl,
  (url, oldUrl) => {
    if (url && !oldUrl) {
      loadAndSeek(url, props.sourceTime, props.isPlaying);
    }
  },
);

// Seek only when paused (for scrubbing preview)
watch(
  () => props.sourceTime,
  (time) => {
    const video = videoEl.value;
    if (!video || video.readyState < 2 || props.isPlaying) return;
    video.currentTime = time;
  },
);

// Sync video play/pause state
watch(
  () => props.isPlaying,
  (playing) => {
    const video = videoEl.value;
    if (!video) return;
    if (playing) {
      applyVolume(video);
      if (video.readyState >= 2) {
        video.currentTime = props.sourceTime;
        video.play();
      }
    } else {
      video.pause();
    }
  },
);

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.video-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.video-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
}

.video-container.hidden {
  display: none;
}

video {
  max-width: 100%;
  flex: 1;
  min-height: 0;
  object-fit: contain;
  background: #000;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #16213e;
  width: 100%;
  justify-content: center;
}

.play-btn {
  padding: 4px 12px;
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

.time-display {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #ccc;
}

.time-separator {
  font-size: 13px;
  color: #666;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
}

.volume-btn {
  background: transparent;
  border: none;
  color: white;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
}

.volume-btn:hover {
  opacity: 0.8;
}

.volume-slider {
  width: 90px;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    #6c63ff 0%,
    #6c63ff var(--fill),
    #333 var(--fill),
    #333 100%
  );
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.4);
}

.volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.4);
}

.volume-slider::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: transparent;
}

.placeholder {
  color: #555;
  font-size: 14px;
}
</style>
