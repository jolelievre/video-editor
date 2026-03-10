<template>
  <div class="clip-inspector" :class="{ 'has-selection': !!textClip }">
    <h3>Text Properties</h3>
    <div v-if="textClip" class="inspector-content">
      <div class="field">
        <label>Content</label>
        <input type="text" class="text-input" :value="textClip.content" @input="onContentChange" />
      </div>

      <div class="field">
        <label>Font Family</label>
        <div ref="fontSelectEl" class="font-select">
          <button class="font-select-trigger" @click="fontDropdownOpen = !fontDropdownOpen">
            <span :style="{ fontFamily: `'${textClip.style.fontFamily}', sans-serif` }">
              {{ textClip.style.fontFamily }}
            </span>
            <span class="caret">&#9662;</span>
          </button>
          <ul v-if="fontDropdownOpen" class="font-dropdown">
            <li
              v-for="font in sortedFonts"
              :key="font.family"
              :class="{ active: font.family === textClip.style.fontFamily }"
              :style="{ fontFamily: `'${font.family}', sans-serif` }"
              @click="selectFont(font.family)"
            >
              {{ font.family }}
            </li>
          </ul>
        </div>
      </div>

      <div class="field">
        <label>Font Size</label>
        <div class="slider-row">
          <input
            type="range"
            min="8"
            max="500"
            step="1"
            :value="textClip.style.fontSize"
            @mousedown="onSliderStart"
            @mouseup="onSliderEnd"
            @input="onFontSizeChange"
          />
          <span class="slider-value">{{ textClip.style.fontSize }}px</span>
        </div>
      </div>

      <div class="field">
        <label>Color</label>
        <input
          type="color"
          class="color-input"
          :value="textClip.style.color"
          @input="onColorChange"
        />
      </div>

      <div class="field">
        <label>Style</label>
        <div class="toggle-row">
          <button class="toggle-btn" :class="{ active: textClip.style.bold }" @click="onBoldToggle">
            <strong>B</strong>
          </button>
          <button
            class="toggle-btn"
            :class="{ active: textClip.style.italic }"
            @click="onItalicToggle"
          >
            <em>I</em>
          </button>
        </div>
      </div>

      <div class="separator" />

      <div class="field">
        <label>Position X</label>
        <div class="slider-row">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            :value="textClip.position.x"
            @mousedown="onSliderStart"
            @mouseup="onSliderEnd"
            @input="onPositionXChange"
          />
          <span class="slider-value">{{ textClip.position.x.toFixed(1) }}%</span>
        </div>
      </div>

      <div class="field">
        <label>Position Y</label>
        <div class="slider-row">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            :value="textClip.position.y"
            @mousedown="onSliderStart"
            @mouseup="onSliderEnd"
            @input="onPositionYChange"
          />
          <span class="slider-value">{{ textClip.position.y.toFixed(1) }}%</span>
        </div>
      </div>

      <div class="separator" />

      <h4>Animation In</h4>
      <div class="field">
        <label>Type</label>
        <select class="select-input" :value="animInType" @change="onAnimInTypeChange">
          <option value="none">None</option>
          <option value="fade">Fade</option>
          <option value="slide">Slide</option>
          <option value="typewriter">Typewriter</option>
        </select>
      </div>
      <div v-if="animInType !== 'none'" class="field">
        <label>Duration</label>
        <div class="slider-row">
          <input
            type="number"
            class="number-input"
            min="0"
            max="30"
            step="0.1"
            :value="animInDuration"
            @input="onAnimInDurationChange"
          />
          <span class="slider-value">s</span>
        </div>
      </div>
      <div v-if="animInType === 'slide'" class="field">
        <label>Direction</label>
        <select class="select-input" :value="animInDirection" @change="onAnimInDirectionChange">
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
        </select>
      </div>
      <div v-if="animInType === 'typewriter'" class="field">
        <label>Alignment</label>
        <select class="select-input" :value="animInAlignment" @change="onAnimInAlignmentChange">
          <option value="center">Center</option>
          <option value="left">Left</option>
        </select>
      </div>

      <h4>Animation Out</h4>
      <div class="field">
        <label>Type</label>
        <select class="select-input" :value="animOutType" @change="onAnimOutTypeChange">
          <option value="none">None</option>
          <option value="fade">Fade</option>
          <option value="slide">Slide</option>
        </select>
      </div>
      <div v-if="animOutType !== 'none'" class="field">
        <label>Duration</label>
        <div class="slider-row">
          <input
            type="number"
            class="number-input"
            min="0"
            max="30"
            step="0.1"
            :value="animOutDuration"
            @input="onAnimOutDurationChange"
          />
          <span class="slider-value">s</span>
        </div>
      </div>
      <div v-if="animOutType === 'slide'" class="field">
        <label>Direction</label>
        <select class="select-input" :value="animOutDirection" @change="onAnimOutDirectionChange">
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
        </select>
      </div>

      <div class="separator" />

      <div class="field">
        <label>Start</label>
        <div class="slider-row">
          <input
            type="number"
            class="number-input"
            min="0"
            step="0.1"
            :value="textClip.timelineStart"
            @input="onStartChange"
          />
          <span class="slider-value">s</span>
        </div>
      </div>

      <div class="field">
        <label>Duration</label>
        <div class="slider-row">
          <input
            type="number"
            class="number-input"
            min="0.1"
            step="0.1"
            :value="textClip.duration"
            @input="onDurationChange"
          />
          <span class="slider-value">s</span>
        </div>
      </div>
    </div>
    <div v-else class="empty">
      <p>Select a text clip to edit</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import type {
  TextClip,
  TextAnimationType,
  SlideDirection,
  TypewriterAlignment,
} from '@video-editor/shared';
import { BUNDLED_FONTS } from '@video-editor/shared/fonts';
import { useProjectStore } from '../stores/project';

