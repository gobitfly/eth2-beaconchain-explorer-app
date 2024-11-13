import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { Browser } from '@capacitor/browser'
import { IonicModule } from '@ionic/angular'
import * as blockies from 'ethereum-blockies'

@Component({
	selector: 'app-notification-item',
	standalone: true,
	imports: [IonicModule, CommonModule],
	templateUrl: './notification-item.component.html',
	styleUrl: './notification-item.component.scss',
})
export class NotificationValidator {
	@Input() title: number | string
	@Input() extra: string // optional
	@Input() extraName: string
	@Input() imgSeed: string
	@Input() titlePrefix: string
	@Input() first: boolean
	@Input() last: boolean
	@Input() externalLink?: string

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

	openExternalLink() {
		Browser.open({ url: this.externalLink, toolbarColor: '#2f2e42' })
	}
}
