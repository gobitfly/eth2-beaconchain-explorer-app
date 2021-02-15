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
import { StorageService, SETTING_NOTIFY_CLIENTUPDATE } from '../services/storage.service';
import { Injectable } from '@angular/core';
import { GithubReleaseRequest, GithubReleaseResponse } from '../requests/requests';

export interface ETHClient {
    key: string,
    name: string,
    repo: string
}

export const ETH2Clients: ETHClient[] = [

    {
        key: "LIGHTHOUSE",
        name: "Lighthouse",
        repo: "sigp/lighthouse",
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
]


export const ETH1Clients: ETHClient[] = [

    {
        key: "GETH",
        name: "Geth",
        repo: "ethereum/go-ethereum",
    },

    {
        key: "OPENETHEREUM",
        name: "Open Ethereum",
        repo: "openethereum/openethereum",
    },

    {
        key: "NETHERMIND",
        name: "Nethermind",
        repo: "NethermindEth/nethermind",
    },

    {
        key: "BESU",
        name: "Besu",
        repo: "hyperledger/besu",
    },
]


const LOCAL_UPDATED_KEY = "mark_clientupdate_completed"
export const ETH1_CLIENT_SAVED = "setting_client_eth1"
export const ETH2_CLIENT_SAVED = "setting_client_eth2"
const SETTINGS_UPDATECHANNEL = "setting_client_updatechannel"

const UPDATE_LOCK = "last_github_update"
const REFRESH_INTERVAL = 30 * 60 * 1000 // just a lock, responses are cached anyway

@Injectable({
    providedIn: 'root'
})
export default class ClientUpdateUtils {

    public updates: Release[] = null

    constructor(
        private api: ApiService,
        private storage: StorageService
    ) { }

    async checkUpdates() {

        this.updates = null

        this.append(
            this.checkUpdateFor(ETH2Clients, await this.storage.getItem(ETH2_CLIENT_SAVED))
        )

        this.append(
            this.checkUpdateFor(ETH1Clients, await this.storage.getItem(ETH1_CLIENT_SAVED))
        )

        this.storage.setObject(UPDATE_LOCK, { ts: Date.now() })
    }

    private async isPreReleaseAllowed() {
        return await this.getUpdateChannel() == "PRERELEASE"
    }

    async append(info: Promise<null | false | Release>) {
        const data = await info
        if (!data) return

        if (this.updates == null) this.updates = [data]
        else {
            if (!this.contains(data)) {
                this.updates.push(data)
            }
        }
    }

    // why are duplicates in Sets a thing, javascript? :(
    private contains(info: Release): boolean {
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
        const temp = array.find((item) => item.key == clientKey)
        if (temp) {
            console.log("checkUpdateFor found", temp)
            const update = await this.getReleases(temp)
            const lastClosed = await this.getLastClosedVersion(clientKey)
            if (update && update.data && lastClosed) {
                if (update.data.id > lastClosed.version) return update
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
        if (old && old == value) return false
        this.storage.setItem(storageKey, value)
        return true
    }

    async setETH2Client(key: string): Promise<boolean> {
        return await this.setClient(ETH2_CLIENT_SAVED, key)
    }

    getETH2Client() {
        return this.storage.getItem(ETH2_CLIENT_SAVED)
    }

    async setETH1Client(key: string): Promise<boolean> {
        return await this.setClient(ETH1_CLIENT_SAVED, key)
    }

    getETH1Client() {
        return this.storage.getItem(ETH1_CLIENT_SAVED)
    }

    getClient(key: string) {
        return this.storage.getItem(key)
    }

    async dismissRelease(release: Release) {
        this.storage.setObject(LOCAL_UPDATED_KEY + release.client.key, { clientKey: release.client.key, version: release.data.id })
    }

    private async areClientUpdatesNotified() {
        return await this.storage.getBooleanSetting(SETTING_NOTIFY_CLIENTUPDATE)
    }

    // Used when talking to remote (0 means no change)
    async getLastClosedVersionOrZero(clientKey) {
        const temp = await this.getLastClosedVersion(clientKey)
        if (temp && temp.version) return temp.version
        else return 0
    }

    async getLastClosedVersion(clientKey: string): Promise<LocalReleaseMark> {
        return await this.storage.getObject(LOCAL_UPDATED_KEY + clientKey)
    }

    private async getReleases(client: ETHClient): Promise<Release> {
        const req = new GithubReleaseRequest(client.repo, !(await this.isPreReleaseAllowed()))
        const response = await this.api.execute(req)
        const temp = req.parse(response)
        if (temp.length <= 0) return null
        console.log("Client updates data", response, temp)
        return new Release(client, temp[0])
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