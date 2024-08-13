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
import { ValidatorUtils } from './ValidatorUtils'
import { LoadingController, Platform } from '@ionic/angular'
import { SyncService } from '../services/sync.service'
import { MerchantUtils } from './MerchantUtils'

import { Toast } from '@capacitor/toast'
import { Device } from '@capacitor/device'
import { OAuth2AuthenticateOptions, OAuth2Client } from '@byteowls/capacitor-oauth2'
import FlavorUtils from './FlavorUtils'

@Injectable({
	providedIn: 'root',
})
export class OAuthUtils {
	constructor(
		private api: ApiService,
		private storage: StorageService,
		private firebaseUtils: FirebaseUtils,
		private validatorUtils: ValidatorUtils,
		private loadingController: LoadingController,
		private sync: SyncService,
		private merchantUtils: MerchantUtils,
		private flavor: FlavorUtils,
		private platform: Platform
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
			.then(async (response: AccessTokenResponse) => {
				const loadingScreen = await this.presentLoading()
				loadingScreen.present()

				if (isV2) {
					let result = response.authorization_response
					if (typeof result === 'string') {
						result = JSON.parse(response.access_token_response as string)
					}
					result = result as Token

					console.log('successful v2 auth')

					await this.storage.setAuthUserv2({
						Session: result.access_token,
					})

					await this.api.initV2Cookies()
				} else {
					let result = response.access_token_response
					if (typeof result === 'string') {
						result = JSON.parse(response.access_token_response as string)
					}
					result = result as Token
					const accessToken = result.access_token
					const refreshToken = result.refresh_token

					// inconsistent on ios, just assume a 10min lifetime for first token and then just refresh it
					// and kick off real expiration times
					const expiresIn = Date.now() + 10 * 60 * 1000

					console.log('successful', accessToken, refreshToken, expiresIn)

					await this.storage.setAuthUser({
						accessToken: accessToken,
						refreshToken: refreshToken,
						expiresIn: expiresIn,
					})
				}
				

				this.validatorUtils.clearDeletedSet()
				await this.firebaseUtils.pushLastTokenUpstream(true)
				await this.sync.fullSync()

				await this.merchantUtils.getUserInfo(true, () => {
					console.warn("can not get user info")
				})
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
				Toast.show({
					text: 'Could not log in, please try again later.',
				})
				return false
			})
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

		const oAuthURL = 'https://local.beaconcha.in:3000/login' // todo

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

interface AccessTokenResponse {
	access_token_response: Token | string
	authorization_response: Token | string // v2
}

interface Token {
	access_token: string
	refresh_token: string
}
