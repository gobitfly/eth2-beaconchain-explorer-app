/// <reference types="vitest" />

import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
	const isTest = mode === 'test'

	return {
		plugins: isTest ? [angular()] : [],
		// resolve: {
		// 	alias: {
		// 		// When 'cordova-plugin-purchase' is imported, use your wrapper.
		// 		'cordova-plugin-purchase': resolve(__dirname, 'src/cordova-plugin-purchase-wrapper.ts'),
		// 	},
		// },
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
			esbuildOptions: {
				format: 'esm',
			},
		},
		test: isTest
			? {
					globals: true,
					environment: 'jsdom',
					setupFiles: ['src/test-setup.ts'],
					include: ['**/*.spec.ts'],
					reporters: ['default'],
					deps: {
						inline: ['@angular/compiler', '@angular/cdk'],
					},
				}
			: undefined,
		define: {
			'import.meta.vitest': isTest,
		},
	}
})
