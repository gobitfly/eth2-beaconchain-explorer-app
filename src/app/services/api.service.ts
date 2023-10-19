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
import { APIRequest, Method, RefreshTokenRequest } from '../requests/requests'
import { StorageService } from './storage.service'
import { ApiNetwork } from '../models/StorageTypes'
import { Mutex } from 'async-mutex'
import { findConfigForKey, MAP } from '../utils/NetworkData'
import { CacheModule } from '../utils/CacheModule'
import { HttpOptions } from '@capacitor/core'

const LOGTAG = '[ApiService]'

const SERVER_TIMEOUT = 25000

@Injectable({
	providedIn: 'root',
})
export class ApiService extends CacheModule {
	networkConfig: ApiNetwork

	public connectionStateOK = true

	private awaitingResponses: Map<string, Mutex> = new Map()

	debug = false

	public lastRefreshed = 0 // only updated by calls that have the updatesLastRefreshState flag enabled

	private lastCacheInvalidate = 0

	constructor(private storage: StorageService) {
		super('api', 6 * 60 * 1000, storage)
		this.storage.getBooleanSetting('migrated_4_3_0', false).then((migrated) => {
			if (!migrated) {
				this.clearHardCache()
				console.info('Cleared hard cache storage as part of 4.3.0 migration')
				this.storage.setBooleanSetting('migrated_4_3_0', true)
			}
		})

		this.storage.isDebugMode().then((result) => {
			this.debug = result
			window.localStorage.setItem('debug', this.debug ? 'true' : 'false')
		})
		this.lastCacheInvalidate = Date.now()

		this.initialize()
	}

	mayInvalidateOnFaultyConnectionState() {
		if (!this.connectionStateOK) this.invalidateCache()
	}

	invalidateCache() {
		if (this.lastCacheInvalidate + 40000 < Date.now()) {
			this.lastCacheInvalidate = Date.now()
			console.log('invalidating request cache')
			this.invalidateAllCache()
			this.storage.invalidateAllCache()
		}
	}

	async initialize() {
		this.networkConfig = await this.storage.getNetworkPreferences().then((config) => {
			const temp = findConfigForKey(config.key)
			if (temp) {
				return temp
			}
			return config
		})
	}

	networkName = null
	getNetworkName(): string {
		const temp = this.networkConfig.key
		this.networkName = temp
		return temp
	}

	getNetwork(): ApiNetwork {
		const temp = this.networkConfig
		return temp
	}

	private async getAuthHeader(isTokenRefreshCall: boolean) {
		let user = await this.storage.getAuthUser()
		if (!user || !user.accessToken) return null

		if (!isTokenRefreshCall && user.expiresIn <= Date.now() - (SERVER_TIMEOUT + 1000)) {
			// grace window, should be higher than allowed server timeout
			console.log('Token expired, refreshing...', user.expiresIn)
			user = await this.refreshToken()
			if (!user || !user.accessToken) {
				// logout logic if token cannot be refreshed again within an 12 hour window
				const markForLogout = await this.storage.getItem('mark_for_logout')
				const markForLogoutInt = parseInt(markForLogout)
				if (!isNaN(markForLogoutInt) && markForLogoutInt + 12 * 60 * 1000 < Date.now()) {
					console.log('[auto-logout] mark_for_logout reached, logout user')
					this.storage.setItem('mark_for_logout', null)
					this.storage.setAuthUser(null)
				} else if (isNaN(markForLogoutInt)) {
					console.log('[auto-logout] mark_for_logout set')
					this.storage.setItem('mark_for_logout', Date.now() + '')
				}

				return null
			}
		}

		return {
			Authorization: 'Bearer ' + user.accessToken,
		}
	}

