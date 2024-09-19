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

import { HttpHeaders, HttpOptions } from '@capacitor/core'
import { StatsResponse } from '../controllers/MachineController'
import { Response } from '../services/api.service'
import { ZoneInfo } from '../utils/AdUtils'

export enum Method {
	GET,
	POST,
	DELETE,
	PUT,
}

export interface APIResponse {
	status: string
	data: unknown
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NoContent {}

interface Paging {
	next_cursor: string
}

export class APIError extends Error {
	code: number
	constructor(message: string, code: number) {
		super(message)
		this.code = code
	}
}
export class APINotFoundError extends APIError {
	constructor(message: string, code: number) {
		super(message, code)
		this.name = 'DashboardNotFoundError'
	}
}

export class APIUnauthorizedError extends APIError {
	constructor(message: string, code: number) {
		super(message, code)
		this.name = 'UnauthorizedError'
	}
}

export class APIForbiddenError extends APIError {
	constructor(message: string, code: number) {
		super(message, code)
		this.name = 'ForbiddenError'
	}
}

export class APIRateLimitedError extends APIError {
	constructor(message: string, code: number) {
		super(message, code)
		this.name = 'RateLimitedError'
	}
}

export class APIUnknownError extends APIError {
	constructor(message: string, code: number) {
		super(message, code)
		this.name = 'UnknownError'
	}
}

export interface ApiResult<T> {
	data: T | null
	error: Error | null
	cached: boolean
	paging: Paging | null
}

export function getProperty(obj: unknown, key: string) {
	if (typeof obj === 'object' && obj !== null && key in obj) {
		return (obj as { [key: string]: unknown })[key]
	}
	return undefined
}

export abstract class APIRequest<T> {
	abstract resource: string
	abstract method: Method

	endPoint = 'default'
	postData?: unknown
	expectedResponseStatus = 200
	customCacheKey: string|null = null
	allowCachedResponse = true

	withCustomCacheKey(key: string): this {
		this.customCacheKey = key
		return this
	}

	withAllowedCacheResponse(cached: boolean): this {
		this.allowCachedResponse = cached
		return this
	}

	sortResultFn: ((a: T, b: T) => number) | null = null

	parse(response: Response): T[] | null {
		return this.parseBase(response)
	}

	parse2(response: Response): ApiResult<T[]> {
		if (this.wasSuccessful(response)) {
			return {
				data: this.parse(response),
				error: null,
				cached: response.cached,
				paging: getProperty(response?.data, 'paging') as Paging || null,
			}
		}

		let error: Error | null = null
		if (!response || response.status != this.expectedResponseStatus) {
			error = getHTTPError(
				response ? response.status : 0,
				getProperty(response?.data, 'error') as string || response ? 'HTTP status code: ' + response.status : 'No response error'
			)
		}

		return {
			data: null,
			error: error,
			cached: response?.cached || false,
			paging: null,
		}
	}

	// Usually you can expect either a Response or a boolean
	// response.status can be a string though depending on the type of http connector used
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	wasSuccessful(response: any, hasDataStatus = true): boolean {
		if (typeof response === 'boolean') {
			return response
		}
		return response && (response.status == 'OK' || response.status == this.expectedResponseStatus || !hasDataStatus)
	}

	protected parseBase(response: Response, hasDataStatus = true): T[] | null {
		if (!this.wasSuccessful(response, hasDataStatus)) {
			return []
		}

		if (response && response.data && getProperty(response?.data, 'data')) {
			const data = getProperty(response?.data, 'data')
			if (Array.isArray(data)) {
				if (this.sortResultFn) {
					data.sort(this.sortResultFn)
				}

				return data as T[]
			} else {
				return [data as T]
			}
		}
		return []
	}

	options: HttpOptions = {
		url: undefined, // unused
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		} as HttpHeaders,
	}

	/** @deprecated can be removed in v2 */
	cacheablePOST = false

	/** @deprecated can be removed in v2 */
	requiresAuth = false

	updatesLastRefreshState = false
	maxCacheAge = 6 * 60 * 1000
}

export function getHTTPError(code: number, msg: string): APIError {
	if (code == 404) {
		return new APINotFoundError(msg, code)
	} else if (code == 401) {
		return new APIUnauthorizedError(msg, code)
	} else if (code == 403) {
		return new APIForbiddenError(msg, code)
	} else if (code == 429) {
		return new APIRateLimitedError(msg, code)
	}
	return new APIUnknownError(msg, code)
}


