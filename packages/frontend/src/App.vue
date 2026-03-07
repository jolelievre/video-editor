<template>
  <div id="app">
    <RouterView />
  </div>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #e0e0e0;
  min-height: 100vh;
}

#app {
  min-height: 100vh;
}

button {
  cursor: pointer;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  background: #4a4e69;
  color: #e0e0e0;
  transition: background 0.2s;
}

button:hover {
  background: #6c63ff;
}

input {
  padding: 8px 12px;
  border: 1px solid #4a4e69;
  border-radius: 4px;
  background: #16213e;
  color: #e0e0e0;
  font-size: 14px;
}

input:focus {
  outline: none;
  border-color: #6c63ff;
}
</style>
