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

import { computed, effect, Injectable, OnInit, Signal, signal, WritableSignal } from '@angular/core'
import 'cordova-plugin-purchase/www/store.d'
import { Platform } from '@ionic/angular'
import { AlertService, PURCHASEUTILS } from '../services/alert.service'
import { ApiService } from '../services/api.service'
import { DEBUG_SETTING_OVERRIDE_PACKAGE, StorageService } from '../services/storage.service'

import { SplashScreen } from '@capacitor/splash-screen'
import { SubscriptionData, V2Me, V2PurchaseValidation } from '../requests/v2-user'
import { UserInfo, UserSubscription } from '../requests/types/user'
import { Aggregation } from '../requests/v2-dashboard'
import { ONE_DAY, ONE_HOUR } from './TimeUtils'
import ThemeUtils from './ThemeUtils'

export const PRODUCT_STANDARD = 'standard'

export const AggregationTimeframes: Aggregation[] = [Aggregation.Epoch, Aggregation.Hourly, Aggregation.Daily, Aggregation.Weekly]

@Injectable({
	providedIn: 'root',
})
export class MerchantUtils implements OnInit {
	DEPRECATED_PACKAGES: Package[] = [
		{
			name: 'Plankton',
			price: '$1.99',
			priceMicros: 1990000,
			currency: 'USD',
			purchaseKey: 'plankton',
			renewFrame: null,
		},
	]

	PACKAGES: Package[]

	purchaseIntent = '' // temp workaround until new api is live

	userInfo: WritableSignal<UserInfo | null> = signal(null)

	userAllowedChartAggregations = computed(() => {
		function add(list: Aggregation[], value: number, aggregation: Aggregation) {
			if (value === 0) return
			list.push(aggregation)
		}

		const result: Aggregation[] = []
		add(result, this.userInfo()?.premium_perks?.chart_history_seconds?.epoch ?? 0, Aggregation.Epoch)
		add(result, this.userInfo()?.premium_perks?.chart_history_seconds?.daily ?? 0, Aggregation.Daily)
		add(result, this.userInfo()?.premium_perks?.chart_history_seconds?.hourly ?? 43200, Aggregation.Hourly)
		add(result, this.userInfo()?.premium_perks?.chart_history_seconds?.weekly ?? 0, Aggregation.Weekly)

		return result
	})

	initialize: Promise<void>

	constructor(
		private alertService: AlertService,
		private api: ApiService,
		private platform: Platform,
		private storage: StorageService,
		private theme: ThemeUtils
	) {
		effect(() => {
			if (this.userInfo()) {
				console.log('validate theming', this.userInfo(), this.userInfo()?.premium_perks?.mobile_app_custom_themes)
				const hasTheming = this.userInfo()?.premium_perks?.mobile_app_custom_themes == true
				if (!hasTheming && this.theme.currentThemeColor != 'gnosis') {
					this.theme.resetTheming()
				}
			}
		})
		this.initPackages() 
		if (!this.platform.is('ios') && !this.platform.is('android')) {
			console.info('merchant is not supported on this platform')
			return
		}
	}

	initPackages(appendix: string = "") {
		this.PACKAGES = [
			{
				name: 'Free',
				price: '€0.00',
				priceMicros: 0,
				currency: 'EUR',
				purchaseKey: null,
				renewFrame: null,
			},
			{
				name: 'Guppy',
				price: '€9.99',
				priceMicros: 9990000,
				currency: 'EUR',
				purchaseKey: 'guppy' + appendix,
				renewFrame: 'monthly',
			},
			{
				name: 'Guppy',
				price: '€107.88',
				priceMicros: 107880000,
				currency: 'EUR',
				purchaseKey: 'guppy.yearly' + appendix,
				renewFrame: 'yearly',
			},
			{
				name: 'Dolphin',
				price: '€29.99',
				priceMicros: 29990000,
				currency: 'EUR',
				purchaseKey: 'dolphin' + appendix,
				renewFrame: 'monthly',
			},
			{
				name: 'Dolphin',
				price: '€311.88',
				priceMicros: 311880000,
				currency: 'EUR',
				purchaseKey: 'dolphin.yearly' + appendix,
				renewFrame: 'yearly',
			},
			{
				name: 'Orca',
				price: '€49.99',
				priceMicros: 49990000,
				currency: 'EUR',
				purchaseKey: 'orca' + appendix,
				renewFrame: 'monthly',
			},
			{
				name: 'Orca',
				price: '€479.88',
				priceMicros: 479880000,
				currency: 'EUR',
				purchaseKey: 'orca.yearly' + appendix,
				renewFrame: 'yearly',
			},
		]
	}

