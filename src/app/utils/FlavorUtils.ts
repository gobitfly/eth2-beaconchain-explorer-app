import { Injectable } from '@angular/core'

import { App } from '@capacitor/app'

@Injectable({
	providedIn: 'root',
})
export default class FlavorUtils {
	constructor() {}

	async isBetaFlavor(): Promise<boolean> {
		const info = await App.getInfo()
		return info.id.indexOf('beta') > 0
	}

	async isNoGoogleFlavor(): Promise<boolean> {
		const info = await App.getInfo()
		return info.id.indexOf('nogoo') > 0
	}
}
