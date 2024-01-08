import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	clean: true,
	format: ['cjs'],
	outDir: 'dist',
	target: 'es2021',
	platform: 'node',
	bundle: true,
	skipNodeModulesBundle: false,
});
