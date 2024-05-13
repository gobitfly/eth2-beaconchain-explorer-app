/*
 *  // Copyright (C) 2020 - 2021 Bitfly GmbH
 *  // Manuel Caspari (manuel@bitfly.at)
 *  //
 *  // This file is part of Beaconchain Dashboard.
 *  //
 *  // Beaconchain Dashboard is free software: you can redistribute it and/or modify
 *  // it under the terms of the GNU General Public License as published by
 *  // the Free Software Foundation, either version 3 of the License, or
 *  // (at your option) any later version.
 *  //
 *  // Beaconchain Dashboard is distributed in the hope that it will be useful,
 *  // but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  // GNU General Public License for more details.
 *  //
 *  // You should have received a copy of the GNU General Public License
 *  // along with Beaconchain Dashboard.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Component } from '@angular/core'
import { StorageService } from '../services/storage.service'
import { SyncService } from '../services/sync.service'
import FirebaseUtils from '../utils/FirebaseUtils'
import { MerchantUtils } from '../utils/MerchantUtils'
import ThemeUtils from '../utils/ThemeUtils'
import { Toast } from '@capacitor/toast'
@Component({
	selector: 'app-tabs',
	templateUrl: 'tabs.page.html',
	styleUrls: ['tabs.page.scss'],
})
export class TabsPage {
	constructor(
		private firebaseUtils: FirebaseUtils,
		private sync: SyncService,
		private storage: StorageService,
		private merchant: MerchantUtils,
		private theme: ThemeUtils
	) {}

	ionViewDidEnter() {
		setTimeout(() => this.preload(), 500)
	}

	private preload() {
		// lazy initiating firebase token exchange
		this.firebaseUtils.registerPush() // just initialize the firebaseutils service

		// lazy sync & notification token update
		setTimeout(async () => {
			this.firebaseUtils.pushLastTokenUpstream(false)
			await this.sync.mightSyncUpAndSyncDelete()
			await this.sync.syncAllSettings()
		}, 5000)

		// lazy ionic speed optimizations
		setTimeout(() => {
			this.hackyIonicPreloads()
		}, 200)

		// Validate licence and reset theme accordingly
		setTimeout(() => {
			this.validateTheming()
		}, 600)
	}

	private async validateTheming() {
		const defaultTheme = await this.merchant.getDefaultTheme()
		const stored = await this.storage.getItem('setting_default_theme')
		if (defaultTheme != stored && defaultTheme != '') {
			this.storage.setItem('setting_default_theme', defaultTheme)
			this.theme.undoColor()
			setTimeout(async () => {
				this.theme.toggle(await this.theme.isDarkThemed(), true, defaultTheme)
				Toast.show({
					text: 'Switched to Ethpool theme',
				})
			}, 250)
		}

		const hasTheming = await this.merchant.hasPremiumTheming()
		if (!hasTheming && this.theme.currentThemeColor != 'gnosis') {
			this.theme.resetTheming()
		}
	}

	private hackyIonicPreloads() {
		// lazy preload some components needed by other tabs
		const preloadArea: HTMLElement = document.getElementById('preload')
		preloadArea.appendChild(document.createElement('ion-list-header'))
		preloadArea.appendChild(document.createElement('app-message'))
		preloadArea.appendChild(document.createElement('ion-select-option'))
		preloadArea.appendChild(document.createElement('ion-toggle'))
		preloadArea.appendChild(document.createElement('app-validator'))
		preloadArea.appendChild(document.createElement('ion-searchbar'))
		preloadArea.appendChild(document.createElement('app-offline'))

		// optimize ion-icon loading by preloading every icon used in preferences / validators page
		const icons = document.createElement('div')
		icons.innerHTML =
			'<ion-icon name="telescope-outline"></ion-icon>' +
			'<ion-icon name="close-circle-outline"></ion-icon>' +
			'<ion-icon name="sync-circle-outline"></ion-icon>' +
			'<ion-icon name="bookmark-outline"></ion-icon>' +
			'<ion-icon name="arrow-up-circle-outline"></ion-icon>' +
			'<ion-icon name="snow-outline"></ion-icon>' +
			'<ion-icon name="moon-outline"></ion-icon>' +
			'<ion-icon name="wallet-outline"></ion-icon>' +
			'<ion-icon name="log-in-outline"></ion-icon>' +
			'<ion-icon name="notifications-outline"></ion-icon>' +
			'<ion-icon name="chevron-down-circle-outline"></ion-icon>' +
			'<ion-icon name="close-circle-outline"></ion-icon>' +
			'<ion-icon name="information-circle-outline"></ion-icon>' +
			'<ion-icon name="remove-circle-outline"></ion-icon>' +
			'<ion-icon name="refresh-circle-outline"></ion-icon>' +
			'<ion-icon name="cube-outline"></ion-icon>' +
			'<ion-icon name="bonfire-outline"></ion-icon>' +
			'<ion-icon name="git-branch"></ion-icon>' +
			'<ion-icon name="planet-outline"></ion-icon>' +
			'<ion-icon name="heart-outline"></ion-icon>' +
			'<ion-icon name="bulb-outline"></ion-icon>' +
			'<ion-icon name="log-out-outline"></ion-icon>' +
			'<ion-icon name="bug-outline"></ion-icon>' +
			'<ion-icon name="heart"></ion-icon>'
		preloadArea.appendChild(icons)
	}
}
