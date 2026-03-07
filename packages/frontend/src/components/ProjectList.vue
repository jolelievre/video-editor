<template>
  <div class="project-list">
    <h1>Video Editor</h1>
    <div class="create-form">
      <input v-model="newName" placeholder="New project name" @keyup.enter="create" />
      <button @click="create">Create Project</button>
    </div>
    <div v-if="loading" class="loading">Loading...</div>
    <ul v-else>
      <li v-for="project in projects" :key="project.id" @click="openProject(project.id)">
        <span class="name">{{ project.name }}</span>
        <span class="date">{{ new Date(project.updatedAt).toLocaleDateString() }}</span>
      </li>
      <li v-if="projects.length === 0" class="empty">No projects yet. Create one above.</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '../api/client';

const router = useRouter();
const projects = ref<Array<{ id: string; name: string; updatedAt: string }>>([]);
const newName = ref('');
const loading = ref(true);

onMounted(async () => {
  projects.value = await api.listProjects();
  loading.value = false;
});

async function create() {
  if (!newName.value.trim()) return;
  const project = await api.createProject(newName.value.trim());
  newName.value = '';
  router.push({ name: 'editor', params: { id: project.id } });
}

function openProject(id: string) {
  router.push({ name: 'editor', params: { id } });
}
</script>

<style scoped>
.project-list {
  max-width: 600px;
  margin: 40px auto;
  padding: 20px;
}

h1 {
  margin-bottom: 24px;
  color: #6c63ff;
}

.create-form {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.create-form input {
  flex: 1;
}

ul {
  list-style: none;
}

li {
  padding: 12px 16px;
  background: #16213e;
  border-radius: 6px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s;
}

li:hover {
  background: #1a1a4e;
}

li.empty {
  cursor: default;
  color: #888;
  justify-content: center;
}

li.empty:hover {
  background: #16213e;
}

.date {
  font-size: 12px;
  color: #888;
}
</style>
