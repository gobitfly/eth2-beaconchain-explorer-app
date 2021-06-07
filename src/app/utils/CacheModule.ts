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

interface CachedData {
    time: number
    data: any
}

const STALE_TIME = 6 * 60 * 1000 // 6 Minutes

export class CacheModule {

    private keyPrefix = ""

    constructor(keyPrefix: string = "") {
        this.keyPrefix = keyPrefix
    }

    private cache: Map<String, CachedData> = new Map()

    protected putCache(key: string, data: any) {
        this.cache[this.getKey(key)] = {
            time: this.getTimestamp(),
            data: data
        }
    }

    protected getCache(key: string) {
        const temp = this.cache[this.getKey(key)]
        if (!temp || temp.time + STALE_TIME < this.getTimestamp()) {
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
    }

    private getTimestamp(): number {
        return new Date().getTime()
    }

    private getKey(key: string) {
        return this.keyPrefix + key
    }

}