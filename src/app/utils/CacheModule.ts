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

import { StorageService, replacer } from '../services/storage.service'
import { Validator } from './ValidatorUtils'

interface CachedData {
	maxStaleTime: number
	time: number
	data: unknown
}

export class CacheModule {
	private staleTime

	private keyPrefix = ''
	private hardStorage: StorageService = null
	initialized: Promise<Map<string, CachedData>>

	constructor(keyPrefix = '', staleTime = 6 * 60 * 1000, hardStorage: StorageService = null) {
		this.keyPrefix = keyPrefix
		this.staleTime = staleTime
		this.hardStorage = hardStorage
		this.init()
	}

	private async init() {
		if (this.hardStorage) {
			this.hardStorage.setObject('cachemodule_' + this.keyPrefix, null)
			this.initialized = this.hardStorage.getObject('cachemodule2_' + this.keyPrefix) as Promise<Map<string, CachedData>>
			const result = await this.initialized
			if (result) {
				this.cache = result
			}
			try {
				let kiloBytes = null
				if (this.hardStorage) {
					const size = new TextEncoder().encode(JSON.stringify(this.cache, replacer)).length
					kiloBytes = Math.round((size * 100) / 1024) / 100
				}
				console.log('[CacheModule] initialized with ', kiloBytes == null ? '(unknown size)' : '(' + kiloBytes + ' KiB)', this.cache)
				if (kiloBytes && kiloBytes > 1000) {
					console.warn('[CacheModule] storage cap exceeded (1 MB), clearing cache')
					await this.clearHardCache()
				}
			} catch (e) {
				console.warn('could not calculate cache size')
			}
		} else {
			this.initialized = new Promise<Map<string, CachedData>>((resolve) => {
				resolve(new Map<string, CachedData>())
			})
			await this.initialized
		}
	}

	private cache: Map<string, CachedData> = new Map()
	private hotOnly: Map<string, CachedData> = new Map()

	private getStoreForCacheKey(cacheKey: string): Map<string, CachedData> {
		// rationale: don't store big data objects in hardStorage due to severe performance impacts
		const storeHard = cacheKey.indexOf('app/dashboard') >= 0 || cacheKey.indexOf('beaconcha.in') < 0 // or store all non beaconchain requests
		return storeHard ? this.cache : this.hotOnly
	}

	protected async putCache(key: string, data: unknown, staleTime = this.staleTime) {
		const cacheKey = this.getKey(key)
		const store = this.getStoreForCacheKey(cacheKey)

		store.set(cacheKey, {
			maxStaleTime: staleTime ?? this.staleTime,
			time: this.getTimestamp(),
			data: data,
		})

		try {
			if (this.hardStorage) {
				await this.hardStorage.setObject('cachemodule2_' + this.keyPrefix, this.cache)
			}
		} catch (e) {
			if (isQuotaExceededError(e)) {
				await this.clearHardCache()
			}
		}
	}

	async clearCache() {
		await this.clearHardCache()
		this.cache.clear()
		this.hotOnly.clear()
	}

	async clearHardCache() {
		if (this.hardStorage) {
			await this.hardStorage.setObject('cachemodule2_' + this.keyPrefix, null)
		}
	}

	protected async getCache(key: string) {
		await this.initialized
		if (!key) {
			return null
		}

		const cacheKey = this.getKey(key)
		const store = this.getStoreForCacheKey(cacheKey)

		const temp = store.get(this.getKey(key))
		if (!temp || temp.time + temp.maxStaleTime < this.getTimestamp()) {
			return null
		}

		return temp.data
	}

	protected cacheMultiple(prefix: string, data: Validator[]) {
		if (!data || data.length <= 0) {
			console.log('[CacheModule] ignore cache attempt of empty data set', data)
			return
		}

		for (let i = 0; i < data.length; i++) {
			const current = data[i]
			const index = data[i].index
			if (!index) {
				return
			}
			this.putCache(prefix + index, current)
		}
	}

	protected async getMultipleCached(prefix: string, keys: string[]) {
		const result = new Array(keys.length)
		for (let i = 0; i < keys.length; i++) {
			result[i] = await this.getCache(prefix + keys[i])
			if (!result[i]) {
				return null
			}
		}
		return result
	}

	protected invalidateCache(key: string) {
		this.cache[this.getKey(key)] = null
	}

	invalidateAllCache() {
		this.cache = new Map()
		if (this.hardStorage) {
			this.hardStorage.setObject('cachemodule2_' + this.keyPrefix, null)
		}
	}

	private getTimestamp(): number {
		return new Date().getTime()
	}

	private getKey(key: string) {
		return this.keyPrefix + key
	}
}

function isQuotaExceededError(err: unknown): boolean {
	return (
		err instanceof DOMException &&
		// everything except Firefox
		(err.code === 22 ||
			// Firefox
			err.code === 1014 ||
			// test name field too, because code might not be present
			// everything except Firefox
			err.name === 'QuotaExceededError' ||
			// Firefox
			err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
	)
}
