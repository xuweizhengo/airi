import { presetChromatic } from '@proj-airi/unocss-preset-chromatic'
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  presets: [
    presetWind3(),
    presetAttributify(),
    presetTypography(),
    presetWebFonts({
      fonts: {
        'sans': 'DM Sans',
        'serif': 'DM Serif Display',
        'mono': 'DM Mono',
        'retro-mono': {
          name: 'Departure Mono',
          provider: 'none',
        },
      },
      timeouts: {
        warning: 5000,
        failure: 10000,
      },
    }),
    presetIcons({
      scale: 1.2,
    }),
    presetChromatic({
      baseHue: 220.25, // default hue offset
      colors: {
        primary: 0,
        secondary: 180, // to create a complementary color scheme
      },
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  safelist: 'prose prose-sm m-auto text-left'.split(' '),
})
