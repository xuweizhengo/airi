// TODO: move to shared package
type WaveDirection = 'up' | 'down'

export function generateSineWavePath(
  width: number,
  height: number,
  amplitude: number,
  waveLength: number,
  direction: WaveDirection,
): string {
  const points: string[] = []

  // Calculate the number of complete waves to fill the SVG width
  const numberOfWaves = Math.ceil(width / waveLength)

  // Total width covered by all complete waves
  const totalWavesWidth = numberOfWaves * waveLength

  // Step size in pixels for generating points (1px for precision)
  const step = 1

  // Determine base Y position based on direction
  const baseY = direction === 'up' ? amplitude : height - amplitude

  // Start the path at the base Y position
  points.push(`M 0 ${baseY}`)

  // Generate points for the sine wave
  const factor = Math.PI * 2 / waveLength
  for (let x = 0; x <= totalWavesWidth; x += step) {
    const deltaY = amplitude * Math.sin(factor * x)
    const y = direction === 'up' ? baseY - deltaY : baseY + deltaY
    points.push(`L ${x} ${y}`)
  }

  // Close the path for filling
  const closeY = direction === 'up' ? height : 0
  points.push(`L ${totalWavesWidth} ${closeY}`)
  points.push(`L 0 ${closeY} Z`)

  return points.join(' ')
}
