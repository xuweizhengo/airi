<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useQueue } from '../../../composables/queue'
import { useMessageContentQueue } from '../../../composables/queues'
import { useAudioContext } from '../../../stores/audio'

const props = defineProps<{
  text: string
  // Provider-specific handlers (provided from parent)
  generateSpeech: (input: string, voice: string, useSSML: boolean) => Promise<ArrayBuffer>
  voice: string
}>()

const { audioContext } = useAudioContext()
const nowSpeaking = ref(false)
const audioAnalyser = ref<AnalyserNode>()

const audioQueue = useQueue<{ audioBuffer: AudioBuffer, text: string }>({
  handlers: [
    (ctx) => {
      return new Promise((resolve) => {
        // Create an AudioBufferSourceNode
        const source = audioContext.createBufferSource()
        source.buffer = ctx.data.audioBuffer

        // Connect the source to the AudioContext's destination (the speakers)
        source.connect(audioContext.destination)
        // Connect the source to the analyzer
        source.connect(audioAnalyser.value!)

        // Start playing the audio
        nowSpeaking.value = true
        source.start(0)
        source.onended = () => {
          nowSpeaking.value = false
          resolve()
        }
      })
    },
  ],
})

function setupAnalyser() {
  if (!audioAnalyser.value)
    audioAnalyser.value = audioContext.createAnalyser()
}

async function handleSpeechGeneration(ctx: { data: string }) {
  console.log('handleSpeechGeneration', ctx.data)
  try {
    const input = ctx.data

    const res = await props.generateSpeech(input, props.voice, false)

    // Decode the ArrayBuffer into an AudioBuffer
    const audioBuffer = await audioContext.decodeAudioData(res)
    await audioQueue.add({ audioBuffer, text: ctx.data })
  }
  catch (error) {
    console.error('Speech generation failed:', error)
  }
}

const ttsQueue = useQueue<string>({
  handlers: [
    handleSpeechGeneration,
  ],
})

const messageContentQueue = useMessageContentQueue(ttsQueue)

onMounted(() => {
  setupAnalyser()
})

async function test() {
  await messageContentQueue.add(props.text)
}
</script>

<template>
  <div>{{ props.text }}</div>
  <div flex="~ row" gap-4>
    <button
      border="neutral-800 dark:neutral-200 solid 2" transition="border duration-250 ease-in-out"
      rounded-lg px-4 text="neutral-100 dark:neutral-900" py-2 text-sm
      bg="neutral-700 dark:neutral-300" @click="test"
    >
      <div flex="~ row" items-center gap-2>
        <div i-solar:round-double-alt-arrow-right-bold-duotone />
        <span>Test streaming</span>
      </div>
    </button>
  </div>
</template>
