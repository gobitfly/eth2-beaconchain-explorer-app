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

import { computed, Injectable, Signal, signal, WritableSignal } from '@angular/core'
import 'cordova-plugin-purchase/www/store.d'
import { Platform } from '@ionic/angular'
import { SubscriptionData } from '../requests/requests'
import { AlertService, PURCHASEUTILS } from '../services/alert.service'
import { ApiService } from '../services/api.service'
import { StorageService } from '../services/storage.service'

import { SplashScreen } from '@capacitor/splash-screen'
import { V2Me, V2PurchaseValidation } from '../requests/v2-user'
import { UserInfo, UserSubscription } from '../requests/types/user'

export const PRODUCT_STANDARD = 'standard'
const MAX_PRODUCT = 'whale'

@Injectable({
	providedIn: 'root',
})
export class MerchantUtils {
	DEPRECATED_PACKAGES = [
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
	]

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

	//currentPlan = PRODUCT_STANDARD // use getCurrentPlanConfirmed instead

	purchaseIntent = '' // temp workaround until new api is live

	userInfo: WritableSignal<UserInfo | null> = signal(null)

	constructor(private alertService: AlertService, private api: ApiService, private platform: Platform, private storage: StorageService) {
		if (!this.platform.is('ios') && !this.platform.is('android')) {
			console.info('merchant is not supported on this platform')
			return
		}

		this.init()
	}

	public async getUserInfo(forceRefresh: boolean = false, errHandler: (err) => void = () => {}) {
		if (!forceRefresh) {
			this.userInfo.set(await (this.storage.getObject('userInfo') as Promise<UserInfo | null>))
		}

		if (await this.storage.getAuthUserv2()) {
			await this.api.set(new V2Me().withAllowedCacheResponse(!forceRefresh), this.userInfo, (err) => {
				console.warn('failed to get user info', err)
				errHandler(err)
			})
			this.storage.setObject('userInfo', this.userInfo())
		}
	}

	private async init() {
		try {
			this.getUserInfo()
			await this.initProducts()
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
			if (this.restorePurchase) {
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


	private async registerPurchaseOnRemote(data: SubscriptionData): Promise<boolean> {
		const request = new V2PurchaseValidation(data)
		const response = await this.api.execute(request)
		const result = request.wasSuccessful(response, false)

		if (!result) {
			console.log('registering purchase receipt failed', response)
		}

		return result
	}

	private async initProducts() {
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

		await CdvPurchase.store.initialize()
		for (let i = 0; i < CdvPurchase.store.products.length; i++) {
			const lastIndex = CdvPurchase.store.products[i].offers[0].pricingPhases.length - 1
			if (lastIndex < 0) {
				console.warn('no pricingphases found', CdvPurchase.store.products[i])
				continue
			}

			this.updatePrice(CdvPurchase.store.products[i].id, CdvPurchase.store.products[i].offers[0].pricingPhases[lastIndex].price)
		}
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
			.approved((p: CdvPurchase.Transaction) => {
				// Handle the product deliverable
				//this.currentPlan = p.products[0].id

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

	async restore(product: string) {
		this.restorePurchase = true
		this.purchaseIntent = product
		await CdvPurchase.store.restorePurchases()
	}

	async purchase(product: string) {
		const offer = CdvPurchase.store.get(product).getOffer()
		const loading = await this.alertService.presentLoading('')
		loading.present()
		this.restorePurchase = true
		this.purchaseIntent = product
		CdvPurchase.store.order(offer).then(
			() => {
				setTimeout(() => {
					loading.dismiss()
				}, 1500)
			},
			(e: unknown) => {
				loading.dismiss()
				this.alertService.showError('Purchase failed', `Failed to purchase: ${e}`, PURCHASEUTILS + 1)
				console.warn('purchase error', e)
				//this.currentPlan = PRODUCT_STANDARD
			}
		)
	}

	private async confirmPurchaseOnRemote(product) {
		const isIOS = this.platform.is('ios')

		// TODO in the future replace isIOS ? product.transaction.appStoreReceipt : product.transaction.purchaseToken
		// with isIOS ? product.id : product.transaction.purchaseToken
		const purchaseData = {
			currency: product.currency,
			id: isIOS ? this.purchaseIntent : product.id,
			priceMicros: product.priceMicros,
			valid: product.valid,
			transaction: {
				id: product.id,
				receipt: isIOS ? product.transaction.id : product.transaction.purchaseToken,
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

		if (result) {
			await this.getUserInfo(true, () => {
				this.alertService.showError(
					'Purchase Error',
					'We could not confirm your purchase. Please try again later or contact us if this problem persists.',
					PURCHASEUTILS + 2
				)
			})
		}

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

	// async getCurrentPlanConfirmed(): Promise<string> {
	// 	if (this.api.debug) {
	// 		const debugPackage = await this.storage.getSetting(DEBUG_SETTING_OVERRIDE_PACKAGE, 'default')
	// 		if (debugPackage != 'default') {
	// 			return debugPackage as string
	// 		}
	// 	}

	// 	const authUser = await this.storage.getAuthUser()
	// 	if (!authUser || !authUser.accessToken) return PRODUCT_STANDARD
	// 	const jwtParts = authUser.accessToken.split('.')
	// 	const claims: ClaimParts = JSON.parse(atob(jwtParts[1]))
	// 	if (claims && claims.package) {
	// 		return claims.package
	// 	}
	// 	return PRODUCT_STANDARD
	// }

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
		for (let i = 0; i < this.DEPRECATED_PACKAGES.length; i++) {
			const current = this.DEPRECATED_PACKAGES[i]
			if (current.purchaseKey == name) {
				return current
			}
		}

		return null
	}

	isPremium = computed(() =>{
		if(!this.userInfo()) return false
		return this.userInfo().premium_perks.ad_free
	})

	getCurrentPlanMaxValidator = computed(() => {
		if (!this.isPremium()) return 20
		return this.userInfo().premium_perks.validators_per_dashboard
	})

	hasMachineMonitoringPremium = computed(() => {
		if (!this.isPremium()) return false
		return this.userInfo().premium_perks.machine_monitoring_history_seconds > 10800
	})

	getUsersSubscription: Signal<UserSubscription> = computed(() => {
		const none = {
			product_id: '',
			product_name: '',
			product_category: '',
			product_store: '',
			start: 0,
			end: 0,
		}
		if (!this.userInfo()) return none
		const appSubs = this.userInfo().subscriptions.filter((sub) => sub.product_category == 'premium')
		if (appSubs.length == 0) return none
		return appSubs[0]
	})

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