	ngOnInit() {
		this.initialize = this.init()
	}

	public async getUserInfo(forceRefresh: boolean = false, errHandler: (err: Error) => void = () => {}) {
		if (await this.storage.getAuthUserv2()) {
			if (!forceRefresh) {
				this.userInfo.set(await (this.storage.getObject('userInfo') as Promise<UserInfo | null>))
			}
			const result = await this.api.set(new V2Me().withAllowedCacheResponse(!forceRefresh), this.userInfo)
			if (result.error) {
				console.warn('failed to get user info', result.error)
				errHandler(result.error)
				return
			}

			if (this.userInfo()) {
				this.storage.setObject('userInfo', this.userInfo())
				if (this.userInfo().api_keys && this.userInfo().api_keys.length > 0) {
					this.api.setApiKey(this.userInfo().api_keys[0])
				}
			}
		} else {
			this.overridePerks('standard')
		}
		// check for override
		const override = (await this.storage.getSetting(DEBUG_SETTING_OVERRIDE_PACKAGE, 'default')) as string
		if (override != 'default') {
			this.overridePerks(override)
		}
	}

	// debug
	private overridePerks(target: string) {
		const userInfoShadow =
			this.userInfo() ||
			({
				premium_perks: {
					ad_free: false,
					validator_dashboards: 1,
					validators_per_dashboard: 20,
					validator_groups_per_dashboard: 1,
					chart_history_seconds: {
						epoch: 0,
						hourly: 12 * ONE_HOUR,
						daily: 0,
						weekly: 0,
					},
				},
				subscriptions: [],
			} as UserInfo)
		switch (target) {
			case 'standard':
				userInfoShadow.premium_perks.ad_free = false
				userInfoShadow.premium_perks.validator_dashboards = 1
				userInfoShadow.premium_perks.validators_per_dashboard = 20
				userInfoShadow.premium_perks.validator_groups_per_dashboard = 1
				userInfoShadow.premium_perks.chart_history_seconds = {
					epoch: 0,
					hourly: 12 * ONE_HOUR,
					daily: 0,
					weekly: 0,
				}
				break
			case 'guppy':
				userInfoShadow.premium_perks.ad_free = true
				userInfoShadow.premium_perks.validator_dashboards = 1
				userInfoShadow.premium_perks.validators_per_dashboard = 100
				userInfoShadow.premium_perks.validator_groups_per_dashboard = 3
				userInfoShadow.premium_perks.chart_history_seconds = {
					epoch: 1 * ONE_DAY,
					hourly: 7 * ONE_DAY,
					daily: 30 * ONE_DAY,
					weekly: 0,
				}
				break
			case 'dolphin':
				userInfoShadow.premium_perks.ad_free = true
				userInfoShadow.premium_perks.validator_dashboards = 2
				userInfoShadow.premium_perks.validators_per_dashboard = 300
				userInfoShadow.premium_perks.validator_groups_per_dashboard = 10
				userInfoShadow.premium_perks.chart_history_seconds = {
					epoch: 5 * ONE_DAY,
					hourly: 30 * ONE_DAY,
					daily: 60 * ONE_DAY,
					weekly: 56 * ONE_DAY, // todo
				}
				break
			case 'orca':
				userInfoShadow.premium_perks.ad_free = true
				userInfoShadow.premium_perks.validator_dashboards = 2
				userInfoShadow.premium_perks.validators_per_dashboard = 1000
				userInfoShadow.premium_perks.validator_groups_per_dashboard = 30
				userInfoShadow.premium_perks.chart_history_seconds = {
					epoch: 21 * ONE_DAY,
					hourly: 180 * ONE_DAY,
					daily: 360 * ONE_DAY,
					weekly: 999 * ONE_DAY,
				}
				break
		}

		this.userInfo.set(userInfoShadow)
	}

	clearTempUserInfo() {
		return this.storage.setObject('userInfo', this.userInfo())
	}

	public getMonthlyBilledPackages(): Package[] {
		return this.PACKAGES.filter((pkg) => pkg.renewFrame == null || pkg.renewFrame == 'monthly')
	}

	public getYearlyBilledPackages(): Package[] {
		return this.PACKAGES.filter((pkg) => pkg.renewFrame == null || pkg.renewFrame == 'yearly')
	}

