import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { ProjectConfig, Clip, SourceFile } from '@video-editor/shared';
import { getStreamUrl } from '../api/client';

export function useVideoPreview(
  config: () => ProjectConfig | null,
  playheadPosition: Ref<number>,
  totalDuration: ComputedRef<number>,
  projectId: string,
) {
  const isPlaying = ref(false);
  let rafId: number | null = null;
  let lastTimestamp: number | null = null;

  const activeClip = computed<Clip | null>(() => {
    const c = config();
    if (!c) return null;
    for (const track of c.timeline.tracks) {
      for (const clip of track.clips) {
        const clipEnd = clip.timelineStart + (clip.outPoint - clip.inPoint);
        if (playheadPosition.value >= clip.timelineStart && playheadPosition.value < clipEnd) {
          return clip;
        }
      }
    }
    return null;
  });

  const activeSource = computed<SourceFile | null>(() => {
    const c = config();
    const clip = activeClip.value;
    if (!c || !clip) return null;
    return c.sources.find((s) => s.id === clip.sourceId) ?? null;
  });

  const sourceTime = computed(() => {
    const clip = activeClip.value;
    if (!clip) return 0;
    return clip.inPoint + (playheadPosition.value - clip.timelineStart);
  });

  const streamUrl = computed(() => {
    const source = activeSource.value;
    if (!source) return null;
    return getStreamUrl(projectId, source.id);
  });

  function tick(timestamp: number) {
    if (lastTimestamp !== null) {
      const delta = (timestamp - lastTimestamp) / 1000;
      playheadPosition.value = Math.min(playheadPosition.value + delta, totalDuration.value);

      if (playheadPosition.value >= totalDuration.value) {
        pause();
        return;
      }
    }
    lastTimestamp = timestamp;
    rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (isPlaying.value) return;
    if (playheadPosition.value >= totalDuration.value) {
      playheadPosition.value = 0;
    }
    isPlaying.value = true;
    lastTimestamp = null;
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    isPlaying.value = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTimestamp = null;
  }

  function seek(time: number) {
    playheadPosition.value = Math.max(0, Math.min(time, totalDuration.value));
  }

  onUnmounted(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  });

  return {
    isPlaying,
    activeClip,
    activeSource,
    sourceTime,
    streamUrl,
    play,
    pause,
    seek,
  };
}
