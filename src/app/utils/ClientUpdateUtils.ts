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

import { ApiService } from '../services/api.service'
import { StorageService } from '../services/storage.service'
import { Injectable, OnInit } from '@angular/core'
import { GithubReleaseRequest, GithubReleaseResponse } from '../requests/requests'

export interface ClientInfo {
	key: string
	remoteKey: string // remote uses different keys now, acts more as a name
	remoteId?: number // used to subscribe/unsubscribe on remote
	name: string
	repo: string
	storageKey: string
	type: 'cons' | 'exec' | '3rdparty'
}

export const Clients: ClientInfo[] = [
	// Consensus
	{
		key: 'LIGHTHOUSE',
		remoteKey: 'Lighthouse',
		name: 'Lighthouse',
		repo: 'sigp/lighthouse',
		storageKey: 'client_updates_lighthouse',
		type: 'cons',
	},

	{
		key: 'LODESTAR',
		remoteKey: 'Lodestar',
		name: 'Lodestar',
		repo: 'chainsafe/lodestar',
		storageKey: 'client_updates_lodestar',
		type: 'cons',
	},

	{
		key: 'PRYSM',
		remoteKey: 'Prysm',
		name: 'Prysm',
		repo: 'prysmaticlabs/prysm',
		storageKey: 'client_updates_prysm',
		type: 'cons',
	},

	{
		key: 'NIMBUS',
		remoteKey: 'Nimbus',
		name: 'Nimbus',
		repo: 'status-im/nimbus-eth2',
		storageKey: 'client_updates_nimbus',
		type: 'cons',
	},

	{
		key: 'TEKU',
		remoteKey: 'Teku',
		name: 'Teku',
		repo: 'ConsenSys/teku',
		storageKey: 'client_updates_teku',
		type: 'cons',
	},

	// {
	// 	key: 'GRANDINE',
	// 	remoteKey: 'Grandine',
	// 	name: 'Grandine',
	// 	repo: 'grandinetech/grandine',
	// 	storageKey: 'client_updates_grandine',
	// 	type: 'cons',
	// },

	// Execution
	{
		key: 'BESU',
		remoteKey: 'Besu',
		name: 'Besu',
		repo: 'hyperledger/besu',
		storageKey: 'client_updates_besu',
		type: 'exec',
	},

	{
		key: 'ERIGON',
		remoteKey: 'Erigon',
		name: 'Erigon',
		repo: 'erigontech/erigon',
		storageKey: 'client_updates_erigon',
		type: 'exec',
	},

	{
		key: 'GETH',
		remoteKey: 'Geth',
		name: 'Geth',
		repo: 'ethereum/go-ethereum',
		storageKey: 'client_updates_geth',
		type: 'exec',
	},

	{
		key: 'NETHERMIND',
		remoteKey: 'Nethermind',
		name: 'Nethermind',
		repo: 'NethermindEth/nethermind',
		storageKey: 'client_updates_nethermind',
		type: 'exec',
	},

	{
		key: 'RETH',
		remoteKey: 'Reth',
		name: 'Reth',
		repo: 'paradigmxyz/reth',
		storageKey: 'client_updates_reth',
		type: 'exec',
	},
	// Various
	{
		key: 'ROCKETPOOL',
		remoteKey: 'Rocketpool Smart Node',
		name: 'Rocketpool',
		repo: 'rocket-pool/smartnode-install',
		storageKey: 'smart_node_updates',
		type: '3rdparty',
	},
	{
		key: 'MEV-BOOST',
		remoteKey: 'MEV-Boost',
		name: 'MEV-Boost',
		repo: 'flashbots/mev-boost',
		storageKey: 'mev_boost_updates',
		type: '3rdparty',
	},
]

const LOCAL_UPDATED_KEY = 'mark_clientupdate_completed'
const SETTINGS_UPDATECHANNEL = 'setting_client_updatechannel'

@Injectable({
	providedIn: 'root',
})
export default class ClientUpdateUtils implements OnInit {
	updates: Release[] = null
	lastTry = 0
	private locked = false

	constructor(
		private api: ApiService,
		private storage: StorageService
	) {}

	ngOnInit() {
		this.storage.getBooleanSetting('migrated_uu_5_0_0', false).then(async (migrated) => {
			if (!migrated) {
				const updateChannel = await this.getUpdateChannel()
				if (updateChannel == 'PRERELEASE') {
					this.setUpdateChannel('STABLE')
				}
				console.info('migrated update channel to stable')
				this.storage.setBooleanSetting('migrated_uu_5_0_0', true)
			}
		})
	}