	private async init() {
		try {
			await this.getUserInfo()
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
		const result = await this.api.execute2(new V2PurchaseValidation(data))

		if (result.error) {
			console.log('registering purchase receipt failed', result)
		}

		return result.error == null
	}

	private async initProducts() {
		let platform = CdvPurchase.Platform.GOOGLE_PLAY
		let appendix = ""
		if (this.platform.is('ios')) {
			platform = CdvPurchase.Platform.APPLE_APPSTORE
			appendix = ".apple"
		}
	
		for (let i = 0; i < this.PACKAGES.length; i++) {
			if (this.PACKAGES[i].purchaseKey) {
				CdvPurchase.store.register({
					id: this.PACKAGES[i].purchaseKey + appendix,
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

			this.updatePrice(CdvPurchase.store.products[i].id, CdvPurchase.store.products[i].offers[0].pricingPhases[lastIndex])
		}
	}

	private updatePrice(id: string, prices: CdvPurchase.PricingPhase) {
		for (let i = 0; i < this.PACKAGES.length; i++) {
			if (this.PACKAGES[i].purchaseKey == id) {
				this.PACKAGES[i].price = prices.price
				this.PACKAGES[i].priceMicros = prices.priceMicros
				this.PACKAGES[i].currency = prices.currency
			}
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

	sleep(ms: number) {
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
		if(this.platform.is('ios')) { // you don't wanna know :)
			product += ".apple"
		}
		console.log('purchasing product', product)
		const storeProduct = CdvPurchase.store.get(product)
		if (storeProduct == null) {
			this.alertService.showError('Purchase failed', `Product ${product} can not be purchased at the moment, please try again later.`, PURCHASEUTILS)
			return
		}

		const offer = storeProduct.getOffer()
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

	private async confirmPurchaseOnRemote(product: CdvPurchase.Validator.Request.Body) {
		const isIOS = this.platform.is('ios')

		// TODO in the future replace isIOS ? product.transaction.appStoreReceipt : product.transaction.purchaseToken
		// with isIOS ? product.id : product.transaction.purchaseToken
		const purchaseData = {
			currency: product.currency,
			id: isIOS ? this.purchaseIntent : product.id,
			priceMicros: product.priceMicros,
			valid: true,
			transaction: {
				id: product.id,
				receipt: isIOS ?
					(product.transaction as CdvPurchase.Validator.Request.ApiValidatorBodyTransactionApple).id
					:
					(product.transaction as CdvPurchase.Validator.Request.ApiValidatorBodyTransactionGoogle).purchaseToken,
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
	findProduct(name: string): Package {
		console.log('find product', name, this.PACKAGES)
		for (let i = 0; i < this.PACKAGES.length; i++) {
			const current = this.PACKAGES[i]
			if (current.purchaseKey == name || this.mapv2Tov1(current.purchaseKey) == name) {
				return current
			}
		}
		for (let i = 0; i < this.DEPRECATED_PACKAGES.length; i++) {
			const current = this.DEPRECATED_PACKAGES[i]
			if (current.purchaseKey == name || this.mapv2Tov1(current.purchaseKey) == name) {
				return current
			}
		}

		return null
	}

	isPremium = computed(() => {
		if (!this.userInfo()) return false
		return this.userInfo().premium_perks.ad_free
	})

	canBulkAdd = computed(() => {
		if (!this.userInfo()) return false
		return this.userInfo().premium_perks.bulk_adding
	})

	getCurrentPlanMaxValidator = computed(() => {
		if (!this.isPremium()) return 20
		return this.userInfo().premium_perks.validators_per_dashboard
	})

	getCurrentPlanMaxGroups = computed(() => {
		if (!this.isPremium()) return 1
		return this.userInfo().premium_perks.validator_groups_per_dashboard
	})

	highestPackageDashboardsAllowed = computed(() => {
		return 2 // todo
	})

	highestPackageGroupsPerDashboardAllowed = computed(() => {
		return 30 // todo
	})

	mapv2Tov1(name: string): string {
		if (name == null) return null
		if (name.indexOf('guppy') >= 0) return 'plankton'
		if (name.indexOf('dolphin') >= 0) return 'goldfish'
		if (name.indexOf('orca') >= 0) return 'whale'
		return name
	}

	mapv1Tov2(name: string): string {
		if (name == null) return null
		if (name.indexOf('plankton') >= 0) return 'guppy'
		if (name.indexOf('goldfish') >= 0) return 'dolphin'
		if (name.indexOf('whale') >= 0) return 'orca'
		return name
	}

	removeApplePrefix(name: string): string {
		if (name == null) return null
		if (name.indexOf('.apple')) {
			name = name.replace('.apple', '')
		}
		return name
	}

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
}

export interface Package {
	name: string
	price: string
	priceMicros: number
	currency: string
	purchaseKey: string
	renewFrame: 'monthly' | 'yearly' | null
}
