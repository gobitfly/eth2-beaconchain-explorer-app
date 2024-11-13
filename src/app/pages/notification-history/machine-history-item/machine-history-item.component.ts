import { Component, Input } from '@angular/core'
import { BaseHistoryItemComponent } from '../base-history-item/base-history-item.component'
import { CommonModule } from '@angular/common'
import { IonicModule } from '@ionic/angular'
import { NotificationMachinesTableRow } from 'src/app/requests/types/notifications'

@Component({
	selector: 'app-machine-history-item',
	standalone: true,
	imports: [CommonModule, IonicModule, BaseHistoryItemComponent],
	templateUrl: './machine-history-item.component.html',
	styleUrl: './machine-history-item.component.scss',
})
export class MachineHistoryItemComponent {
	@Input() data: NotificationMachinesTableRow
	@Input() first: boolean
	@Input() last: boolean

	title: string
	extra: number
	preExtra: string

	ngOnChanges() {
		this.title = formatMachineHistoryType(this.data.event_type)
		this.extra = this.getExtra()
		this.preExtra = this.getPreExtra()
	}

	private getExtra() {
		return this.data.threshold
	}

	private getPreExtra() {
		switch (this.data.event_type) {
			case 'offline':
				return ''
			case 'storage':
				return 'Usage above'
			case 'cpu':
				return 'Usage above'
			case 'memory':
				return 'Usage above'
			default:
				return 'Unknown'
		}
	}
}

export function formatMachineHistoryType(eventType: string): string {
	switch (eventType) {
		case 'offline':
			return 'Machine Offline'
		case 'storage':
			return 'Storage Warning'
		case 'cpu':
			return 'CPU Warning'
		case 'memory':
			return 'Memory Warning'
		default:
			return null
	}

	return null
}
