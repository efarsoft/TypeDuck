<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { ImageResult } from '@typeduck/core'

const props = defineProps<{ image: ImageResult }>()
const emit = defineEmits<{ (e: 'close'): void }>()

/** 公众号封面标准比例 2.35:1（900×383） */
const W = 900
const H = 383

const canvasEl = ref<HTMLCanvasElement>()
const loading = ref(true)
const saving = ref(false)
const state = reactive({ scale: 1, offsetX: 0, offsetY: 0 })
let img: HTMLImageElement | null = null
let dragFrom: { x: number; y: number } | null = null

/** 展示尺寸：画布按面板宽度等比缩放 */
const displayStyle = reactive({ width: '100%' })

function draw() {
  const canvas = canvasEl.value
  if (!canvas || !img) return
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, W, H)
  // cover 起始缩放 + 用户缩放系数
  const base = Math.max(W / img.width, H / img.height)
  const s = base * state.scale
  const w = img.width * s
  const h = img.height * s
  let x = (W - w) / 2 + state.offsetX
  let y = (H - h) / 2 + state.offsetY
  x = Math.min(0, Math.max(W - w, x))
  y = Math.min(0, Math.max(H - h, y))
  state.offsetX = x - (W - w) / 2
  state.offsetY = y - (H - h) / 2
  ctx.drawImage(img, x, y, w, h)
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  state.scale = Math.min(3, Math.max(1, state.scale * (e.deltaY < 0 ? 1.08 : 0.925)))
  draw()
}

function onPointerDown(e: PointerEvent) {
  dragFrom = { x: e.clientX - state.offsetX, y: e.clientY - state.offsetY }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragFrom) return
  state.offsetX = e.clientX - dragFrom.x
  state.offsetY = e.clientY - dragFrom.y
  draw()
}

function onPointerUp() {
  dragFrom = null
}

function resetView() {
  state.scale = 1
  state.offsetX = 0
  state.offsetY = 0
  draw()
}

async function download() {
  const canvas = canvasEl.value
  if (!canvas || saving.value) return
  saving.value = true
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) throw new Error('导出失败')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cover-900x383-${Date.now().toString(36)}.jpg`
    a.click()
    URL.revokeObjectURL(url)
    emit('close')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  const el = canvasEl.value
  if (el) displayStyle.width = '100%'
  img = new Image()
  img.crossOrigin = 'anonymous' // 图库图片带 CORS 头，匿名加载保证 canvas 可导出
  img.onload = () => {
    loading.value = false
    resetView()
  }
  img.onerror = () => {
    loading.value = false
  }
  img.src = props.image.full
})
</script>

<template>
  <div class="crop-overlay">
    <div class="crop-dialog">
      <header class="dlg-head">
        <span class="dlg-title">✂️ 封面裁剪（公众号 2.35:1）</span>
        <button class="dlg-close" title="关闭" @click="emit('close')">✕</button>
      </header>

      <div class="crop-body">
        <p v-if="loading" class="loading">图片加载中…</p>
        <canvas
          v-show="!loading"
          ref="canvasEl"
          :style="displayStyle"
          @wheel.prevent="onWheel"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointerleave="onPointerUp"
        ></canvas>
        <div class="crop-tips">
          <label>缩放</label>
          <input v-model.number="state.scale" type="range" min="1" max="3" step="0.02" @input="draw" />
          <span>{{ state.scale.toFixed(2) }}x</span>
          <button class="reset" @click="resetView">复位</button>
        </div>
        <p class="hint">拖动画布调整位置，滚轮或滑杆缩放。导出 900×383 JPG，去公众号后台「封面」处上传即可。</p>
      </div>

      <footer class="dlg-foot">
        <span class="credit" :title="`${image.author} · ${image.source}`">📷 {{ image.author }}</span>
        <button class="primary" :disabled="loading || saving" @click="download">
          {{ saving ? '导出中…' : '下载封面' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.crop-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.crop-dialog {
  width: 640px;
  max-width: 100%;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dlg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 18px;
  border-bottom: 1px solid #e5e6eb;
}
.dlg-title {
  font-size: 14px;
  font-weight: 700;
  color: #1d2129;
}
.dlg-close {
  border: none;
  background: transparent;
  font-size: 14px;
  color: #999;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.dlg-close:hover {
  background: #f2f3f5;
  color: #333;
}
.crop-body {
  padding: 16px 18px;
}
.loading {
  font-size: 13px;
  color: #86909c;
  text-align: center;
  padding: 40px 0;
}
canvas {
  display: block;
  width: 100%;
  cursor: grab;
  border-radius: 8px;
  touch-action: none;
  user-select: none;
}
canvas:active {
  cursor: grabbing;
}
.crop-tips {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  font-size: 12.5px;
  color: #4e5969;
}
.crop-tips input[type='range'] {
  flex: 1;
  accent-color: #07c160;
}
.crop-tips .reset {
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  color: #4e5969;
  font-size: 12px;
  padding: 3px 10px;
  cursor: pointer;
}
.hint {
  font-size: 11.5px;
  color: #a8adb5;
  margin: 8px 0 0;
  line-height: 1.6;
}
.dlg-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-top: 1px solid #e5e6eb;
}
.credit {
  font-size: 11.5px;
  color: #a8adb5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.primary {
  height: 32px;
  padding: 0 20px;
  border: none;
  border-radius: 7px;
  background: #07c160;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.primary:hover {
  background: #06ad56;
}
.primary:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
