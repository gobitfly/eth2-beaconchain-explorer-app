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

import { Injectable } from '@angular/core'
import { AlertController, LoadingController } from '@ionic/angular'

export const VALIDATORUTILS = 140
export const PURCHASEUTILS = 150

@Injectable({
	providedIn: 'root',
})
export class AlertService {
	constructor(private alertController: AlertController, private loadingController: LoadingController) {}

	async showError(title: string, message: string, code: number) {
		const alert = await this.alertController.create({
			header: title,
			message: message + '<br/>Code: ' + code,
			buttons: ['OK'],
		})

		await alert.present()
	}

	async showSelect(title: string, inputs: unknown[], callback: (data) => void) {
		const alert = await this.alertController.create({
			header: title,
			inputs: inputs,
			buttons: [
				{
					text: 'OK',
					handler: callback,
				},
			],
		})

		await alert.present()
	}

	async showInfo(title: string, message: string, customCss: '' | 'bigger-alert' = '') {
		const alert = await this.alertController.create({
			cssClass: customCss,
			header: title,
			message: message,
			buttons: ['OK'],
		})

		await alert.present()
	}

	async confirmDialog(title: string, message: string, confirmButton: string, confirmCallback: () => void, customCSS: string = null) {
		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: title,
			message: message,
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
					cssClass: 'secondary',
					handler: () => {
						return
					},
				},
				{
					text: confirmButton,
					cssClass: customCSS,
					handler: confirmCallback,
				},
			],
		})

		await alert.present()
	}

	async confirmDialogReverse(title: string, message: string, confirmButton: string, confirmCallback: () => void, customCSS: string = null) {
		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: title,
			message: message,
			buttons: [
				{
					text: confirmButton,
					cssClass: customCSS,
					handler: confirmCallback,
				},
				{
					text: 'Cancel',
					role: 'cancel',
					cssClass: 'secondary',
					handler: () => {
						return
					},
				},
			],
		})

		await alert.present()
	}

	async presentLoading(message: string) {
		return await this.loadingController.create({
			cssClass: 'my-custom-class',
			spinner: 'bubbles',
			message: message,
		})
	}
}
