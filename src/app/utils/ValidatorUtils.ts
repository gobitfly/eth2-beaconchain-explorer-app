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

import { ApiService } from '../services/api.service';
import { StorageService } from '../services/storage.service';
import { Injectable } from '@angular/core';
import { EpochRequest, EpochResponse, RemoveMyValidatorsRequest, AttestationPerformanceResponse, ValidatorRequest, ValidatorResponse, ValidatorETH1Request, GetMyValidatorsRequest, MyValidatorResponse, DashboardRequest, DashboardResponse, RocketPoolResponse, RocketPoolNetworkStats, ExecutionResponse } from '../requests/requests';
import { AlertService } from '../services/alert.service';
import { CacheModule } from './CacheModule';
import { MerchantUtils } from './MerchantUtils';
import BigNumber from 'bignumber.js';
import { UnitconvService } from '../services/unitconv.service';

export const SAVED = 0 // stored locally
export const MEMORY = 1 // Search results etc

const VERSION = 1

const KEYPREFIX = "validators_"
export const LAST_TIME_ADDED_KEY = "last_time_added"
export const LAST_TIME_REMOVED_KEY = "last_time_removed"

const cachePerformanceKeyBare = "performance";
const cacheAttestationKeyBare = "attestationperformance";
const epochCachedKeyBare = "epochcached"
const allMyKeyBare = "allmy"
const cacheValidatorsKeyBare = "validators_"

export enum ValidatorState {
    ACTIVE, OFFLINE, SLASHED, WAITING, ELIGABLE, EXITED, UNKNOWN
}

export interface Validator {
    index: number
    pubkey: string
    name: string
    storage: (typeof SAVED | typeof MEMORY)
    synced: boolean
    version: number
    data: ValidatorResponse
    state: ValidatorState
    attrEffectiveness: number
    rocketpool: RocketPoolResponse
    execution: ExecutionResponse
    share: number 
    rplshare: number
    execshare: number 
}

@Injectable({
    providedIn: 'root'
})
export class ValidatorUtils extends CacheModule {

    private listeners: (() => void)[] = []

    private currentEpoch: EpochResponse
    private olderEpoch: EpochResponse
    rocketpoolStats: RocketPoolNetworkStats

    constructor(
        private api: ApiService,
        private storage: StorageService,
        private alerts: AlertService,
        private merchantUtils: MerchantUtils,
        private unitConversion: UnitconvService
    ) {
        super("vu_") // initialize cache module with vu prefix
    }

    notifyListeners() {
        this.listeners.forEach((callback) => callback())
    }

    registerListener(listener: () => void) {
        this.listeners.push(listener)
    }

    async hasLocalValdiators() {
        return (await this.getMap(await this.getStorageKey())).size > 0
    }

    async localValidatorCount() {
        return (await this.getMap(await this.getStorageKey())).size
    }

    public async getStorageKey(): Promise<string> {
        return KEYPREFIX + await this.api.getNetworkName()
    }

    async migrateTo3Dot2() {
        const share = await this.storage.getStakingShare()
        var valis = await this.getAllValidatorsLocal()
        for (var i = 0; i < valis.length; i++) {
            valis[i].share = share.toNumber()
        }
        this.saveValidatorsLocal(valis)
    }

    public async getMap(storageKey: string): Promise<Map<String, Validator>> {
        const erg = await this.storage.getObject(storageKey)
        if (erg && erg instanceof Map) return erg
        return new Map<String, Validator>()
    }

    private async getMapWithoutDeleted(storageKey) : Promise<Map<String, Validator>> {
        const local = await this.getMap(storageKey)
        const deleted = await this.getDeletedSet(storageKey)
        if (await this.storage.isLoggedIn()) {
            for (const locallyDeleted of deleted) {
                local.delete(locallyDeleted)
            }
        }
        return local
    }

    public async getDeletedSet(storageKey: string): Promise<Set<string>> {
        const erg = await this.storage.getObject(storageKey + "_deleted")
        if (erg && Array.isArray(erg)) return new Set(erg)
        return new Set<string>()
    }

    public async setDeleteSet(storageKey: string, list: Set<string>) {
        if (!(await this.storage.isLoggedIn())) return
        this.storage.setObject(storageKey + "_deleted", [...list])
    }

    async clearDeletedSet() {
        const storageKey = await this.getStorageKey()
        this.setDeleteSet(storageKey, new Set<string>())
    }

