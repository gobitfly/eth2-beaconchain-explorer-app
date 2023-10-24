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

import { Injectable } from '@angular/core'
import 'cordova-plugin-purchase/www/store.d'
import { Platform } from '@ionic/angular'
import { PostMobileSubscription, SubscriptionData } from '../requests/requests'
import { AlertService, PURCHASEUTILS } from '../services/alert.service'
import { ApiService } from '../services/api.service'
import { DEBUG_SETTING_OVERRIDE_PACKAGE, StorageService } from '../services/storage.service'

import { SplashScreen } from '@capacitor/splash-screen'

export const PRODUCT_STANDARD = 'standard'
const MAX_PRODUCT = 'whale'

@Injectable({
	providedIn: 'root',
})
export class MerchantUtils {
	PACKAGES: Package[] = [
		{
			name: 'Free',
			price: '$0.00',
			maxValidators: 100,
			maxTestnetValidators: 100,
			maxBeaconNodes: 1,
			deviceMonitoringHours: 3,
			deviceMonitorAlerts: false,
			noAds: false,
			widgets: false,
			customTheme: false,
			supportUs: false,
			purchaseKey: null,
		},
		{
			name: 'Plankton',
			price: '$1.99',
			maxValidators: 100,
			maxTestnetValidators: 100,
			maxBeaconNodes: 1,
			deviceMonitoringHours: 30 * 24,
			deviceMonitorAlerts: true,
			noAds: true,
			widgets: false,
			customTheme: false,
			supportUs: true,
			purchaseKey: 'plankton',
		},
		{
			name: 'Goldfish',
			price: '$4.99',
			maxValidators: 100,
			maxTestnetValidators: 100,
			maxBeaconNodes: 2,
			deviceMonitoringHours: 30 * 24,
			deviceMonitorAlerts: true,
			noAds: true,
			widgets: true,
			customTheme: true,
			supportUs: true,
			purchaseKey: 'goldfish',
		},
		{
			name: 'Whale',
			price: '$19.99',
			maxValidators: 280,
			maxTestnetValidators: 280,
			maxBeaconNodes: 10,
			deviceMonitoringHours: 30 * 24,
			deviceMonitorAlerts: true,
			noAds: true,
			widgets: true,
			customTheme: true,
			supportUs: true,
			purchaseKey: 'whale',
		},
	]

	currentPlan = PRODUCT_STANDARD // use getCurrentPlanConfirmed instead

	constructor(private alertService: AlertService, private api: ApiService, private platform: Platform, private storage: StorageService) {
		if (!this.platform.is('ios') && !this.platform.is('android')) {
			console.info('merchant is not supported on this platform')
			return
		}

		try {
			this.initProducts()
			this.initCustomValidator()
			this.setupListeners()
		} catch (e) {
			if (e.toString().includes('CdvPurchase is not defined')) {
				console.info('Store purchases are not available on this platform')
			} else {
				console.warn('MerchantUtils cannot be initialized', e)
			}
		}
	}

	private initCustomValidator() {
		CdvPurchase.store.validator = async (
			product: CdvPurchase.Validator.Request.Body,
			callback: CdvPurchase.Callback<CdvPurchase.Validator.Response.Payload>
		) => {
			if (this.restorePurchase && product.id != 'in.beaconcha.mobile') {
				this.restorePurchase = false
				await this.confirmPurchaseOnRemote(product)
			}
			callback({
				ok: true,
				data: {
					collection: [product] as CdvPurchase.VerifiedPurchase[],
					ineligible_for_intro_price: null,
					id: product.id,
					latest_receipt: true,
					transaction: product.transaction,
					warning: null,
				},
			} as CdvPurchase.Validator.Response.SuccessPayload)
		}
	}

	restartApp() {
		SplashScreen.show()
		window.location.reload()
	}

