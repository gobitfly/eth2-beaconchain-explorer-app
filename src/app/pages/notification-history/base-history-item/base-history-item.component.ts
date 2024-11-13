import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { IonicModule } from '@ionic/angular'
import { HistoryDataTypes } from '../validator-history-item/validator-history-item.component'
import { epochToTimestamp, formatMonthShort, getLocale } from 'src/app/utils/TimeUtils'

@Component({
	selector: 'app-base-history-item',
	standalone: true,
	imports: [CommonModule, IonicModule],
	templateUrl: './base-history-item.component.html',
	styleUrl: './base-history-item.component.scss',
})
export class BaseHistoryItemComponent {
	@Input() data: HistoryDataTypes
	@Input() first: boolean
	@Input() last: boolean
	@Input() title: string

	ts: number
	day: number
	month: string
	time: string

	ngOnChanges() {
		this.ts = getTs(this.data)
		this.day = getDay(this.data)
		this.month = getMonth(this.data)
		this.time = getTime(this.data)
	}
}

export function getTs(data: HistoryDataTypes): number {
	if (!data) return 0
	if ('dashboard_id' in data) {
		// todo can be cleaned up once api returns timestamp for dashboard as well
		return epochToTimestamp(data.chain_id, data.epoch)
	} else {
		return data.timestamp * 1000
	}
}

export function getDay(data: HistoryDataTypes): number {
	return new Date(getTs(data)).getDate()
}

function getMonth(data: HistoryDataTypes): string {
	return formatMonthShort(new Date(getTs(data)).getMonth())
}

function getTime(data: HistoryDataTypes): string {
	return new Date(getTs(data)).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })
}