    async deleteAll() {
        const storageKey = await this.getStorageKey()
        const current = await this.getMap(storageKey)
        this.storage.setObject(storageKey, new Map<String, Validator>())

        const deletedList = await this.getDeletedSet(storageKey)
        current.forEach((_, key) => {
            deletedList.add(key.toString())
        })

        this.setDeleteSet(storageKey, deletedList)

        this.storage.setObject(LAST_TIME_REMOVED_KEY, { timestamp: Date.now() })
        this.notifyListeners()
    }

    async deleteValidatorLocal(validator: ValidatorResponse) {
        const storageKey = await this.getStorageKey()
        const current = await this.getMap(storageKey)
        current.delete(validator.pubkey)
        this.storage.setObject(storageKey, current)

        const deletedList = await this.getDeletedSet(storageKey)
        deletedList.add(validator.pubkey)
        this.setDeleteSet(storageKey, deletedList)
        console.log("delete set", deletedList)

        this.storage.setObject(LAST_TIME_REMOVED_KEY, { timestamp: Date.now() })
    }

    async saveValidatorsLocal(validators: Validator[]) {
        const storageKey = await this.getStorageKey()

        var current = await this.getMap(storageKey)
        var newMap = new Map<String, Validator>()

        validators.forEach((validator) => {
            newMap.set(validator.pubkey, validator)
        })

        current.forEach((value, key) => {
            if(!newMap.has(key)) newMap.set(key, value)
        })

        this.storage.setObject(storageKey, newMap)
        this.notifyListeners()
    }

    async saveRocketpoolCollateralShare(nodeAddress: string, sharePercent: number) {
        this.storage.setObject("rpl_share_" + nodeAddress, { share: sharePercent })
    }

    async getRocketpoolCollateralShare(nodeAddress: string): Promise<number> {
        const temp = await this.storage.getObject("rpl_share_" + nodeAddress)
        if (!temp) return null
        return temp.share
    }

    async getValidatorLocal(pubkey: string): Promise<Validator> {
        const current = await this.getMap(await this.getStorageKey())
        return current.get(pubkey)
    }

    async getAllValidatorsLocal(): Promise<Validator[]> {
        const current = await this.getMap(await this.getStorageKey())
        const erg: Validator[] = [...current.values()]
        return erg
    }


    async getAllMyValidators(): Promise<Validator[]> {
        const storageKey = await this.getStorageKey()
        const local = await this.getMapWithoutDeleted(storageKey)
      
        const validatorString = getValidatorQueryString([...local.values()], 2000, await this.merchantUtils.getCurrentPlanMaxValidator() - 1)

        // TODO::
       /* const cached = await this.getMultipleCached(allMyKeyBare, validatorString.split(","))
        if (cached != null) {
            console.log("return my validators from cache")
            return cached
        }*/

        const remoteUpdatesPromise = this.getDashboardDataValidators(SAVED,
            validatorString
        ).catch(err => { return [] })
        if (remoteUpdatesPromise == null) return null
        
        const remoteUpdates = await remoteUpdatesPromise

        remoteUpdates.forEach((item) => {
            local.set(item.pubkey, item)
        })

        // update local info
        this.storage.setObject(storageKey, local)

        const result = [...local.values()]

        this.cacheMultiple(allMyKeyBare, result)

        return result
    }

    async updateValidatorStates(validators: Validator[]) {
        const epoch = await this.getRemoteCurrentEpoch()
        validators.forEach((item) => {
            item.state = this.getValidatorState(item, epoch)
        })
    }

    // checks if remote validators are already known locally.
    // If not, return all indizes of non locally known validators
    public async getAllNewIndizesOnly(myRemotes: MyValidatorResponse[]): Promise<number[]> {
        const storageKey = await this.getStorageKey()
        const current = await this.getMap(storageKey)

        const result: number[] = []
        myRemotes.forEach((remote) => {
            if (!current.has(remote.PubKey)) {
                result.push(remote.Index)
            }
        })

        return result
    }
    
    getValidatorState(item: Validator, currentEpoch: EpochResponse): ValidatorState {
        if (item.data.slashed == false &&
            item.data.lastattestationslot >= (currentEpoch.epoch - 2) * 32 && // online since last two epochs
            item.data.exitepoch >= currentEpoch.epoch &&
            item.data.activationepoch <= currentEpoch.epoch) {
            return ValidatorState.ACTIVE
        }

        if (item.data.slashed) return ValidatorState.SLASHED
        if (item.data.exitepoch < currentEpoch.epoch) return ValidatorState.EXITED
        if (item.data.activationeligibilityepoch > currentEpoch.epoch) return ValidatorState.ELIGABLE
        if (item.data.activationepoch > currentEpoch.epoch) return ValidatorState.WAITING
        if (item.data.lastattestationslot < (currentEpoch.epoch - 2) * 32) return ValidatorState.OFFLINE

        // default case
        return ValidatorState.OFFLINE
    }

