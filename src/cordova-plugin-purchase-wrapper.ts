// src/cordova-plugin-purchase-wrapper.ts
// Import the default export from our ambient module.
import CdvPurchase from 'cordova-plugin-purchase'

const cdvPurchase = (window as any).CdvPurchase as typeof CdvPurchase | undefined

if (!cdvPurchase) {
	console.warn('CdvPurchase global is not available. Ensure the plugin is loaded.')
}

export default cdvPurchase
