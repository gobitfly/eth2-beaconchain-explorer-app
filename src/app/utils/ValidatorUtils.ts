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

import { ApiService } from '../services/api.service'
import { StorageService, StoredShare, StoredTimestamp } from '../services/storage.service'
import { Injectable } from '@angular/core'
import {
	EpochResponse,
	RemoveMyValidatorsRequest,
	AttestationPerformanceResponse,
	ValidatorRequest,
	ValidatorResponse,
	GetMyValidatorsRequest,
	MyValidatorResponse,
	DashboardRequest,
	RocketPoolResponse,
	RocketPoolNetworkStats,
	ExecutionResponse,
	SyncCommitteeResponse,
	ETH1ValidatorResponse,
	SyncCommitteesStatisticsResponse,
	ProposalLuckResponse,
	ValidatorViaDepositAddress,
	ValidatorViaWithdrawalAddress,
} from '../requests/requests'
import { MerchantUtils } from './MerchantUtils'
import BigNumber from 'bignumber.js'
import { UnitconvService } from '../services/unitconv.service'

export const SAVED = 0 // stored locally
export const MEMORY = 1 // Search results etc

const VERSION = 1

const KEYPREFIX = 'validators_'
export const LAST_TIME_ADDED_KEY = 'last_time_added'
export const LAST_TIME_REMOVED_KEY = 'last_time_removed'

export enum ValidatorState {
	ACTIVE,
	OFFLINE,
	SLASHED,
	WAITING,
	ELIGABLE,
	EXITED,
	UNKNOWN,
}

export interface Validator {
	index: number
	pubkey: string
	name: string
	storage: typeof SAVED | typeof MEMORY
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
	currentSyncCommittee: SyncCommitteeResponse
	nextSyncCommittee: SyncCommitteeResponse
}

@Injectable({
	providedIn: 'root',
})
export class ValidatorUtils {
	private listeners: (() => void)[] = []

	private currentEpoch: EpochResponse
	private olderEpoch: EpochResponse
	rocketpoolStats: RocketPoolNetworkStats
	syncCommitteesStatsResponse: SyncCommitteesStatisticsResponse
	proposalLuckResponse: ProposalLuckResponse

	constructor(
		private api: ApiService,
		private storage: StorageService,
		private merchantUtils: MerchantUtils,
		private unitConversion: UnitconvService
	) {}

	notifyListeners() {
		this.listeners.forEach((callback) => callback())
	}

	registerListener(listener: () => void) {
		this.listeners.push(listener)
	}

	async hasLocalValdiators() {
		return (await this.getMap(this.getStorageKey())).size > 0
	}

	async localValidatorCount() {
		return (await this.getMap(this.getStorageKey())).size
	}

	public getStorageKey(): string {
		return KEYPREFIX + this.api.getNetworkName()
	}

	async migrateTo3Dot2() {
		const share = await this.storage.getStakingShare()
		const valis = await this.getAllValidatorsLocal()
		if (valis) {
			for (let i = 0; i < valis.length; i++) {
				if (share) {
					valis[i].share = share.toNumber()
				}
			}
			this.saveValidatorsLocal(valis)
		}
	}

	public async getMap(storageKey: string): Promise<Map<string, Validator>> {
		const erg = await this.storage.getObject(storageKey)
		if (erg && erg instanceof Map) return erg
		return new Map<string, Validator>()
	}

	private async getMapWithoutDeleted(storageKey): Promise<Map<string, Validator>> {
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
		const erg = await this.storage.getObject(storageKey + '_deleted')
		if (erg && Array.isArray(erg)) return new Set(erg)
		return new Set<string>()
	}

	public async setDeleteSet(storageKey: string, list: Set<string>) {
		if (!(await this.storage.isLoggedIn())) return
		this.storage.setObject(storageKey + '_deleted', [...list])
	}

	clearDeletedSet() {
		const storageKey = this.getStorageKey()
		this.setDeleteSet(storageKey, new Set<string>())
	}

	async deleteAll() {
		const storageKey = this.getStorageKey()
		const current = await this.getMap(storageKey)
		this.storage.setObject(storageKey, new Map<string, Validator>())

		const deletedList = await this.getDeletedSet(storageKey)
		current.forEach((_, key) => {
			deletedList.add(key.toString())
		})

		this.setDeleteSet(storageKey, deletedList)

		this.storage.setObject(LAST_TIME_REMOVED_KEY, { timestamp: Date.now() })
		this.notifyListeners()
	}

	private deletedWithoutNotifying: boolean = false