    public async removeValidatorRemote(pubKey: string) {
        const request = new RemoveMyValidatorsRequest(pubKey)
        const response = await this.api.execute(request).catch((error) => { return false })
        if (!response) return false
        return request.wasSuccessfull(response)
    }

    async getMyRemoteValidators(): Promise<MyValidatorResponse[]> {
        const request = new GetMyValidatorsRequest()
        const response = await this.api.execute(request)
        const result = request.parse(response)
        console.log("My remote validators", result, response)
        return result
    }

    
    private lastFreshTime = 0
    async getDashboardDataValidators(storage: (0 | 1), ...validators): Promise<Validator[]> {
        /*const cacheKey = await this.getCachedValidatorKey()
        // if request is cached, return processed cached data
        const cached = await this.getMultipleCached(cacheKey, validators)
        console.log("request cached, return processed cached data", cached)
        if (cached != null && cached.length > 0 && this.lastFreshTime + 6 * 60 * 1000 > Date.now()) return cached
*/
        const request = new DashboardRequest(validators)
        const response = await this.api.execute(request)
       
        if (!request.wasSuccessfull(response)) {
            if (response && response.data && response.data.status && response.data.status.indexOf("only a maximum of") >= 0) {
                throw new Error(response.data.status);
            }
            this.api.clearSpecificCache(request)
            return []
        }

        const result = request.parse(response)[0]
        this.lastFreshTime = Date.now()
        this.currentEpoch = result.currentEpoch[0]
        this.olderEpoch = result.olderEpoch[0]
        this.rocketpoolStats = result.rocketpool_network_stats[0]
        const validatorEffectivenessResponse = result.effectiveness
        const validatorsResponse = result.validators
 
        this.updateRplAndRethPrice()

        if (response.cached != true) { 
            await this.storage.setLastEpochRequestTime(Date.now())
        } else {
            const lastCachedTime = await this.storage.getLastEpochRequestTime()
            this.currentEpoch.lastCachedTimestamp = lastCachedTime
        }

        var local = null
        if (storage == SAVED) {
            local = await this.getMapWithoutDeleted(await this.getStorageKey())
        }

        const temp = this.convertToValidatorModel({ synced: false, storage: storage, validatorResponse: validatorsResponse })
        await this.updateValidatorStates(temp)
        for (let vali of temp) {
            vali.attrEffectiveness = this.findAttributionEffectiveness(validatorEffectivenessResponse, vali.index)
            vali.rocketpool = this.findRocketpoolResponse(result.rocketpool_validators, vali.index)
            vali.execution = this.findExecutionResponse(result.execution_performance, vali.index)
            if (local) {
                const found = local.get(vali.pubkey)
                if (found) {
                    vali.share = found.share
                    vali.execshare = (found.execshare == null || found.execshare == undefined) ? found.share : found.execshare
                }
            }
            if (vali.rocketpool) {
                vali.rplshare = await this.getRocketpoolCollateralShare(vali.rocketpool.node_address)
            }
        }

       // this.cacheMultiple(cacheKey, temp)
        return temp
    }

    private updateRplAndRethPrice() {
        if (!this.rocketpoolStats) return
        this.unitConversion.setRPLPrice(new BigNumber(this.rocketpoolStats.rpl_price.toString()))
        this.unitConversion.setRETHPrice(new BigNumber(this.rocketpoolStats.reth_exchange_rate.toString()))
    }


    private findExecutionResponse(list: ExecutionResponse[], index: number): ExecutionResponse {
        if(list == null || list.length == 0) return null
        for (let attr of list) {
            if (attr.validatorindex == index) {
              return attr
            }
          }
          return null
    }

    private findRocketpoolResponse(list: RocketPoolResponse[], index: number): RocketPoolResponse {
        for (let attr of list) {
          if (attr.index == index) {
            return attr
          }
        }
        return null
      }

    private findAttributionEffectiveness(list: AttestationPerformanceResponse[], index: number): number {
        for (let attr of list) {
          if (attr.validatorindex == index && attr.attestation_efficiency) {
            return new BigNumber(1).dividedBy(attr.attestation_efficiency).multipliedBy(100).decimalPlaces(1).toNumber()
          }
        }
        return -1
      }

    async getOlderEpoch(): Promise<EpochResponse> {
        return this.olderEpoch
    }
    
    async getRemoteCurrentEpoch(): Promise<EpochResponse> {

        const result = this.currentEpoch



        return result
    }

