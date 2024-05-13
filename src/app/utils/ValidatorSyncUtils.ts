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
import { StorageService, StoredTimestamp } from '../services/storage.service'
import { Injectable } from '@angular/core'
import { MyValidatorResponse, AddMyValidatorsRequest } from '../requests/requests'
import { Mutex } from 'async-mutex'
import { ValidatorUtils, LAST_TIME_ADDED_KEY, LAST_TIME_REMOVED_KEY } from './ValidatorUtils'

const LAST_TIME_UPSYNCED_KEY = 'last_time_upsynced'
const LAST_TIME_UPDELETED_KEY = 'last_time_updeleted'

@Injectable({
	providedIn: 'root',
})
export class ValidatorSyncUtils {
	constructor(private validator: ValidatorUtils, private storage: StorageService, private api: ApiService) {}

	public async mightSyncUpAndSyncDelete(syncNotificationsForNewValidators: () => void) {
		this.mayDeleteUp()
		await this.maySyncUp(syncNotificationsForNewValidators)
	}

	// Use only when you really need to sync both ways
	// Otherwise use syncDown or maySyncUp
	public async fullSync(syncNotificationsForNewValidators: () => void) {
		await this.syncDown()
		await this.mightSyncUpAndSyncDelete(syncNotificationsForNewValidators)
	}

	public async syncDown() {
		const loggedIn = await this.storage.isLoggedIn()
		if (!loggedIn) return
		console.log('[SYNC] syncing down')

		const myRemotes = await this.validator.getMyRemoteValidators()
		if (!myRemotes || myRemotes.length <= 0) return

		const newValidatorIndizes = await this.validator.getAllNewIndicesOnly(myRemotes)
		console.log('newValidatorIndizes', newValidatorIndizes)

		this.syncRemoteRemovals(myRemotes)

		if (newValidatorIndizes.length <= 0) {
			this.validator.notifyListeners()
			return
		}

		const newValidators = await this.validator.getRemoteValidatorInfo(...newValidatorIndizes).catch((err) => {
			console.warn('error in syncDown getRemoteValidatorInfo', err)
			return null
		})
		if (newValidators == null) return

		this.validator.convertToValidatorModelsAndSaveLocal(true, newValidators)
	}

	private upSyncLastTry = 0

	private async maySyncUp(syncNotificationsForNewValidators: () => void) {
		const loggedIn = await this.storage.isLoggedIn()
		if (!loggedIn) return

		if (this.upSyncLastTry + 2 * 60 * 1000 > Date.now()) {
			console.log('maySyncUp canceled, last try was under 2minutes ago')
			return
		}

		const lastTimeUpSynced = (await this.storage.getObject(LAST_TIME_UPSYNCED_KEY)) as StoredTimestamp

		// Upload only when new validators were added locally
		const lastTimeAdded = (await this.storage.getObject(LAST_TIME_ADDED_KEY)) as StoredTimestamp
		if (lastTimeAdded && (!lastTimeUpSynced || lastTimeAdded.timestamp > lastTimeUpSynced.timestamp)) {
			this.upSyncLastTry = Date.now()
			const success = await this.syncUp(syncNotificationsForNewValidators)
			if (success) {
				this.storage.setObject(LAST_TIME_UPSYNCED_KEY, { timestamp: Date.now() } as StoredTimestamp)
			}
		}
	}

	private upDeleteSyncLastTry = 0
	private deleteSyncLock = new Mutex()
	private async mayDeleteUp() {
		const loggedIn = await this.storage.isLoggedIn()
		if (!loggedIn) return

		if (this.upDeleteSyncLastTry + 5 * 60 * 1000 > Date.now()) {
			console.log('mayDeleteUp canceled, last try was under 2minutes ago')
			return
		}

		if (this.deleteSyncLock.isLocked()) {
			console.log('delete sync already locked by other async chain')
			return
		}

		const lastTimeUpDeleted = (await this.storage.getObject(LAST_TIME_UPDELETED_KEY)) as StoredTimestamp
		const lastTimeRemoved = (await this.storage.getObject(LAST_TIME_REMOVED_KEY)) as StoredTimestamp

		console.log('mayDeleteUp', lastTimeRemoved, lastTimeUpDeleted)

		if (lastTimeRemoved && (!lastTimeUpDeleted || lastTimeRemoved.timestamp > lastTimeUpDeleted.timestamp)) {
			console.log('Starting deleteUp')
			const unlock = await this.deleteSyncLock.acquire()
			const success = await this.deleteUp()
			unlock()
			if (success) {
				this.validator.clearDeletedSet()
				this.storage.setObject(LAST_TIME_UPDELETED_KEY, { timestamp: Date.now() })
			}
		} else {
			this.validator.clearDeletedSet()
		}
	}

	private async deleteUp(): Promise<boolean> {
		const storageKey = this.validator.getStorageKey()
		const deletedSet = await this.validator.getDeletedSet(storageKey)

		console.log('delete queue', deletedSet)
		if (deletedSet.size <= 0) return true
		this.upDeleteSyncLastTry = Date.now()
		console.log('== starting delete sync queue ==')

		let count = 0
		let finished = true
		for (const value of deletedSet) {
			const success = await this.validator.removeValidatorRemote(value.toString())
			if (success) {
				console.log('== deleted ' + value + ' ==')
				count++

				const temp = await this.validator.getDeletedSet(storageKey)
				temp.delete(value)
				this.validator.setDeleteSet(storageKey, temp)

				await this.delay(10000 + (count > 3 ? 15000 : 0))
			} else {
				console.log('== failed to delete ' + value + ' ==')
				finished = false
				await this.delay(35000)
			}
		}

		return finished
	}

	private delay(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	private async syncUp(syncNotificationsForNewValidators: () => void) {
		console.log('[SYNC] syncing up')

		const storageKey = this.validator.getStorageKey()
		const current = await this.validator.getMap(storageKey)

		const syncUpList: string[] = []
		current.forEach((validator) => {
			if (!validator.synced) syncUpList.push(validator.index + '')
		})

		if (syncUpList.length <= 0) return true
		const success = await this.addValidatorsRemote(syncUpList)

		if (success) {
			syncNotificationsForNewValidators()

			current.forEach((validator) => {
				if (!validator.synced) validator.synced = true
			})
		}

		await this.storage.setObject(storageKey, current)
		return success
	}

	private async syncRemoteRemovals(myRemotes: MyValidatorResponse[]) {
		const storageKey = this.validator.getStorageKey()
		const current = await this.validator.getMap(storageKey)

		const existsSynced: Set<string> = new Set<string>()
		myRemotes.forEach((remote) => {
			if (current.has(remote.PubKey)) {
				existsSynced.add(remote.PubKey)
			}
		})
		console.log('syncRemoteRemovals existsSynced', existsSynced)

		current.forEach((oldValidator) => {
			if (!existsSynced.has(oldValidator.pubkey) && oldValidator.synced) {
				console.log('syncRemoteRemovals remove', oldValidator)
				current.delete(oldValidator.pubkey)
			}
		})

		await this.storage.setObject(storageKey, current)
	}

	private async addValidatorsRemote(indices: string[]): Promise<boolean> {
		const request = new AddMyValidatorsRequest(indices)
		const response = await this.api.execute(request)
		const result = request.parse(response)
		console.log('add validators remote', response, result)
		return request.wasSuccessful(response)
	}
}
