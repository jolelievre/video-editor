import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'projects',
      component: () => import('./components/ProjectList.vue'),
    },
    {
      path: '/project/:id',
      name: 'editor',
      component: () => import('./components/ProjectEditor.vue'),
    },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
