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

import { resolve } from "@angular/compiler-cli/src/ngtsc/file_system"
import { StorageService } from "../services/storage.service"

interface CachedData {
    maxStaleTime: number
    time: number
    data: any
}

export class CacheModule {

    private staleTime = 5 * 60 * 1000 // 6 Minutes

    private keyPrefix = ""
    private hardStorage: StorageService = null
    initialized: Promise<any>

    constructor(keyPrefix: string = "", staleTime = 6 * 60 * 1000, hardStorage: StorageService = null) {
        this.keyPrefix = keyPrefix
        this.staleTime = staleTime
        this.hardStorage = hardStorage
        this.init()
    }

    async init() {
        if (this.hardStorage) {
            this.initialized = this.hardStorage.getObject("cachemodule_" + this.keyPrefix)
            let result = await this.initialized
            if(result) this.cache = result
            console.log("[CacheModule] initialized with ", this.cache)
        } else {
            this.initialized = new Promise<void>((resolve) => { resolve() })
            await this.initialized
        }
    }

    private cache: Map<String, CachedData> = new Map()

    protected putCache(key: string, data: any, staleTime = this.staleTime) {
        this.cache.set(this.getKey(key), {
            maxStaleTime: staleTime ?? this.staleTime,
            time: this.getTimestamp(),
            data: data
        })
      
        if (this.hardStorage) {
            this.hardStorage.setObject("cachemodule_"+this.keyPrefix, this.cache)
        }
    }

    protected getCache(key: string) {
        const temp = this.cache.get(this.getKey(key))
        if (!temp || temp.time + temp.maxStaleTime < this.getTimestamp()) {
            return null
        }
        console.log("[CacheModule] getting from cache", temp.data)
        return temp.data
    }

    protected cacheMultiple(prefix: string, data: any[]) {
        if (!data || data.length <= 0) {
            console.log("[CacheModule] ignore cache attempt of empty data set", data)
            return
        }
        for (var i = 0; i < data.length; i++) {
            const current = data[i]
            const index = current.hasOwnProperty("validatorindex") ? data[i].validatorindex :
                current.hasOwnProperty("index") ? data[i].index : console.error("[CacheModule] can not store cache entry - no index")
            if(!index) return
            this.putCache(prefix + index, current)
        }
    }

    protected invalidateMultiple(prefix: string, keys) {
        for (var i = 0; i < keys.length; i++) {
            this.putCache(prefix + keys[i], null)
        }
    }

    protected getMultipleCached(prefix: string, keys: string[]) {
        var result = new Array(keys.length)
        for (var i = 0; i < keys.length; i++) {
            result[i] = this.getCache(prefix + keys[i])
            if (!result[i]) return null;
        }
        return result
    }

    protected invalidateCache(key: string) {
        this.cache[this.getKey(key)] = null
    }

    invalidateAllCache() {
        this.cache = new Map()
        if (this.hardStorage) {
            this.hardStorage.setObject("cachemodule_"+this.keyPrefix, null)
        }
    }

    private getTimestamp(): number {
        return new Date().getTime()
    }

    private getKey(key: string) {
        return this.keyPrefix + key
    }

}