const sortedFonts = computed(() =>
  [...BUNDLED_FONTS].sort((a, b) => a.family.localeCompare(b.family)),
);

const props = defineProps<{
  textClip: TextClip | null;
}>();

const emit = defineEmits<{
  update: [changes: Partial<TextClip>];
}>();

const store = useProjectStore();

function onSliderStart() {
  store.beginUndoGroup();
}

function onSliderEnd() {
  store.endUndoGroup();
}

const fontDropdownOpen = ref(false);
const fontSelectEl = ref<HTMLElement | null>(null);

function onClickOutside(e: MouseEvent) {
  if (fontSelectEl.value && !fontSelectEl.value.contains(e.target as Node)) {
    fontDropdownOpen.value = false;
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside));
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside));

const animInType = computed(() => props.textClip?.animationIn?.type ?? 'none');
const animInDuration = computed(() => props.textClip?.animationIn?.duration ?? 0);
const animInDirection = computed(() => props.textClip?.animationIn?.direction ?? 'left');
const animInAlignment = computed(() => props.textClip?.animationIn?.alignment ?? 'center');
const animOutType = computed(() => props.textClip?.animationOut?.type ?? 'none');
const animOutDuration = computed(() => props.textClip?.animationOut?.duration ?? 0);
const animOutDirection = computed(() => props.textClip?.animationOut?.direction ?? 'left');

function onAnimInTypeChange(e: Event) {
  const type = (e.target as HTMLSelectElement).value as TextAnimationType;
  const update: Partial<TextClip> = {
    animationIn: {
      type,
      duration: type === 'none' ? 0 : animInDuration.value || 0.5,
      ...(type === 'slide' ? { direction: animInDirection.value } : {}),
    },
  };
  emit('update', update);
}

function onAnimInDurationChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  if (!isNaN(val) && val >= 0) {
    emit('update', { animationIn: { duration: val } } as Partial<TextClip>);
  }
}

function onAnimInDirectionChange(e: Event) {
  const direction = (e.target as HTMLSelectElement).value as SlideDirection;
  emit('update', { animationIn: { direction } } as Partial<TextClip>);
}

function onAnimInAlignmentChange(e: Event) {
  const alignment = (e.target as HTMLSelectElement).value as TypewriterAlignment;
  emit('update', { animationIn: { alignment } } as Partial<TextClip>);
}

function onAnimOutTypeChange(e: Event) {
  const type = (e.target as HTMLSelectElement).value as TextAnimationType;
  const update: Partial<TextClip> = {
    animationOut: {
      type,
      duration: type === 'none' ? 0 : animOutDuration.value || 0.5,
      ...(type === 'slide' ? { direction: animOutDirection.value } : {}),
    },
  };
  emit('update', update);
}

function onAnimOutDurationChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  if (!isNaN(val) && val >= 0) {
    emit('update', { animationOut: { duration: val } } as Partial<TextClip>);
  }
}

function onAnimOutDirectionChange(e: Event) {
  const direction = (e.target as HTMLSelectElement).value as SlideDirection;
  emit('update', { animationOut: { direction } } as Partial<TextClip>);
}

function onContentChange(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  if (val) emit('update', { content: val });
}

function selectFont(family: string) {
  fontDropdownOpen.value = false;
  emit('update', { style: { fontFamily: family } } as unknown as Partial<TextClip>);
}

function onFontSizeChange(e: Event) {
  const val = parseInt((e.target as HTMLInputElement).value, 10);
  emit('update', { style: { fontSize: val } } as unknown as Partial<TextClip>);
}

function onColorChange(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  emit('update', { style: { color: val } } as unknown as Partial<TextClip>);
}

function onBoldToggle() {
  emit('update', { style: { bold: !props.textClip?.style.bold } } as unknown as Partial<TextClip>);
}

function onItalicToggle() {
  emit('update', {
    style: { italic: !props.textClip?.style.italic },
  } as unknown as Partial<TextClip>);
}

function onPositionXChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  emit('update', { position: { x: Math.round(val * 10) / 10 } } as Partial<TextClip>);
}

function onPositionYChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  emit('update', { position: { y: Math.round(val * 10) / 10 } } as Partial<TextClip>);
}

function onStartChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  if (!isNaN(val) && val >= 0) emit('update', { timelineStart: Math.round(val * 100) / 100 });
}

function onDurationChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  if (!isNaN(val) && val >= 0.1) emit('update', { duration: Math.round(val * 100) / 100 });
}
</script>

<style scoped>
.clip-inspector {
  padding: 12px;
  border: 2px solid transparent;
  border-radius: 4px;
}

.clip-inspector.has-selection {
  border-color: #00897b;
}

h3 {
  font-size: 13px;
  color: #00897b;
  margin-bottom: 12px;
}

.inspector-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.font-select {
  position: relative;
}

.font-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 4px;
  color: #ccc;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  box-sizing: border-box;
}

.font-select-trigger:hover {
  border-color: #00897b;
}

.caret {
  font-size: 10px;
  color: #888;
}

.font-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 4px;
  margin-top: 2px;
  z-index: 10;
  list-style: none;
  padding: 0;
}

.font-dropdown li {
  padding: 6px 8px;
  font-size: 14px;
  color: #ccc;
  cursor: pointer;
}

.font-dropdown li:hover {
  background: #2a2a4e;
}

.font-dropdown li.active {
  background: #00897b;
  color: white;
}

h4 {
  font-size: 12px;
  color: #00897b;
  margin: 4px 0;
}

.select-input {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 4px;
  color: #ccc;
  padding: 4px 8px;
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
}

.select-input:focus {
  border-color: #00897b;
  outline: none;
}

.text-input,
.number-input {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 4px;
  color: #ccc;
  padding: 4px 8px;
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
}

.text-input:focus,
.number-input:focus {
  border-color: #00897b;
  outline: none;
}

.number-input {
  width: auto;
  flex: 1;
}

.color-input {
  width: 100%;
  height: 28px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a2e;
  cursor: pointer;
  padding: 2px;
}

.toggle-row {
  display: flex;
  gap: 6px;
}

.toggle-btn {
  padding: 4px 10px;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 4px;
  color: #ccc;
  cursor: pointer;
  font-size: 12px;
}

.toggle-btn.active {
  background: #00897b;
  border-color: #00897b;
  color: white;
}

.separator {
  border-top: 1px solid #333;
  margin: 4px 0;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-row input[type='range'] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #333;
  border-radius: 2px;
  outline: none;
}

.slider-row input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #00897b;
  cursor: pointer;
}

.slider-row input[type='range']::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #00897b;
  border: none;
  cursor: pointer;
}

.slider-value {
  font-size: 11px;
  color: #ccc;
  min-width: 40px;
  text-align: right;
}

.empty {
  color: #555;
  font-size: 12px;
  text-align: center;
  padding: 16px 0;
}
</style>
