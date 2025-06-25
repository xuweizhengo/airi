import { ref, reactive, onUnmounted, readonly } from 'vue'
import { invoke } from '@tauri-apps/api/tauri'
import { listen, type UnlistenFn, type Event } from '@tauri-apps/api/event'

export interface StreamChunk {
  text: string
  timestamp?: number
}

export interface TranscriptionResponse {
  text: string
}

export interface AudioMonitoringStatus {
  isMonitoring: boolean
  model: string
  sampleRate?: number
}

export function useAudioProcessing() {
  // Reactive state
  const isMonitoring = ref(false)
  const currentModel = ref('tiny')
  const availableModels = ref<string[]>([])
  const audioDevices = ref<string[]>([])
  const realtimeTranscriptions = ref<StreamChunk[]>([])
  const processingProgress = ref(0)
  const lastTranscription = ref('')

  // Event listeners cleanup functions
  const unlistenFunctions = ref<UnlistenFn[]>([])

  // Initialize available models and devices
  const initialize = async (): Promise<void> => {
    try {
      const models = await invoke<string[]>('get_available_models')
      availableModels.value = models
      
      const devices = await invoke<string[]>('get_audio_devices')
      audioDevices.value = devices
      
      console.log('🎤 Audio processing initialized', { models, devices })
    } catch (error) {
      console.error('❌ Failed to initialize audio processing:', error)
      throw error
    }
  }

  // Setup event listeners for realtime audio processing
  const setupEventListeners = async (): Promise<void> => {
    try {
      // Listen for realtime transcriptions
      const unlistenRealtime = await listen<StreamChunk>('audio-realtime-transcription', (event: Event<StreamChunk>) => {
        console.log('🎯 Realtime transcription:', event.payload)
        realtimeTranscriptions.value.push(event.payload)
        lastTranscription.value = event.payload.text
      })
      unlistenFunctions.value.push(unlistenRealtime)

      // Listen for monitoring status changes
      const unlistenStarted = await listen('audio-monitoring-started', (event: Event<any>) => {
        console.log('🚀 Audio monitoring started:', event.payload)
        isMonitoring.value = true
      })
      unlistenFunctions.value.push(unlistenStarted)

      const unlistenStopped = await listen('audio-monitoring-stopped', () => {
        console.log('🛑 Audio monitoring stopped')
        isMonitoring.value = false
      })
      unlistenFunctions.value.push(unlistenStopped)

      // Listen for errors
      const unlistenError = await listen<{ error: string }>('audio-monitoring-error', (event: Event<{ error: string }>) => {
        console.error('❌ Audio monitoring error:', event.payload.error)
        isMonitoring.value = false
      })
      unlistenFunctions.value.push(unlistenError)

      // Listen for transcription progress (for file processing)
      const unlistenProgress = await listen<{ progress: number }>('audio-transcription-progress', (event: Event<{ progress: number }>) => {
        processingProgress.value = event.payload.progress
      })
      unlistenFunctions.value.push(unlistenProgress)

      // Listen for transcription chunks (for streaming file processing)
      const unlistenChunk = await listen<StreamChunk>('audio-transcription-chunk', (event: Event<StreamChunk>) => {
        console.log('📝 Transcription chunk:', event.payload)
        realtimeTranscriptions.value.push(event.payload)
      })
      unlistenFunctions.value.push(unlistenChunk)

      // Listen for transcription completion
      const unlistenComplete = await listen<TranscriptionResponse>('audio-transcription-complete', (event: Event<TranscriptionResponse>) => {
        console.log('✅ Transcription complete:', event.payload)
        lastTranscription.value = event.payload.text
        processingProgress.value = 100
      })
      unlistenFunctions.value.push(unlistenComplete)

    } catch (error) {
      console.error('❌ Failed to setup event listeners:', error)
      throw error
    }
  }

  // Start realtime audio monitoring
  const startMonitoring = async (deviceName?: string, modelName?: string): Promise<void> => {
    try {
      await invoke('start_audio_monitoring', {
        deviceName,
        modelName: modelName || currentModel.value,
      })
      currentModel.value = modelName || currentModel.value
      console.log('🎤 Starting audio monitoring with model:', currentModel.value)
    } catch (error) {
      console.error('❌ Failed to start audio monitoring:', error)
      throw error
    }
  }

  // Stop realtime audio monitoring
  const stopMonitoring = async (): Promise<void> => {
    try {
      await invoke('stop_audio_monitoring')
      console.log('🛑 Audio monitoring stopped')
    } catch (error) {
      console.error('❌ Failed to stop audio monitoring:', error)
      throw error
    }
  }

  // Transcribe audio file
  const transcribeFile = async (
    audioData: Uint8Array,
    modelName?: string,
    enableStreaming?: boolean
  ): Promise<string> => {
    try {
      processingProgress.value = 0
      realtimeTranscriptions.value = []
      
      const result = await invoke<string>('transcribe_audio_file', {
        audioData: Array.from(audioData),
        modelName: modelName || currentModel.value,
        stream: enableStreaming,
      })
      
      lastTranscription.value = result
      processingProgress.value = 100
      console.log('📝 File transcription complete:', result)
      return result
    } catch (error) {
      console.error('❌ Failed to transcribe file:', error)
      throw error
    }
  }

  // Get health status
  const getHealthStatus = async (): Promise<any> => {
    try {
      return await invoke('health_check')
    } catch (error) {
      console.error('❌ Failed to get health status:', error)
      throw error
    }
  }

  // Clear transcription history
  const clearTranscriptions = (): void => {
    realtimeTranscriptions.value = []
    lastTranscription.value = ''
    processingProgress.value = 0
  }

  // Cleanup function
  const cleanup = async (): Promise<void> => {
    // Stop monitoring if active
    if (isMonitoring.value) {
      await stopMonitoring()
    }

    // Remove all event listeners
    for (const unlisten of unlistenFunctions.value) {
      unlisten()
    }
    unlistenFunctions.value = []
  }

  // Auto cleanup on component unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    // State
    isMonitoring: readonly(isMonitoring),
    currentModel: readonly(currentModel),
    availableModels: readonly(availableModels),
    audioDevices: readonly(audioDevices),
    realtimeTranscriptions: readonly(realtimeTranscriptions),
    processingProgress: readonly(processingProgress),
    lastTranscription: readonly(lastTranscription),

    // Methods
    initialize,
    setupEventListeners,
    startMonitoring,
    stopMonitoring,
    transcribeFile,
    getHealthStatus,
    clearTranscriptions,
    cleanup,
  }
}