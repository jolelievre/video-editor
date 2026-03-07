import { ref, computed } from 'vue';
import type { ProjectConfig } from '@video-editor/shared';

export function useTimeline(config: () => ProjectConfig | null) {
  const zoomLevel = ref(50); // pixels per second
  const scrollOffset = ref(0);
  const playheadPosition = ref(0);

  const totalDuration = computed(() => {
    const c = config();
    if (!c) return 0;
    let max = 0;
    for (const track of c.timeline.tracks) {
      for (const clip of track.clips) {
        const end = clip.timelineStart + (clip.outPoint - clip.inPoint);
        if (end > max) max = end;
      }
    }
    return max;
  });

  const totalWidth = computed(() => totalDuration.value * zoomLevel.value + 200);

  function timeToPixels(seconds: number): number {
    return seconds * zoomLevel.value;
  }

  function pixelsToTime(px: number): number {
    return px / zoomLevel.value;
  }

  function setZoom(level: number) {
    zoomLevel.value = Math.max(10, Math.min(200, level));
  }

  return {
    zoomLevel,
    scrollOffset,
    playheadPosition,
    totalDuration,
    totalWidth,
    timeToPixels,
    pixelsToTime,
    setZoom,
  };
}
