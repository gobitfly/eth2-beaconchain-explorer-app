import { Component, computed, OnInit, Signal, signal, WritableSignal } from '@angular/core'
import { ModalController, Platform } from '@ionic/angular'
import { fromEvent, Subscription } from 'rxjs'
import { StorageService } from 'src/app/services/storage.service'
import { MerchantUtils, Package } from 'src/app/utils/MerchantUtils'
import { OAuthUtils } from 'src/app/utils/OAuthUtils'
import { AlertService } from 'src/app/services/alert.service'
import { Toast } from '@capacitor/toast'
import FlavorUtils from 'src/app/utils/FlavorUtils'

import { Browser } from '@capacitor/browser'
import { ApiService, capitalize } from 'src/app/services/api.service'
import { V2ProductSummary } from 'src/app/requests/v2-general'
import { PremiumProduct, ProductSummary, UserSubscription } from 'src/app/requests/types/user'

const ASSOCIATED_CACHE_KEY = 'subscribe'
@Component({
	selector: 'app-subscribe',
	templateUrl: './subscribe.page.html',
	styleUrls: ['./subscribe.page.scss'],
})
export class SubscribePage implements OnInit {
	currentY = 0
	private backbuttonSubscription: Subscription
	isiOS = false

	renewalFrame: 'monthly' | 'yearly' = 'monthly'

	// all available products from server
	products: WritableSignal<ProductSummary> = signal(null)

	// currently selected product from server
	selectedProduct: Signal<PremiumProduct> = computed(() => {
		if (this.products() == null) return null
		const result = this.products().premium_products.find(
			(product) =>
				product.product_id_monthly === this.selectedPackage().purchaseKey || product.product_id_yearly === this.selectedPackage().purchaseKey
		)
		if (result) return result
		return this.products().premium_products.find((product) => product.product_name == 'Free')
	})

	// currently selected local package (we need it for the purchase key and the appstore pricing, otherwise use selectedProduct)
	selectedPackage: WritableSignal<Package> = signal(null)

	online: boolean = true

	constructor(
		private modalCtrl: ModalController,
		public merchant: MerchantUtils,
		private storage: StorageService,
		private oauth: OAuthUtils,
		private alertService: AlertService,
		private platform: Platform,
		private flavor: FlavorUtils,
		private api: ApiService
	) {
		const event = fromEvent(document, 'backbutton')
		this.backbuttonSubscription = event.subscribe(() => {
			this.modalCtrl.dismiss()
		})
	}

	async setup() {
		const result = await this.api.set(new V2ProductSummary(), this.products, ASSOCIATED_CACHE_KEY)
		if (result.error) {
			Toast.show({
				text: 'Can not load, please check your internet connection.',
			})
			this.online = false
		}
	}

	async ngOnInit() {
		this.online = true
		this.setup()
		await this.merchant.getUserInfo()

		const current = this.merchant.findProduct(this.merchant.getUsersSubscription().product_id)
		if (current) {
			this.selectedPackage.set(current)
		} else {
			this.selectedPackage.set(this.merchant.PACKAGES[1])
		}

		this.isiOS = this.platform.is('ios')
	}

	changeSelectedPackage(selectedPackage: Package) {
		this.selectedPackage.set(selectedPackage)
	}

	equalPackage(pkg: Package, pkg2: Package): boolean {
		if (pkg == null || pkg2 == null) {
			return false
		}
		if (pkg.purchaseKey == null || pkg2.purchaseKey == null) {
			return pkg.purchaseKey == pkg2.purchaseKey
		}
		return pkg.purchaseKey.split('.')[0] === pkg2.purchaseKey.split('.')[0]
	}

	// UserSubscription is remote while Package is local
	// Package might contain an old pre v2 fish package, so we need to map it to the corresponding new one
	equalProduct(product: UserSubscription, pkg: Package): boolean {
		if (product == null || pkg == null) {
			return false
		}
		const myPackageV2 = product.product_id // remote id
		if (!product) return false

		// removes apple prefix and converts any old fish package to new one (returns the monthly package since v1 was only monthly)
		const selectedPackageV2 = this.merchant.removeApplePrefix(this.merchant.mapv1Tov2(pkg.purchaseKey))
		if (!selectedPackageV2) return false

		return myPackageV2.split('.')[0] === selectedPackageV2.split('.')[0]
	}