	async deleteValidatorLocal(validator: ValidatorResponse, notifyListeners: boolean = true) {
		const storageKey = this.getStorageKey()
		const current = await this.getMap(storageKey)
		current.delete(validator.pubkey)
		this.storage.setObject(storageKey, current)

		const deletedList = await this.getDeletedSet(storageKey)
		deletedList.add(validator.pubkey)
		this.setDeleteSet(storageKey, deletedList)
		console.log('delete set', deletedList)

		this.storage.setObject(LAST_TIME_REMOVED_KEY, { timestamp: Date.now() })
		if (notifyListeners) this.notifyListeners()
		else this.deletedWithoutNotifying = true
	}

	notifyListenersIfDeletedWithoutNotifying() {
		if (this.deletedWithoutNotifying) {
			this.notifyListeners()
			this.deletedWithoutNotifying = false
		}
	}

	async saveValidatorsLocal(validators: Validator[]) {
		const storageKey = this.getStorageKey()

		const current = await this.getMap(storageKey)
		const newMap = new Map<string, Validator>()

		validators.forEach((validator) => {
			newMap.set(validator.pubkey, validator)
		})

		current.forEach((value, key) => {
			if (!newMap.has(key)) newMap.set(key, value)
		})

		this.storage.setObject(storageKey, newMap)
		this.notifyListeners()
	}

	async saveRocketpoolCollateralShare(nodeAddress: string, sharePercent: number) {
		await this.storage.setObject('rpl_share_' + nodeAddress, { share: sharePercent } as StoredShare)
	}

	async getRocketpoolCollateralShare(nodeAddress: string): Promise<number> {
		const temp = (await this.storage.getObject('rpl_share_' + nodeAddress)) as StoredShare
		if (!temp) return null
		return temp.share
	}

	async getValidatorLocal(pubkey: string): Promise<Validator> {
		const current = await this.getMapWithoutDeleted(this.getStorageKey())
		return current.get(pubkey)
	}

	async getAllValidatorsLocal(): Promise<Validator[]> {
		const current = await this.getMap(this.getStorageKey())
		const erg: Validator[] = [...current.values()]
		return erg
	}

	async getLocalValidatorByIndex(index: number): Promise<Validator> {
		const localValidators = await this.getAllValidatorsLocal()
		for (const vali of localValidators) {
			if (vali.index == index) {
				return vali
			}
		}
		return null
	}

	async getAllMyValidators(): Promise<Validator[]> {
		const storageKey = this.getStorageKey()
		const local = await this.getMapWithoutDeleted(storageKey)
		if (local.size == 0) return []

		const validatorString = getValidatorQueryString([...local.values()], 2000, (await this.merchantUtils.getCurrentPlanMaxValidator()) - 1)

		const remoteUpdatesPromise = this.getDashboardDataValidators(SAVED, validatorString).catch((err) => {
			console.warn('error getAllMyValidators getDashboardDataValidators', err)
			return []
		})
		if (remoteUpdatesPromise == null) return null

		const remoteUpdates = await remoteUpdatesPromise

		remoteUpdates.forEach((item) => {
			local.set(item.pubkey, item)
		})

		// update local info
		this.storage.setObject(storageKey, local)

		const result = [...local.values()]

		return result
	}

	async areRocketpoolValidatorsSubscribed(): Promise<boolean> {
		const validators = await this.getAllMyValidators()
		for (const v of validators) {
			if (v.rocketpool) {
				return true
			}
		}

		return false
	}

	updateValidatorStates(validators: Validator[]) {
		validators.forEach((item) => {
			item.state = this.getValidatorState(item)
		})
	}

	// checks if remote validators are already known locally.
	// If not, return all indizes of non locally known validators
	public async getAllNewIndicesOnly(myRemotes: MyValidatorResponse[]): Promise<number[]> {
		const storageKey = this.getStorageKey()
		const current = await this.getMap(storageKey)

		const result: number[] = []
		myRemotes.forEach((remote) => {
			if (!current.has(remote.PubKey)) {
				result.push(remote.Index)
			}
		})

		return result
	}

	getValidatorState(item: Validator): ValidatorState {
		if (item.data.slashed) return ValidatorState.SLASHED
		if (item.data.status == 'exited') return ValidatorState.EXITED
		if (item.data.status == 'deposited') return ValidatorState.ELIGABLE
		if (item.data.status == 'pending') return ValidatorState.WAITING
		if (item.data.slashed == false && item.data.status.indexOf('online') > 0) {
			return ValidatorState.ACTIVE
		}

		// default case
		return ValidatorState.OFFLINE
	}

	public async removeValidatorRemote(pubKey: string) {
		const request = new RemoveMyValidatorsRequest(pubKey)
		const response = await this.api.execute(request).catch((error) => {
			console.warn('error in removeValidatorRemote', error)
			return false
		})
		if (!response) return false
		return request.wasSuccessful(response)
	}

