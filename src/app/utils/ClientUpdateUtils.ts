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
import { GithubReleaseRequest, GithubReleaseResponse } from '../requests/requests';

interface ETHClient {
    key: string,
    name: string,
    repo: string
}

export const ETHClients: ETHClient[] = [
    // Execution
    {
        key: "LIGHTHOUSE",
        name: "Lighthouse",
        repo: "sigp/lighthouse",
    },

    {
        key: "LODESTAR",
        name: "Lodestar",
        repo: "chainsafe/lodestar",
    },

    {
        key: "PRYSM",
        name: "Prysm",
        repo: "prysmaticlabs/prysm",
    },

    {
        key: "NIMBUS",
        name: "Nimbus",
        repo: "status-im/nimbus-eth2",
    },

    {
        key: "TEKU",
        name: "Teku",
        repo: "ConsenSys/teku",
    },
    // Consensus
    {
        key: "BESU",
        name: "Besu",
        repo: "hyperledger/besu",
    },

    {
        key: "ERIGON",
        name: "Erigon",
        repo: "ledgerwatch/erigon",
    },

    {
        key: "GETH",
        name: "Geth",
        repo: "ethereum/go-ethereum",
    },

    {
        key: "NETHERMIND",
        name: "Nethermind",
        repo: "NethermindEth/nethermind",
    },
]

export const OtherClients: ETHClient[] = [
    {
        key: "ROCKETPOOL",
        name: "Rocketpool",
        repo: "rocket-pool/smartnode-install",
    },
    {
        key: "MEV-BOOST",
        name: "MEV-Boost",
        repo: "flashbots/mev-boost",
    },
]

const LOCAL_UPDATED_KEY = "mark_clientupdate_completed"
const ETH_CLIENT_SAVED_PREFIX = "setting_client_"
export const ROCKETPOOL_CLIENT_SAVED = "smart_node_updates"
export const MEVBOOST_CLIENT_SAVED = "mev_boost_updates"
const SETTINGS_UPDATECHANNEL = "setting_client_updatechannel"

@Injectable({
    providedIn: 'root'
})
export default class ClientUpdateUtils {

    updates: Release[] = null

    constructor(
        private api: ApiService,
        private storage: StorageService
    ) { }

    async checkUpdates() {
        this.updates = null
        for (let i = 0; i < ETHClients.length; i++) {
            this.append(
                this.checkUpdateFor(ETHClients, await this.storage.getItem(this.getETHClientStorageKey(ETHClients[i].key)))
            )
        }

        this.append(
            this.checkUpdateFor(OtherClients, await this.storage.getItem(MEVBOOST_CLIENT_SAVED))
        )

        this.append(
            this.checkUpdateFor(OtherClients, await this.storage.getItem(ROCKETPOOL_CLIENT_SAVED))
        )
    }

    async checkETHClientUpdate(clientKey: string) {
        this.remove(clientKey)

        this.append(
            this.checkUpdateFor(ETHClients, clientKey)
        )
    }

    async checkMEVBoostUpdate() {
        this.remove("MEV-BOOST")

        this.append(
            this.checkUpdateFor(OtherClients, await this.storage.getItem(MEVBOOST_CLIENT_SAVED))
        )
    }

    async checkRocketpoolUpdate() {
        this.remove("ROCKETPOOL")

        this.append(
            this.checkUpdateFor(OtherClients, await this.storage.getItem(ROCKETPOOL_CLIENT_SAVED))
        )
    }

    private async isPreReleaseAllowed() {
        return await this.getUpdateChannel() == "PRERELEASE"
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

        for (var i = 0; i < this.updates.length; i++) {
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

        for (var i = 0; i < this.updates.length; i++) {
            const value = this.updates[i]
            if (value.client.key == info.client.key) {
                return true
            }
        }
        return false
    }

    private async checkUpdateFor(array: ETHClient[], clientKey: string) {
        console.log("checkUpdateFor", clientKey, array)
        if (!clientKey) return false
        const client = array.find((item) => item.key == clientKey)
        if (client) {
            console.log("checkUpdateFor found", client)
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
        if (!temp) return "STABLE"
        return temp
    }

    private async setClient(storageKey: string, value: string): Promise<boolean> {
        const old = await this.storage.getItem(storageKey)
        if (old == value) return false
        this.storage.setItem(storageKey, value)
        return true
    }

    async setRocketpoolClient(clientKey: string): Promise<boolean> {
        return await this.setClient(ROCKETPOOL_CLIENT_SAVED, clientKey)
    }

    async getRocketpoolClient() {
        var temp = await this.storage.getItem(ROCKETPOOL_CLIENT_SAVED)
        if (temp) {
            return temp.toUpperCase()
        }
        return temp
    }

    async setMevBoostClient(clientKey: string): Promise<boolean> {
        return await this.setClient(MEVBOOST_CLIENT_SAVED, clientKey)
    }

    async getMevBoostClient() {
        var temp = await this.storage.getItem(MEVBOOST_CLIENT_SAVED)
        if (temp) {
            return temp.toUpperCase()
        }
        return temp
    }

    async setETHClient(clientKey: string, value: string): Promise<boolean> {
        return await this.setClient(this.getETHClientStorageKey(clientKey), value)
    }

    async getETHClient(clientKey: string) {
        return await this.storage.getItem(this.getETHClientStorageKey(clientKey))
    }

    async dismissRelease(clientKey: string, id: string) {
        this.storage.setObject(LOCAL_UPDATED_KEY + clientKey, { clientKey: clientKey, version: id })
    }

    private async getLastClosedVersion(clientKey: string): Promise<LocalReleaseMark> {
        return await this.storage.getObject(LOCAL_UPDATED_KEY + clientKey)
    }

    private async getReleases(client: ETHClient): Promise<Release> {
        const req = new GithubReleaseRequest(client.repo, !(await this.isPreReleaseAllowed()))
        const response = await this.api.execute(req).catch((error) => { return null })
        const temp = req.parse(response)
        if (temp.length <= 0) return null
        console.log("Client updates data", response, temp)
        return new Release(client, temp[0])
    }

    getETHClientStorageKey(key: string) {
        return ETH_CLIENT_SAVED_PREFIX + key
    }

    // Set client if only name of client is known and not whether execution or consensus. For example when setting client from /user/notifications
    setUnknownLayerClient(client: string) {
        client = client.toUpperCase()
        ETHClients.forEach((data) => {
            if (data.key.toLowerCase() == client.toLocaleLowerCase()) {
                console.log("setting", data.key, "to", client)
                this.setETHClient(data.key, data.key)
                return
            }
        })

        OtherClients.forEach((data) => {
            if (data.key.toLowerCase() == client.toLocaleLowerCase()) {
                if (data.key == "MEV-BOOST") {
                    console.log("setting mevboost client to", client)
                    this.setMevBoostClient(data.key)
                    return
                } else {
                    console.log("setting rocketpool client to", client)
                    this.setRocketpoolClient(data.key)
                    return
                }

            }
        })

    }

}

interface LocalReleaseMark {
    clientKey: string,
    version: number
}

export class Release {

    constructor(client: ETHClient, data: GithubReleaseResponse) {
        this.client = client
        this.data = data
    }

    readonly client: ETHClient
    readonly data: GithubReleaseResponse
}