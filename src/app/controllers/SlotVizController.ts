// Copyright (C) 2025 Bitfly GmbH
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
// along with Beaconchain Dashboard.  If not, see <https://www.gnu.org/licenses/>.

import { computed, Injectable, NgZone, Signal, signal, WritableSignal } from '@angular/core'
import { LatestStateData } from '@requests/types/latest_state'
import { SlotVizEpoch, VDBSlotVizSlot } from '@requests/types/slot_viz'
import { dashboardID, V2SlotViz } from '@requests/v2-dashboard'
import { ApiService } from '@services/api.service'
import { ChainNetwork, findChainNetworkById } from '@utils/NetworkData'
import { slotToSecondsTimestamp, timestampToSlot, timeUntilNextSlot } from '@utils/TimeUtils'

@Injectable({ providedIn: 'root' })
export class SlotVizProvider {
	private dashboardID: dashboardID
	private groupID: number = -1

	private running: boolean = false

	private intervalId: ReturnType<typeof setInterval> | null = null
	private timerSignal = signal(0)

	private currentChainConfig: ChainNetwork

	private latestState: WritableSignal<LatestStateData> = signal(null)
	public slotViz: WritableSignal<SlotVizEpoch[]> = signal(null)

	slots = computed(() => {
		if (this.slotViz() == null) return []
		return this.slotViz()
			.flatMap((item) => item.slots)
			.sort((a, b) => a.slot - b.slot)
	})

	previousDuties: Signal<VDBSlotVizSlot[]> = computed(() => {
		// give me all slots before current one where validator has a duty
		const duties = this.slots()
			.filter((slot) => this.slotHasDuty(slot) && slot.slot <= this.currentSlot())
			.sort((a, b) => b.slot - a.slot)
		if (duties.length == 0) return []
		return duties
	})

	previousDuty: Signal<VDBSlotVizSlot> = computed(() => {
		this.currentSlot()
		const duties = this.previousDuties()

		if (duties.length == 0) return null
		return duties[0]
	})

	nextDuties: Signal<VDBSlotVizSlot[]> = computed(() => {
		// give me all slots after current one where validator has a duty
		const duties = this.slots()
			.filter((slot) => slot.slot > this.currentSlot() && this.slotHasDuty(slot))
			.sort((a, b) => a.slot - b.slot)
		if (duties.length == 0) return []
		return duties
	})

	nextDuty: Signal<VDBSlotVizSlot> = computed(() => {
		this.currentSlot()
		if (this.nextDuties().length == 0) return null
		return this.nextDuties()[0]

		// let i = 0
		// while (i < this.nextDuties().length && this.slotTime(this.nextDuties()[i].slot) <= Date.now()) {
		// 	i++
		// }
		// return i < this.nextDuties().length ? this.nextDuties()[i] : null
	})

	currentSlot: Signal<number> = computed(() => {
		this.timerSignal()
		const slot = timestampToSlot(this.api.networkConfig.supportedChainIds, Date.now())
		console.log('slotviz current slot')
		return slot
	})

	nextDutyTs: Signal<number> = computed(() => {
		if (this.nextDuty() == null) return this.slotTime(this.slots()[this.slots().length - 1].slot)
		return this.slotTime(this.nextDuty().slot)
	})

	private slotHasDuty(slot: VDBSlotVizSlot) {
		return slot.attestations || slot.proposal || slot.sync
	}

	constructor(
		private api: ApiService,
		private zone: NgZone
	) {}

	start(id: dashboardID, groupID: number) {
		console.log('slotviz slot viz start')
		this.dashboardID = id
		this.groupID = groupID

		if (this.running) return
		this.running = true

		this.startTimer()
		this.serviceLoop()
	}

	stop() {
		this.running = false
		if (this.intervalId) {
			clearInterval(this.intervalId)
		}
	}

	private slotTime(slot: number) {
		return slotToSecondsTimestamp(this.api.networkConfig.supportedChainIds, slot) * 1000
	}

	private serviceLoop() {
		if (!this.running) return

		this.update()
		this.currentChainConfig = findChainNetworkById(this.api.getNetwork().supportedChainIds)
		setTimeout(() => this.serviceLoop(), this.currentChainConfig.slotsTime * 1000)
	}

	private async update() {
		const result = await Promise.all([
			// this.api.set(new V2LatestState().withAllowedCacheResponse(false), this.latestState),
			this.api.set(new V2SlotViz(this.dashboardID, this.groupID).withAllowedCacheResponse(false), this.slotViz),
		])
		if (result[0].error) {
			// || result[1].error
			console.error('Error updating SlotVizProvider', result)
		}
	}

	changeDashboard(id: dashboardID) {
		this.dashboardID = id
		this.zone.run(() => {
			this.timerSignal.set(Date.now())
		})
	}

	changeGroupID(groupID: number) {
		this.groupID = groupID
		this.zone.run(() => {
			this.timerSignal.set(Date.now())
		})
	}

	private startTimer() {
		const buffer = 0
		const wait = timeUntilNextSlot(this.api.networkConfig.supportedChainIds, Date.now()) + buffer
		// start interval with start of next slot
		setTimeout(() => {
			this.zone.run(() => {
				this.timerSignal.set(Date.now())
			})
			this.startTimer()
		}, wait)
	}

	ngOnDestroy() {
		this.stop()
	}
}