	calculateMonthlyPrice(pkg: Package): string {
		let monthlyPrice = Math.ceil(pkg.priceMicros / 1000000 / 12).toFixed(2)
		if (Number.isInteger(Number(monthlyPrice)) && Number(monthlyPrice) > 0) {
			monthlyPrice = (Number(monthlyPrice) - 0.01).toFixed(2)
		}
		return this.replaceNumberInString(pkg.price, monthlyPrice)
	}

	replaceNumberInString(inputString: string, newNumber: string): string {
		const regex = /[0-9,.]+/g
		return inputString.replace(regex, newNumber)
	}

	calculateYearlyPrice(pkg: Package): string {
		let yearlyPrice = Math.ceil((pkg.priceMicros / 1000000) * 12).toFixed(2)
		if (Number.isInteger(Number(yearlyPrice)) && Number(yearlyPrice) > 0) {
			yearlyPrice = (Number(yearlyPrice) - 0.01).toFixed(2)
		}
		return this.replaceNumberInString(pkg.price, yearlyPrice)
	}

	getFrameShort(pkg: Package): string {
		return pkg.renewFrame === 'monthly' ? 'm' : 'y'
	}

	monthlyYearlySwitch() {
		if (this.selectedPackage() == this.merchant.PACKAGES[0]) {
			this.selectedPackage.set(this.merchant.PACKAGES[1])
			this.selectedPackage.set(this.merchant.PACKAGES[0])
			return
		}
		this.selectedPackage.set(
			this.merchant.PACKAGES.find((pkg) => pkg.renewFrame === this.renewalFrame && this.equalPackage(pkg, this.selectedPackage()))
		)
	}

	async continuePurchaseIntern() {
		const isPremium = this.merchant.hasMachineMonitoringPremium()
		const isNoGoogle = await this.flavor.isNoGoogleFlavor()
		if (isPremium) {
			const packageName = capitalize(this.merchant.getUsersSubscription().product_name)
			this.alertService.confirmDialog(
				'Already Premium',
				'You already own the ' + packageName + ' package, are you sure that you want to continue with your purchase?',
				'Yes',
				async () => {
					if (isNoGoogle) {
						await Browser.open({ url: this.api.getBaseUrl() + '/premium', toolbarColor: '#2f2e42' })
					} else {
						this.merchant.purchase(this.selectedPackage().purchaseKey)
					}
				}
			)
			return
		}

		if (isNoGoogle) {
			await Browser.open({ url: this.api.getBaseUrl() + '/premium', toolbarColor: '#2f2e42' })
		} else {
			this.merchant.purchase(this.selectedPackage().purchaseKey)
		}
	}

	async purchaseIntern() {
		let loggedIn = await this.storage.isLoggedIn()
		if (!loggedIn) {
			this.alertService.confirmDialog('Login', 'You need to login to your ' + this.api.getHostName() + ' account first. Continue?', 'Login', () => {
				this.oauth.login().then(async () => {
					loggedIn = await this.storage.isLoggedIn()
					if (loggedIn) this.continuePurchaseIntern()
				})
			})
		} else {
			this.continuePurchaseIntern()
		}
	}

	purchase() {
		this.purchaseIntern()
	}

	trial() {
		this.alertService.confirmDialog(
			'Free Trial Info',
			'You can test ' +
				this.selectedPackage().name +
				" for free for 14 days. You'll be charged the regular subscription amount of " +
				this.selectedPackage().price +
				' per month if you do not cancel the subscription before the trial concludes. You can cancel the subscription at any time.',
			'Start trial',
			() => {
				this.purchaseIntern()
			}
		)
	}

	async restore() {
		const loggedIn = await this.storage.isLoggedIn()
		if (!loggedIn) {
			await this.oauth.login()
		} else {
			// try refreshing user info first
			await this.merchant.getUserInfo(true, () => {
				Toast.show({
					text: 'Error restoring purchase',
				})
			})
			if (this.merchant.isPremium()) {
				Toast.show({
					text: 'Purchase restored',
				})
				this.closeModal()
				return
			}

			// if not successfull try registering native purchases again if there are any
			await this.merchant.restore(this.merchant.getUsersSubscription().product_id)
		}

		if (this.merchant.isPremium()) {
			Toast.show({
				text: 'Purchase restored',
			})
			this.closeModal()
		} else {
			Toast.show({
				text: 'No purchases found on this account',
			})
		}
	}

	onScroll($event: { detail: { currentY: number } }) {
		this.currentY = $event.detail.currentY
	}

	ngOnDestroy() {
		this.backbuttonSubscription.unsubscribe()
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}
}

