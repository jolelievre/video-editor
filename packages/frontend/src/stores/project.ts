import { defineStore } from 'pinia';
import { ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectConfig, Clip } from '@video-editor/shared';
import * as api from '../api/client';

// Pixel threshold past a neighbor before reorder triggers (adjusted via zoom)
export const REORDER_THRESHOLD_PX = 80;

const IMAGE_DEFAULT_DURATION = 5;

export const useProjectStore = defineStore('project', () => {
  const config = ref<ProjectConfig | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const selectedClipId = ref<string | null>(null);
  const selectedTrackId = ref<string | null>(null);

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

  function getOrCreateTrack(type: 'video' | 'audio') {
    if (!config.value) return null;

    let track = config.value.timeline.tracks.find((t) => (t.type ?? 'video') === type);
    if (!track) {
      track = {
        id: uuidv4(),
        name: type === 'audio' ? 'Audio' : 'Video',
        type,
        clips: [],
      };
      if (type === 'audio') {
        config.value.timeline.tracks.push(track);
      } else {
        config.value.timeline.tracks.unshift(track);
      }
    }
    return track;
  }

  function addClipToTimeline(sourceId: string) {
    if (!config.value) return;
    const source = config.value.sources.find((s) => s.id === sourceId);
    if (!source) return;

    const sourceType = source.type ?? 'video';
    const trackType = sourceType === 'audio' ? 'audio' : 'video';
    const track = getOrCreateTrack(trackType);
    if (!track) return;

    const lastClip = track.clips[track.clips.length - 1];
    const timelineStart = lastClip
      ? lastClip.timelineStart + (lastClip.outPoint - lastClip.inPoint)
      : 0;

    const duration = sourceType === 'image' ? IMAGE_DEFAULT_DURATION : source.duration;

    const clip: Clip = {
      id: uuidv4(),
      sourceId,
      inPoint: 0,
      outPoint: duration,
      timelineStart,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
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
        if (selectedClipId.value === clipId) {
          selectedClipId.value = null;
        }
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

  function selectClip(clipId: string | null) {
    selectedClipId.value = clipId;
    // Also select the track containing this clip
    if (clipId && config.value) {
      for (const track of config.value.timeline.tracks) {
        if (track.clips.some((c) => c.id === clipId)) {
          selectedTrackId.value = track.id;
          return;
        }
      }
    }
  }

  function selectTrack(trackId: string | null) {
    selectedTrackId.value = trackId;
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

  function splitClipAtPlayhead(playheadTime: number): boolean {
    if (!config.value) return false;

    // Only cut on the selected track, fall back to first match
    const tracks = selectedTrackId.value
      ? config.value.timeline.tracks.filter((t) => t.id === selectedTrackId.value)
      : config.value.timeline.tracks;

    for (const track of tracks) {
      for (const clip of track.clips) {
        const clipEnd = clip.timelineStart + (clip.outPoint - clip.inPoint);
        // Check if playhead is within this clip (not at edges)
        if (
          playheadTime > clip.timelineStart + 0.01 &&
          playheadTime < clipEnd - 0.01
        ) {
          const offsetInClip = playheadTime - clip.timelineStart;
          const splitSourceTime = clip.inPoint + offsetInClip;

          // Create the right half
          const rightClip: Clip = {
            id: uuidv4(),
            sourceId: clip.sourceId,
            inPoint: Math.round(splitSourceTime * 100) / 100,
            outPoint: clip.outPoint,
            timelineStart: Math.round(playheadTime * 100) / 100,
            volume: clip.volume ?? 1,
            fadeIn: 0,
            fadeOut: clip.fadeOut ?? 0,
          };

          // Trim the left half (original clip)
          clip.outPoint = Math.round(splitSourceTime * 100) / 100;
          clip.fadeOut = 0;

          // Insert right clip after the original
          const idx = track.clips.indexOf(clip);
          track.clips.splice(idx + 1, 0, rightClip);

          debouncedSave();
          return true;
        }
      }
    }
    return false;
  }

  return {
    config,
    loading,
    saving,
    selectedClipId,
    selectedTrackId,
    load,
    save,
    debouncedSave,
    addClipToTimeline,
    removeClip,
    updateClip,
    selectClip,
    selectTrack,
    moveClip,
    splitClipAtPlayhead,
  };
});
