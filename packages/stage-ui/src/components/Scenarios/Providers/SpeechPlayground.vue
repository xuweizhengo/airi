<script setup lang="ts">
import type { VoiceInfo } from '../../../stores'

import { FieldCheckbox } from '@proj-airi/ui'
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SpeechStreamingPlayground from './SpeechStreamingPlayground.vue'

import { TestDummyMarker } from '../../Gadgets'

const props = defineProps<{
  // Input fields
  defaultText?: string
  availableVoices: VoiceInfo[]

  // Provider-specific handlers (provided from parent)
  generateSpeech: (input: string, voice: string, useSSML: boolean) => Promise<ArrayBuffer>

  // Current state
  apiKeyConfigured?: boolean
}>()

const { t } = useI18n()

const testTextZhCn = `茶房在輪船里，總是盤踞在所謂“大菜間”的吃飯間里。他們常常圍著桌子閒談，客人也可插進一兩個去。
但客人若是坐滿了，使他們無處可坐，他們便恨恨了；这是一段有语气的句子？这一句也是！！
若在晚上，他們老實不客气將電燈滅了，讓你們暗中摸索去吧。
所以這吃飯間里的桌子竟像他們專利的。當他們圍桌而坐，有几個固然有話可談；有几個卻連話也沒有，只默默坐著，或者在打牌。
我似乎為他們覺著無聊，但他們也就這樣過去了。他們的臉上充滿了倦怠，嘲諷，麻木的气分，仿佛下工夫練就了似的。
最可怕的就是這滿臉：所謂“施施然拒人于千里之外”者，便是這种臉了。晚上映著電燈光，多少遮過了那灰滯的顏色；
他們也開始有了些生气。他們搭了舖抽大煙，或者拖開桌子打牌。他們抽了大煙，漸有笑語；
他們打牌，往往通宵達旦——牌聲，爭論聲充滿那小小的“大菜間”里。客人們，尤其是抱了病，可睡不著了；
但于他們有甚么相干呢？活該你們洗耳恭听呀！他們也有不抽大煙，不打牌的，便搬出香煙畫片來一張張細細賞玩：這卻是“雅人深致”了。`

const testTextJa = `或冬曇りの午後、わたしは中央線の汽車の窓に一列の山脈を眺めてゐた。山脈は勿論まつ白だつた。
が、それは雪と言ふよりも山脈の皮膚に近い色をしてゐた。わたしはかう言ふ山脈を見ながら、ふと或小事件を思ひ出した。
もう四五年以前になつた、やはり或冬曇りの午後、わたしは或友だちのアトリエに、――見すぼらしい鋳もののストオヴの前に彼やそのモデルと話してゐた。
アトリエには彼自身の油画の外に何も装飾になるものはなかつた。巻煙草を啣へた断髪のモデルも、――彼女は成程混血児じみた一種の美しさを具へてゐた。
しかしどう言ふ量見か、天然自然に生えた睫毛を一本残らず抜きとつてゐた。話はいつかその頃の寒気の厳しさに移つてゐた。
彼は如何に庭の土の季節を感ずるかと言ふことを話した。就中如何に庭の土の冬を感ずるかと言ふことを話した。
「つまり土も生きてゐると言ふ感じだね。」
彼はパイプに煙草をつめつめ、我々の顔を眺めまはした。わたしは何とも返事をしずににほひのない珈琲を啜つてゐた。
けれどもそれは断髪のモデルに何か感銘を与へたらしかつた。彼女は赤いまぶたを擡げ、彼女の吐いた煙の輪にぢつと目を注いでゐた。
それからやはり空中を見たまま、誰にともなしにこんなことを言つた。
「それは肌も同じだわね。あたしもこの商売を始めてから、すつかり肌を荒してしまつたもの。」
或冬曇りの午後、わたしは中央線の汽車の窓に一列の山脈を眺めてゐた。山脈は勿論まつ白だつた。
が、それは雪と言ふよりも人間の鮫肌に近い色をしてゐた。わたしはかう言ふ山脈を見ながら、ふとあのモデルを思ひ出した、あの一本も睫毛のない、混血児じみた日本の娘さんを。`

// Playground state
const testText = ref(testTextZhCn || testTextJa || props.defaultText || 'Hello! This is a test of the voice synthesis.')
const isGenerating = ref(false)
const audioUrl = ref('')
const errorMessage = ref('')
const audioPlayer = ref<HTMLAudioElement | null>(null)
const useSSML = ref(false)
const ssmlText = ref('')
const selectedVoice = ref('')

// Watch for changes in available voices
watch(
  () => props.availableVoices,
  (newVoices) => {
    if (newVoices.length > 0 && !selectedVoice.value) {
      selectedVoice.value = newVoices[0]?.id || ''
    }
  },
  { immediate: true },
)

// Function to generate speech
async function handleGenerateTestSpeech() {
  if ((!testText.value.trim() && !useSSML.value) || (useSSML.value && !ssmlText.value.trim()) || !selectedVoice.value)
    return

  isGenerating.value = true
  errorMessage.value = ''

  try {
    // Stop any currently playing audio
    if (audioUrl.value) {
      stopTestAudio()
    }

    const input = useSSML.value ? ssmlText.value : testText.value

    const response = await props.generateSpeech(input, selectedVoice.value, useSSML.value)

    // Convert the response to a blob and create an object URL
    audioUrl.value = URL.createObjectURL(new Blob([response]))

    // Play the audio
    setTimeout(() => {
      if (audioPlayer.value) {
        audioPlayer.value.play()
      }
    }, 100)
  }
  catch (error) {
    console.error('Error generating speech:', error)
    errorMessage.value = error instanceof Error ? error.message : 'An unknown error occurred'
  }
  finally {
    isGenerating.value = false
  }
}

