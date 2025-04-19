const padding = '='.charCodeAt(0)
const alphabet = new TextEncoder()
  .encode('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/')
const rAlphabet = new Uint8Array(128).fill(64) // alphabet.length
alphabet.forEach((byte, i) => rAlphabet[byte] = i)

export function encodeBase64(data: ArrayBuffer | Uint8Array | string): string {
  let processedData: Uint8Array

  if (typeof data === 'string') {
    processedData = new TextEncoder().encode(data)
  }
  else if (data instanceof ArrayBuffer) {
    processedData = new Uint8Array(data).slice()
  }
  else {
    processedData = data.slice()
  }

  // Calculate the size needed for base64 encoding (4 bytes for every 3 bytes of input)
  const calcSizeBase64 = (length: number): number => Math.ceil(length / 3) * 4

  // Base64 encoding implementation
  const encode = (input: Uint8Array, output: Uint8Array, alphabet: Uint8Array, padding: number): void => {
    const len = input.length
    let outIdx = 0
    let i = 0

    // Process input in groups of 3 bytes
    for (; i + 2 < len; i += 3) {
      const triplet = (input[i] << 16) | (input[i + 1] << 8) | input[i + 2]
      output[outIdx++] = alphabet[(triplet >> 18) & 63]
      output[outIdx++] = alphabet[(triplet >> 12) & 63]
      output[outIdx++] = alphabet[(triplet >> 6) & 63]
      output[outIdx++] = alphabet[triplet & 63]
    }

    // Handle remaining bytes
    if (i < len) {
      if (i + 1 < len) {
        // 2 bytes remaining
        const triplet = (input[i] << 16) | (input[i + 1] << 8)
        output[outIdx++] = alphabet[(triplet >> 18) & 63]
        output[outIdx++] = alphabet[(triplet >> 12) & 63]
        output[outIdx++] = alphabet[(triplet >> 6) & 63]
        output[outIdx++] = padding
      }
      else {
        // 1 byte remaining
        const triplet = input[i] << 16
        output[outIdx++] = alphabet[(triplet >> 18) & 63]
        output[outIdx++] = alphabet[(triplet >> 12) & 63]
        output[outIdx++] = padding
        output[outIdx++] = padding
      }
    }
  }

  const outputSize = calcSizeBase64(processedData.length)
  const output = new Uint8Array(outputSize)
  encode(processedData, output, alphabet, padding)

  return new TextDecoder().decode(output)
}
