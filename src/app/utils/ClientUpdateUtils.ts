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
import { StorageService } from '../services/storage.service'
import { Injectable } from '@angular/core'
import { GithubReleaseRequest, GithubReleaseResponse } from '../requests/requests'

interface ClientInfo {
	key: string
	name: string
	repo: string
	storageKey: string
}

export const Clients: ClientInfo[] = [
	// Execution
	{
		key: 'LIGHTHOUSE',
		name: 'Lighthouse',
		repo: 'sigp/lighthouse',
		storageKey: 'client_updates_lighthouse',
	},

	{
		key: 'LODESTAR',
		name: 'Lodestar',
		repo: 'chainsafe/lodestar',
		storageKey: 'client_updates_lodestar',
	},

	{
		key: 'PRYSM',
		name: 'Prysm',
		repo: 'prysmaticlabs/prysm',
		storageKey: 'client_updates_prysm',
	},

	{
		key: 'NIMBUS',
		name: 'Nimbus',
		repo: 'status-im/nimbus-eth2',
		storageKey: 'client_updates_nimbus',
	},

	{
		key: 'TEKU',
		name: 'Teku',
		repo: 'ConsenSys/teku',
		storageKey: 'client_updates_teku',
	},
	// Consensus
	{
		key: 'BESU',
		name: 'Besu',
		repo: 'hyperledger/besu',
		storageKey: 'client_updates_besu',
	},

	{
		key: 'ERIGON',
		name: 'Erigon',
		repo: 'ledgerwatch/erigon',
		storageKey: 'client_updates_erigon',
	},

	{
		key: 'GETH',
		name: 'Geth',
		repo: 'ethereum/go-ethereum',
		storageKey: 'client_updates_geth',
	},

	{
		key: 'NETHERMIND',
		name: 'Nethermind',
		repo: 'NethermindEth/nethermind',
		storageKey: 'client_updates_nethermind',
	},
	// Various
	{
		key: 'ROCKETPOOL',
		name: 'Rocketpool',
		repo: 'rocket-pool/smartnode-install',
		storageKey: 'smart_node_updates',
	},
	{
		key: 'MEV-BOOST',
		name: 'MEV-Boost',
		repo: 'flashbots/mev-boost',
		storageKey: 'mev_boost_updates',
	},
]

const LOCAL_UPDATED_KEY = 'mark_clientupdate_completed'
const SETTINGS_UPDATECHANNEL = 'setting_client_updatechannel'

@Injectable({
	providedIn: 'root',
})
export default class ClientUpdateUtils {
	private oldClientInfoConverted = false
	updates: Release[] = null

	constructor(private api: ApiService, private storage: StorageService) {}

	getClientInfo(clientKey: string): ClientInfo {
		if (clientKey == null) {
			return null
		}

		const client = Clients.find((client) => client.key == clientKey)
		if (client == undefined) {
			console.log('ClientInfo for', clientKey, 'not found')
			return null
		}
		return client
	}

	async checkAllUpdates() {
		this.updates = null
		for (let i = 0; i < Clients.length; i++) {
			this.append(this.checkUpdateFor(await this.storage.getItem(Clients[i].storageKey)))
		}
	}

	async checkClientUpdate(clientKey: string) {
		this.remove(clientKey)

		const client = this.getClientInfo(clientKey)
		if (client != null) {
			this.append(this.checkUpdateFor(await this.storage.getItem(client.storageKey)))
		}
	}

	private async isPreReleaseAllowed() {
		return (await this.getUpdateChannel()) == 'PRERELEASE'
	}

	private async append(info: Promise<null | false | Release>) {
		const data = await info
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
		this.storage.setObject(LOCAL_UPDATED_KEY + clientKey, { clientKey: clientKey, version: id })
	}

	private async getLastClosedVersion(clientKey: string): Promise<LocalReleaseMark> {
		return (await this.storage.getObject(LOCAL_UPDATED_KEY + clientKey)) as LocalReleaseMark
	}

	private async getReleases(client: ClientInfo): Promise<Release> {
		const req = new GithubReleaseRequest(client.repo, !(await this.isPreReleaseAllowed()))
		const response = await this.api.execute(req).catch((error) => {
			console.warn('error getReleases', error)
			return null
		})
		const temp = req.parse(response)
		if (temp.length <= 0) return null
		console.log('Client updates data', response, temp)
		return new Release(client, temp[0])
	}

	async convertOldToNewClientSettings() {
		if (this.oldClientInfoConverted) {
			return
		}

		const oldEth1StorageKey = 'setting_client_eth1'

		let oldClient = await this.storage.getItem(oldEth1StorageKey)
		if (oldClient != null) {
			console.log('Old ETH1/ETH2 client settings found, converting them')

			if (oldClient != 'none') {
				this.setClient(oldClient, oldClient)
			}
			this.storage.remove(oldEth1StorageKey)

			// both ETH1 and ETH2 clients where used simultaneously
			// so only if the ETH1 client was != null, there was a possibility for an ETH2 client too
			const oldEth2StorageKey = 'setting_client_eth2'

			oldClient = await this.storage.getItem(oldEth2StorageKey)
			if (oldClient != null) {
				if (oldClient != 'none') {
					this.setClient(oldClient, oldClient)
				}
				this.storage.remove(oldEth2StorageKey)
			}
		}

		this.oldClientInfoConverted = true
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
