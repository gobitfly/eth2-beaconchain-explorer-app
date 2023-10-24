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
	protected initialized: Promise<void>

	private cache: Map<string, CachedData> = new Map()
	private hotOnly: Map<string, CachedData> = new Map()

	private hardStorageSizeLimit: number

	constructor(
		keyPrefix = '',
		staleTime = 6 * 60 * 1000,
		hardStorage: StorageService = null,
		hardStorageSizeLimit: number = 1000,
		callInit: boolean = true
	) {
		this.keyPrefix = keyPrefix
		this.staleTime = staleTime
		this.hardStorage = hardStorage
		this.hardStorageSizeLimit = hardStorageSizeLimit
		if (callInit) this.init()
	}

	protected async init() {
		if (this.hardStorage) {
			this.hardStorage.setObject('cachemodule_' + this.keyPrefix, null, false)
			await this.initHardCache()
			this.initialized = Promise.resolve()
		} else {
			this.initialized = Promise.resolve()
		}
	}

	private async initHardCache() {
		// dont load hardStorage if last time it was written too is more than 6 hours ago
		const lastWrite = (await this.hardStorage.getObject('cachemodule2_' + this.keyPrefix + '_lastWrite')) as number
		if (lastWrite && lastWrite + 6 * 60 * 60 * 1000 < this.getTimestamp()) {
			console.log('[CacheModule] hardStorage too old, ignoring')
		} else {
			const result = (await this.hardStorage.getObject('cachemodule2_' + this.keyPrefix)) as Map<string, CachedData>
			if (result) {
				this.cache = result
			}
			this.checkHardCacheSize()
		}
	}

	private async checkHardCacheSize() {
		try {
			let kiloBytes = null
			if (this.hardStorage) {
				const size = new TextEncoder().encode(JSON.stringify(this.cache, replacer)).length
				kiloBytes = Math.round((size * 100) / 1024) / 100
			}
			console.log('[CacheModule] initialized with ', kiloBytes == null ? '(unknown size)' : '(' + kiloBytes + ' KiB)', this.cache)
			if (kiloBytes && kiloBytes > this.hardStorageSizeLimit) {
				console.warn('[CacheModule] storage cap exceeded (1 MB), clearing cache')
				await this.clearHardCache()
			}
		} catch (e) {
			console.warn('could not calculate cache size')
		}
	}

	private getStoreForCacheKey(cacheKey: string): Map<string, CachedData> {
		// rationale: don't store big data objects in hardStorage due to severe performance impacts
		const storeHard =
			cacheKey.indexOf('app/dashboard') >= 0 ||
			cacheKey.indexOf('produced?offset=0') >= 0 || // first page of blocks page
			(cacheKey.indexOf('beaconcha.in') < 0 && cacheKey.indexOf('gnosischa.in') < 0 && cacheKey.indexOf('ads.bitfly') < 0)
		return storeHard ? this.cache : this.hotOnly
	}

	public async deleteAllHardStorageCacheKeyContains(search: string) {
		if (!this.hardStorage) {
			return
		}
		search = search.toLocaleLowerCase()
		const keys = Array.from(this.cache.keys())
		for (let i = 0; i < keys.length; i++) {
			if (keys[i].toLocaleLowerCase().indexOf(search) >= 0) {
				this.cache.delete(keys[i])
			}
		}

		await this.hardStorage.setObject('cachemodule2_' + this.keyPrefix, this.cache, false)
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
				await this.hardStorage.setObject('cachemodule2_' + this.keyPrefix, this.cache, false)
				this.setLastHardCacheWrite()
			}
		} catch (e) {
			if (isQuotaExceededError(e)) {
				await this.clearHardCache()
			}
		}
	}

	private setLastHardCacheWrite() {
		if (this.hardStorage) {
			this.hardStorage.setObject('cachemodule2_' + this.keyPrefix + '_lastWrite', this.getTimestamp(), false)
		}
	}

	public async clearCache() {
		await this.clearHardCache()
		this.hotOnly.clear()
	}

	public async clearNetworkCache() {
		if (this.hardStorage) {
			const network = await this.hardStorage.getNetworkPreferences()
			this.deleteAllHardStorageCacheKeyContains(network.key == 'main' ? '//beaconcha.in' : '//' + network.key)
		}

		this.hotOnly.clear()
	}

	public async clearHardCache() {
		if (this.hardStorage) {
			await this.hardStorage.setObject('cachemodule2_' + this.keyPrefix, null, false)
			this.setLastHardCacheWrite()
			this.cache.clear()
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

	public invalidateAllCache() {
		this.cache = new Map()
		if (this.hardStorage) {
			this.hardStorage.setObject('cachemodule2_' + this.keyPrefix, null, false)
			this.setLastHardCacheWrite()
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
