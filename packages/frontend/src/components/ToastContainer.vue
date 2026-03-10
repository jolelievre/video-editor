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
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.toast {
  background: #ff9f43;
  color: #1a1a2e;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 18px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  opacity: 1;
  transition: opacity 0.4s ease;
}

.toast.fading {
  opacity: 0;
}
</style>
