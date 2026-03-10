<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('cancel')">
      <div class="modal">
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>
        <p v-if="warning" class="warning">{{ warning }}</p>
        <div class="modal-actions">
          <button class="cancel-btn" @click="$emit('cancel')">Cancel</button>
          <button v-if="forceLabel" class="force-btn" @click="$emit('force')">
            {{ forceLabel }}
          </button>
          <button v-if="!disableConfirm" class="confirm-btn" @click="$emit('confirm')">
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  message: string;
  warning?: string;
  confirmLabel?: string;
  forceLabel?: string;
  disableConfirm?: boolean;
}>();

defineEmits<{
  confirm: [];
  force: [];
  cancel: [];
}>();
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: #1a1a2e;
  border: 1px solid #4a4e69;
  border-radius: 8px;
  padding: 24px;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal h3 {
  font-size: 15px;
  color: #ccc;
  margin-bottom: 12px;
}

.modal p {
  font-size: 13px;
  color: #999;
  line-height: 1.5;
  margin-bottom: 8px;
  overflow-wrap: break-word;
  word-break: break-word;
}

.warning {
  color: #ff9f43 !important;
  font-weight: 600;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.cancel-btn {
  background: #333;
  color: #ccc;
  padding: 6px 14px;
  font-size: 13px;
}

.cancel-btn:hover {
  background: #444;
}

.confirm-btn {
  background: #ff4444;
  color: white;
  padding: 6px 14px;
  font-size: 13px;
}

.confirm-btn:hover {
  background: #ff5555;
}

.force-btn {
  background: #cc3300;
  color: white;
  padding: 6px 14px;
  font-size: 13px;
}

.force-btn:hover {
  background: #dd4411;
}
</style>
