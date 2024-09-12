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

import { Injectable, WritableSignal } from '@angular/core'
import { APIRequest, ApiResult, Method, RefreshTokenRequest } from '../requests/requests'
import { StorageService } from './storage.service'
import { ApiNetwork } from '../models/StorageTypes'
import { Mutex } from 'async-mutex'
import { findChainNetworkById, findConfigForKey, MAP } from '../utils/NetworkData'
import { CacheModule } from '../utils/CacheModule'
import { Capacitor, HttpOptions } from '@capacitor/core'
import { CapacitorCookies } from '@capacitor/core'
import { LatestStateData } from '../requests/types/latest_state'
import { V2LatestState } from '../requests/network'
import { environment } from 'src/environments/environment'
const LOGTAG = '[ApiService]'

const SERVER_TIMEOUT = 25000

const R = 2

@Injectable({
	providedIn: 'root',
})
export class ApiService extends CacheModule {
	networkConfig: ApiNetwork // todo signal?

	private awaitingResponses: Map<string, Mutex> = new Map()

	public lastRefreshed = 0 // only updated by calls that have the updatesLastRefreshState flag enabled

	private lastCacheInvalidate = 0

	private sessionCookie: string
	private apiUserKey: string = null
	private apiAccessKey: string = null

	// holds all cache keys if executed via execute2 and provided with a cacheKey
	private associatedCacheKeyMap: Map<string, Set<string>> = new Map()

	// debug
	debug = false
	private csrfCookie: string // only debug
	private lastCsrfHeader: string = null
	private r = 3

	constructor(private storage: StorageService) {
		super('api', 6 * 60 * 1000, storage, 1000, false)
		this.storage.getBooleanSetting('migrated_4_4_0', false).then((migrated) => {
			if (!migrated) {
				this.clearHardCache()
				console.info('Cleared hard cache storage as part of 4.4.0 migration')
				this.storage.setBooleanSetting('migrated_4_4_0', true)
			}
		})

		this.storage.isDebugMode().then((result) => {
			this.debug = result
			window.localStorage.setItem('debug', this.debug ? 'true' : 'false')
		})
		this.lastCacheInvalidate = Date.now()
	}

	invalidateCache() {
		if (this.lastCacheInvalidate + 40000 < Date.now()) {
			this.lastCacheInvalidate = Date.now()
			console.log('invalidating request cache')
			this.invalidateAllCache()
			this.storage.invalidateAllCache()
		}
	}

	storeInHardCache(cacheKey: string): boolean {
		return (
			cacheKey.indexOf('dashboards') >= 0 ||
			cacheKey.indexOf('produced?offset=0') >= 0 || // first page of blocks page // todo v2
			(cacheKey.indexOf('beaconcha.in') < 0 && cacheKey.indexOf('gnosischa.in') < 0 && cacheKey.indexOf('ads.bitfly') < 0)
		)
	}

	async initialize() {
		await this.loadNetworkConfig()
		await this.initV2Cookies()
		await this.init()
		this.apiUserKey = await this.getApiKey()
		this.apiAccessKey = this.use(environment.API_ACCESS_KEY)
		console.log('API SERVICE INITIALISED', this.apiAccessKey)
	}

