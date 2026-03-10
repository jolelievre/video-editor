<template>
  <div class="toast-container">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="{ fading: toast.fading }">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast';

const { toasts } = useToast();
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  background: #1a1a2e;
  border: 1px solid #4a4e69;
  color: #ccc;
  font-size: 12px;
  padding: 8px 14px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  opacity: 1;
  transition: opacity 0.4s ease;
}

.toast.fading {
  opacity: 0;
}
</style>
