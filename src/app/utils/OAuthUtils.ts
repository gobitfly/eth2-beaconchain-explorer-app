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

import { ApiService } from '../services/api.service'
import { Injectable } from '@angular/core'
import { StorageService } from '../services/storage.service'
import FirebaseUtils from './FirebaseUtils'
import { LoadingController, Platform } from '@ionic/angular'
import { MerchantUtils } from './MerchantUtils'

import { Toast } from '@capacitor/toast'
import { Device } from '@capacitor/device'
import { OAuth2AuthenticateOptions, OAuth2Client } from '@byteowls/capacitor-oauth2'
import FlavorUtils from './FlavorUtils'
import { mergeLocalDashboardToRemote } from './DashboardUtils'
import { getProperty } from '../requests/requests'
import { AlertService } from '../services/alert.service'
import { NotificationBase } from '../tab-preferences/notification-base'

@Injectable({
	providedIn: 'root',
})
export class OAuthUtils {
	constructor(
		private api: ApiService,
		private storage: StorageService,
		private firebaseUtils: FirebaseUtils,
		private loadingController: LoadingController,
		private merchantUtils: MerchantUtils,
		private flavor: FlavorUtils,
		private platform: Platform,
		private alert: AlertService,
		private notificationBase: NotificationBase
	) {
		//registerWebPlugin(OAuth2Client);
	}

	async login(statusCallback: (finished: boolean) => void = null) {
		let authOptions: OAuth2AuthenticateOptions = await this.getOAuthOptionsv1()
		const isV2 = await this.storage.isV2()
		if (isV2) {
			authOptions = await this.getOAuthOptionsv2()
		}
		return OAuth2Client.authenticate(authOptions)
			.then(async (response: unknown) => {
				const loadingScreen = await this.presentLoading()
				loadingScreen.present()

				let obj = response
				if (typeof response === 'string') {
					obj = JSON.parse(response as string)
				}

				// different responses based on the platform yay
				let accessToken = getProperty(obj, 'access_token')
				if (!accessToken) {
					accessToken = getProperty(obj, 'access_token_response')
						? getProperty(getProperty(obj, 'access_token_response'), 'access_token')
						: getProperty(obj, 'authorization_response')
							? getProperty(getProperty(obj, 'authorization_response'), 'access_token')
							: undefined
				}
				let refreshToken = getProperty(obj, 'refresh_token')
				if (!refreshToken) {
					refreshToken = getProperty(obj, 'access_token_response')
						? getProperty(getProperty(obj, 'access_token_response'), 'refresh_token')
						: getProperty(obj, 'authorization_response')
							? getProperty(getProperty(obj, 'authorization_response'), 'refresh_token')
							: undefined
				}

				if (!accessToken) {
					throw new Error('invalid access token')
				}

				if (isV2) {
					console.log('successful v2 auth')

					await this.storage.setAuthUserv2({
						Session: accessToken as string,
					})

					await this.api.initV2Cookies()
				} else {
					// inconsistent on ios, just assume a 10min lifetime for first token and then just refresh it
					// and kick off real expiration times
					const expiresIn = Date.now() + 10 * 60 * 1000

					await this.storage.setAuthUser({
						accessToken: accessToken as string,
						refreshToken: refreshToken as string,
						expiresIn: expiresIn,
					})
				}

				await this.postLogin()
				const isPremium = this.merchantUtils.isPremium()

				loadingScreen.dismiss()
				if (isPremium) {
					this.merchantUtils.restartDialogLogin()
				} else {
					Toast.show({
						text: 'Welcome!',
					})
				}

				return true
			})
			.catch((reason: unknown) => {
				if (statusCallback) statusCallback(true)
				console.error('OAuth rejected', reason)
				this.alert.showError(
					'Login Failed',
					'Your credentials are correct but there has been a problem signing you in at this moment. Please try again in 20min. If this error persists please reach out to us.',
					100
				)
				return false
			})
	}

	async postLogin() {
		await this.firebaseUtils.pushLastTokenUpstream(true)
		//await this.sync.fullSync()

		await this.merchantUtils.getUserInfo(true, () => {
			console.warn('can not get user info')
			Toast.show({
				text: 'Could not log in, please try again later.',
			})
		})

		await mergeLocalDashboardToRemote(this.api, this.storage)

		await this.notificationBase.syncClientUpdates()
	}

	private async presentLoading() {
		return await this.loadingController.create({
			cssClass: 'my-custom-class',
			spinner: 'bubbles',
			duration: 8000,
		})
	}

	public hashCode(string: string): string {
		let hash = 0
		for (let i = 0; i < string.length; i++) {
			const character = string.charCodeAt(i)
			hash = (hash << 5) - hash + character
			hash = hash & hash
		}
		return hash.toString(16)
	}

	private async getOAuthOptionsv1() {
		const api = this.api
		const endpointUrl = api.getResourceUrl('user/token')

		const info = await Device.getId().catch(() => {
			return { identifier: 'iduno' }
		})
		let clientID = this.hashCode(info.identifier)
		while (clientID.length <= 5) {
			clientID += '0'
		}

		const responseType = 'code'
		let callback = 'beaconchainmobile://callback'

		if (this.platform.is('ios') || this.platform.is('android')) {
			if (await this.flavor.isBetaFlavor()) {
				callback = 'beaconchainmobilebeta://callback'
			}
		}

		const oAuthURL = api.getBaseUrl() + '/user/authorize'

		return {
			authorizationBaseUrl: oAuthURL,
			accessTokenEndpoint: endpointUrl,
			web: {
				appId: clientID,
				responseType: responseType,
				redirectUrl: callback,
				windowOptions: 'height=600,left=0,top=0',
			},
			android: {
				appId: clientID,
				responseType: responseType,
				redirectUrl: callback,
				handleResultOnNewIntent: true,
				handleResultOnActivityResult: true,
			},
			ios: {
				appId: clientID,
				responseType: responseType,
				redirectUrl: callback,
			},
		}
	}

	private async getOAuthOptionsv2() {
		const responseType = 'token'
		const clientName = await this.storage.getDeviceName()

		let callback = 'beaconchainmobile://callback'
		if (this.platform.is('ios') || this.platform.is('android')) {
			if (await this.flavor.isBetaFlavor()) {
				callback = 'beaconchainmobilebeta://callback'
			}
		}

		const oAuthURL = this.api.getBaseUrl() + '/login'

		const clientID = await this.storage.getDeviceID()

		return {
			authorizationBaseUrl: oAuthURL,
			web: {
				appId: clientID + ':' + clientName,
				responseType: responseType,
				redirectUrl: callback,
				windowOptions: 'height=600,left=0,top=0',
			},
			android: {
				appId: clientID + ':' + clientName,
				responseType: responseType,
				redirectUrl: callback,
				handleResultOnNewIntent: true,
				handleResultOnActivityResult: true,
			},
			ios: {
				appId: clientID + ':' + clientName,
				responseType: responseType,
				redirectUrl: callback,
			},
		}
	}
}
