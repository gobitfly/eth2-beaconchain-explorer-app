import { Component, OnInit, Input } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { ModalController } from '@ionic/angular'
import { SubscribePage } from '@pages/subscribe/subscribe.page'
import AdUtils, { AdLocation } from '@utils/AdUtils'
import { MerchantUtils } from '@utils/MerchantUtils'

@Component({
	selector: 'app-ad',
	templateUrl: './ad.component.html',
	styleUrls: ['./ad.component.scss'],
	standalone: false,
})
export class AdComponent implements OnInit {
	info: AdLocation = 'info'

	@Input() location: AdLocation

	adHtml: SafeHtml
	openUpgradeToPremium = false

	constructor(
		private adUtils: AdUtils,
		private sanitizer: DomSanitizer,
		private modalController: ModalController,
		public merchantUtils: MerchantUtils
	) {}

	async ngOnInit() {
		await this.merchantUtils.getUserInfo() // waits for user info to be loaded
		this.adUtils.get(this.location).then((data) => {
			if (data && data.html && data.html.length > 10) {
				this.openUpgradeToPremium = data.html.indexOf('beaconchain_sample_ad') >= 0
				this.adHtml = this.sanitizer.bypassSecurityTrustHtml(
					data.html
						.replace('alt', 'alt style="height:auto;display: block;margin:auto;"') //image-rendering: pixelated;
						.replace('a h', 'a style="color: var(--x-toolbar-title-color) !important;text-decoration: none;" h')
				)
			}
		})
	}

	async openUpgrades() {
		if (!this.openUpgradeToPremium) return
		const modal = await this.modalController.create({
			component: SubscribePage,
			cssClass: 'my-custom-class',
		})
		return await modal.present()
	}
}
