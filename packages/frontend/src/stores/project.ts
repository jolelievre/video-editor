import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectConfig, Clip, TextClip } from '@video-editor/shared';
import * as api from '../api/client';

// Pixel threshold past a neighbor before reorder triggers (adjusted via zoom)
export const REORDER_THRESHOLD_PX = 80;

const IMAGE_DEFAULT_DURATION = 5;
const TEXT_DEFAULT_DURATION = 5;
const HISTORY_LIMIT = 50;

export const useProjectStore = defineStore('project', () => {
  const config = ref<ProjectConfig | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const selectedClipId = ref<string | null>(null);
  const selectedTrackId = ref<string | null>(null);

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // --- Undo/Redo ---
  const undoStack = ref<string[]>([]);
  const redoStack = ref<string[]>([]);
  let inUndoGroup = false;
  let inUndoRedo = false;

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  function pushSnapshot() {
    if (inUndoGroup || inUndoRedo) return;
    if (!config.value) return;
    const snapshot = JSON.stringify(config.value.timeline);
    if (undoStack.value.length > 0 && undoStack.value[undoStack.value.length - 1] === snapshot) {
      return;
    }
    undoStack.value.push(snapshot);
    if (undoStack.value.length > HISTORY_LIMIT) {
      undoStack.value.shift();
    }
    // New action after undos: discard any remaining redo entries
    redoStack.value = [];
  }

  function beginUndoGroup() {
    pushSnapshot();
    inUndoGroup = true;
  }

  function endUndoGroup() {
    inUndoGroup = false;
  }

  function undo() {
    if (!config.value || undoStack.value.length === 0) return;
    inUndoRedo = true;
    const current = JSON.stringify(config.value.timeline);
    redoStack.value.push(current);
    const snapshot = undoStack.value.pop()!;
    config.value.timeline = JSON.parse(snapshot);
    debouncedSave();
    inUndoRedo = false;
  }

  function redo() {
    if (!config.value || redoStack.value.length === 0) return;
    inUndoRedo = true;
    const current = JSON.stringify(config.value.timeline);
    undoStack.value.push(current);
    const snapshot = redoStack.value.pop()!;
    config.value.timeline = JSON.parse(snapshot);
    debouncedSave();
    inUndoRedo = false;
  }

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
        name: type === 'audio' ? 'Audio' : 'Medias',
        type,
        clips: [],
        textClips: [],
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
    pushSnapshot();
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
    pushSnapshot();
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
    pushSnapshot();
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
    if (clipId && config.value) {
      for (const track of config.value.timeline.tracks) {
        if (track.clips.some((c) => c.id === clipId)) {
          selectedTrackId.value = track.id;
          return;
        }
        if ((track.textClips ?? []).some((c) => c.id === clipId)) {
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
    pushSnapshot();
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
      // Check if dragging past threshold to reorder
      const pastPrevThreshold = prev && desiredStart < prev.timelineStart - thresholdTime;
      const pastNextThreshold = next && desiredEnd > getClipEnd(next) + thresholdTime;

      if (pastPrevThreshold || pastNextThreshold) {
        // Reorder: place clip at desired position, sort, resolve overlaps
        clip.timelineStart = Math.round(Math.max(0, desiredStart) * 100) / 100;
        track.clips.sort((a, b) => a.timelineStart - b.timelineStart);
      } else {
        // Constrained move: clamp to previous clip but allow pushing next clips
        let clamped = Math.max(0, desiredStart);
        if (prev) {
          clamped = Math.max(prevEnd, clamped);
        }
        clip.timelineStart = Math.round(Math.max(0, clamped) * 100) / 100;
      }

      // Push overlapping clips to the right
      track.clips.sort((a, b) => a.timelineStart - b.timelineStart);
      for (let i = 0; i < track.clips.length - 1; i++) {
        const current = track.clips[i];
        const currentEnd = getClipEnd(current);
        const nextClip = track.clips[i + 1];
        if (nextClip.timelineStart < currentEnd) {
          nextClip.timelineStart = Math.round(currentEnd * 100) / 100;
        }
      }

      debouncedSave();
      return;
    }
  }

  function splitClipAtPlayhead(playheadTime: number): boolean {
    pushSnapshot();
    if (!config.value) return false;

    // Only cut on the selected track, fall back to first match
    const tracks = selectedTrackId.value
      ? config.value.timeline.tracks.filter((t) => t.id === selectedTrackId.value)
      : config.value.timeline.tracks;

    for (const track of tracks) {
      // Try media clips
      for (const clip of track.clips) {
        const clipEnd = clip.timelineStart + (clip.outPoint - clip.inPoint);
        if (playheadTime > clip.timelineStart + 0.01 && playheadTime < clipEnd - 0.01) {
          const offsetInClip = playheadTime - clip.timelineStart;
          const splitSourceTime = clip.inPoint + offsetInClip;

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

          clip.outPoint = Math.round(splitSourceTime * 100) / 100;
          clip.fadeOut = 0;

          const idx = track.clips.indexOf(clip);
          track.clips.splice(idx + 1, 0, rightClip);

          debouncedSave();
          return true;
        }
      }

      // Try text clips
      for (const tc of track.textClips ?? []) {
        const tcEnd = tc.timelineStart + tc.duration;
        if (playheadTime > tc.timelineStart + 0.01 && playheadTime < tcEnd - 0.01) {
          const leftDuration = Math.round((playheadTime - tc.timelineStart) * 100) / 100;
          const rightDuration = Math.round((tcEnd - playheadTime) * 100) / 100;

          const rightClip: TextClip = {
            id: uuidv4(),
            content: tc.content,
            timelineStart: Math.round(playheadTime * 100) / 100,
            duration: rightDuration,
            style: { ...tc.style },
            position: { ...tc.position },
            animationIn: tc.animationIn ? { ...tc.animationIn } : undefined,
            animationOut: tc.animationOut ? { ...tc.animationOut } : undefined,
          };

          tc.duration = leftDuration;

          const idx = track.textClips.indexOf(tc);
          track.textClips.splice(idx + 1, 0, rightClip);

          debouncedSave();
          return true;
        }
      }
    }
    return false;
  }

  // --- Text track/clip actions ---

  function addTextTrack() {
    pushSnapshot();
    if (!config.value) return;
    const textTracks = config.value.timeline.tracks.filter((t) => t.type === 'text');
    const name = `Text ${textTracks.length + 1}`;
    const track = {
      id: uuidv4(),
      name,
      type: 'text' as const,
      clips: [],
      textClips: [],
    };
    // Insert text tracks at the top (above video tracks)
    config.value.timeline.tracks.unshift(track);
    debouncedSave();
    return track;
  }

  function removeTrack(trackId: string) {
    pushSnapshot();
    if (!config.value) return;
    const idx = config.value.timeline.tracks.findIndex((t) => t.id === trackId);
    if (idx === -1) return;
    const track = config.value.timeline.tracks[idx];
    if (track.type !== 'text') return;
    if (track.textClips.length > 0 || track.clips.length > 0) return;
    config.value.timeline.tracks.splice(idx, 1);
    if (selectedTrackId.value === trackId) {
      selectedTrackId.value = null;
    }
    debouncedSave();
  }

  function addTextClip(trackId: string, playheadTime?: number) {
    pushSnapshot();
    if (!config.value) return;
    const track = config.value.timeline.tracks.find((t) => t.id === trackId);
    if (!track || track.type !== 'text') return;

    const sorted = [...track.textClips].sort((a, b) => a.timelineStart - b.timelineStart);
    let timelineStart: number | null = null;

    // Try to place at playhead if there's room
    if (playheadTime != null && playheadTime >= 0) {
      const desiredEnd = playheadTime + TEXT_DEFAULT_DURATION;
      let fits = true;
      for (const tc of sorted) {
        const tcEnd = tc.timelineStart + tc.duration;
        // Overlap check
        if (playheadTime < tcEnd && desiredEnd > tc.timelineStart) {
          fits = false;
          break;
        }
      }
      if (fits) {
        timelineStart = Math.round(playheadTime * 100) / 100;
      }
    }

    // Fallback: place after the last clip
    if (timelineStart == null) {
      const lastTc = sorted[sorted.length - 1];
      timelineStart = lastTc ? Math.round((lastTc.timelineStart + lastTc.duration) * 100) / 100 : 0;
    }

    const textClip: TextClip = {
      id: uuidv4(),
      content: 'Text',
      timelineStart,
      duration: TEXT_DEFAULT_DURATION,
      style: {
        fontFamily: 'Roboto',
        fontSize: 48,
        color: '#FFFFFF',
        bold: false,
        italic: false,
      },
      position: { x: 50, y: 50 },
    };

    track.textClips.push(textClip);
    debouncedSave();
  }

  function updateTextClip(clipId: string, changes: Partial<TextClip>) {
    pushSnapshot();
    if (!config.value) return;
    for (const track of config.value.timeline.tracks) {
      const tc = (track.textClips ?? []).find((c) => c.id === clipId);
      if (tc) {
        // Handle nested objects carefully
        if (changes.style) {
          tc.style = { ...tc.style, ...changes.style };
          delete changes.style;
        }
        if (changes.position) {
          tc.position = { ...tc.position, ...changes.position };
          delete changes.position;
        }
        if (changes.animationIn) {
          tc.animationIn = {
            ...(tc.animationIn ?? { type: 'none' as const, duration: 0 }),
            ...changes.animationIn,
          };
          delete changes.animationIn;
        }
        if (changes.animationOut) {
          tc.animationOut = {
            ...(tc.animationOut ?? { type: 'none' as const, duration: 0 }),
            ...changes.animationOut,
          };
          delete changes.animationOut;
        }
        Object.assign(tc, changes);
        debouncedSave();
        return;
      }
    }
  }

  function removeTextClip(clipId: string) {
    pushSnapshot();
    if (!config.value) return;
    for (const track of config.value.timeline.tracks) {
      const idx = (track.textClips ?? []).findIndex((c) => c.id === clipId);
      if (idx !== -1) {
        track.textClips.splice(idx, 1);
        if (selectedClipId.value === clipId) {
          selectedClipId.value = null;
        }
        debouncedSave();
        return;
      }
    }
  }

  function moveTextClip(clipId: string, desiredStart: number) {
    pushSnapshot();
    if (!config.value) return;
    for (const track of config.value.timeline.tracks) {
      const tc = (track.textClips ?? []).find((c) => c.id === clipId);
      if (!tc) continue;

      const sorted = [...track.textClips].sort((a, b) => a.timelineStart - b.timelineStart);
      const idx = sorted.findIndex((c) => c.id === clipId);
      const prev = idx > 0 ? sorted[idx - 1] : null;

      let clamped = Math.max(0, desiredStart);
      if (prev) {
        clamped = Math.max(prev.timelineStart + prev.duration, clamped);
      }

      tc.timelineStart = Math.round(Math.max(0, clamped) * 100) / 100;

      // Push overlapping clips to the right
      const reSorted = track.textClips.sort((a, b) => a.timelineStart - b.timelineStart);
      for (let i = 0; i < reSorted.length - 1; i++) {
        const current = reSorted[i];
        const currentEnd = current.timelineStart + current.duration;
        const nextTc = reSorted[i + 1];
        if (nextTc.timelineStart < currentEnd) {
          nextTc.timelineStart = Math.round(currentEnd * 100) / 100;
        }
      }

      debouncedSave();
      return;
    }
  }

  function moveClipGroup(clipIds: string[], delta: number) {
    pushSnapshot();
    if (!config.value) return;
    for (const track of config.value.timeline.tracks) {
      const groupClips = track.clips.filter((c) => clipIds.includes(c.id));
      if (groupClips.length === 0) continue;

      // Apply delta to all group clips
      for (const clip of groupClips) {
        clip.timelineStart = Math.round(Math.max(0, clip.timelineStart + delta) * 100) / 100;
      }

      // Re-sort and resolve overlaps with non-group clips
      track.clips.sort((a, b) => a.timelineStart - b.timelineStart);
      for (let i = 0; i < track.clips.length - 1; i++) {
        const current = track.clips[i];
        const currentEnd = getClipEnd(current);
        const nextClip = track.clips[i + 1];
        if (nextClip.timelineStart < currentEnd) {
          nextClip.timelineStart = Math.round(currentEnd * 100) / 100;
        }
      }
    }
    debouncedSave();
  }

  return {
    config,
    loading,
    saving,
    selectedClipId,
    selectedTrackId,
    canUndo,
    canRedo,
    load,
    save,
    debouncedSave,
    pushSnapshot,
    beginUndoGroup,
    endUndoGroup,
    undo,
    redo,
    addClipToTimeline,
    removeClip,
    updateClip,
    selectClip,
    selectTrack,
    moveClip,
    moveClipGroup,
    getClipEnd,
    splitClipAtPlayhead,
    addTextTrack,
    removeTrack,
    addTextClip,
    updateTextClip,
    removeTextClip,
    moveTextClip,
  };
});