	async getMyRemoteValidators(): Promise<MyValidatorResponse[]> {
		const request = new GetMyValidatorsRequest()
		const response = await this.api.execute(request)
		const result = request.parse(response)
		console.log('My remote validators', result, response)
		return result
	}

	private async getDashboardDataValidators(storage: 0 | 1, ...validators): Promise<Validator[]> {
		const request = new DashboardRequest(...validators)
		const response = await this.api.execute(request)
		if (!request.wasSuccessful(response)) {
			if (response && response.data && response.data.status && response.data.status.indexOf('only a maximum of') >= 0) {
				throw new Error(response.data.status)
			}
			this.api.clearSpecificCache(request)
			return []
		}

		const result = request.parse(response)[0]
		if (!result) {
			console.warn('error getDashboardDataValidators', response, result)
			return []
		}

		if (result.currentEpoch && result.currentEpoch.length > 0) {
			this.currentEpoch = result.currentEpoch[0]
		} else {
			console.warn('no current epoch information!', result)
		}
		if (result.olderEpoch && result.olderEpoch.length > 0) {
			this.olderEpoch = result.olderEpoch[0]
		} else {
			console.warn('no older epoch information!', result)
		}

		if (result.rocketpool_network_stats && result.rocketpool_network_stats.length > 0) {
			this.rocketpoolStats = result.rocketpool_network_stats[0]
		}
		const validatorEffectivenessResponse = result.effectiveness
		const validatorsResponse = result.validators

		this.syncCommitteesStatsResponse = result.sync_committees_stats
		this.proposalLuckResponse = result.proposal_luck_stats

		this.updateRplAndRethPrice()

		if (response.cached != true) {
			await this.storage.setLastEpochRequestTime(Date.now())
		} else {
			const lastCachedTime = await this.storage.getLastEpochRequestTime()
			if (this.currentEpoch) {
				this.currentEpoch.lastCachedTimestamp = lastCachedTime
			}
		}

		let local = null
		if (storage == SAVED) {
			local = await this.getMapWithoutDeleted(this.getStorageKey())
		}

		const temp = this.convertToValidatorModel({ synced: false, storage: storage, validatorResponse: validatorsResponse })
		this.updateValidatorStates(temp)
		for (const vali of temp) {
			vali.attrEffectiveness = this.findAttributionEffectiveness(validatorEffectivenessResponse, vali.index)
			vali.rocketpool = this.findRocketpoolResponse(result.rocketpool_validators, vali.index)
			vali.execution = this.findExecutionResponse(result.execution_performance, vali.index)
			if (local) {
				const found = local.get(vali.pubkey)
				if (found) {
					vali.share = found.share
					vali.execshare = found.execshare == null || found.execshare == undefined ? found.share : found.execshare
				}
			}
			if (vali.rocketpool) {
				vali.rplshare = await this.getRocketpoolCollateralShare(vali.rocketpool.node_address)
			}

			if (result.current_sync_committee && result.current_sync_committee.length >= 1) {
				vali.currentSyncCommittee = this.findSyncCommitteeDuty(result.current_sync_committee[0], vali.index)
			}
			if (result.next_sync_committee && result.next_sync_committee.length >= 1) {
				vali.nextSyncCommittee = this.findSyncCommitteeDuty(result.next_sync_committee[0], vali.index)
			}
		}

		return temp
	}

	private findSyncCommitteeDuty(committee: SyncCommitteeResponse, index: number): SyncCommitteeResponse {
		for (const vali of committee.validators) {
			if (vali == index) {
				return committee
			}
		}
		return null
	}

	private updateRplAndRethPrice() {
		if (!this.rocketpoolStats) return
		this.unitConversion.setRPLPrice(new BigNumber(this.rocketpoolStats.rpl_price.toString()))
		//this.unitConversion.setRETHPrice(new BigNumber(this.rocketpoolStats.reth_exchange_rate.toString()))
	}

	private findExecutionResponse(list: ExecutionResponse[], index: number): ExecutionResponse {
		if (list == null || list.length == 0) return null
		for (const attr of list) {
			if (attr.validatorindex == index) {
				return attr
			}
		}
		return null
	}

	private findRocketpoolResponse(list: RocketPoolResponse[], index: number): RocketPoolResponse {
		for (const attr of list) {
			if (attr.index == index) {
				return attr
			}
		}
		return null
	}

	private findAttributionEffectiveness(list: AttestationPerformanceResponse[], index: number): number {
		for (const attr of list) {
			if (attr.validatorindex == index && attr.attestation_efficiency) {
				return new BigNumber(1).dividedBy(attr.attestation_efficiency).multipliedBy(100).decimalPlaces(1).toNumber()
			}
		}
		return -1
	}

