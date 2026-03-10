<template>
  <div class="video-preview">
    <!-- Media area: always visible when there's something to show -->
    <div v-if="activeSourceType || activeTextClips.length > 0" class="video-container">
      <div ref="mediaWrapperEl" class="media-wrapper">
        <!-- Video source (hidden when not active) -->
        <video ref="videoEl" preload="auto" :class="{ hidden: activeSourceType !== 'video' }" />
        <!-- Image source (hidden when not active) -->
        <img
          v-if="imageUrl && activeSourceType === 'image'"
          :src="imageUrl"
          class="image-preview"
        />
        <!-- Black background when no video/image but text clips exist -->
        <div v-if="!activeSourceType && activeTextClips.length > 0" class="black-bg" />
        <!-- Text overlay: always rendered when text clips are active -->
        <div v-if="activeTextClips.length > 0" class="text-overlay" :style="overlayStyle">
          <TextOverlayItem
            v-for="tc in activeTextClips"
            :key="tc.id"
            :text-clip="tc"
            :scale-factor="scaleFactor"
            :is-selected="tc.id === selectedClipId"
            :container-width="overlayRect.width"
            :container-height="overlayRect.height"
            :playhead-position="playheadPosition"
            @update:position="$emit('updateTextPosition', $event)"
            @select="$emit('selectTextClip', $event)"
          />
        </div>
      </div>
    </div>
    <!-- Audio-only placeholder (no text clips active) -->
    <div
      v-if="!activeSourceType && audioStreamUrl && activeTextClips.length === 0"
      class="placeholder audio-placeholder"
    >
      <div class="audio-viz">&#9835;</div>
      <p>Audio only</p>
    </div>
    <!-- Nothing active at all -->
    <div
      v-if="!activeSourceType && !audioStreamUrl && activeTextClips.length === 0"
      class="placeholder"
    >
      <p>Add clips to the timeline to preview</p>
    </div>
    <!-- Hidden audio element for audio track -->
    <audio ref="audioEl" preload="auto" />
    <!-- Controls always visible -->
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
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { TextClip } from '@video-editor/shared';
import TextOverlayItem from './TextOverlayItem.vue';
import { useFontLoader } from '../composables/useFontLoader';

useFontLoader();

const props = defineProps<{
  projectId: string;
  streamUrl: string | null;
  audioStreamUrl: string | null;
  sourceTime: number;
  audioSourceTime: number;
  isPlaying: boolean;
  playheadPosition: number;
  totalDuration: number;
  activeClipId: string | null;
  activeAudioClipId: string | null;
  activeSourceType: 'video' | 'image' | null;
  clipVolume: number;
  clipFadeIn: number;
  clipFadeOut: number;
  clipTimelineStart: number;
  clipDuration: number;
  clipPrevVolume: number;
  clipNextVolume: number;
  audioClipVolume: number;
  audioClipFadeIn: number;
  audioClipFadeOut: number;
  audioClipTimelineStart: number;
  audioClipDuration: number;
  audioClipPrevVolume: number;
  audioClipNextVolume: number;
  imageUrl: string | null;
  seekGeneration: number;
  activeTextClips: TextClip[];
  selectedClipId: string | null;
  resolution: { width: number; height: number };
}>();

defineEmits<{
  togglePlay: [];
  updateTextPosition: [payload: { clipId: string; x: number; y: number }];
  selectTextClip: [clipId: string];
}>();

const videoEl = ref<HTMLVideoElement | null>(null);
const audioEl = ref<HTMLAudioElement | null>(null);
const mediaWrapperEl = ref<HTMLElement | null>(null);
const masterVolume = ref(1);
const muted = ref(false);
let volumeBeforeMute = 1;
let loadedVideoUrl: string | null = null;
let loadedAudioUrl: string | null = null;

// Overlay sizing: track the rendered video/image area to position text correctly
const overlayRect = ref({ width: 100, height: 100 });

const scaleFactor = computed(() => {
  if (props.resolution.width <= 0) return 1;
  return overlayRect.value.width / props.resolution.width;
});

const overlayStyle = computed(() => ({
  width: `${overlayRect.value.width}px`,
  height: `${overlayRect.value.height}px`,
}));

let resizeObserver: ResizeObserver | null = null;

