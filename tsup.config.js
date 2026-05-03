import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        server: 'src/server.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourceMap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    // No external deps- this package is zero-dependency and should be bundled with everything it needs
})