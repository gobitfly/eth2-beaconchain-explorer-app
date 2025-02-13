// vite.config.mts
import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
	const isTest = mode === 'test'

	return {
		plugins: isTest ? [angular()] : [],
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
		build: {
			commonjsOptions: {
				include: ['cordova-plugin-purchase'],
				transformMixedEsModules: true,
			},
		},
		optimizeDeps: {
			exclude: ['highcharts', 'ethereum-blockies', 'cordova-plugin-purchase'],
			include: ['@ionic/core'],
		},
		test: isTest
			? {
					globals: true,
					environment: 'jsdom',
					setupFiles: ['src/test-setup.ts'],
					include: ['**/*.spec.ts'],
					reporters: ['default'],
					//   browser: {
					//     enabled: true,
					//     name: 'chromium',
					//     headless: false, // set to true in CI
					//     provider: 'playwright',
					//   },
					deps: {
						// Force Vitest to inline these packages so that the JIT compiler isn’t “lost”
						inline: ['@angular/compiler', '@angular/cdk', '@angular/cdk/collections'],
					},
				}
			: undefined,
		define: {
			'import.meta.vitest': isTest,
		},
	}
})