	async refreshToken() {
		const user = await this.storage.getAuthUser()
		if (!user || !user.refreshToken) {
			console.warn('No refreshtoken, cannot refresh token')
			return null
		}

		const now = Date.now()
		const req = new RefreshTokenRequest(user.refreshToken)

		// let result: ApiTokenResponse
		// let resp
		// if (Capacitor.isNativePlatform() && Capacitor.getPlatform() == 'ios') {
		// 	resp = await this.execute(req)
		// 	const response = req.parse(resp)
		// 	result = response[0]
		// } else {
		const formBody = new FormData()
		formBody.set('grant_type', 'refresh_token')
		formBody.set('refresh_token', user.refreshToken)
		const url = this.getResourceUrl(req.resource, req.endPoint)

		const resp = await fetch(url, {
			method: 'POST',
			body: formBody,
			headers: await this.getAuthHeader(true),
		})
		const result = await resp.json()
		// }

		console.log('Refresh token', result, resp)
		if (!result || !result.access_token) {
			console.warn('could not refresh token', result)
			return null
		}

		user.accessToken = result.access_token
		user.expiresIn = now + result.expires_in * 1000

		await this.storage.setAuthUser(user)
		return user
	}

	private async lockOrWait(resource) {
		if (!this.awaitingResponses[resource]) {
			console.log('Locking ', resource)
			this.awaitingResponses[resource] = new Mutex()
		}
		await this.awaitingResponses[resource].acquire()
	}

	private unlock(resource) {
		console.log('Unlocking  ', resource)

		this.awaitingResponses[resource].release()
	}

	isNotMainnet(): boolean {
		const test = this.networkConfig.net != ''
		return test
	}

	isMainnet(): boolean {
		return !this.isNotMainnet()
	}

	private getCacheKey(request: APIRequest<unknown>): string {
		if (request.method == Method.GET) {
			return request.method + this.getResourceUrl(request.resource, request.endPoint)
		} else if (request.cacheablePOST) {
			return request.method + this.getResourceUrl(request.resource, request.endPoint) + JSON.stringify(request.postData)
		}
		return null
	}

	async execute(request: APIRequest<unknown>): Promise<Response> {
		await this.initialized

		if (!this.connectionStateOK) {
			this.invalidateCache()
		}

		// If cached and not stale, return cache
		const cached = (await this.getCache(this.getCacheKey(request))) as Response
		if (cached) {
			if (this.lastRefreshed == 0) this.lastRefreshed = Date.now()
			cached.cached = true
			return cached
		}

		const options = request.options

		// second is special case for notifications
		// notifications are rescheduled if response is != 200
		// but user can switch network in the mean time, so we need to reapply the network
		// the user was currently on, when they set the notification toggle
		// hence the additional request.requiresAuth
		if (request.endPoint == 'default' || request.requiresAuth) {
			const authHeader = await this.getAuthHeader(request instanceof RefreshTokenRequest)

			if (authHeader) {
				const headers = { ...options.headers, ...authHeader }
				options.headers = headers
			}
		}

		await this.lockOrWait(request.resource)

		console.log(LOGTAG + ' Send request: ' + request.resource, request.method, request)
		const startTs = Date.now()

		let response: Promise<Response>
		switch (request.method) {
			case Method.GET:
				response = this.get(request.resource, request.endPoint, request.ignoreFails, options)
				break
			case Method.POST:
				response = this.post(request.resource, request.postData, request.endPoint, request.ignoreFails, options)
				break
			default:
				throw 'Unsupported method: ' + request.method
		}

		const result = await response
		this.updateConnectionState(request.ignoreFails, result && result.data && !!result.url)

		if (!result) {
			this.unlock(request.resource)
			console.log(LOGTAG + ' Empty Response: ' + request.resource, Date.now() - startTs)
			return result
		}

		if ((request.method == Method.GET || request.cacheablePOST) && result && result.status == 200 && result.data) {
			this.putCache(this.getCacheKey(request), result, request.maxCacheAge)
		}

		if (request.updatesLastRefreshState) this.updateLastRefreshed(result)

		this.unlock(request.resource)
		console.log(LOGTAG + ' Response: ' + result.url + '', result, Date.now() - startTs)

		result.cached = false

		return result
	}

	async clearSpecificCache(request: APIRequest<unknown>) {
		await this.putCache(this.getCacheKey(request), null, request.maxCacheAge)
	}

	private updateLastRefreshed(response: Response) {
		if (response && response.status == 200) {
			this.lastRefreshed = Date.now()
		}
	}

