import { Component, Input, OnInit } from '@angular/core'
import { ModalController, Platform } from '@ionic/angular'
import { fromEvent, Subscription } from 'rxjs'
import { StorageService } from 'src/app/services/storage.service'
import { MerchantUtils, Package } from 'src/app/utils/MerchantUtils'
import { OAuthUtils } from 'src/app/utils/OAuthUtils'
import { AlertService } from 'src/app/services/alert.service'
import { Toast } from '@capacitor/toast'
import FlavorUtils from 'src/app/utils/FlavorUtils'

import { Browser } from '@capacitor/browser'

@Component({
	selector: 'app-subscribe',
	templateUrl: './subscribe.page.html',
	styleUrls: ['./subscribe.page.scss'],
})
export class SubscribePage implements OnInit {
	@Input() tab: string = null

	currentY = 0

	private backbuttonSubscription: Subscription
	selectedPackage: Package = this.merchant.PACKAGES[2]
	activeUserPackageName = 'standard'
	isiOS = false

	constructor(
		private modalCtrl: ModalController,
		public merchant: MerchantUtils,
		private storage: StorageService,
		private oauth: OAuthUtils,
		private alertService: AlertService,
		private platform: Platform,
		private flavor: FlavorUtils
	) {}

	ngOnInit() {
		const event = fromEvent(document, 'backbutton')
		this.backbuttonSubscription = event.subscribe(async () => {
			this.modalCtrl.dismiss()
		})

		this.merchant.getCurrentPlanConfirmed().then((result) => {
			this.activeUserPackageName = result
			if (this.tab) {
				result = this.tab
			}
			const pkg = this.merchant.findProduct(result)
			if (pkg) {
				this.selectedPackage = pkg
			}
		})

		this.isiOS = this.platform.is('ios')
	}

	onScroll($event) {
		this.currentY = $event.detail.currentY
	}

	ngOnDestroy() {
		this.backbuttonSubscription.unsubscribe()
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}

	async continuePurchaseIntern() {
		const isPremium = await this.merchant.hasMachineHistoryPremium()
		const isNoGoogle = await this.flavor.isNoGoogleFlavor()
		if (isPremium) {
			const packageName = capitalize(await this.merchant.getCurrentPlanConfirmed())
			this.alertService.confirmDialog(
				'Already Premium',
				'You already own the ' + packageName + ' package, are you sure that you want to continue with your purchase?',
				'Yes',
				async () => {
					if (isNoGoogle) {
						await Browser.open({ url: 'https://beaconcha.in/premium', toolbarColor: '#2f2e42' })
					} else {
						this.merchant.purchase(this.selectedPackage.purchaseKey)
					}
				}
			)
			return
		}

		if (isNoGoogle) {
			await Browser.open({ url: 'https://beaconcha.in/premium', toolbarColor: '#2f2e42' })
		} else {
			this.merchant.purchase(this.selectedPackage.purchaseKey)
		}
	}

	async purchaseIntern() {
		const loggedIn = await this.storage.isLoggedIn()
		if (!loggedIn) {
			this.alertService.confirmDialog('Login', 'You need to login to your beaconcha.in account first. Continue?', 'Login', () => {
				this.oauth.login().then(async () => {
					const loggedIn = await this.storage.isLoggedIn()
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
				this.selectedPackage.name +
				" for free for 14 days. You'll be charged the regular subscription amount of " +
				this.selectedPackage.price +
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
			await this.merchant.refreshToken()
			const currentPackage = await this.merchant.getCurrentPlanConfirmed()
			if (currentPackage != 'standard') {
				Toast.show({
					text: 'Purchase restored',
				})
				this.closeModal()
				return
			}

			await this.merchant.restore()
		}

		const currentPackage = await this.merchant.getCurrentPlanConfirmed()
		if (currentPackage != 'standard') {
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
}

const capitalize = (s) => {
	if (typeof s !== 'string') return ''
	return s.charAt(0).toUpperCase() + s.slice(1)
}