// ------------- Responses -------------

export interface ApiTokenResponse {
	access_token: string
	expires_in: number
	refresh_token: string
	token_type: string
}
export interface GithubReleaseResponse {
	url: string
	html_url: string
	id: number
	tag_name: string
	draft: boolean
	prerelease: boolean
	created_at: string
	published_at: string
}

export interface CoinbaseExchangeResponse {
	base: string
	currency: string
	amount: string
}


export interface BitflyAdResponse {
	html: string
	width: string
	height: string
}



// ------------ Authorized Calls -----------------


export class GetMyMachinesRequest extends APIRequest<StatsResponse> {
	resource = 'user/stats'
	method = Method.GET
	requiresAuth = true
	
	constructor(offset = 0, limit = 180) {
		super()
		this.resource += '/' + offset + '/' + limit
	}
}

/** @deprecated */
export class RefreshTokenRequest extends APIRequest<ApiTokenResponse> {
	resource = 'user/token'
	method = Method.POST
	requiresAuth = true
	maxCacheAge = 1000
	options: HttpOptions = {
		url: null,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json',
		},
	}

	parse(response: Response): ApiTokenResponse[] {
		if (response && response.data) return [response.data] as ApiTokenResponse[]
		else return []
	}

	constructor(refreshToken: string, isIOS: boolean) {
		super()
		// ¯\_(ツ)_/¯
		if (isIOS) {
			this.postData = {
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
			}
		} else {
			const formBody = new FormData()
			formBody.set('grant_type', 'refresh_token')
			formBody.set('refresh_token', refreshToken)
			this.postData = formBody
			this.options.headers = undefined
		}
	}
}

/** @deprecated Has been replaced by V2RegisterPushNotificationToken */
export class UpdateTokenRequest extends APIRequest<APIResponse> {
	resource = 'user/mobile/notify/register'
	method = Method.POST
	requiresAuth = true
	
	parse(response: Response): APIResponse[] | null {
		if (response && response.data) return response.data as APIResponse[]
		return null
	}

	constructor(token: string) {
		super()
		this.postData = { token: token }
	}
}

// ------------ Special external api requests -----------------

export class BitflyAdRequest extends APIRequest<BitflyAdResponse> {
	endPoint = 'https://ads.bitfly.at'

	resource = '/www/delivery/asyncspc.php?zones={ZONE}&prefix={PREFIX}'
	method = Method.GET
	maxCacheAge = 4 * 60 * 1000

	options: HttpOptions = {
		url: null, // unused
		headers: undefined,
	}

	parse(response: Response): BitflyAdResponse[] | null {
		if (!response || !response.data) {
			return []
		}

		return Object.values(response.data)
	}

	constructor(zoneInfo: ZoneInfo) {
		super()
		this.resource = this.resource.replace('{ZONE}', zoneInfo.zones.toString()).replace('{PREFIX}', zoneInfo.prefix)
		console.log('bitfly ad resource', this.resource)
	}
}

export class CoinbaseExchangeRequest extends APIRequest<CoinbaseExchangeResponse> {
	endPoint = 'https://api.coinbase.com'

	resource = 'v2/prices/'
	method = Method.GET
	maxCacheAge = 40 * 60 * 1000

	parse(response: Response): CoinbaseExchangeResponse[] | null {
		return this.parseBase(response, false)
	}

	constructor(currencyPair: string) {
		super()
		this.resource += currencyPair + '/spot'
	}
}

export class GithubReleaseRequest extends APIRequest<GithubReleaseResponse> {
	endPoint = 'https://api.github.com'

	resource = 'repos/'
	method = Method.GET
	maxCacheAge = 4 * 60 * 60 * 1000
	options: HttpOptions = {
		url: null, // unused
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'User-Agent': 'beaconcha.in Dashboard',
		},
	}

	parse(response: Response): GithubReleaseResponse[] {
		if (!this.wasSuccessful(response, false)) {
			return []
		}

		const data = response.data
		if (Array.isArray(data)) {
			return data
		} else {
			return [data as GithubReleaseResponse]
		}
	}

	constructor(repo: string, latest = true) {
		super()
		this.resource += repo + '/releases' + (latest ? '/latest' : '')
	}
}

export default class {}
