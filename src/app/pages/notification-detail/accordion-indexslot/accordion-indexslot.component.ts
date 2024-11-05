import { Component, Input } from '@angular/core'
import { NotificationValidator } from '../validator/validator.component'
import { Address, IndexBlocks, IndexEpoch, IndexSlots } from 'src/app/requests/types/common'
import { IonicModule } from '@ionic/angular'
import { CommonModule } from '@angular/common'
import { NotificationEventValidatorBackOnline, NotificationEventWithdrawal } from 'src/app/requests/types/notifications'
import { MoreComponent } from '../more/more.component'
import { ModalController } from '@ionic/angular'
import BigNumber from 'bignumber.js'

export type DataTypes = IndexEpoch | IndexSlots | IndexBlocks | NotificationEventValidatorBackOnline | NotificationEventWithdrawal | Address | number

const CAP = 7 // Millers Law

@Component({
	selector: 'app-accordion-indexslot',
	standalone: true,
	imports: [IonicModule, CommonModule, NotificationValidator],
	templateUrl: './accordion-indexslot.component.html',
	styleUrl: './accordion-indexslot.component.scss',
})
export class AccordionIndexslotComponent {
	@Input() name: string
	@Input() data: DataTypes[]
	@Input() extraName: string
	@Input() key: string
	@Input() icon: string

	CAP_MAX_SHOW = 3 // could be variable in the future, like if it's just one category show more. But 3 is fine for now

	constructor(private modalCtrl: ModalController) {}

	isDataCapped = () => {
		return this.data.length > CAP
	}

	dataCapped = () => {
		if (this.isDataCapped()) return this.data.slice(0, this.CAP_MAX_SHOW)
		return this.data
	}

	async showAll() {
		const modal = await this.modalCtrl.create({
			component: MoreComponent,
			componentProps: {
				title: this.name,
				data: this.data,
				extraName: this.extraName,
			},
		})
		modal.present()

		await modal.onWillDismiss()
	}

	getTitlePrefix = getTitlePrefix
	getImageSeed = getImageSeed
	getTitle = getTitle
	getExtra = getExtra
}

export function getTitlePrefix(data: DataTypes) {
	if (typeof data === 'number' || 'index' in data) {
		return 'Validator'
	} else if ('hash' in data) {
		return ''
	}
	return '?'
}

export function getImageSeed(data: DataTypes) {
	if (typeof data === 'number') {
		return data + ''
	} else if ('index' in data) {
		return data.index + ''
	} else if ('hash' in data) {
		return data.hash
	}
}

export function getTitle(data: DataTypes, searchString: string = null) {
	let result = ''
	if (typeof data === 'number') {
		result = data + ''
	} else if ('index' in data) {
		result = data.index + ''
	} else if ('hash' in data) {
		result = data.hash.substring(0, 8) + '...' + data.hash.substring(data.hash.length - 8)
	}

	return highlightSearchPart(result, searchString)
}

export function getExtra(data: DataTypes, searchString: string = null) {
	let result = ''
	if (typeof data === 'number') {
		result = ''
	} else if ('epoch' in data) {
		result = data.epoch + ''
	} else if ('slots' in data) {
		result = data.slots + ''
	} else if ('blocks' in data) {
		result = data.blocks + ''
	} else if ('epoch_count' in data) {
		result = data.epoch_count + ''
	} else if ('amount' in data) {
		result = new BigNumber(data.amount).dividedBy(1e18).decimalPlaces(5) + ' ETH' // todo gnosis
	}

	return highlightSearchPart(result, searchString)
}

function highlightSearchPart(text: string, searchString: string) {
	// highlight searchString in text with <mark> tags
	if (!searchString) return text
	const index = text.toLowerCase().indexOf(searchString.toLowerCase())
	if (index === -1) return text
	const before = text.substring(0, index)
	const after = text.substring(index + searchString.length)
	return before + '<mark>' + text.substring(index, index + searchString.length) + '</mark>' + after
}