	async loadNetworkConfig() {
		async function getConfig(storage: StorageService, config: ApiNetwork) {
			const temp = findConfigForKey(config.key)
			if (temp) {
				if (temp.v2NetworkConfigKey && (await storage.isV2())) {
					const v2Config = findConfigForKey(config.v2NetworkConfigKey)
					if (v2Config) {
						return v2Config
					}
				}
				return temp
			}
			return config
		}

		this.networkConfig = this.networkConfig = await getConfig(this.storage, await this.storage.getNetworkPreferences())
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

	/** @deprecated v1 */
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

	public async initV2Cookies() {
		const user = await this.storage.getAuthUserv2()
		if (!user || !user.Session) return null

		console.log('init cookies', this.networkConfig.protocol + '://' + this.networkConfig.net + this.networkConfig.host, user.Session)

		await CapacitorCookies.setCookie({
			url: this.networkConfig.protocol + '://' + this.networkConfig.net + this.networkConfig.host,
			key: 'session_id',
			value: user.Session,
		})

		if (await this.storage.isHttpAllowed()) {
			await CapacitorCookies.setCookie({
				url: 'http://' + this.networkConfig.net + this.networkConfig.host,
				key: 'session_id',
				value: user.Session,
			})
		}

		this.r += this.r * R - R ** R
		this.sessionCookie = user.Session
	}

	/** @deprecated v1 */
	async refreshToken() {
		const user = await this.storage.getAuthUser()
		if (!user || !user.refreshToken) {
			console.warn('No refreshtoken, cannot refresh token')
			return null
		}

		const now = Date.now()
		const req = new RefreshTokenRequest(user.refreshToken, Capacitor.getPlatform() == 'ios')

		const resp = await this.execute(req)
		const response = req.parse(resp)
		const result = response[0]

		// Intention to not log access token in app logs
		if (this.debug) {
			console.log('Refresh token', result, resp)
		} else {
			if (result && result.access_token) {
				console.log('Refresh token', 'success')
			} else {
				console.log('Refresh token', result, resp)
			}
		}

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
			this.awaitingResponses[resource] = new Mutex()
		}
		await this.awaitingResponses[resource].acquire()
	}

	private unlock(resource) {
		this.awaitingResponses[resource].release()
	}

	isNotEthereumMainnet(): boolean {
		const test = this.networkConfig.key != 'main'
		return test
	}

	isEthereumMainnet(): boolean {
		return !this.isNotEthereumMainnet()
	}

	getCacheKey(request: APIRequest<unknown>): string {
		if (request.method == Method.GET) {
			if (request.customCacheKey) {
				return request.customCacheKey
			}
			return request.method + this.getResourceUrl(request.resource, request.endPoint)
		} else if (request.cacheablePOST) {
			return request.method + this.getResourceUrl(request.resource, request.endPoint) + JSON.stringify(request.postData)
		}
		return null
	}

	async execute2<T>(request: APIRequest<T>, associatedCacheKey: string = null): Promise<ApiResult<T[]>> {
		const response = await this.execute(request)
		if (associatedCacheKey) {
			if (this.associatedCacheKeyMap.has(associatedCacheKey)) {
				this.associatedCacheKeyMap.get(associatedCacheKey).add(this.getCacheKey(request))
			} else {
				this.associatedCacheKeyMap.set(associatedCacheKey, new Set([this.getCacheKey(request)]))
			}
		}
		return request.parse2(response)
	}

	async clearAllAssociatedCacheKeys(associatedCacheKey: string) {
		const keys = this.associatedCacheKeyMap.get(associatedCacheKey)
		if (keys) {
			for (const key of keys) {
				await this.putCache(key, null, 0)
				this.findAndClearAssociatedKeyInOtherKeys(associatedCacheKey)
			}
			this.associatedCacheKeyMap.delete(associatedCacheKey)
		}
	}

	private findAndClearAssociatedKeyInOtherKeys(associatedCacheKey: string) {
		for (const [_, value] of this.associatedCacheKeyMap) {
			if (value.has(associatedCacheKey)) {
				value.delete(associatedCacheKey)
			}
		}
	}

