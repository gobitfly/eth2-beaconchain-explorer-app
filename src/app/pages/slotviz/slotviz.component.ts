import { CommonModule } from '@angular/common'
import { Component, signal, WritableSignal } from '@angular/core'
import { FullPageLoadingComponent } from '@components/full-page-loading/full-page-loading.component'
import { FullPageOfflineComponent } from '@components/full-page-offline/full-page-offline.component'
import { FilterType, SlotVizProvider } from '@controllers/SlotVizController'
import { IonicModule, ModalController } from '@ionic/angular'

import { fromEvent, Subscription } from 'rxjs'
import { SlotGridComponent } from '../../components/slotgrid/slotgrid.component'
import { SlotvizLegendComponent } from '@pages/slotviz-legend/slotviz-legend.component'
import { PipesModule } from '@pipes/pipes.module'
import { StorageService } from '@services/storage.service'

@Component({
	selector: 'app-slotviz',
	imports: [CommonModule, IonicModule, FullPageLoadingComponent, FullPageOfflineComponent, SlotGridComponent, PipesModule],
	templateUrl: './slotviz.component.html',
	styleUrl: './slotviz.component.scss',
})
export class SlotvizComponent {
	initialLoading: boolean = true
	online: boolean = true
	fadeInCompleted: boolean = false

	private backbuttonSubscription: Subscription

	filterMap: WritableSignal<Map<FilterType, boolean>> = signal(new Map<FilterType, boolean>())

	constructor(
		public slotViz: SlotVizProvider,
		private modalCtrl: ModalController,
		private storage: StorageService
	) {}

	update() {
		this.initialLoading = false
	}

	ngOnInit() {
		this.storage.getObject('slotviz_filters').then((filters) => {
			if (filters) {
				this.filterMap.update(() => filters as Map<FilterType, boolean>)
			}
		})
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

	async openLegend() {
		const modal = await this.modalCtrl.create({
			component: SlotvizLegendComponent,
		})
		return await modal.present()
	}

	filter(filter: FilterType) {
		this.filterMap.update((map) => {
			return map.set(filter, !map.get(filter))
		})
		this.storage.setObject('slotviz_filters', this.filterMap())
	}

	isFiltered(filter: FilterType) {
		return this.filterMap().get(filter)
	}
}
