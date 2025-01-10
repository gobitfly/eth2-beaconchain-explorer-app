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

import { ApiService } from '@services/api.service'
import { StorageService, StoredShare } from '@services/storage.service'
import { Injectable } from '@angular/core'
import BigNumber from 'bignumber.js'
import { UnitconvService } from '@services/unitconv.service'
import { VDBManageValidatorsTableRow } from '@requests/types/validator_dashboard'

export const SAVED = 0 // stored locally
export const MEMORY = 1 // Search results etc

const KEYPREFIX = 'validators_'
export const LAST_TIME_ADDED_KEY = 'last_time_added'
export const LAST_TIME_REMOVED_KEY = 'last_time_removed'

export enum ValidatorState {
	SLASHED = 'slashed',
	EXITED = 'exited',
	DEPOSITED = 'deposited',
	PENDING = 'pending',
	SLASHING_ONLINE = 'slashing_online',
	SLASHING_OFFLINE = 'slashing_offline',
	EXITING_ONLINE = 'exiting_online',
	EXITING_OFFLINE = 'exiting_offline',
	ACTIVE_ONLINE = 'active_online',
	ACTIVE_OFFLINE = 'active_offline',
}

export interface Validator {
	index: number
	pubkey: string
	name: string
	storage: typeof SAVED | typeof MEMORY
	synced: boolean
	version: number
	//
	state: ValidatorState
	attrEffectiveness: number
	share: number
	rplshare: number
	execshare: number
}

@Injectable({
	providedIn: 'root',
})
export class ValidatorUtils {
	constructor(
		private api: ApiService,
		private storage: StorageService,
		private unitConversion: UnitconvService
	) {}

	/**@deprecated */
	async localValidatorCount() {
		return (await this.getMap(this.getStorageKey())).size
	}

	/**@deprecated */
	public getStorageKey(): string {
		return KEYPREFIX + this.api.getNetworkName()
	}

	/**
	 * @deprecated replaced in v2 with new v2 storage object
	 */
	public async getMap(storageKey: string): Promise<Map<string, Validator>> {
		const erg = await this.storage.getObject(storageKey)
		if (erg && erg instanceof Map) return erg
		return new Map<string, Validator>()
	}

	/**
	 * @deprecated with v2 we don't need complex syncing logic any more
	 */
	private async getMapWithoutDeleted(storageKey: string): Promise<Map<string, Validator>> {
		const local = await this.getMap(storageKey)
		const deleted = await this.getDeletedSet(storageKey)
		if (await this.storage.isLoggedIn()) {
			for (const locallyDeleted of deleted) {
				local.delete(locallyDeleted)
			}
		}
		return local
	}

	/**@deprecated */
	public async getDeletedSet(storageKey: string): Promise<Set<string>> {
		const erg = await this.storage.getObject(storageKey + '_deleted')
		if (erg && Array.isArray(erg)) return new Set(erg)
		return new Set<string>()
	}

	/**@deprecated */
	public async setDeleteSet(storageKey: string, list: Set<string>) {
		if (!(await this.storage.isLoggedIn())) return
		this.storage.setObject(storageKey + '_deleted', [...list])
	}

	/**@deprecated */
	async deleteAll(networkName: string = undefined) {
		let storageKey = this.getStorageKey()
		if (networkName) {
			storageKey = KEYPREFIX + networkName
		}
		const current = await this.getMap(storageKey)
		this.storage.setObject(storageKey, new Map<string, Validator>())

		const deletedList = await this.getDeletedSet(storageKey)
		current.forEach((_, key) => {
			deletedList.add(key.toString())
		})

		this.setDeleteSet(storageKey, deletedList)

		this.storage.setObject(LAST_TIME_REMOVED_KEY, { timestamp: Date.now() })
	}

	/**@deprecated */
	async saveRocketpoolCollateralShare(nodeAddress: string, sharePercent: number) {
		await this.storage.setObject('rpl_share_' + nodeAddress, { share: sharePercent } as StoredShare)
	}

	/**@deprecated */
	async getRocketpoolCollateralShare(nodeAddress: string): Promise<number> {
		const temp = (await this.storage.getObject('rpl_share_' + nodeAddress)) as StoredShare
		if (!temp) return null
		return temp.share
	}

	/**@deprecated */
	async getAllValidatorsLocal(networkName: string = undefined): Promise<Validator[]> {
		let storageKey = this.getStorageKey()
		if (networkName) {
			storageKey = KEYPREFIX + networkName
		}
		const current = await this.getMap(storageKey)
		const erg: Validator[] = [...current.values()]
		return erg
	}

	async getMyLocalValidators(networkName: string = undefined): Promise<number[]> {
		let storageKey = this.getStorageKey()
		if (networkName) {
			storageKey = KEYPREFIX + networkName
		}
		const local = await this.getMapWithoutDeleted(storageKey)
		if (local.size == 0) return []
		return [...local.values()].map((item) => item.index)
	}

	async debugSetMyLocalValidators(networkName: string = undefined, validators: number[]) {
		let storageKey = this.getStorageKey()
		if (networkName) {
			storageKey = KEYPREFIX + networkName
		}
		const mappedToValidators = validators.map((v) => {
			return {
				index: v,
				pubkey: '',
				name: '',
				storage: SAVED,
				synced: false,
				version: 0,
				data: null,
				state: null,
				attrEffectiveness: 0,
				rocketpool: null,
				execution: null,
				share: 0,
				rplshare: 0,
				execshare: 0,
				currentSyncCommittee: null,
				nextSyncCommittee: null,
			} as Validator
		})
		const map = new Map<string, Validator>()
		mappedToValidators.forEach((v) => {
			map.set(v.index.toString(), v)
		})
		await this.storage.setObject(storageKey, map)
	}

	async wasStakeShareUser() {
		const hasStakeShareEnabled = async (network: string) => {
			return !!(await this.getAllValidatorsLocal(network)).find((v) => {
				return !!v.share || !!v.execshare || !!v.rplshare
			})
		}

		return (await hasStakeShareEnabled('main')) || (await hasStakeShareEnabled('holesky')) || (await hasStakeShareEnabled('gnosis'))
	}

	private updateRplAndRethPrice() {
		this.unitConversion.setRPLPrice(new BigNumber(''.toString())) // todo rpl price
	}
}

export function getDisplayName(validator: VDBManageValidatorsTableRow): string {
	return 'Validator ' + validator.index
}
