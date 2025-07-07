<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { animate } from 'animejs'
import { computed, onMounted, ref } from 'vue'

import { generateSineWavePath } from '../utils'

const progress = ref(0)
const step1Width = ref({ width: 0 })

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

defineExpose({
  handleUpdateStep,
  handleUpdateProgress,
  handleUpdateDone,
})

const { width, height } = useWindowSize()

const maskImage = computed(() => {
  const svg = `<svg width="${width.value}" height="${height.value}" xmlns="http://www.w3.org/2000/svg">
    <path d="${generateSineWavePath(width.value, height.value, 10, step1Width.value.width, 'down')}"/>
  </svg>`
  return `url(data:image/svg+xml;base64,${btoa(svg)})`
})

onMounted(async () => {
  await animate(step1Width.value, {
    width: 100,
    duration: 1000,
    ease: 'cubicBezier(.2,1,.49,1)',
  }).then()
})
</script>

<template>
  <div
    id="curtain"
    absolute inset-0 z-99 h-screen flex items-center
    bg-primary-500
    :style="{
      maskImage,
      WebkitMaskImage: maskImage,
      width: `${step1Width.width}vw`,
    }"
  >
    <template v-for="i in 10" :key="i">
      <div class="h-full flex-1 bg-primary-200" />
      <div class="h-full flex-1 bg-primary-300" />
    </template>
  </div>
</template>

<style scoped>
.wave {
  width: 200vw;
  mask-repeat: repeat-x;
  -webkit-mask-repeat: repeat-x;
}
</style>