	async refreshToken() {
		let refreshSuccess = (await this.api.refreshToken()) != null
		if (!refreshSuccess) {
			console.log('refreshing token after purchase failed, scheduling retry')
			const loading = await this.alertService.presentLoading('This can take a minute')
			loading.present()
			await this.sleep(35000)
			refreshSuccess = (await this.api.refreshToken()) != null
			if (!refreshSuccess) {
				this.alertService.showError(
					'Purchase Error',
					'We could not confirm your purchase. Please try again later or contact us if this problem persists.',
					PURCHASEUTILS + 2
				)
			}
			loading.dismiss()
		}
	}

	private async registerPurchaseOnRemote(data: SubscriptionData): Promise<boolean> {
		const request = new PostMobileSubscription(data)
		const response = await this.api.execute(request)
		const result = request.wasSuccessful(response, false)

		if (!result) {
			console.log('registering purchase receipt failed', response)
		}

		return result
	}

	private initProducts() {
		let platform = CdvPurchase.Platform.GOOGLE_PLAY
		if (this.platform.is('ios')) {
			platform = CdvPurchase.Platform.APPLE_APPSTORE
		}
		for (let i = 0; i < this.PACKAGES.length; i++) {
			if (this.PACKAGES[i].purchaseKey) {
				CdvPurchase.store.register({
					id: this.PACKAGES[i].purchaseKey,
					platform: platform,
					type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
				} as CdvPurchase.IRegisterProduct)
			}
		}

		CdvPurchase.store.initialize()
	}

	private updatePrice(id, price) {
		for (let i = 0; i < this.PACKAGES.length; i++) {
			if (this.PACKAGES[i].purchaseKey == id) this.PACKAGES[i].price = price
		}
	}

	private restorePurchase = false

	private setupListeners() {
		// General query to all products
		CdvPurchase.store
			.when()
			.productUpdated((p: CdvPurchase.Product) => {
				this.updatePrice(p.id, p.pricing.price)
			})
			.approved((p: CdvPurchase.Transaction) => {
				// Handle the product deliverable
				this.currentPlan = p.products[0].id

				//this.ref.detectChanges();
				return p.verify()
			})
			.verified((p: CdvPurchase.VerifiedReceipt) => p.finish())
		// .receiptUpdated((p: CdvPurchase.Receipt) => {
		// 	console.log(`you now own ${p.hasTransaction }`)
		// })
	}

	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	manageSubscriptions() {
		CdvPurchase.store.manageSubscriptions()
	}

	async restore() {
		this.restorePurchase = true
		await CdvPurchase.store.restorePurchases()
	}

	async purchase(product: string) {
		const offer = CdvPurchase.store.get(product).getOffer()
		const loading = await this.alertService.presentLoading('')
		loading.present()
		CdvPurchase.store.order(offer).then(
			() => {
				this.restorePurchase = true

				setTimeout(() => {
					loading.dismiss()
				}, 1500)
			},
			(e: unknown) => {
				loading.dismiss()
				this.alertService.showError('Purchase failed', `Failed to purchase: ${e}`, PURCHASEUTILS + 1)
				console.warn('purchase error', e)
				this.currentPlan = PRODUCT_STANDARD
			}
		)
	}

	private async confirmPurchaseOnRemote(product) {
		if (product.id == 'in.beaconcha.mobile') {
			this.alertService.showError('Purchase Error', 'Invalid product, try again later or report this issue to us if persistent.', PURCHASEUTILS + 4)
			return
		}

		const isIOS = this.platform.is('ios')
		const purchaseData = {
			currency: product.currency,
			id: product.id,
			priceMicros: product.priceMicros,
			valid: product.valid,
			transaction: {
				id: product.id,
				receipt: isIOS ? product.transaction.appStoreReceipt : product.transaction.purchaseToken,
				type: product.transaction.type,
			},
		}

		const loading = await this.alertService.presentLoading('Confirming, this might take a couple seconds')
		loading.present()

		let result = await this.registerPurchaseOnRemote(purchaseData)
		if (!result) {
			console.log('registering receipt at remote failed, scheduling retry')

			await this.sleep(35000)
			result = await this.registerPurchaseOnRemote(purchaseData)
			if (!result) {
				this.alertService.showError(
					'Purchase Error',
					'We could not confirm your purchase. Please try again later or contact us if this problem persists.',
					PURCHASEUTILS + 3
				)
				loading.dismiss()
				return
			}
			loading.dismiss()
		}

		if (result) await this.refreshToken()

		loading.dismiss()

		if (result) {
			this.alertService.confirmDialog('Upgrade successful', 'App requires a restart. Do you want to restart it now?', 'Restart App', () => {
				this.api.invalidateCache()
				this.restartApp()
			})
		} else {
			this.alertService.showError('Purchase failed', `Failed to make purchase, please try again later.`, PURCHASEUTILS + 4)
		}
	}

