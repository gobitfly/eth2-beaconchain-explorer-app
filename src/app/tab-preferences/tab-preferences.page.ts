/*
 *  // Copyright (C) 2020 - 2024 bitfly explorer GmbH
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

import { Component, computed } from '@angular/core'
import { ApiService, capitalize } from '../services/api.service'
import { StorageService } from '../services/storage.service'
import { PreferredCurrency, UnitconvService } from '../services/unitconv.service'
import { OAuthUtils } from '../utils/OAuthUtils'
import ClientUpdateUtils from '../utils/ClientUpdateUtils'
import ThemeUtils from '../utils/ThemeUtils'
import { findConfigForKey } from '../utils/NetworkData'
import { ModalController } from '@ionic/angular'
import { HelppagePage } from '../pages/helppage/helppage.page'
import Unit, { MAPPING } from '../utils/EthereumUnits'
import { AlertController } from '@ionic/angular'

import FirebaseUtils from '../utils/FirebaseUtils'
import { Platform } from '@ionic/angular'
import { AlertService } from '../services/alert.service'
import { LicencesPage } from '../pages/licences/licences.page'
import { SubscribePage } from '../pages/subscribe/subscribe.page'
import { MerchantUtils } from '../utils/MerchantUtils'
import { NotificationBase } from './notification-base'

import { Browser } from '@capacitor/browser'
import { Toast } from '@capacitor/toast'
import { ClientsPage } from '../pages/clients/clients.page'
import FlavorUtils from '../utils/FlavorUtils'
import V2Migrator from '../utils/V2Migrator'
import { DashboardUtils } from '../utils/DashboardUtils'
import { AuthUser, AuthUserv2 } from '../models/StorageTypes'
import { ValidatorUtils } from '../utils/ValidatorUtils'
import { AppUpdater } from '../utils/AppUpdater'
@Component({
	selector: 'app-tab3',
	templateUrl: 'tab-preferences.page.html',
	styleUrls: ['tab-preferences.page.scss'],
})
export class Tab3Page {
	darkMode: boolean

	network = 'main'

	allTestNetworks: string[][]

	authUser: AuthUserv2 | AuthUser

	updateChannel: string

	allCurrencies: Array<Array<[string] | [string]>>

	appVersion: string

	debug = true

	snowing: boolean

	themeColor: string

	premiumLabel = computed(() => {
		if (this.merchant.getUsersSubscription()?.product_name) {
			return ' - ' + capitalize(this.merchant.getUsersSubscription().product_name)
		} else {
			return ''
		}
	})

	protected package = ''
	protected currentFiatCurrency: string

	protected currentYear = new Date().getFullYear()

	constructor(
		protected api: ApiService,
		protected oauth: OAuthUtils,
		public theme: ThemeUtils,
		public unit: UnitconvService,
		protected storage: StorageService,
		protected updateUtils: ClientUpdateUtils,
		protected modalController: ModalController,
		protected alertController: AlertController,
		protected firebaseUtils: FirebaseUtils,
		protected dashboardUtils: DashboardUtils,
		public platform: Platform,
		protected alerts: AlertService,
		protected merchant: MerchantUtils,
		public notificationBase: NotificationBase,
		private flavor: FlavorUtils,
		protected v2migrator: V2Migrator,
		protected validatorUtils: ValidatorUtils,
		protected appUpdater: AppUpdater
	) {}

	ngOnInit() {
		this.unit.getCurrentConsFiat().then((result) => {
			this.currentFiatCurrency = result
		})
		this.theme.isDarkThemed().then((result) => (this.darkMode = result))

		this.theme.getThemeColor().then((result) => (this.themeColor = result))

		this.updateUtils.getClient('ROCKETPOOL').then((result) => {
			this.notificationBase.setClientToggleState('ROCKETPOOL', result && result.toUpperCase() == 'ROCKETPOOL')
		})
		this.updateUtils.getClient('MEV-BOOST').then((result) => {
			this.notificationBase.setClientToggleState('MEV-BOOST', result && result.toUpperCase() == 'MEV-BOOST')
		})
		this.updateUtils.getUpdateChannel().then((result) => (this.updateChannel = result))

		this.theme.isWinterEnabled().then((result) => (this.snowing = result))

		this.allCurrencies = this.getAllCurrencies()
		this.api.getAllTestNetNames().then((result) => {
			this.allTestNetworks = result
		})

		this.appUpdater.getFormattedCurrentVersion().then((result) => {
			this.appVersion = result
		})

		this.flavor.isBetaFlavor().then((result) => {
			if (result) {
				this.package = 'INTERNAL BETA'
			}
		})

		this.flavor.isNoGoogleFlavor().then((result) => {
			if (result) {
				this.package = 'Googleless Edition'
			}
		})

		this.notificationBase.disableToggleLock()
	}

	goToNotificationPage() {
		this.openBrowser(this.api.getBaseUrl() + "/notifications#dashboards", false)
	}

	async openClientsPage(identifier: string) {
		const modal = await this.modalController.create({
			component: ClientsPage,
			cssClass: 'my-custom-class',
			componentProps: {
				clientIdentifier: identifier,
			},
		})

		return await modal.present()
	}

	themeColorLock = false
	changeThemeColor() {
		this.themeColorLock = true
		this.theme.undoColor()
		setTimeout(() => {
			this.theme.toggle(this.darkMode, true, this.themeColor)
			this.themeColorLock = false
		}, 250)
	}

	widgetSetupInfo() {
		if (this.merchant.userInfo()?.premium_perks.mobile_app_widget != true) {
			this.openUpgrades()
			return
		}

		let tutorialText = 'MISSINGNO'
		if (this.platform.is('ios')) {
			tutorialText =
				'1. Go to your homescreen<br/>' +
				'2. Hold down on an empty space<br/>' +
				'3. On the top right corner, click the + symbol<br/>' +
				'4. Scroll down and select Beaconchain Dashboard and chose your widget<br/>' +
				'<br/>You can configure your widget by holding down on the widget.<br/><br/>' +
				'Widgets are only available on iOS 14 or newer<br/><br/>' +
				'If you just purchased a premium package and the widget does not show any data, try deleting it and adding the widget again.'
		} else {
			tutorialText =
				'1. Go to your homescreen<br/>' +
				'2. Hold down on an empty space<br/>' +
				"3. Click on 'Widgets'<br/>" +
				'4. Scroll down and select Beaconchain Dashboard and chose your widget<br/><br/>' +
				'If you just purchased a premium package and the widget does not show any data, try deleting it and adding the widget again.'
		}

		this.alerts.showInfo('Widget Setup', tutorialText, 'bigger-alert')
	}

	ionViewWillEnter() {
		this.storage.getAuthUserv2().then((result) => (this.authUser = result))
		this.debug = this.api.debug
		this.network = this.api.getNetworkName()
	}

	private getAllCurrencies() {
		const erg: Array<Array<[string] | [string]>> = []
		MAPPING.forEach((value: Unit, key) => {
			if (value.settingName) {
				erg.push([[value.settingName], [key]])
			}
		})
		return erg
	}

	darkModeToggle() {
		this.theme.toggle(this.darkMode)
	}

	overrideDisplayCurrency: PreferredCurrency = null
	private changeCurrencyLocked = false
	async changeCurrency() {
		if (this.changeCurrencyLocked) return
		this.changeCurrencyLocked = true

		await this.api.deleteAllHardStorageCacheKeyContains('coinbase')
		this.overrideDisplayCurrency = this.unit.pref

		await this.unit.changeCurrency(this.currentFiatCurrency)
		this.unit.save()

		setTimeout(() => {
			this.changeCurrencyLocked = false
			this.overrideDisplayCurrency = null
		}, 2500)
	}

	openOAuth() {
		this.oauth.login().then((success) => {
			if (success) {
				this.storage.getAuthUserv2().then((result) => (this.authUser = result))
				this.dashboardUtils.dashboardAwareListener.notifyAll()
			}
		})
	}

	rateApp() {
		if (this.platform.is('android')) {
			window.open('market://details?id=in.beaconcha.mobile', '_system', 'location=yes')
		} else {
			window.open('itms-apps://itunes.apple.com/app/id1541822121', '_system', 'location=yes')
		}
	}

	changeUpdateChannel() {
		this.updateUtils.setUpdateChannel(this.updateChannel)
		this.updateUtils.checkAllUpdates()
	}

	async openBrowser(link: string, native = false) {
		if (native) {
			window.open(link, '_system', 'location=yes')
		} else {
			await Browser.open({ url: link, toolbarColor: '#2f2e42' })
		}
	}

	logout() {
		this.alerts.confirmDialog('Confirm logout', 'Notifications will stop working if you sign out. Continue?', 'Logout', () => {
			this.confirmLogout()
		})
	}

	count = 0
	notAnEasterEgg() {
		this.count++
		if (this.count % 3 != 0) return
		const random = Math.floor(Math.random() * 2)
		switch (random) {
			case 0: {
				const currentSnow = this.theme.snow()
				setTimeout(() => {
					this.theme.stopSnow(currentSnow)
				}, 45000)
				break
			}
			case 1:
				this.theme.silvesterFireworks()
				break
		}
	}

	confirmLogout() {
		this.storage.removeAuthUser()
		this.storage.setDashboardID(null)
		this.merchant.clearTempUserInfo()
		this.authUser = null
		this.dashboardUtils.dashboardAwareListener.notifyAll()
		Toast.show({
			text: 'Logged out',
		})
	}

	async changeNetwork() {
		await changeNetwork(
			this.network,
			this.storage,
			this.api,
			this.unit,
			this.theme,
			this.alerts,
			this.merchant,
			false,
			this.dashboardUtils
		)
		this.currentFiatCurrency = await this.unit.getCurrentConsFiat()
	}

	async openIconCredit() {
		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'App Icon Credit',
			message:
				'Satellite dish by Font Awesome.<br/>Licensed under the Creative Commons Attribution 4.0 International.<br/><a href="https://fontawesome.com/license">https://fontawesome.com/license</a>',
			buttons: ['OK'],
		})

		await alert.present()
	}

	async openUpgrades() {
		const modal = await this.modalController.create({
			component: SubscribePage,
			cssClass: 'my-custom-class',
		})
		return await modal.present()
	}

	async openFAQ() {
		const modal = await this.modalController.create({
			component: HelppagePage,
			cssClass: 'my-custom-class',
		})
		return await modal.present()
	}

	async openOpenSource() {
		const modal = await this.modalController.create({
			component: LicencesPage,
			cssClass: 'my-custom-class',
		})
		return await modal.present()
	}

	manageSubs() {
		this.merchant.manageSubscriptions()
	}

	toggleSnow() {
		this.theme.toggleWinter(this.snowing)
	}

	versionClickCount = 0
	openLogSessionDialog() {
		this.versionClickCount++
		if (this.versionClickCount % 3 != 0) return
		this.openLogSessionDialogReally()
	}

	async openLogSessionDialogReally() {
		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'Logs Viewer',
			message: 'For which session would you like to see logs?',
			buttons: [
				{
					text: 'Current Session',
					handler: () => {
						this.storage.openLogSession(this.modalController, 0)
					},
				},
				{
					text: 'Last Session',
					handler: () => {
						this.storage.openLogSession(this.modalController, 1)
					},
				},
				{
					text: 'Last Last Session',
					handler: () => {
						this.storage.openLogSession(this.modalController, 2)
					},
				},
				{
					text: 'Cancel',
				},
			],
		})

		await alert.present()
	}
}

export async function changeNetwork(
	network: string,
	storage: StorageService,
	api: ApiService,
	unit: UnitconvService,
	theme: ThemeUtils,
	alertService: AlertService,
	merchant: MerchantUtils,
	forceThemeSwitch: boolean,
	dashboardUtils: DashboardUtils
) {
	const darkTheme = await theme.isDarkThemed()

	const newConfig = findConfigForKey(network)
	await storage.clearCache()
	//await api.clearNetworkCache()

	await storage.setNetworkPreferences(newConfig)
	await api.initialize()
	await unit.networkSwitchReload()
	dashboardUtils.dashboardAwareListener.notifyAll()
	//await this.unit.changeCurrency(this.currentFiatCurrency)

	const currentTheme = theme.currentThemeColor

	if (forceThemeSwitch && (currentTheme == '' || currentTheme == 'gnosis')) {
		theme.undoColor()
		setTimeout(() => {
			theme.toggle(darkTheme, true, api.isGnosis() ? 'gnosis' : '')
		}, 50)
	} else {
		await merchant.initialize
		const hasTheming = merchant.userInfo()?.premium_perks.mobile_app_custom_themes == true
		if (hasTheming) return
		if (currentTheme == '' && !api.isGnosis()) return
		if (currentTheme == 'gnosis' && api.isGnosis()) return
		alertService.confirmDialog('Switch App Theme', 'Do you want to switch to the free ' + api.getNetwork().name + ' App theme?', 'Sure', () => {
			theme.undoColor()
			setTimeout(() => {
				theme.toggle(darkTheme, true, api.isGnosis() ? 'gnosis' : '')
			}, 50)
		})
	}
}