// Function to stop audio playback
function stopTestAudio() {
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value.currentTime = 0
  }

  // Clean up the object URL to prevent memory leaks
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = ''
  }
}

// Clean up when component is unmounted
onUnmounted(() => {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
})

// Expose public methods and state
defineExpose({
  testText,
  ssmlText,
  useSSML,
  selectedVoice,
  isGenerating,
  audioUrl,
  errorMessage,
  audioPlayer,
  generateTestSpeech: handleGenerateTestSpeech,
  stopTestAudio,
})
</script>

<template>
  <div w-full rounded-xl>
    <h2 class="mb-4 text-lg text-neutral-500 md:text-2xl dark:text-neutral-400" w-full>
      <div class="inline-flex items-center gap-4">
        <TestDummyMarker />
        <div>
          {{ t('settings.pages.providers.provider.elevenlabs.playground.title') }}
        </div>
      </div>
    </h2>
    <div flex="~ col gap-4">
      <FieldCheckbox
        v-model="useSSML"
        :label="t('settings.pages.modules.speech.sections.section.voice-settings.use-ssml.label')"
        :description="t('settings.pages.modules.speech.sections.section.voice-settings.use-ssml.description')"
      />

      <template v-if="!useSSML">
        <textarea
          v-model="testText"
          :placeholder="t('settings.pages.providers.provider.elevenlabs.playground.fields.field.input.placeholder')"
          border="neutral-100 dark:neutral-800 solid 2 focus:neutral-200 dark:focus:neutral-700"
          transition="all duration-250 ease-in-out"
          bg="neutral-100 dark:neutral-800 focus:neutral-50 dark:focus:neutral-900"
          h-24 w-full rounded-lg px-3 py-2 text-sm outline-none
        />
      </template>
      <template v-else>
        <textarea
          v-model="ssmlText"
          :placeholder="t('settings.pages.modules.speech.sections.section.voice-settings.input-ssml.placeholder')"
          border="neutral-100 dark:neutral-800 solid 2 focus:neutral-200 dark:focus:neutral-700"
          transition="all duration-250 ease-in-out"
          bg="neutral-100 dark:neutral-800 focus:neutral-50 dark:focus:neutral-900"
          h-48 w-full rounded-lg px-3 py-2 text-sm font-mono outline-none
        />
      </template>

      <div flex="~ col gap-6">
        <label grid="~ cols-2 gap-4">
          <div>
            <div class="flex items-center gap-1 text-sm font-medium">
              {{ t('settings.pages.providers.provider.elevenlabs.playground.fields.field.voice.label') }}
            </div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('settings.pages.providers.provider.elevenlabs.playground.fields.field.voice.description') }}
            </div>
          </div>
          <select
            v-model="selectedVoice"
            border="neutral-300 dark:neutral-800 solid 2 focus:neutral-400 dark:focus:neutral-600"
            transition="border duration-250 ease-in-out" w-full rounded-lg px-2 py-1 text-nowrap text-sm
            outline-none
          >
            <option v-for="voice in availableVoices" :key="voice.id" :value="voice.id">
              {{ voice.name }}
            </option>
          </select>
        </label>
      </div>
      <!-- Playground actions -->
      <div flex="~ row" gap-4>
        <button
          border="neutral-800 dark:neutral-200 solid 2" transition="border duration-250 ease-in-out"
          rounded-lg px-4 text="neutral-100 dark:neutral-900" py-2 text-sm
          :disabled="isGenerating || (!testText.trim() && !useSSML) || (useSSML && !ssmlText.trim()) || !selectedVoice || !apiKeyConfigured"
          :class="{ 'opacity-50 cursor-not-allowed': isGenerating || (!testText.trim() && !useSSML) || (useSSML && !ssmlText.trim()) || !selectedVoice || !apiKeyConfigured }"
          bg="neutral-700 dark:neutral-300" @click="handleGenerateTestSpeech"
        >
          <div flex="~ row" items-center gap-2>
            <div i-solar:play-circle-bold-duotone />
            <span>{{ isGenerating ? t('settings.pages.providers.provider.elevenlabs.playground.buttons.button.test-voice.generating') : t('settings.pages.providers.provider.elevenlabs.playground.buttons.button.test-voice.label') }}</span>
          </div>
        </button>
        <button
          v-if="audioUrl" border="primary-300 dark:primary-800 solid 2"
          transition="border duration-250 ease-in-out" rounded-lg px-4 py-2 text-sm @click="stopTestAudio"
        >
          <div flex="~ row" items-center gap-2>
            <div i-solar:stop-circle-bold-duotone />
            <span>{{ t('settings.pages.modules.speech.sections.section.playground.buttons.stop.label') }}</span>
          </div>
        </button>
      </div>
      <!-- Error messages -->
      <div v-if="!apiKeyConfigured" class="mt-2 text-sm text-red-500">
        {{ t('settings.pages.providers.provider.elevenlabs.playground.validation.error-missing-api-key') }}
      </div>
      <div v-if="!selectedVoice" class="mt-2 text-sm text-red-500">
        {{ t('settings.pages.modules.speech.sections.section.playground.select-voice.required') }}
      </div>
      <div v-if="errorMessage" class="mt-2 text-sm text-red-500">
        {{ errorMessage }}
      </div>
      <audio v-if="audioUrl" ref="audioPlayer" :src="audioUrl" controls class="mt-2 w-full" />

      <SpeechStreamingPlayground
        :text="testText"
        :voice="selectedVoice"
        :generate-speech="generateSpeech"
      />
    </div>
    <!-- Slot for additional provider-specific UI in the playground -->
    <slot />
  </div>
</template>
