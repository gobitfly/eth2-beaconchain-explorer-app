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

import { Component, OnInit, Input } from '@angular/core'
import { AlertController } from '@ionic/angular'
import { StorageService } from 'src/app/services/storage.service'
import confetti from 'canvas-confetti'

import { Browser } from '@capacitor/browser'
import { Output, EventEmitter } from '@angular/core'
import FirebaseUtils from 'src/app/utils/FirebaseUtils'

@Component({
	selector: 'app-message',
	templateUrl: './message.component.html',
	styleUrls: ['./message.component.scss'],
	standalone: false,
})
export class MessageComponent implements OnInit {
	@Input() title: string
	@Input() icon: string
	@Input() iconStyle: string
	@Input() openUrl: string
	@Input() openUrlExternal = false
	@Input() dismissAble = false
	@Input() dismissKey: string
	@Input() msgTitle: string
	@Input() msgText: string
	@Input() confettiOnClick = false
	@Input() notificationPermission = false
	@Output() onResult = new EventEmitter<string>()

	notDismissed = true

	constructor(
		private alertController: AlertController,
		private storage: StorageService,
		private firebaseUtils: FirebaseUtils
	) {}

	ngOnInit() {
		if (this.dismissAble || this.notificationPermission) {
			if (!this.dismissKey) this.dismissKey = this.defaultDismissKey()
			this.storage.getBooleanSetting(this.dismissKey, false).then((dismissed) => {
				this.notDismissed = !dismissed
			})
		}

		if (this.notificationPermission) {
			this.firebaseUtils.hasNotificationConsent().then((result) => {
				if (result) this.dismiss()
			})
		}
	}

	async openInfo() {
		if (this.confettiOnClick) {
			confetti({
				particleCount: 30,
				spread: 50,
				origin: { y: 0.41 },
			})
			return
		}
		if (this.msgTitle && this.msgText) {
			this.showDialog(this.msgTitle, this.msgText)
		} else if (this.openUrl) {
			if (this.openUrlExternal) {
				window.open(this.openUrl, '_system', 'location=yes')
			} else {
				await Browser.open({ url: this.openUrl, toolbarColor: '#2f2e42' })
			}
		} else if (this.notificationPermission) {
			const alert = await this.alertController.create({
				header: 'Notifications',
				message:
					'You can configure custom alerts for you validators and get notified on your phone. If you wish to enable this, please grant notification permission. You can customize your notification settings in the settings panel.',
				buttons: [
					{
						text: 'Do not show again',
						handler: () => {
							this.dismiss()
						},
					},
					{
						text: 'Decide Later',
						handler: () => {
							this.notDismissed = false
						},
					},
					{
						text: 'Allow Notifications',
						handler: async () => {
							await this.firebaseUtils.registerPush(true, async () => {
								if (await this.firebaseUtils.hasNotificationConsent()) {
									this.notDismissed = false
								}
							})
						},
					},
				],
			})

			await alert.present()
		}
	}

	async showDialog(title: string, text: string) {
		const alert = await this.alertController.create({
			header: title,
			message: text,
			buttons: ['OK'],
		})

		await alert.present()
	}

	private defaultDismissKey() {
		return 'dismissed_msg_' + window.btoa(this.title)
	}

	dismiss() {
		this.notDismissed = false
		this.storage.setBooleanSetting(this.dismissKey, true)
	}
}
