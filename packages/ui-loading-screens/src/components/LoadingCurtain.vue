<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { animate } from 'animejs'
import { computed, onMounted, ref } from 'vue'

import { generateSineWavePath } from '../utils'

const progress = ref(0)
const step1Width = ref(0)

// 扇形的角度（度数）
const sectorAngle = ref(0)

// 计算扇形的背景样式
const sectorStyle = computed(() => {
  return {
    maskImage: `conic-gradient(#272b66 0deg ${sectorAngle.value}deg, transparent ${sectorAngle.value}deg 360deg)`,
  }
})

/**
 * 1. curtain to right
 * 2. sector to circle
 * 3. logo scale up
 * 4. progress bar scale x up
 * 5. progress bar show progress
 * 6. progress bar scale x center down
 * 7. circle to sector
 * 8. curtain to left
 * 9. logo to top left
 */
const step = ref(0)
const done = ref(false)

function handleUpdateStep(value: number) {
  step.value = value
}

function handleUpdateProgress(value: number) {
  progress.value = value
}

function handleUpdateDone(value: boolean) {
  done.value = value
}

// 添加更新扇形角度的方法
function updateSectorAngle(angle: number) {
  sectorAngle.value = angle
}

defineExpose({
  handleUpdateStep,
  handleUpdateProgress,
  handleUpdateDone,
  updateSectorAngle, // 暴露更新扇形角度的方法
})

const { width, height } = useWindowSize()

const maskImage = computed(() => {
  const svg = `<svg width="${width.value}" height="${height.value}" xmlns="http://www.w3.org/2000/svg">
    <path d="${generateSineWavePath(width.value, height.value, 10, step1Width.value / 40, 'down')}"/>
  </svg>`
  return `url(data:image/svg+xml;base64,${btoa(svg)})`
})

const airiScale = ref(0)

onMounted(async () => {
  await animate(step1Width, {
    value: width.value,
    duration: 1000,
    ease: 'cubicBezier(.2,1,.49,1)',
  }).then()
  await animate(sectorAngle, {
    value: 360,
    duration: 1000,
    ease: 'cubicBezier(.2,1,.49,1)',
  }).then()
  await animate(airiScale, {
    value: 1,
    duration: 600,
    ease: 'cubicBezier(.12,.63,.56,1.22)',
  }).then()
})
</script>

<template>
  <div class="absolute inset-0 z-99 h-screen">
    <div
      id="curtain"
      absolute inset-0 z-99 h-screen flex items-center
      :style="{
        maskImage,
        WebkitMaskImage: maskImage,
        maskPosition: `${step1Width / -80}px 0`,
        maskSize: `${width * 2}px ${height}px`,
        width: `${step1Width}px`,
        backgroundColor: '#FFB7D0',
      }"
    >
      <template v-for="i in 10" :key="i">
        <div class="h-full flex-1" :style="{ backgroundColor: '#FFC8DD' }" />
        <div class="h-full flex-1" :style="{ backgroundColor: '#FFD9E6' }" />
      </template>
    </div>
    <div class="absolute inset-0 z-99 h-screen flex items-center justify-center">
      <div
        class="h-72 w-72 flex items-center justify-center rounded-1/2" :style="{ ...sectorStyle, backgroundColor: '#e17fff' }"
      >
        <div class="h-64 w-64 rounded-1/2" :style="{ ...sectorStyle, backgroundColor: '#d154ff' }" />
      </div>
    </div>
    <div
      class="absolute inset-0 z-99 h-screen flex items-center justify-center text-12rem font-600" :style="{
        color: '#ffacff',
        transform: `scale(${airiScale})`,
        fontFamily: 'Quicksand, sans-serif',
      }"
    >
      AIRI
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@600&display=swap');

.wave {
  width: 200vw;
  mask-repeat: repeat-x;
  -webkit-mask-repeat: repeat-x;
}
</style>
