import type { ReaderLike } from 'clustr'

import { readGraphemeClusters } from 'clustr'

interface Punctuation {
  threshold: number
  priority: number
  keep?: boolean
}

const PUNCTUATIONS = [
  {
    chars: '\n',
    threshold: 0, // No threshold, always split
    priority: 0, // Highest priority, no threshold
  },
  {
    chars: '。',
    threshold: 60,
    priority: 10,
  },
  {
    chars: '？！',
    threshold: 60,
    priority: 10,
    keep: true, // Keep punctuations here as they could affect the tone
  },
  {
    chars: '…⋯',
    threshold: 50,
    priority: 20,
  },
  {
    chars: ';；',
    threshold: 45,
    priority: 30,
  },
  {
    chars: '，、—：',
    threshold: 35,
    priority: 40,
  },
]
  .reduce((punctuations, t) => {
    t.chars.split('').forEach((c) => {
      punctuations[c] = {
        threshold: t.threshold,
        priority: t.priority,
        keep: t.keep,
      }
    })
    return punctuations
  }, {} as Record<string, Punctuation>)

export async function* ttsInputPreProcessor(reader: ReaderLike) {
  const thresholdFactors = [0, 0, 0.5, 1] // Simply adaptive: Boost and efficiency

  const iterator = readGraphemeClusters(reader)

  let buffer: string[] = []
  let bufferSize = 0

  let lastPunctuation: [index: number, punctuation: Punctuation] | undefined
  let chunkCount = 0

  for await (const clustr of iterator) {
    buffer.push(clustr)
    bufferSize += clustr.length

    if (clustr.length > 1) {
      // Not punctuations we are interested in
      continue
    }

    const punctuation = PUNCTUATIONS[clustr]
    if (!punctuation) {
      continue
    }

    if (buffer.length === 0) {
      // Skip the leading punctuation
    }
    else if (lastPunctuation && punctuation.priority > lastPunctuation[1].priority) {
      const shifted = buffer.splice(0, lastPunctuation[0] + 1)
      if (!lastPunctuation[1].keep) {
        shifted.pop()
      }
      const chunk = shifted.join('')
      // eslint-disable-next-line no-console
      console.debug(`[TTS SEGMENTER] Chunk #${chunkCount} = ${JSON.stringify(chunk)}, Reason = Priority regression`)
      chunkCount++
      yield chunk

      lastPunctuation = undefined
      bufferSize -= chunk.length
    }
    else if (bufferSize >= Math.floor(punctuation.threshold * (chunkCount < thresholdFactors.length ? thresholdFactors[chunkCount] : 1))) {
      if (!punctuation.keep) {
        buffer.pop()
      }
      const chunk = buffer.join('')
      // eslint-disable-next-line no-console
      console.debug(`[TTS SEGMENTER] Chunk #${chunkCount} = ${JSON.stringify(chunk)}, Reason = Threshold met`)
      chunkCount++
      yield chunk

      lastPunctuation = undefined
      buffer = []
      bufferSize = 0
    }
    else {
      lastPunctuation = [buffer.length - 1, punctuation]
    }
  }

  if (buffer.length > 0) {
    const chunk = buffer.join('')
    // eslint-disable-next-line no-console
    console.debug(`[TTS SEGMENTER] Chunk #${chunkCount} = ${JSON.stringify(chunk)}, Reason = Flush buffer`)
    yield chunk
  }
}
