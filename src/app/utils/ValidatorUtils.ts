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
import { EpochRequest, EpochResponse, PerformanceRequest, RemoveMyValidatorsRequest, NotificationSubsRequest, PerformanceResponse, AttestationPerformanceRequest, AttestationPerformanceResponse, ValidatorRequest, ValidatorResponse, ValidatorETH1Request, GetMyValidatorsRequest, MyValidatorResponse } from '../requests/requests';
import { AlertService, VALIDATORUTILS } from '../services/alert.service';
import { CacheModule } from './CacheModule';
import { MerchantUtils } from './MerchantUtils';

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

export enum ValidatorState {
    ACTIVE, OFFLINE, SLASHED, WAITING, ELIGABLE, EXITED, UNKNOWN
}

export interface Validator {
    index: number,
    pubkey: string,
    name: string,
    storage: (typeof SAVED | typeof MEMORY)
    synced: boolean,
    version: number,
    data: ValidatorResponse,
    state: ValidatorState,
    searchAttrEffectiveness: number
}

@Injectable({
    providedIn: 'root'
})
export class ValidatorUtils extends CacheModule {

    private listeners: (() => void)[] = []

    constructor(
        private api: ApiService,
        private storage: StorageService,
        private alerts: AlertService,
        private merchantUtils: MerchantUtils
    ) {
        super("vu") // initialize cache module with vu prefix
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

    public async getMap(storageKey: string): Promise<Map<String, Validator>> {
        const erg = await this.storage.getObject(storageKey)
        if (erg && erg instanceof Map) return erg
        return new Map<String, Validator>()
    }

    private async getMapWithoutDeleted(storageKey) {
        const local = await this.getMap(storageKey)
        const deleted = await this.getDeletedSet(storageKey)
        for (const locallyDeleted of deleted) {
            local.delete(locallyDeleted)
        }
        return local
    }

    public async getDeletedSet(storageKey: string): Promise<Set<string>> {
        const erg = await this.storage.getObject(storageKey + "_deleted")
        if (erg && Array.isArray(erg)) return new Set(erg)
        return new Set<string>()
    }

    public setDeleteSet(storageKey: string, list: Set<string>) {
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

    private async saveValidatorsLocal(validators: Validator[]) {
        const storageKey = await this.getStorageKey()

        const current = await this.getMap(storageKey)

        validators.forEach((validator) => {
            current.set(validator.pubkey, validator)
        })

        this.storage.setObject(storageKey, current)

        this.notifyListeners()
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

    async getAllMyPerformances(): Promise<PerformanceResponse[]> {
        const storageKey = await this.getStorageKey()
        const local = await this.getMap(storageKey)

        const validatorString = getValidatorQueryString([...local.values()], 2000, await this.merchantUtils.getCurrentPlanMaxValidator())

        const cachePerformanceKey = await this.getCachedPerformanceKey()
        const cached = this.getMultipleCached(cachePerformanceKey, validatorString.split(","))
        if (cached != null && cached.length > 0) return cached

        const remoteUpdates = await this.getRemoteValidatorPerformance(
            validatorString
        )

        this.cacheMultiple(cachePerformanceKey, validatorString.split(","), remoteUpdates)

        return remoteUpdates
    }

    async getAllMyAttestationPerformances(): Promise<AttestationPerformanceResponse[]> {
        const storageKey = await this.getStorageKey()
        const local = await this.getMap(storageKey)

        const validatorString = getValidatorQueryString([...local.values()], 2000, await this.merchantUtils.getCurrentPlanMaxValidator())

        const cacheAttestationKey = await this.getCachedAttestationKey()
        const cached = this.getMultipleCached(cacheAttestationKey, validatorString.split(","))
        if (cached != null && cached.length > 0) return cached

        const remoteUpdates = await this.getRemoteValidatorAttestationPerformance(
            validatorString
        )

        this.cacheMultiple(cacheAttestationKey, validatorString.split(","), remoteUpdates)
        return remoteUpdates
    }


    async getAllMyValidators(): Promise<Validator[]> {
        const storageKey = await this.getStorageKey()
        const local = await this.getMapWithoutDeleted(storageKey)
        const epochPromise = this.getRemoteCurrentEpoch()
        const validatorString = getValidatorQueryString([...local.values()], 2000, await this.merchantUtils.getCurrentPlanMaxValidator())

        const cached = this.getMultipleCached(allMyKeyBare, validatorString.split(","))
        if (cached != null) {
            console.log("return my validators from cache")
            return cached
        }

        const remoteUpdatesPromise = this.getRemoteValidatorInfo(
            validatorString
        ).catch(err => { return null })
        if(remoteUpdatesPromise == null) return null

        const epoch = await epochPromise
        const remoteUpdates = await remoteUpdatesPromise

        // applying new remote infos to local
        remoteUpdates.forEach((item) => {
            const current = local.get(item.pubkey)
            current.data = item
            current.state = ValidatorState.UNKNOWN
            current.state = this.getValidatorState(current, epoch)
        })

        // update local info
        this.storage.setObject(storageKey, local)

        const result = [...local.values()]

        this.cacheMultiple(allMyKeyBare, validatorString.split(","), result)

        return result
    }

    async updateValidatorStates(validators: Validator[]) {
        const epoch = await this.getRemoteCurrentEpoch()
        validators.forEach((item) => {
            item.state = this.getValidatorState(item, epoch)
        })
    }

    async postNotifySub(eventName: string, filter: string = null, enabled, silent = true, network: string): Promise<boolean> {
        const loggedIn = await this.storage.isLoggedIn()
        if (!loggedIn) return false

        const request = new NotificationSubsRequest(eventName, filter, enabled); // this.getToggleFromEvent(eventName)
        if (network) {
            request.endPoint = network
        }

        const response = await this.api.execute(request)
        const result = request.wasSuccessfull(response)
        if (!result) {
            console.warn("Error chaning notification event subscription")
            if (!silent) {
                this.alerts.showError(
                    "Sorry",
                    "Your notification setting could not be synced. Please try it again in a couple minutes.",
                    VALIDATORUTILS + 1
                )
            }

            return false
        }

        return true
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

    async getRemoteCurrentEpoch(epoch = "latest"): Promise<EpochResponse> {
        const cached = this.getCache(await this.getCachedEpochKey())
        if (cached != null) return cached

        const request = new EpochRequest(epoch)
        const response = await this.api.execute(request)
        const result = request.parse(response)[0]
        if (response.request.fromCache != true) {
            await this.storage.setLastEpochRequestTime(Date.now())
        }
        const lastCachedTime = await this.storage.getLastEpochRequestTime()
        result.lastCachedTimestamp = lastCachedTime

        this.putCache(await this.getCachedEpochKey(), result)
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

    async getRemoteValidatorViaETH1(arg: string, enforceMax: number = -1): Promise<ValidatorResponse[]> {
        if (!arg) return []
        const request = new ValidatorETH1Request(arg)
        const response = await this.api.execute(request)

        if (request.wasSuccessfull(response)) {
            const eth1ValidatorList = request.parse(response)
            const queryString = getValidatorQueryString(eth1ValidatorList, 2000, enforceMax)

            return await this.getRemoteValidatorInfo(
                queryString
            )
        } else {
            return this.apiStatusHandler(response)
        }
    }

    async getRemoteValidatorPerformance(...args: any): Promise<PerformanceResponse[]> {
        if (!args || args[0] === undefined) return []

        const cachePerformanceKey = await this.getCachedPerformanceKey()
        const cached = this.getMultipleCached(cachePerformanceKey, args)
        if (cached != null && cached.length > 0) return cached

        const request = new PerformanceRequest(args)
        const response = await this.api.execute(request)
        const result = request.parse(response)
        this.cacheMultiple(cachePerformanceKey, args, result)
        return result
    }

    async getRemoteValidatorAttestationPerformance(...args: any): Promise<AttestationPerformanceResponse[]> {
        if (!args || args[0] === undefined) return []

        const cacheAttestationKey = await this.getCachedAttestationKey()
        const cached = this.getMultipleCached(cacheAttestationKey, args)
        if (cached != null && cached.length > 0) return cached

        const request = new AttestationPerformanceRequest(args)
        const response = await this.api.execute(request)
        const result = request.parse(response)
        this.cacheMultiple(cacheAttestationKey, args, result)
        return result
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
                state: ValidatorState.UNKNOWN
            } as Validator

            erg.push(temp)
        })
        return erg
    }

    async searchValidators(search: string): Promise<Validator[]> {
        const result = await this.getRemoteValidatorInfo(search).catch(err => { return null })
        if(result == null) return []
        const temp = this.convertToValidatorModel({ synced: false, storage: MEMORY, validatorResponse: result })
        await this.updateValidatorStates(temp)
        return temp
    }

    async searchValidatorsViaETH1(search: string, enforceMax: number = -1): Promise<Validator[]> {
        const result = await this.getRemoteValidatorViaETH1(search, enforceMax)
        if(result == null) return []
        const temp = this.convertToValidatorModel({ synced: false, storage: MEMORY, validatorResponse: result })
        await this.updateValidatorStates(temp)
        return temp
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
        return erg.substr(0, erg.length - 1)
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