	private async get(resource: string, endpoint = 'default', ignoreFails = false, options: HttpOptions = { url: null, headers: {} }) {
		const result = await fetch(this.getResourceUrl(resource, endpoint), {
			method: 'GET',
			headers: options.headers,
		}).catch((err) => {
			this.updateConnectionState(ignoreFails, false)
			console.warn('Connection err', err)
		})
		if (!result) return null
		return await this.validateResponse(ignoreFails, result)
	}

	private async post(resource: string, data, endpoint = 'default', ignoreFails = false, options: HttpOptions = { url: null, headers: {} }) {
		const contentType = this.getContentType(data)
		if (!Object.prototype.hasOwnProperty.call(options.headers, 'Content-Type')) {
			options.headers = { ...options.headers, ...{ 'Content-Type': contentType } }
		}

		const result = await fetch(this.getResourceUrl(resource, endpoint), {
			method: 'POST',
			headers: options.headers,
			body: this.formatPostData(data),
		}).catch((err) => {
			this.updateConnectionState(ignoreFails, false)
			console.warn('Connection err', err)
		})
		if (!result) return null
		return await this.validateResponse(ignoreFails, result)
	}

	private getContentType(data: unknown): string {
		if (data instanceof FormData) return 'application/x-www-form-urlencoded'
		return 'application/json'
	}

	private formatPostData(data): BodyInit {
		if (data instanceof FormData) return data
		return JSON.stringify(data)
	}

	private updateConnectionState(ignoreFails: boolean, working: boolean) {
		if (ignoreFails) return
		this.connectionStateOK = working
		console.log(LOGTAG + ' setting status', working)
	}

	private async validateResponse(ignoreFails, response: globalThis.Response): Promise<Response> {
		if (!response) {
			console.warn('can not get response', response)
			this.updateConnectionState(ignoreFails, false)
			return
		}
		const jsonData = await response.json()
		if (!jsonData) {
			console.warn('not json response', response, jsonData)
			this.updateConnectionState(ignoreFails, false)
			return
		}
		this.updateConnectionState(ignoreFails, true)
		return {
			data: jsonData,
			status: response.status,
			headers: response.headers,
			url: response.url,
			cached: false,
		} as Response
	}

	getResourceUrl(resource: string, endpoint = 'default'): string {
		const base = this.getBaseUrl()
		if (endpoint == 'default') {
			return this.getApiBaseUrl() + '/' + resource
		} else {
			const substitute = endpoint.replace('{$BASE}', base)
			return substitute + '/' + resource
		}
	}

	getApiBaseUrl() {
		const cfg = this.networkConfig
		return this.getBaseUrl() + cfg.endpoint + cfg.version
	}

	getBaseUrl(): string {
		const cfg = this.networkConfig
		return cfg.protocol + '://' + cfg.net + cfg.host
	}

	async getAllTestNetNames() {
		const debug = await this.storage.isDebugMode()
		const re: string[][] = []

		for (const entry of MAP) {
			if (entry.key == 'main') continue
			if (entry.key == 'gnosis') continue
			if (!entry.active) continue
			if (entry.onlyDebug && !debug) continue
			re.push([this.capitalize(entry.key) + ' (Testnet)', entry.key])
		}
		return re
	}

	capitalize(text) {
		return text.charAt(0).toUpperCase() + text.slice(1)
	}

	getHostName() {
		const network = this.networkConfig
		return network.host
	}

	/**
	 * Avoid whenever possible. Most of the time you can archive your goal by using the
	 * api.getNetwork().clCurrency or api.getNetwork().elCurrency for currencies.
	 * And api.getNetwork().name for the network name and api.getCurrenciesFormatted()
	 * for a formatted output of one/both currencies.
	 * @returns true if the current network is the mainnet
	 */
	isGnosis() {
		return this.networkConfig.key == 'gnosis'
	}

	/**
	 * Returns the formatted currencies for the network
	 */
	public getCurrenciesFormatted(): string {
		const network = this.networkConfig
		if (network.elCurrency.internalName == network.clCurrency.internalName) {
			return network.clCurrency.formattedName
		}
		return network.clCurrency.formattedName + ' / ' + network.elCurrency.formattedName
	}
}

export interface Response {
	cached: boolean
	data
	headers: Headers
	status: number
	url: string
}

export function initializeApiService(service: ApiService): () => Promise<void> {
	return () => service.initialize()
}