function updateOverlayRect() {
  // Find the active media element to get its rendered size
  const video = videoEl.value;
  if (video && props.activeSourceType === 'video' && video.videoWidth > 0) {
    const rect = video.getBoundingClientRect();
    const videoAspect = video.videoWidth / video.videoHeight;
    const containerAspect = rect.width / rect.height;

    let renderedWidth: number;
    let renderedHeight: number;
    if (videoAspect > containerAspect) {
      renderedWidth = rect.width;
      renderedHeight = rect.width / videoAspect;
    } else {
      renderedHeight = rect.height;
      renderedWidth = rect.height * videoAspect;
    }
    overlayRect.value = { width: renderedWidth, height: renderedHeight };
    return;
  }

  // For images or text-only, use resolution aspect ratio with container size
  const wrapper = mediaWrapperEl.value;
  if (wrapper) {
    const rect = wrapper.getBoundingClientRect();
    const aspect = props.resolution.width / props.resolution.height;
    const containerAspect = rect.width / rect.height;
    let w: number;
    let h: number;
    if (aspect > containerAspect) {
      w = rect.width;
      h = rect.width / aspect;
    } else {
      h = rect.height;
      w = rect.height * aspect;
    }
    overlayRect.value = { width: w, height: h };
  }
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => updateOverlayRect());
  if (mediaWrapperEl.value) resizeObserver.observe(mediaWrapperEl.value);

  if (props.streamUrl && props.activeSourceType === 'video') {
    loadAndSeekVideo(props.streamUrl, props.sourceTime, false);
  }
  if (props.audioStreamUrl) {
    loadAndSeekAudio(props.audioStreamUrl, props.audioSourceTime, false);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

// Re-observe wrapper when it appears/disappears (e.g. text clips activate)
watch(mediaWrapperEl, (el) => {
  resizeObserver?.disconnect();
  if (el) {
    resizeObserver?.observe(el);
    updateOverlayRect();
  }
});

// Update overlay rect when video metadata loads
watch(
  () => props.activeClipId,
  () => {
    setTimeout(updateOverlayRect, 100);
  },
);

const sliderValue = computed(() => {
  if (muted.value) return 0;
  return Math.round(masterVolume.value * 100);
});

const volumeSliderStyle = computed(() => ({
  '--fill': `${sliderValue.value}%`,
}));

const volumeIcon = computed(() => {
  if (muted.value || masterVolume.value === 0) return '\uD83D\uDD07';
  if (masterVolume.value < 0.5) return '\uD83D\uDD09';
  return '\uD83D\uDD0A';
});

function computeFadeMultiplier(
  playhead: number,
  clipVolume: number,
  fadeIn: number,
  fadeOut: number,
  timelineStart: number,
  clipDuration: number,
  prevClipVolume: number,
  nextClipVolume: number,
): number {
  if (clipDuration <= 0) return clipVolume;
  const elapsed = playhead - timelineStart;
  if (fadeIn > 0 && elapsed < fadeIn) {
    const t = elapsed / fadeIn;
    return prevClipVolume + (clipVolume - prevClipVolume) * t;
  }
  if (fadeOut > 0 && elapsed > clipDuration - fadeOut) {
    const remaining = clipDuration - elapsed;
    const t = Math.max(0, remaining / fadeOut);
    return nextClipVolume + (clipVolume - nextClipVolume) * t;
  }
  return clipVolume;
}

function applyVideoVolume() {
  const video = videoEl.value;
  if (!video) return;
  const effectiveVolume = computeFadeMultiplier(
    props.playheadPosition,
    props.clipVolume,
    props.clipFadeIn,
    props.clipFadeOut,
    props.clipTimelineStart,
    props.clipDuration,
    props.clipPrevVolume,
    props.clipNextVolume,
  );
  video.volume = Math.min(1, masterVolume.value * effectiveVolume);
  video.muted = muted.value;
}

function applyAudioVolume() {
  const audio = audioEl.value;
  if (!audio) return;
  const effectiveVolume = computeFadeMultiplier(
    props.playheadPosition,
    props.audioClipVolume,
    props.audioClipFadeIn,
    props.audioClipFadeOut,
    props.audioClipTimelineStart,
    props.audioClipDuration,
    props.audioClipPrevVolume,
    props.audioClipNextVolume,
  );
  audio.volume = Math.min(1, masterVolume.value * effectiveVolume);
  audio.muted = muted.value;
}

function onVolumeChange(e: Event) {
  const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
  masterVolume.value = val;
  muted.value = val === 0;
  applyVideoVolume();
  applyAudioVolume();
}

function toggleMute() {
  if (muted.value) {
    muted.value = false;
    masterVolume.value = volumeBeforeMute || 0.5;
  } else {
    volumeBeforeMute = masterVolume.value;
    muted.value = true;
  }
  applyVideoVolume();
  applyAudioVolume();
}

function loadAndSeekVideo(url: string, seekTime: number, shouldPlay: boolean) {
  const video = videoEl.value;
  if (!video) return;

  if (loadedVideoUrl === url) {
    if (!shouldPlay && !video.paused) video.pause();
    applyVideoVolume();
    video.currentTime = seekTime;
    if (shouldPlay) video.play();
    return;
  }

  loadedVideoUrl = url;
  if (!video.paused) video.pause();
  video.src = url;
  video.addEventListener(
    'canplay',
    () => {
      applyVideoVolume();
      video.currentTime = seekTime;
      if (shouldPlay) video.play();
      updateOverlayRect();
    },
    { once: true },
  );
}

function loadAndSeekAudio(url: string, seekTime: number, shouldPlay: boolean) {
  const audio = audioEl.value;
  if (!audio) return;

  if (loadedAudioUrl === url) {
    if (!shouldPlay && !audio.paused) audio.pause();
    applyAudioVolume();
    audio.currentTime = seekTime;
    if (shouldPlay) audio.play();
    return;
  }

  loadedAudioUrl = url;
  if (!audio.paused) audio.pause();
  audio.src = url;
  audio.addEventListener(
    'canplay',
    () => {
      applyAudioVolume();
      audio.currentTime = seekTime;
      if (shouldPlay) audio.play();
    },
    { once: true },
  );
}

// Watch video clip changes (flush: 'post' so the <video> element exists after v-if renders)
watch(
  () => props.activeClipId,
  (clipId) => {
    const video = videoEl.value;
    if (!clipId || !props.streamUrl || props.activeSourceType !== 'video') {
      if (video && !video.paused) video.pause();
      return;
    }
    loadAndSeekVideo(props.streamUrl, props.sourceTime, props.isPlaying);
  },
  { flush: 'post' },
);

// Watch audio clip changes
watch(
  () => props.activeAudioClipId,
  (clipId) => {
    const audio = audioEl.value;
    if (!clipId || !props.audioStreamUrl) {
      if (audio && !audio.paused) audio.pause();
      return;
    }
    loadAndSeekAudio(props.audioStreamUrl, props.audioSourceTime, props.isPlaying);
  },
);

watch(() => props.clipVolume, applyVideoVolume);
watch(() => props.audioClipVolume, applyAudioVolume);
watch(
  () => props.playheadPosition,
  () => {
    if (props.isPlaying) {
      applyVideoVolume();
      applyAudioVolume();
    }
  },
);

watch(
  () => props.streamUrl,
  (url, oldUrl) => {
    if (url && !oldUrl && props.activeSourceType === 'video') {
      loadAndSeekVideo(url, props.sourceTime, props.isPlaying);
    }
    if (!url) {
      const video = videoEl.value;
      if (video && !video.paused) video.pause();
    }
  },
  { flush: 'post' },
);

watch(
  () => props.audioStreamUrl,
  (url, oldUrl) => {
    if (url && url !== oldUrl) {
      loadAndSeekAudio(url, props.audioSourceTime, props.isPlaying);
    }
    if (!url) {
      const audio = audioEl.value;
      if (audio && !audio.paused) audio.pause();
    }
  },
);

watch(
  () => props.sourceTime,
  (time) => {
    const video = videoEl.value;
    if (!video || video.readyState < 2 || props.isPlaying) return;
    if (props.activeSourceType === 'video') {
      video.currentTime = time;
    }
  },
);

watch(
  () => props.audioSourceTime,
  (time) => {
    const audio = audioEl.value;
    if (!audio || props.isPlaying) return;
    if (!props.audioStreamUrl || !props.activeAudioClipId) return;

    if (loadedAudioUrl !== props.audioStreamUrl) {
      loadAndSeekAudio(props.audioStreamUrl, time, false);
      return;
    }
    if (audio.readyState >= 2) {
      audio.currentTime = time;
    }
  },
);

watch(
  () => props.seekGeneration,
  () => {
    const video = videoEl.value;
    if (video && video.readyState >= 2 && props.activeSourceType === 'video' && props.streamUrl) {
      video.currentTime = props.sourceTime;
    }

    const audio = audioEl.value;
    if (!audio || !props.audioStreamUrl || !props.activeAudioClipId) return;

    if (loadedAudioUrl !== props.audioStreamUrl) {
      loadAndSeekAudio(props.audioStreamUrl, props.audioSourceTime, props.isPlaying);
    } else if (audio.readyState >= 2) {
      audio.currentTime = props.audioSourceTime;
    }
  },
);

watch(
  () => props.isPlaying,
  (playing) => {
    const video = videoEl.value;
    const audio = audioEl.value;
    if (playing) {
      if (video && props.activeSourceType === 'video' && props.streamUrl) {
        applyVideoVolume();
        if (video.readyState >= 2) {
          video.currentTime = props.sourceTime;
          video.play();
        }
      }
      if (audio && props.audioStreamUrl && props.activeAudioClipId) {
        if (loadedAudioUrl !== props.audioStreamUrl || audio.readyState < 2) {
          loadAndSeekAudio(props.audioStreamUrl, props.audioSourceTime, true);
        } else {
          applyAudioVolume();
          audio.currentTime = props.audioSourceTime;
          audio.play();
        }
      }
    } else {
      if (video) video.pause();
      if (audio) audio.pause();
    }
  },
  { flush: 'post' },
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
  flex: 1;
  min-height: 0;
}

.video-container.hidden {
  display: none;
}

.media-wrapper {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background: #000;
}

video.hidden {
  display: none;
}

.image-preview {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background: #000;
}

.black-bg {
  width: 100%;
  height: 100%;
  background: #000;
}

.text-overlay {
  position: absolute;
  pointer-events: none;
  overflow: hidden;
}

.audio-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.audio-viz {
  font-size: 64px;
  color: #6c63ff;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
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
