import { Injectable } from '@angular/core'

import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

@Injectable({
	providedIn: 'root',
})
export default class FlavorUtils {
	async isBetaFlavor(): Promise<boolean> {
		if(!Capacitor.isNativePlatform()) return false
		const info = await App.getInfo()
		return info.id.indexOf('beta') > 0
	}

	async isNoGoogleFlavor(): Promise<boolean> {
		if (!Capacitor.isNativePlatform()) return false
		const info = await App.getInfo()
		return info.id.indexOf('nogoo') > 0
	}
}
