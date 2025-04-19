import type { CreateProviderOptions, TranscriptionProviderWithExtraOptions } from '@xsai-ext/shared-providers'
import type { GenerateTranscriptionResult } from '@xsai/generate-transcription'
import type { CommonRequestOptions } from '@xsai/shared'
import type { LoadOptionProgressCallback, LoadOptions, WorkerMessageEvent } from './types/transcribe'

import { merge } from '@xsai-ext/shared-providers'

import { encodeBase64 } from './utils/base64'

export type Loadable<P, T = string, T2 = undefined> = P & {
  loadTranscribe: (model: (string & {}) | T, options?: T2) => Promise<void>
  terminateTranscribe: () => void
}

function createTranscribeProvider<T extends string, T2 extends Omit<CommonRequestOptions, 'baseURL' | 'model'> & LoadOptions>(createOptions: CreateProviderOptions): Loadable<TranscriptionProviderWithExtraOptions<T, T2>, T, T2> {
  let worker: Worker
  let isReady = false

  function loadModel(model: (string & {}) | T, options?: T2) {
    return new Promise<void>((resolve, reject) => {
      let onProgress: LoadOptionProgressCallback | undefined
      if (options != null && 'onProgress' in options && options.onProgress != null) {
        onProgress = options?.onProgress
        delete options?.onProgress
      }

      try {
        const workerURL = new URL(createOptions.baseURL)

        if (!worker)
          worker = new Worker(workerURL.searchParams.get('worker-url')!, { type: 'module' })
        if (!worker)
          throw new Error('Worker not initialized')

        worker.postMessage({ type: 'load', data: { modelId: model, task: 'feature-extraction', options } } satisfies WorkerMessageEvent)
      }
      catch (err) {
        reject(err)
      }

      worker.addEventListener('message', (event: MessageEvent<WorkerMessageEvent>) => {
        switch (event.data.type) {
          case 'error':
            reject(event.data.data.error)
            break
          case 'status':
            if (event.data.data.status === 'ready') {
              isReady = true
              resolve()
            }

            break
          case 'progress':
            if (onProgress != null && typeof onProgress === 'function') {
              onProgress(event.data.data.progress)
            }

            break
        }
      })
    })
  }

  return {
    transcription: (model, options) => Object.assign(createOptions, {
      fetch: (_, init: RequestInit) => {
        return new Promise<Response>((resolve, reject) => {
          loadModel(model, options).then(() => {
            if (!worker || !isReady) {
              reject(new Error('Model not loaded'))
              return
            }

            worker.addEventListener('error', (event: ErrorEvent) => {
              reject(event)
            })

            let file: Blob
            let fileName: string | undefined
            let formData: FormData

            try {
              // Extract the FormData from the request
              formData = init.body as FormData
              file = formData.get('file') as Blob
              fileName = formData.get('fileName') as string | undefined

              if (!file) {
                reject(new Error('No file provided'))
                return
              }
            }
            catch (err) {
              reject(err)
              return
            }

            let errored = false
            let resultDone = false

            debugger

            worker.addEventListener('message', (event: MessageEvent<WorkerMessageEvent>) => {
              switch (event.data.type) {
                case 'error':
                  errored = true
                  reject(event.data.data.error)
                  break
                case 'transcribeResult':
                  console.log('event', event)

                  resultDone = true

                  // eslint-disable-next-line no-case-declarations
                  const result = { text: event.data.data.output.text } satisfies GenerateTranscriptionResult
                  // eslint-disable-next-line no-case-declarations
                  const encoder = new TextEncoder()

                  resolve(new Response(encoder.encode(JSON.stringify(result))))

                  break
                default:
                  console.log('event', event)
                  break
              }
            })

            if (!errored && !resultDone) {
              // Convert blob to arrayBuffer for processing
              file.arrayBuffer().then((audioData) => {
                const base64 = btoa(
                  new Uint8Array(audioData)
                    .reduce((data, byte) => data + String.fromCharCode(byte), ''),
                )

                worker.postMessage({
                  type: 'transcribe',
                  data: {
                    audio: base64,
                    options: {
                      ...options,
                      fileName,
                    },
                  },
                } satisfies WorkerMessageEvent)
              }).catch(err => reject(err))
            }
          })
        })
      },
    }) as unknown as Omit<CommonRequestOptions, 'baseURL'> & Partial<T2> as any,
    loadTranscribe: loadModel,
    terminateTranscribe: () => {
      if (worker) {
        worker.terminate()
        worker = undefined
      }
    },
  }
}

export function createTransformers(options: { transcribeWorkerURL: string }) {
  return merge(
    createTranscribeProvider<'Xenova/whisper-base', Omit<CreateProviderOptions, 'baseURL'> & LoadOptions>({ baseURL: `xsai-provider-ext:///?worker-url=${options.transcribeWorkerURL}&other=true` }),
  )
}
