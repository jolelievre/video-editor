import { defineStore } from 'pinia';
import { ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectConfig, Clip } from '@video-editor/shared';
import * as api from '../api/client';

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
  };
});
