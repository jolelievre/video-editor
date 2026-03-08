import { defineStore } from 'pinia';
import { ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectConfig, Clip } from '@video-editor/shared';
import * as api from '../api/client';

// Pixel threshold past a neighbor before reorder triggers (adjusted via zoom)
export const REORDER_THRESHOLD_PX = 80;

export const useProjectStore = defineStore('project', () => {
  const config = ref<ProjectConfig | null>(null);
  const loading = ref(false);
  const saving = ref(false);

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  async function load(id: string) {
    loading.value = true;
    try {
      config.value = await api.getProject(id);
    } finally {
      loading.value = false;
    }
  }

  async function save() {
    if (!config.value) return;
    saving.value = true;
    try {
      config.value = await api.saveProject(config.value);
    } finally {
      saving.value = false;
    }
  }

  function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => save(), 500);
  }

  function addClipToTimeline(sourceId: string) {
    if (!config.value) return;
    const source = config.value.sources.find((s) => s.id === sourceId);
    if (!source) return;

    // Ensure at least one track exists
    if (config.value.timeline.tracks.length === 0) {
      config.value.timeline.tracks.push({
        id: uuidv4(),
        name: 'Track 1',
        clips: [],
      });
    }

    const track = config.value.timeline.tracks[0];
    const lastClip = track.clips[track.clips.length - 1];
    const timelineStart = lastClip
      ? lastClip.timelineStart + (lastClip.outPoint - lastClip.inPoint)
      : 0;

    const clip: Clip = {
      id: uuidv4(),
      sourceId,
      inPoint: 0,
      outPoint: source.duration,
      timelineStart,
    };

    track.clips.push(clip);
    debouncedSave();
  }

  function removeClip(clipId: string) {
    if (!config.value) return;
    for (const track of config.value.timeline.tracks) {
      const idx = track.clips.findIndex((c) => c.id === clipId);
      if (idx !== -1) {
        track.clips.splice(idx, 1);
        debouncedSave();
        return;
      }
    }
  }

  function updateClip(clipId: string, changes: Partial<Clip>) {
    if (!config.value) return;
    for (const track of config.value.timeline.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) {
        Object.assign(clip, changes);
        debouncedSave();
        return;
      }
    }
  }

  function getClipEnd(clip: Clip): number {
    return clip.timelineStart + (clip.outPoint - clip.inPoint);
  }

  function moveClip(clipId: string, desiredStart: number, zoom: number) {
    if (!config.value) return;
    for (const track of config.value.timeline.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (!clip) continue;

      const clipDuration = clip.outPoint - clip.inPoint;
      const desiredEnd = desiredStart + clipDuration;
      const thresholdTime = REORDER_THRESHOLD_PX / zoom;

      // Find neighbors (based on current sort order)
      const sorted = [...track.clips].sort((a, b) => a.timelineStart - b.timelineStart);
      const currentIdx = sorted.findIndex((c) => c.id === clipId);
      const prev = currentIdx > 0 ? sorted[currentIdx - 1] : null;
      const next = currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null;

      const prevEnd = prev ? getClipEnd(prev) : 0;
      const nextStart = next ? next.timelineStart : Infinity;

      // Check if dragging past threshold to reorder
      const pastPrevThreshold = prev && desiredStart < prev.timelineStart - thresholdTime;
      const pastNextThreshold = next && desiredEnd > getClipEnd(next) + thresholdTime;

      if (pastPrevThreshold || pastNextThreshold) {
        // Reorder: place clip at desired position, sort, resolve overlaps
        clip.timelineStart = Math.round(Math.max(0, desiredStart) * 100) / 100;
        track.clips.sort((a, b) => a.timelineStart - b.timelineStart);

        // Push overlapping clips to the right
        for (let i = 0; i < track.clips.length - 1; i++) {
          const current = track.clips[i];
          const currentEnd = getClipEnd(current);
          const nextClip = track.clips[i + 1];
          if (nextClip.timelineStart < currentEnd) {
            nextClip.timelineStart = Math.round(currentEnd * 100) / 100;
          }
        }
      } else {
        // Constrained move: clamp between neighbors
        let clamped = Math.max(0, desiredStart);
        if (prev) {
          clamped = Math.max(prevEnd, clamped);
        }
        if (next) {
          clamped = Math.min(nextStart - clipDuration, clamped);
        }
        clip.timelineStart = Math.round(Math.max(0, clamped) * 100) / 100;
      }

      debouncedSave();
      return;
    }
  }

  return {
    config,
    loading,
    saving,
    load,
    save,
    debouncedSave,
    addClipToTimeline,
    removeClip,
    updateClip,
    moveClip,
  };
});