	async execute(request: APIRequest<unknown>): Promise<Response> {
		await this.initialized

		await this.lockOrWait(request.resource)

		try {
			if (request.allowCachedResponse) {
				// If cached and not stale, return cache
				const cached = (await this.getCache(this.getCacheKey(request))) as Response
				if (cached) {
					if (this.lastRefreshed == 0) this.lastRefreshed = Date.now()
					cached.cached = true
					return cached
				}
			}

			const options = request.options

			// second is special case for notifications
			// notifications are rescheduled if response is != 200
			// but user can switch network in the mean time, so we need to reapply the network
			// the user was currently on, when they set the notification toggle
			// hence the additional request.requiresAuth
			if (request.endPoint == 'default' || request.requiresAuth) {
				if (await this.storage.isV2()) {
					if (!this.sessionCookie) {
						await this.initV2Cookies()
					}

					if (request.method != Method.GET) {
						options.headers = { ...options.headers, 'X-Csrf-Token': this.lastCsrfHeader }
					}

					// DANGEROUS
					// Strictly for development purposes. Intention is this to be used in local
					// setup to develop in browser instead of native device. Since fetch does not allow
					// setting cookies yourself, we can use the X-Cookie header with a reverse proxy to
					// get sessions working in development environment.
					if (this.networkConfig.passXCookieDANGEROUS) {
						let csrfCookieExtra = ''
						if (this.csrfCookie) {
							csrfCookieExtra = '; _gorilla_csrf=' + this.csrfCookie + '; '
						}
						options.headers = { ...options.headers, 'X-Cookie': 'session_id=' + this.sessionCookie + csrfCookieExtra }
					} else {
						if (this.apiAccessKey) {
							options.headers = { ...options.headers, 'x-mobile-token': this.apiAccessKey }
						}
					}
				} else {
					const authHeader = await this.getAuthHeader(request instanceof RefreshTokenRequest)

					if (authHeader) {
						const headers = { ...options.headers, ...authHeader }
						options.headers = headers
					}
				}
			}

			console.log(LOGTAG + ' Send request: ' + request.resource, request.method, request)
			const startTs = Date.now()

			const response = this.doHttp(request.method, request.resource, request.postData, request.endPoint, options)

			const result = await response

			if (!result) {
				console.log(LOGTAG + ' Empty Response: ' + request.resource, 'took ' + (Date.now() - startTs) + 'ms')
				return result
			}

			if ((request.method == Method.GET || request.cacheablePOST) && result && result.status == request.expectedResponseStatus && result.data) {
				this.putCache(this.getCacheKey(request), result, request.maxCacheAge)
			}

			if (request.method == Method.GET) {
				const temp = result.headers.get('x-csrf-token')
				if (temp) {
					this.lastCsrfHeader = temp
					console.log("set csrf token", temp)
				}

				// workaround for non native development
				if (this.networkConfig.passXCookieDANGEROUS) {
					const setCookie = result.headers.get('x-set-cookie')

					if (setCookie) {
						const keyAndValue = setCookie.split(';')[0]
						if (keyAndValue) {
							const split = keyAndValue.split('=')
							if (split.length == 2) {
								const value = split[1]
								this.csrfCookie = value
							}
						}
					}
				}
			}

			if (request.updatesLastRefreshState) this.updateLastRefreshed(result)

			console.log(LOGTAG + ' Response: ' + result.url + '', 'took ' + (Date.now() - startTs) + 'ms', result)

			result.cached = false

			return result
		} finally {
			this.unlock(request.resource)
		}
	}

	private async doHttp(
		method: Method,
		resource: string,
		data,
		endpoint = 'default',
		options: HttpOptions = { url: null, headers: {} }
	) {
		let body: BodyInit = undefined
		if (method == Method.POST || method == Method.PUT) {
			if (!Object.prototype.hasOwnProperty.call(options.headers, 'Content-Type')) {
				if (!(data instanceof FormData)) {
					options.headers = { ...options.headers, ...{ 'Content-Type': this.getContentTypeBasedOnData(data) } }
				}
			}
			body = this.formatPostData(data, resource)
		}

		if (this.apiUserKey && endpoint == 'default') {
			options.headers = {
				...options.headers,
				...{
					Authorization: 'Bearer ' + this.apiUserKey,
				},
			}
		}

		try {
			const result = await fetch(this.getResourceUrl(resource, endpoint), {
				method: Method[method],
				headers: options.headers,
				body: body,
				credentials: endpoint == 'default' ? 'include' : 'omit',
			})
			if (!result) return null
			return await this.validateResponse(result)
		} catch (e) {
			console.warn('fetch error', e)
			return null
		}
	}

	async clearSpecificCache(request: APIRequest<unknown>) {
		await this.putCache(this.getCacheKey(request), null, request.maxCacheAge)
	}