	getClientInfo(clientKey: string): ClientInfo {
		if (clientKey == null) {
			return null
		}

		const client = Clients.find((c) => c.key == clientKey)
		if (client == undefined) {
			console.log('ClientInfo for', clientKey, 'not found')
			return null
		}
		return client
	}

	async checkAllUpdates() {
		if (this.lastTry + 10 * 60 * 1000 > Date.now()) return
		if (this.locked) return

		this.locked = true
		const promiseArray: Promise<Release>[] = []
		for (let i = 0; i < Clients.length; i++) {
			promiseArray.push(this.checkUpdateFor(await this.storage.getItem(Clients[i].storageKey)))
		}

		try {
			const results = await Promise.all(promiseArray)
			let changeFound = false
			for (let i = 0; i < results.length; i++) {
				if (results[i] && !this.contains(results[i])) {
					changeFound = true
					break
				}
			}

			if (changeFound) {
				this.updates = null
				for (let i = 0; i < results.length; i++) {
					if (results[i]) {
						this.append(results[i])
					}
				}
			}
		} catch (error) {
			console.error('An error occurred while checking for all updates:', error)
		}
		this.locked = false
	}

	async checkClientUpdate(clientKey: string) {
		const client = this.getClientInfo(clientKey)
		if (client == null) {
			return
		}
		const update = await this.checkUpdateFor(await this.storage.getItem(client.storageKey))

		if (update && !this.contains(update)) {
			this.remove(clientKey)
			this.append(update)
		}
	}

	private append(info: Release) {
		const data = info
		if (!data) return

		if (this.updates == null) this.updates = [data]
		else {
			if (!this.contains(data)) {
				this.updates.push(data)
			}
		}
	}

	private remove(clientKey: string): boolean {
		if (this.updates == null) {
			return false
		}

		for (let i = 0; i < this.updates.length; i++) {
			const value = this.updates[i]
			if (value.client.key == clientKey) {
				this.updates.splice(i, 1)
				return true
			}
		}
		return false
	}

	// why are duplicates in Sets a thing, javascript? :(
	private contains(info: Release): boolean {
		if (this.updates == null) {
			return false
		}

		for (let i = 0; i < this.updates.length; i++) {
			const value = this.updates[i]
			if (value.client.key == info.client.key) {
				return true
			}
		}
		return false
	}

	private async checkUpdateFor(clientKey: string) {
		if (clientKey == null || clientKey == 'null') {
			return null
		}
		const client = this.getClientInfo(clientKey)
		if (client != null) {
			this.lastTry = Date.now()
			const update = await this.getReleases(client)
			const lastClosed = await this.getLastClosedVersion(clientKey)
			if (update && update.data && lastClosed) {
				if (update.data.id > lastClosed.version) {
					return update
				}
			} else {
				return update
			}
			return null
		}
		return null
	}

	setUpdateChannel(key: string) {
		this.storage.setItem(SETTINGS_UPDATECHANNEL, key)
	}

	async getUpdateChannel() {
		const temp = await this.storage.getItem(SETTINGS_UPDATECHANNEL)
		if (!temp) {
			return 'STABLE'
		}
		return temp
	}

	async setClient(clientKey: string, value: string): Promise<boolean> {
		const client = this.getClientInfo(clientKey)
		if (client == null) {
			return false
		}

		const old = await this.storage.getItem(client.storageKey)
		if (old == value) {
			return false
		}
		await this.storage.setItem(client.storageKey, value)
		return true
	}

	async getClient(clientKey: string) {
		const client = this.getClientInfo(clientKey)
		if (client == null) {
			return null
		}

		return await this.storage.getItem(client.storageKey)
	}

	async dismissRelease(clientKey: string, id: string) {
		await this.storage.setObject(LOCAL_UPDATED_KEY + clientKey, { clientKey: clientKey, version: id })
	}

	private async getLastClosedVersion(clientKey: string): Promise<LocalReleaseMark> {
		return (await this.storage.getObject(LOCAL_UPDATED_KEY + clientKey)) as LocalReleaseMark
	}

	private async getReleases(client: ClientInfo): Promise<Release> {
		const req = new GithubReleaseRequest(client.repo)
		const temp = await this.api.execute2(req)
		if (temp.error) return null
		console.log('Client updates data', temp)
		return new Release(client, temp.data[0])
	}
}

interface LocalReleaseMark {
	clientKey: string
	version: number
}

export class Release {
	constructor(client: ClientInfo, data: GithubReleaseResponse) {
		this.client = client
		this.data = data
	}

	readonly client: ClientInfo
	readonly data: GithubReleaseResponse
}
