import { CommonModule } from '@angular/common'
import { ChangeDetectorRef, Component, computed, effect, Input, signal, WritableSignal } from '@angular/core'
import { SlotVizProvider } from '@controllers/SlotVizController'
import { IonicModule, ModalController } from '@ionic/angular'
import { PipesModule } from '@pipes/pipes.module'
import { trigger, state, style, transition, animate } from '@angular/animations'
import { dashboardID } from '@requests/v2-dashboard'
import { SlotvizComponent } from '@pages/slotviz/slotviz.component'

@Component({
	selector: 'app-slotviz-widget',
	standalone: true,
	imports: [CommonModule, IonicModule, PipesModule],
	templateUrl: './slotviz-widget.component.html',
	styleUrls: ['./slotviz-widget.component.scss'],
	animations: [
		trigger('iconAnimation', [
			state(
				'initial',
				style({
					transform: 'translateX(0)',
					fontSize: '1.5em',
					opacity: 0,
				})
			),
			state(
				'moved',
				style({
					transform: 'translateX(-25px)',
					fontSize: '1em',
					opacity: 0.7,
				})
			),
			transition('initial => moved', [style({ opacity: 1 }), animate('0.3s ease')]),
		]),
		trigger('newIconAnimation', [
			transition(':enter', [style({ opacity: 0, transform: 'scale(0.5)' }), animate('0.2s ease', style({ opacity: 1, transform: 'scale(1)' }))]),
		]),
	],
})
export class SlotvizWidgetComponent {
	@Input() dashboardID: dashboardID
	@Input() groupID: number

	nextIconState: 'initial' | 'moved' = 'initial'
	previousIconHidden = false
	movedIcon: WritableSignal<string> = signal(null)
	isNewIconVisible = false

	constructor(
		public slotViz: SlotVizProvider,
		private cdr: ChangeDetectorRef,
		private modalCtrl: ModalController
	) {
		effect(() => {
			this.slotViz.nextDutyTs()
			this.triggerAnimation()
		})
	}

	ngOnInit() {
		this.slotViz.start(this.dashboardID, this.groupID)
	}

	ngOnChange() {
		this.slotViz.changeDashboard(this.dashboardID)
		this.slotViz.changeGroupID(this.groupID)
	}

	previousIcon = computed(() => {
		const prev = this.slotViz.previousDuty()
		if (prev == null) return 'help-outline'
		if (prev.proposal) return 'cube-outline'
		if (prev.sync) return 'sync-outline'
		if (prev.attestations) return 'document-text-outline'

		return 'help-outline'
	})

	previousIconColor = computed(() => {
		const prev = this.slotViz.previousDuty()
		if (prev == null) return 'unknown'
		if (prev.attestations) {
			if (
				prev.attestations.failed &&
				prev.attestations.success &&
				prev.attestations.failed.total_count > 0 &&
				prev.attestations.success.total_count > 0
			)
				return 'warning'
			if (prev.attestations.failed && prev.attestations.failed.total_count > 0) return 'danger'
			if (prev.attestations.success && prev.attestations.success.total_count > 0) return 'success'
		} else if (prev.proposal) {
			if (prev.status == 'missed' || prev.status == 'orphaned') return 'danger'
		} else if (prev.sync) {
			if (prev.sync.failed && prev.attestations.success && prev.sync.failed.total_count > 0 && prev.attestations.success.total_count > 0)
				return 'warning'
			if (prev.sync.failed && prev.sync.failed.total_count > 0) return 'danger'
			if (prev.attestations.success && prev.sync.success.total_count > 0) return 'success'
		}

		return 'unknown'
	})

	nextIcon = computed(() => {
		const next = this.slotViz.nextDuty()
		if (next == null) return 'help-outline'
		if (next.proposal) return 'cube-outline'
		if (next.sync) return 'sync-outline'
		if (next.attestations) return 'document-text-outline'

		return 'help-outline'
	})

	animationBlocked = false
	triggerAnimation() {
		if (this.animationBlocked) return
		this.animationBlocked = true

		console.log('animation triggered')
		this.nextIconState = 'moved'
		this.previousIconHidden = true
		this.isNewIconVisible = true

		setTimeout(() => {
			this.previousIconHidden = false
			this.isNewIconVisible = false
			this.resetAnimation()
			this.animationBlocked = false
		}, 300)
	}

	resetAnimation() {
		this.nextIconState = 'initial'
	}

	private triggerChangeDetection() {
		this.cdr.detectChanges()
	}

	async openSlotViz() {
		const modal = await this.modalCtrl.create({
			component: SlotvizComponent,
			componentProps: {},
		})
		modal.present()

		await modal.onWillDismiss()
	}
}
