import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FullPageLoadingComponent } from '@components/full-page-loading/full-page-loading.component'
import { FullPageOfflineComponent } from '@components/full-page-offline/full-page-offline.component'
import { SlotVizProvider } from '@controllers/SlotVizController'
import { IonicModule, ModalController } from '@ionic/angular'

import { fromEvent, Subscription } from 'rxjs'
import { SlotGridComponent } from '../../components/slotgrid/slotgrid.component'
@Component({
	selector: 'app-slotviz',
	imports: [CommonModule, IonicModule, FullPageLoadingComponent, FullPageOfflineComponent, SlotGridComponent],
	templateUrl: './slotviz.component.html',
	styleUrl: './slotviz.component.scss',
})
export class SlotvizComponent {
	initialLoading: boolean = true
	online: boolean = true
	fadeInCompleted: boolean = false

	private backbuttonSubscription: Subscription

	constructor(
		public slotViz: SlotVizProvider,
		private modalCtrl: ModalController
	) {}

	update() {
		this.initialLoading = false
	}

	ionViewWillEnter() {
		const event = fromEvent(document, 'backbutton')
		this.backbuttonSubscription = event.subscribe(() => {
			this.modalCtrl.dismiss()
		})
		this.update()
	}

	ngOnDestroy() {
		this.backbuttonSubscription.unsubscribe()
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}
}
