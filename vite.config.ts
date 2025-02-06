import { defineConfig } from 'vite'

export default defineConfig({
	server: {
		port: 8100,
		strictPort: true,
		allowedHosts: ['all'],
	},
	preview: {
		port: 8100,
		strictPort: true,
		allowedHosts: ['all'],
	},

	optimizeDeps: {
		exclude: ['highcharts', 'ethereum-blockies', 'magic-snowflakes'],
		include: ['@ionic/core'],
		esbuildOptions: {
			format: 'esm',
		},
	},
})
