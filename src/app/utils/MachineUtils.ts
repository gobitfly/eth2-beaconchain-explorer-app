// Copyright (C) 2021 Bitfly GmbH
//
// This file is part of Beaconchain Dashboard.
//
// Beaconchain Dashboard is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Beaconchain Dashboard is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Beaconchain Dashboard.  If not, see <http://www.gnu.org/licenses/>.

import { ApiService } from '../services/api.service'
import { Injectable } from '@angular/core'
import MachineController, { ProcessedStats, StatsResponse } from '../controllers/MachineController'
import { GetMyMachinesRequest } from '../requests/requests'
import { StorageService } from '../services/storage.service'
import { SyncService } from '../services/sync.service'
import { CacheModule } from './CacheModule'

const LOGTAG = '[MachineUtils] '
const MACHINES_STORAGE_KEY = 'stored_machine_names'
export const UNSUPPORTED_PRYSM = 'unsupported_prysm_version'

const MACHINE_CACHE = 'machine_'

@Injectable({
	providedIn: 'root',
})
export default class MachineUtils extends CacheModule {
	constructor(private api: ApiService, private storage: StorageService, private sync: SyncService) {
		super('machine', 4 * 60 * 1000)
	}

	storeInHardCache(): boolean {
		return false
	}

	/*
        2 Listen
            -) Alle machine names
            -) Neu ungesyncte machine names
    */

	// Call from notification screen when need a full list of machine names
	async getAllMachineNames(): Promise<string[]> {
		const local = await this.getAllLocalMachineNames()
		console.log('getAllMachineNames local', local)
		if (!local || local.length == 0) {
			const remote = await this.getAndProcessDataBase()
			return this.getAllMachineNamesFrom(remote)
		}
		return local
	}

	private async registerNewRemotesForSync(remote: string[]): Promise<boolean> {
		const local = await this.getAllLocalMachineNames()
		let returnOK = true
		for (let i = 0; i < remote.length; i++) {
			const it = remote[i] // TODO think about default scenario
			if (!local || !local.includes(it)) {
				console.log(LOGTAG + 'found a new machine, applying your notification preferences...')
				returnOK = (await this.sync.reapplyNotifyEvent('monitoring_machine_offline', it)) && returnOK
				returnOK = (await this.sync.reapplyNotifyEvent('monitoring_hdd_almostfull', it)) && returnOK
				returnOK = (await this.sync.reapplyNotifyEvent('monitoring_cpu_load', it)) && returnOK
				returnOK = (await this.sync.reapplyNotifyEvent('monitoring_memory_usage', it)) && returnOK
			}
		}
		this.sync.syncAllSettings()
		return returnOK
	}

	private registerAllLocalMachineNames(names: string[]) {
		this.storage.setObject(MACHINES_STORAGE_KEY, names)
	}

	private async getAllLocalMachineNames(): Promise<string[]> {
		return this.storage.getObject(MACHINES_STORAGE_KEY) as Promise<string[]>
	}

	private getAllMachineNamesFrom(data: ProcessedStats[]): string[] {
		const result: string[] = []
		for (const key in data) {
			result.push(key)
		}
		return result
	}

	private unsupportedPrysmVersion(data: ProcessedStats[], machineController: MachineController): boolean {
		let result = false
		for (const key in data) {
			const machine = data[key]

			if (machineController.isBuggyPrysmVersion(machine)) {
				result = true
			}
		}
		return result
	}

	async getAndProcessData(timeslot = 180) {
		const result = await this.getAndProcessDataBase(timeslot)
		const machineNames = this.getAllMachineNamesFrom(result)
		console.log(LOGTAG + ' machine names', machineNames)

		this.registerNewRemotesForSync(machineNames).then((remoteResult) => {
			console.log(LOGTAG + ' registerNewRemotesForSync', remoteResult)
		})

		// Storing all machine names if
		// Used for notification syncing
		this.registerAllLocalMachineNames(machineNames)

		return result
	}

	private async getAndProcessDataBase(timeslot = 180) {
		const data = (await this.getData(timeslot).catch(() => {
			return null
		})) as StatsResponse
		console.log('machine data', data)
		if (data == null) {
			return []
		}

		const machineController = new MachineController(this.storage)

		const result = machineController.combineByMachineName(
			machineController.filterMachines(data.validator),
			machineController.filterMachines(data.node),
			machineController.filterMachines(data.system)
		)

		const unsupportedPrysm = this.unsupportedPrysmVersion(result, machineController)
		this.storage.setBooleanSetting(UNSUPPORTED_PRYSM, unsupportedPrysm)
		//machineController.isBuggyPrysmVersion(result)

		return result
	}

	private async getData(timeslot: number): Promise<StatsResponse> {
		const cached = (await this.getCache(MACHINE_CACHE + timeslot)) as StatsResponse
		if (cached) return cached
		const request = new GetMyMachinesRequest(0, timeslot)
		const response = await this.api.execute(request)
		const result = request.parse(response)
		if (result && result[0]) {
			this.putCache(MACHINE_CACHE + timeslot, result[0])
		}
		return result[0]
	}
}