	restartDialogLogin() {
		this.alertService.confirmDialog(
			'Login successful',
			'App requires a restart to unlock all your premium features. Do you want to restart it now?',
			'Restart App',
			() => {
				this.api.invalidateCache()
				this.restartApp()
			}
		)
	}

	async getCurrentPlanConfirmed(): Promise<string> {
		if (this.api.debug) {
			const debugPackage = await this.storage.getSetting(DEBUG_SETTING_OVERRIDE_PACKAGE, 'default')
			if (debugPackage != 'default') {
				return debugPackage as string
			}
		}

		const authUser = await this.storage.getAuthUser()
		if (!authUser || !authUser.accessToken) return PRODUCT_STANDARD
		const jwtParts = authUser.accessToken.split('.')
		const claims: ClaimParts = JSON.parse(atob(jwtParts[1]))
		if (claims && claims.package) {
			return claims.package
		}
		return PRODUCT_STANDARD
	}

	async getDefaultTheme(): Promise<string> {
		const authUser = await this.storage.getAuthUser()
		if (!authUser || !authUser.accessToken) return ''
		const jwtParts = authUser.accessToken.split('.')
		const claims: ClaimParts = JSON.parse(atob(jwtParts[1]))
		if (claims && Object.prototype.hasOwnProperty.call(claims, 'theme') && claims.theme) {
			return claims.theme
		}
		return ''
	}

	findProduct(name: string): Package {
		for (let i = 0; i < this.PACKAGES.length; i++) {
			const current = this.PACKAGES[i]
			if (current.purchaseKey == name) {
				return current
			}
		}
		return null
	}

	private async isNotFreeTier() {
		const currentPlan = await this.getCurrentPlanConfirmed()
		return currentPlan != PRODUCT_STANDARD && currentPlan != ''
	}

	async hasPremiumTheming() {
		const currentPlan = await this.getCurrentPlanConfirmed()
		return currentPlan != PRODUCT_STANDARD && currentPlan != '' && currentPlan != 'plankton'
	}

	async hasCustomizableNotifications() {
		return await this.isNotFreeTier()
	}

	async hasAdFree() {
		return await this.isNotFreeTier()
	}

	async hasMachineHistoryPremium() {
		return await this.isNotFreeTier()
	}

	async getCurrentPlanMaxValidator(): Promise<number> {
		const currentPlan = await this.getCurrentPlanConfirmed()
		const currentProduct = this.findProduct(currentPlan)
		if (currentProduct == null) return 100

		const notMainnet = this.api.isNotEthereumMainnet()
		if (notMainnet) return currentProduct.maxTestnetValidators
		return currentProduct.maxValidators
	}

	getHighestPackageValidator(): number {
		const currentProduct = this.findProduct(MAX_PRODUCT)
		if (currentProduct == null) return 100

		const notMainnet = this.api.isNotEthereumMainnet()
		if (notMainnet) return currentProduct.maxTestnetValidators
		return currentProduct.maxValidators
	}
}

interface ClaimParts {
	userID: number
	appID: number
	deviceID: number
	package: string
	exp: number
	iss: string
	theme: string
}

export interface Package {
	name: string
	price: string
	maxValidators: number
	maxTestnetValidators: number
	maxBeaconNodes: number
	deviceMonitoringHours: number
	deviceMonitorAlerts: boolean
	noAds: boolean
	widgets: boolean
	customTheme: boolean
	supportUs: boolean
	purchaseKey: string
}