    async getRemoteValidatorInfo(...args: any): Promise<ValidatorResponse[]> {
        if (!args || !args[0]) return []
        const request = new ValidatorRequest(args)
        const response = await this.api.execute(request)
        if (request.wasSuccessfull(response)) {
            return request.parse(response)
        } else {
            return this.apiStatusHandler(response)
        }
    }

    async getRemoteValidatorViaETH1(arg: string, enforceMax: number = -1): Promise<Validator[]> {
        if (!arg) return []
        const request = new ValidatorETH1Request(arg)
        const response = await this.api.execute(request)

        if (request.wasSuccessfull(response)) {
            const eth1ValidatorList = request.parse(response)
            const queryString = getValidatorQueryString(eth1ValidatorList, 2000, enforceMax)

            return await this.getDashboardDataValidators(MEMORY,
                queryString
            )
        } else {
            return this.apiStatusHandler(response)
        }
    }
    private async apiStatusHandler(response) {
        if (response && response.data && response.data.status) {
            return Promise.reject(new Error(response.data.status))
        }
        return Promise.reject(new Error("Response is invalid"))
    }

    async getCachedAttestationKey() {
        return cacheAttestationKeyBare + await this.api.getNetworkName()
    }

    async getCachedPerformanceKey() {
        return cachePerformanceKeyBare + await this.api.getNetworkName()
    }

    async getCachedValidatorKey() {
        return cacheValidatorsKeyBare + await this.api.getNetworkName()
    }

    async getCachedEpochKey() {
        return epochCachedKeyBare + await this.api.getNetworkName()
    }

    // single
    async convertToValidatorModelAndSaveValidatorLocal(synced: boolean, validator: ValidatorResponse) {
        this.convertToValidatorModelsAndSaveLocal(synced, [validator])
    }

    // multiple
    async convertToValidatorModelsAndSaveLocal(synced: boolean, validator: ValidatorResponse[]) {
        this.saveValidatorsLocal(this.convertToValidatorModel({ synced, storage: SAVED, validatorResponse: validator }))
        if (!synced) {
            this.storage.setObject(LAST_TIME_ADDED_KEY, { timestamp: Date.now() })
            this.clearCache()
        }
    }

    private convertToValidatorModel({ synced, storage, validatorResponse }: { synced: boolean; storage: (0 | 1); validatorResponse: ValidatorResponse[]; }): Validator[] {
        const erg: Validator[] = []
        validatorResponse.forEach((validator) => {
            const temp = {
                index: validator.validatorindex,
                pubkey: validator.pubkey,
                name: this.getName(validator),
                storage: storage,
                synced: synced,
                version: VERSION,
                data: validator,
                state: ValidatorState.UNKNOWN,
                share: null,
                rplshare: null,
            } as Validator

            erg.push(temp)
        })
        return erg
    }

    async searchValidators(search: string): Promise<Validator[]> {
        const result = await this.getDashboardDataValidators(MEMORY, search).catch(err => { 
            return null })
        if(result == null) return []
        return result
    }

    async searchValidatorsViaETH1(search: string, enforceMax: number = -1): Promise<Validator[]> {
        const result = await this.getRemoteValidatorViaETH1(search, enforceMax)
        if(result == null) return []
        return result
    }

    private getName(validator: ValidatorResponse): string {
        if (!validator || !validator.name || validator.name.length <= 0) {
            return "Validator #" + validator.validatorindex
        } else {
            return validator.name
        }
    }
}

export function getValidatorQueryString(validators: any[], getParamMaxLimit: number, maxValLimit: number = -1) { // Validator
    var erg = ""
    var count = 0
    validators.forEach((item) => {
        var temp = ""
        if (item.validatorindex !== undefined && item.validatorindex != null) {
            temp = item.validatorindex + ","
        } else if (item.index !== undefined && item.index != null) {
            temp = item.index + ","
        } else if (item.pubkey !== undefined && item.pubkey != null) {
            temp = item.pubkey + ","
        } else if (item.publickey !== undefined && item.publickey != null) {
            temp = item.publickey + ","
        }

        const isNotMaxed = maxValLimit == -1 || count <= maxValLimit
        const doesNotExceedGetMaxLimit = erg.length + temp.length < getParamMaxLimit

        if (isNotMaxed && doesNotExceedGetMaxLimit) {
            erg += temp
            count++;
        }
    })

    if (erg.length > 1) {
        return erg.substring(0, erg.length - 1)
    }
    
    return erg
}

export function getDisplayName(validator: Validator): string {
    if (validator.name && validator.name.length >= 0) {
        return validator.name
    }
    if (validator.data.name.length <= 0) {
        return "Validator #" + validator.data.validatorindex
    } else {
        return validator.data.name
    }
}