	getOlderEpoch(): EpochResponse {
		return this.olderEpoch
	}

	async getRemoteCurrentEpoch(): Promise<EpochResponse> {
		const result = this.currentEpoch
		if (result == null) {
			await this.getAllMyValidators()
			return this.currentEpoch
		}

		return result
	}

	async getRemoteValidatorInfo(...args: number[]): Promise<ValidatorResponse[]> {
		if (!args || !args[0]) return []
		const request = new ValidatorRequest(...args)
		const response = await this.api.execute(request)
		if (request.wasSuccessful(response)) {
			return request.parse(response)
		} else {
			return this.apiStatusHandler(response)
		}
	}

	async getRemoteValidatorViaETHAddress(arg: string, enforceMax = -1): Promise<Validator[]> {
		if (!arg) return []
		const viaDeposit = new ValidatorViaDepositAddress(arg)
		const viaDepositPromise = this.api.execute(viaDeposit)

		const viaWithdrawal = new ValidatorViaWithdrawalAddress(arg)
		const viaWithdrawalPromise = this.api.execute(viaWithdrawal)

		const response = await Promise.all([viaDepositPromise, viaWithdrawalPromise])
		let result: ETH1ValidatorResponse[] = []

		for (const resp of response) {
			if (viaDeposit.wasSuccessful(resp)) {
				// since both results are identical we can use any of the requests for parsing
				const temp = viaDeposit.parse(resp)
				if (temp) {
					if (result.length > 0) {
						result = Array.from(new Map([...result, ...temp].map((item) => [item.validatorindex, item])).values())
					} else {
						result = temp
					}
				}
			} else {
				return this.apiStatusHandler(response)
			}
		}

		const queryString = getValidatorQueryString(result, 2000, enforceMax)
		return await this.getDashboardDataValidators(MEMORY, queryString)
	}

	private async apiStatusHandler(response) {
		if (response && response.data && response.data.status) {
			return Promise.reject(new Error(response.data.status))
		}
		return Promise.reject(new Error('Response is invalid'))
	}

	// single
	async convertToValidatorModelAndSaveValidatorLocal(synced: boolean, validator: ValidatorResponse) {
		await this.convertToValidatorModelsAndSaveLocal(synced, [validator])
	}

	// multiple
	async convertToValidatorModelsAndSaveLocal(synced: boolean, validator: ValidatorResponse[]) {
		await this.saveValidatorsLocal(this.convertToValidatorModel({ synced, storage: SAVED, validatorResponse: validator }))
		if (!synced) {
			await this.storage.setObject(LAST_TIME_ADDED_KEY, { timestamp: Date.now() } as StoredTimestamp)
		}
	}

	private convertToValidatorModel({
		synced,
		storage,
		validatorResponse,
	}: {
		synced: boolean
		storage: 0 | 1
		validatorResponse: ValidatorResponse[]
	}): Validator[] {
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
		const result = await this.getDashboardDataValidators(MEMORY, search).catch((err) => {
			console.warn('error in searchValidators', err)
			return null
		})
		if (result == null) return []
		return result
	}

	async searchValidatorsViaETHAddress(search: string, enforceMax = -1): Promise<Validator[]> {
		const result = await this.getRemoteValidatorViaETHAddress(search, enforceMax)
		if (result == null) return []
		return result
	}

	private getName(validator: ValidatorResponse): string {
		if (!validator || !validator.name || validator.name.length <= 0) {
			return 'Validator ' + validator.validatorindex
		} else {
			return validator.name
		}
	}
}

export function getValidatorQueryString(validators: Validator[] | ETH1ValidatorResponse[], getParamMaxLimit: number, maxValLimit = -1) {
	// Validator
	let erg = ''
	let count = 0
	validators.forEach((item) => {
		let temp = ''

		if (item.validatorindex !== undefined && item.validatorindex != null) {
			temp = item.validatorindex + ','
		} else if (item.index !== undefined && item.index != null) {
			temp = item.index + ','
		} else if (item.pubkey !== undefined && item.pubkey != null) {
			temp = item.pubkey + ','
		} else if (item.publickey !== undefined && item.publickey != null) {
			temp = item.publickey + ','
		}

		const isNotMaxed = maxValLimit == -1 || count <= maxValLimit
		const doesNotExceedGetMaxLimit = erg.length + temp.length < getParamMaxLimit

		if (isNotMaxed && doesNotExceedGetMaxLimit) {
			erg += temp
			count++
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
		return 'Validator ' + validator.data.validatorindex
	} else {
		return validator.data.name
	}
}
