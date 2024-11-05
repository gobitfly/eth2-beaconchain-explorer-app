import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { IonicModule } from '@ionic/angular'
import * as blockies from 'ethereum-blockies'

@Component({
	selector: 'app-notification-validator',
	standalone: true,
	imports: [IonicModule, CommonModule],
	templateUrl: './validator.component.html',
	styleUrl: './validator.component.scss',
})
export class NotificationValidator {
	@Input() title: number | string
	@Input() extra: string // optional
	@Input() extraName: string
	@Input() imgSeed: string
	@Input() titlePrefix: string
	@Input() first: boolean
	@Input() last: boolean

	imgData: string

	constructor() {}

	ngOnChanges() {
		this.imgData = this.getBlockies()
	}

	private getBlockies() {
		// TODO: figure out why the first blockie image is always black
		blockies.create({ seed: this.imgSeed + '' }).toDataURL()
		const dataurl = blockies.create({ seed: this.imgSeed + '', size: 8, scale: 7 }).toDataURL()
		return dataurl
	}
}