	private updateLastRefreshed(response: Response) {
		if (response && response.status == 200) {
			this.lastRefreshed = Date.now()
		}
	}

	private getContentTypeBasedOnData(data: unknown): string {
		if (data instanceof FormData) return 'application/x-www-form-urlencoded'
		return 'application/json'
	}

	private formatPostData(data, resource: string): BodyInit {
		if (data instanceof FormData || resource.indexOf('user/token') != -1) return data
		return JSON.stringify(data)
	}

	private async validateResponse(response: globalThis.Response): Promise<Response> {
		if (!response) {
			console.warn('can not get response', response)
			return
		}
		let jsonData
		try {
			jsonData = await response.json()
			if (!jsonData) {
				console.warn('not json response', response, jsonData)
				return {
					data: null,
					status: response.status,
					headers: response.headers,
					url: response.url,
					cached: false,
				} as Response
			}
		} catch (e) {
			console.log('could not parse json', e)
			// Auth response can be empty, maybe improve handling in the future
		}
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
			re.push([capitalize(entry.key) + ' (Testnet)', entry.key])
		}
		return re
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
		// todo refactor to chainID
		return this.networkConfig.key == 'gnosis'
	}

	/**
	 * Returns the formatted currencies for the network
	 */
	public getCurrenciesFormatted(chainID: number): string {
		const network = findChainNetworkById(chainID)
		if (network.elCurrency.internalName == network.clCurrency.internalName) {
			return network.clCurrency.formattedName
		}
		return network.clCurrency.formattedName + ' / ' + network.elCurrency.formattedName
	}

	// Helper function since this is used quite often
	// and caching is already done by ApiService itself
	public async getLatestState(force: boolean = false): Promise<LatestStateWithTime> {
		const temp = await this.execute2(new V2LatestState().withAllowedCacheResponse(!force))
		if (temp.error) {
			console.warn('getLatestState error', temp.error)
			return null
		}
		const result = {
			state: temp.data[0],
			ts: Date.now(),
		}

		if (temp.cached != true) {
			await this.storage.setLastEpochRequestTime(Date.now())
		} else {
			result.ts = await this.storage.getLastEpochRequestTime()
		}
		return result
	}

	set<T>(request: APIRequest<T>, s: WritableSignal<T>, associatedCacheKey: string = null) {
		return this.execute2(request, associatedCacheKey).then((data) => {
			if (data.error) {
				return data
			}
			s.set(data.data[0])
			return data
		})
	}
	setArray<T>(request: APIRequest<T>, s: WritableSignal<T[]>, associatedCacheKey: string = null) {
		return this.execute2(request, associatedCacheKey).then((data) => {
			if (data.error) {
				return data
			}
			s.set(data.data)
			return data
		})
	}

	setApiKey(apiKey: string) {
		this.apiUserKey = apiKey
		return this.storage.setItem('api_key', apiKey)
	}

	getApiKey(): Promise<string> {
		return this.storage.getItem('api_key')
	}

	use(e) {
		if (!e) return null
		const t = e.split('').reverse().join('')
		let l = ''
		for (e = 0; e < t.length; e += 2) l += t[e]
		let n = ''
		for (e = 0; e < l.length; e++) n += String.fromCharCode(l.charCodeAt(e) - this.r)
		return n
	}

	async setCurrentDashboardChainID(chainID: number) {
		return this.storage.setObject('current_dashboard_chain_id', chainID)
	}

	async getCurrentDashboardChainID(): Promise<number> {
		let data = (await this.storage.getObject('current_dashboard_chain_id')) as number
		if (!data) data = this.networkConfig.supportedChainIds[0]
		console.log('getCurrentDashboardChainID', data)
		return data
	}
}

export interface LatestStateWithTime {
	state: LatestStateData
	ts: number // at which the request was made
}

export interface Response {
	cached: boolean
	data
	headers: Headers
	status: number
	url: string
}

export function capitalize(text) {
	if (typeof text !== 'string') return ''
	return text.charAt(0).toUpperCase() + text.slice(1)
}
