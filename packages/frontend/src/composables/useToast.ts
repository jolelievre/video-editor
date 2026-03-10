import { ref } from 'vue';

export interface Toast {
  id: number;
  message: string;
  fading: boolean;
}

const toasts = ref<Toast[]>([]);
let nextId = 0;

const DISPLAY_DURATION = 2000;
const FADE_DURATION = 400;

export function useToast() {
  function showToast(message: string) {
    const id = nextId++;
    toasts.value.push({ id, message, fading: false });

    setTimeout(() => {
      const toast = toasts.value.find((t) => t.id === id);
      if (toast) toast.fading = true;

      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
      }, FADE_DURATION);
    }, DISPLAY_DURATION);
  }

  return { toasts, showToast };
}
