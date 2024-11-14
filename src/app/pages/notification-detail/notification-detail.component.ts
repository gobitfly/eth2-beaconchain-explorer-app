import { Component, computed, effect, Input, Signal, signal, ViewChild, WritableSignal } from '@angular/core'
import { NotificationValidatorDashboardDetail } from 'src/app/requests/types/notifications'
import { V2NotificationDetails } from 'src/app/requests/v2-notifications'
import { ApiService } from 'src/app/services/api.service'

import { IonAccordionGroup, IonicModule, ModalController } from '@ionic/angular'
import { fromEvent, Subscription } from 'rxjs'
import { NotificationValidator } from './notification-item/notification-item.component'
import { FullPageLoadingComponent } from '@components/full-page-loading/full-page-loading.component'
import { FullPageOfflineComponent } from '@components/full-page-offline/full-page-offline.component'
import { CommonModule } from '@angular/common'
import { AccordionIndexslotComponent } from './accordion-indexslot/accordion-indexslot.component'
import { PipesModule } from 'src/app/pipes/pipes.module'
import { epochToTimestamp, shortTimeFormatLocale } from 'src/app/utils/TimeUtils'
import { APIUnauthorizedError } from 'src/app/requests/requests'

@Component({
	selector: 'app-notification-detail',
	standalone: true,
	imports: [
		IonicModule,
		PipesModule,
		NotificationValidator,
		FullPageLoadingComponent,
		FullPageOfflineComponent,
		CommonModule,
		AccordionIndexslotComponent,
	],
	templateUrl: './notification-detail.component.html',
	styleUrl: './notification-detail.component.scss',
})
export class NotificationDetailComponent {
	@ViewChild('accordionGroup', { static: true }) accordionGroup: IonAccordionGroup

	@Input() dashboardID: number
	@Input() groupID: number
	@Input() epoch: number
	@Input() chainID: number = 1 // todo

	currentY: number
	data: WritableSignal<NotificationValidatorDashboardDetail> = signal(null)
	initialLoading: boolean = true
	online: boolean = true
	timestamp = 0
	dateState: 'ts' | 'epoch' = 'ts'
	state = signal<'expanded' | 'collapsed'>('collapsed')
	fadeInCompleted: boolean = false

	private backbuttonSubscription: Subscription

	constructor(
		private api: ApiService,
		private modalCtrl: ModalController
	) {
		effect(() => {
			const openAccordions = this.defaultOpenAccordions()
			if (openAccordions.length > 0) {
				queueMicrotask(() => this.state.set('expanded'))
			} else {
				queueMicrotask(() => this.state.set('collapsed'))
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

	ngAfterViewInit() {
		if (!this.accordionGroup) {
			console.error('accordionGroup is not initialized.')
		}
	}

	defaultOpenAccordions = computed(() => {
		if (this.data() === null) return []

		const wouldOpenCount = Object.keys(this.data()).reduce((count, key) => {
			const value = this.data()[key as keyof NotificationValidatorDashboardDetail]
			if (Array.isArray(value) && value.length > 0) {
				count++
			}
			return count
		}, 0)

		return Object.keys(this.data()).filter((key) => {
			const value = this.data()[key as keyof NotificationValidatorDashboardDetail]
			return Array.isArray(value) && value.length > 0 && wouldOpenCount <= 1
		})
	})

	groupEfficiency: Signal<GroupEfficiency> = computed(() => {
		if (this.data()?.group_efficiency_below) {
			return { efficiency: this.data().group_efficiency_below } as GroupEfficiency
		}
		return null
	})

	async update() {
		const result = await this.api.set(new V2NotificationDetails(this.dashboardID, this.groupID, this.epoch), this.data)
		if (result.error) {
			console.error('Failed to get notification details', result.error)
			if (!(result.error instanceof APIUnauthorizedError)) {
				this.online = false
			}
			this.initialLoading = false
		}
		// this.data().slashed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
		// this.data().validator_offline = Array.from({ length: 100 }, (_, i) => i + 1)
		// this.data().withdrawal = [{ index: 1, amount: '1000', address: { hash: '', is_contract: false } }]
		// this.data().max_collateral_reached = [{ hash: '0x1231231231231231231231231232', is_contract: false }]
		this.initialLoading = false
		this.accordionChange()
		this.timestamp = epochToTimestamp(this.chainID, this.epoch)
	}

	collapse = () => {
		if (this.state() == 'collapsed') {
			this.accordionGroup.value = Object.keys(this.data()).filter((key) => {
				const value = this.data()[key as keyof NotificationValidatorDashboardDetail]
				return Array.isArray(value) && value.length > 0
			})
		} else {
			this.accordionGroup.value = []
		}
		this.accordionChange()
	}

	accordionChange = () => {
		if (!this.accordionGroup || !this.accordionGroup.value) {
			return
		}
		this.state.set(this.accordionGroup.value.length === 0 ? 'collapsed' : 'expanded')
	}

	toggleDateState() {
		this.dateState = this.dateState === 'ts' ? 'epoch' : 'ts'
	}

	ngOnDestroy() {
		this.backbuttonSubscription.unsubscribe()
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}

	onScroll($event: { detail: { currentY: number } }) {
		this.currentY = $event.detail.currentY
	}

	locale = shortTimeFormatLocale
}

interface GroupEfficiency {
	efficiency: number
}
