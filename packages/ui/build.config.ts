import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    { builder: 'mkdist', input: './src/components/', outDir: './dist', pattern: ['**/*.vue', '!**/*.story.vue'], loaders: ['vue'] },
    { builder: 'mkdist', input: './src/components/', outDir: './dist', pattern: '**/*.ts', format: 'esm', loaders: ['js'] },
    // { builder: 'mkdist', input: './src/stores/', outDir: './dist/stores', pattern: '**/*.ts', format: 'esm', loaders: ['js'] },
  ],
  declaration: true,
  sourcemap: true,
  clean: true,
})
