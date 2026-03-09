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

  function findActiveClipInTrack(trackType: 'video' | 'audio'): Clip | null {
    const c = config();
    if (!c) return null;
    for (const track of c.timeline.tracks) {
      if ((track.type ?? 'video') !== trackType) continue;
      for (const clip of track.clips) {
        const clipEnd = clip.timelineStart + (clip.outPoint - clip.inPoint);
        if (playheadPosition.value >= clip.timelineStart && playheadPosition.value < clipEnd) {
          return clip;
        }
      }
    }
    return null;
  }

  const activeVideoClip = computed<Clip | null>(() => findActiveClipInTrack('video'));
  const activeAudioClip = computed<Clip | null>(() => findActiveClipInTrack('audio'));

  // Keep backward-compatible activeClip (first active clip from any track)
  const activeClip = computed<Clip | null>(() => activeVideoClip.value ?? activeAudioClip.value);

  function findSource(clip: Clip | null): SourceFile | null {
    const c = config();
    if (!c || !clip) return null;
    return c.sources.find((s) => s.id === clip.sourceId) ?? null;
  }

  const activeVideoSource = computed<SourceFile | null>(() => findSource(activeVideoClip.value));
  const activeAudioSource = computed<SourceFile | null>(() => findSource(activeAudioClip.value));
  const activeSource = computed<SourceFile | null>(
    () => activeVideoSource.value ?? activeAudioSource.value,
  );

  // Whether the active video-track source is an image, video, or null
  const activeSourceType = computed<'video' | 'image' | null>(() => {
    const src = activeVideoSource.value;
    if (!src) return null;
    return (src.type ?? 'video') === 'image' ? 'image' : 'video';
  });

  const sourceTime = computed(() => {
    const clip = activeVideoClip.value;
    if (!clip) return 0;
    return clip.inPoint + (playheadPosition.value - clip.timelineStart);
  });

  const audioSourceTime = computed(() => {
    const clip = activeAudioClip.value;
    if (!clip) return 0;
    return clip.inPoint + (playheadPosition.value - clip.timelineStart);
  });

  const streamUrl = computed(() => {
    const source = activeVideoSource.value;
    if (!source) return null;
    return getStreamUrl(projectId, source.id);
  });

  const audioStreamUrl = computed(() => {
    const source = activeAudioSource.value;
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

  const seekGeneration = ref(0);

  function seek(time: number) {
    playheadPosition.value = Math.max(0, Math.min(time, totalDuration.value));
    seekGeneration.value++;
  }

  onUnmounted(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  });

  return {
    isPlaying,
    activeClip,
    activeVideoClip,
    activeAudioClip,
    activeSource,
    activeVideoSource,
    activeAudioSource,
    activeSourceType,
    sourceTime,
    audioSourceTime,
    seekGeneration,
    streamUrl,
    audioStreamUrl,
    play,
    pause,
    seek,
  };
}
