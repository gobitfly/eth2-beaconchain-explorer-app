import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { IonicModule } from '@ionic/angular'
import { NotificationNetworksTableRow } from 'src/app/requests/types/notifications'
import { BaseHistoryItemComponent } from '../base-history-item/base-history-item.component'
import { findChainNetworkById } from 'src/app/utils/NetworkData'
import { capitalize } from 'src/app/services/api.service'

@Component({
	selector: 'app-network-history-item',
	standalone: true,
	imports: [CommonModule, IonicModule, BaseHistoryItemComponent],
	templateUrl: './network-history-item.component.html',
	styleUrl: './network-history-item.component.scss',
})
export class NetworkHistoryItemComponent {
	@Input() data: NotificationNetworksTableRow
	@Input() first: boolean
	@Input() last: boolean
	title: string
	extra: string
	network: string

	ngOnChanges() {
		this.title = formatNetworkHistoryType(this.data.event_type)
		this.extra = this.getExtra()
		this.network = capitalize(findChainNetworkById(this.data.chain_id).name)
	}

	private getExtra() {
		switch (this.data.event_type) {
			case 'new_reward_round':
				return ''
			case 'gas_above':
				return this.data.threshold
			case 'gas_below':
				return this.data.threshold
			case 'participation_rate':
				return this.data.threshold
		}
	}
}

export function formatNetworkHistoryType(eventType: string): string {
	switch (eventType) {
		case 'new_reward_round':
			return 'New Reward Round'
		case 'gas_above':
			return 'Gas Above'
		case 'gas_below':
			return 'Gas Below'
		case 'participation_rate':
			return 'Participation Rate'
	}

	return null
}
