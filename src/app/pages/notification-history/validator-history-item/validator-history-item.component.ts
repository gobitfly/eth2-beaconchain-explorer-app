import { Component, Input } from '@angular/core'
import {
	NotificationClientsTableRow,
	NotificationDashboardsTableRow,
	NotificationMachinesTableRow,
	NotificationNetworksTableRow,
} from 'src/app/requests/types/notifications'
import { NotificationDetailComponent } from '../../notification-detail/notification-detail.component'
import { IonicModule, ModalController } from '@ionic/angular'
import { CommonModule } from '@angular/common'
import { BaseHistoryItemComponent } from '../base-history-item/base-history-item.component'

interface EventType {
	eventType: string
	short: string
	color: string
}

export type HistoryDataTypes =
	| NotificationDashboardsTableRow
	| NotificationMachinesTableRow
	| NotificationNetworksTableRow
	| NotificationClientsTableRow

@Component({
	selector: 'app-validator-history-item',
	imports: [CommonModule, IonicModule, BaseHistoryItemComponent],
	templateUrl: './validator-history-item.component.html',
	styleUrl: './validator-history-item.component.scss',
})
export class NotificationHistoryItemComponent {
	@Input() data: NotificationDashboardsTableRow
	@Input() first: boolean
	@Input() last: boolean
	eventTypeBadge: EventType[]

	constructor(private modalCtrl: ModalController) {}

	ngOnChanges() {
		this.eventTypeBadge = this.getEventTypeBadge()
	}

	getEventTypeBadge = (): EventType[] => {
		if (!this.data) return []
		const result = this.data.event_types.map((eventType) => {
			return eventTypeBadge(eventType)
		})
		return result
	}

	async open() {
		const modal = await this.modalCtrl.create({
			component: NotificationDetailComponent,
			componentProps: {
				dashboardID: this.data.dashboard_id,
				groupID: this.data.group_id,
				epoch: this.data.epoch,
			},
		})
		modal.present()

		await modal.onWillDismiss()
	}
}

export function eventTypeBadge(eventType: string): EventType {
	switch (eventType) {
		case 'group_efficiency_below':
			return { eventType: eventType.toString(), short: 'Efficiency', color: 'secondary' }
		case 'validator_offline':
			return { eventType: eventType.toString(), short: 'Offline', color: 'danger' }
		case 'proposal_missed':
			return { eventType: eventType.toString(), short: 'Block Missed', color: 'danger' }
		case 'proposal_success':
			return { eventType: eventType.toString(), short: 'Block Proposed', color: 'secondary' }
		case 'proposal_upcoming':
			return { eventType: eventType.toString(), short: 'Block Upcoming', color: 'secondary' }
		case 'attestation_missed':
			return { eventType: eventType.toString(), short: 'Att. Missed', color: 'danger' }
		case 'max_collateral':
			return { eventType: eventType.toString(), short: 'Max Coll.', color: 'secondary' }
		case 'min_collateral':
			return { eventType: eventType.toString(), short: 'Min Coll.', color: 'secondary' }
		case 'sync':
			return { eventType: eventType.toString(), short: 'Sync', color: 'secondary' }
		case 'withdrawal':
			return { eventType: eventType.toString(), short: 'Withdrawal', color: 'secondary' }
		case 'validator_got_slashed':
			return { eventType: eventType.toString(), short: 'Slashed', color: 'danger' }
		case 'validator_online':
			return { eventType: eventType.toString(), short: 'Online', color: 'danger' }
		default:
			return { eventType: eventType.toString(), short: null, color: 'primary' }
	}
}
