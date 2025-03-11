import { CommonModule } from '@angular/common'
import { OnInit, HostListener, WritableSignal, computed, Signal, signal } from '@angular/core'
import { Browser } from '@capacitor/browser'
import { FilterType, SlotVizProvider } from '@controllers/SlotVizController'
import { IonicModule } from '@ionic/angular'
import { VDBSlotVizSlot } from '@requests/types/slot_viz'
import { ApiService } from '@services/api.service'
import { Component, Input } from '@angular/core'
import { PopoverController } from '@ionic/angular'
import { SlotDetailPopoverComponent } from './details/details.component'
import { animate, state, style, transition, trigger } from '@angular/animations'
import { interval, startWith } from 'rxjs'

/*
To to:
-) border color transition, background color transition and icon color transition not working
*/

interface SlotModel {
	smallIcon: string
	bigIcon: string
	squareCss: string[]
	color: string
}
@Component({
	selector: 'app-slotgrid',
	imports: [CommonModule, IonicModule],
	templateUrl: './slotgrid.component.html',
	styleUrls: ['./slotgrid.component.scss'],
	animations: [
		trigger('blink', [
		  state('off', style({ opacity: 0.8 })),
		  state('on', style({ opacity: 0.4 })),
		  // Transition for one half of the blink cycle; adjust duration as needed
		  transition('off <=> on', animate('600ms ease-in-out')),
		]),
		trigger('bgColorAnim', [
			state('default', style({ backgroundColor: 'var(--ion-card-background)', color: '#000' })),
			state('warning', style({ backgroundColor: 'var(--ion-color-warning)', color: '#000' })),
			state('danger', style({ backgroundColor: 'var(--ion-color-danger)', color: '#000' })),
			state('success', style({ backgroundColor: 'var(--ion-color-success)', color: '#000' })),
			// Animate any state change with a uniform timing
			transition('* <=> *', animate('400ms ease-in-out'))
		  ])
	  ]
})
export class SlotGridComponent implements OnInit {
	@Input() slots: Signal<Array<VDBSlotVizSlot>> = signal([])
	@Input() epoch = 0
	@Input() rowsToShow: number = 4
	@Input() margin: number = 5

	@Input() filterMap!: WritableSignal<Map<FilterType, boolean>>

	epochDescriptive: Signal<string> = computed(() => this.calculateDescriptiveEpoch())

	rows: VDBSlotVizSlot[][] = []
	squareSize: number = 50 // Dynamically calculated
	edgePadding: number = 0

	blinkState: 'on' | 'off' = 'off';

	lastAnimated: number = 0
	static nextLastAnimated : number = 0

	slotMap: Signal<Map<number, SlotModel>> = computed(() => {
		const filters = this.filterMap()
		this.lastAnimated = SlotGridComponent.nextLastAnimated
		const newMap = new Map<number, SlotModel>()
		this.slots().forEach((slot) => {
			// Pass the captured filters to your helper functions
			const model: SlotModel = {
				smallIcon: this.getIconSmall(slot, filters),
				bigIcon: this.getIconBig(slot, filters),
				squareCss: this.getSquareCss(slot, filters),
				color: this.getIconColor(slot, filters),
			}
			
			if (slot.slot > this.lastAnimated && model.color !== '') {
				SlotGridComponent.nextLastAnimated = slot.slot
			}
			newMap.set(slot.slot, model)
		})
		return newMap
	})



	private readonly slotsPerRow: number = 8 // Fixed number of slots per row

	constructor(
		public slotViz: SlotVizProvider,
		private api: ApiService,
		private popoverCtrl: PopoverController,
	) {}

	ngOnInit() {
		this.calculateGrid()
		this.calculateSquareSize()
		interval(600)
      .pipe(startWith(0))
      .subscribe(() => {
        this.blinkState = this.blinkState === 'off' ? 'on' : 'off';
      });
	}

	private calculateDescriptiveEpoch() {
		const currentEpoch = this.slotViz.currentEpoch()
		if (this.epoch == currentEpoch) {
			return 'Current Epoch'
		} else if (this.epoch > currentEpoch) {
			return 'Upcoming Epoch'
		} else if (this.epoch < currentEpoch) {
			return 'Previous Epoch'
		}
	}

	@HostListener('window:resize', ['$event'])
	onResize() {
		this.calculateSquareSize()
	}

	trackBySlot(_: number, slot: VDBSlotVizSlot): number {
		return slot.slot
	}

	private calculateGrid() {
		// Break slots into chunks for rows
		const chunkSize = this.slotsPerRow
		this.rows = []
		for (let i = 0; i < this.rowsToShow; i++) {
			const start = i * chunkSize
			const row = this.slots().slice(start, start + chunkSize)
			this.rows.unshift(row)
		}
	}

	private calculateSquareSize() {
		const rootStyles = getComputedStyle(document.documentElement)
		const edgePadding = parseInt(rootStyles.getPropertyValue('--edge-padding').split(' ')[1]) || 0
		this.edgePadding = edgePadding
		const availableWidth = window.innerWidth - 2 * edgePadding
		const totalMargin = (this.slotsPerRow - 1) * this.margin
		const totalBorder = this.slotsPerRow * 2 // 2px per square
		this.squareSize = Math.floor((availableWidth - totalMargin - totalBorder) / this.slotsPerRow)
	}

	// Called when a square is clicked; stops propagation so the document listener doesn't immediately clear it.
	async onSquareClick(slot: VDBSlotVizSlot, event: MouseEvent) {
		event.stopPropagation()
		// Create a snapshot of the slot so that future updates don’t affect it.
		const slotSnapshot = JSON.parse(JSON.stringify(slot))
		const popover = await this.popoverCtrl.create({
			component: SlotDetailPopoverComponent,
			componentProps: { slot: slotSnapshot },
			event: event,
			translucent: true,
			backdropDismiss: true,
		})
		await popover.present()
	}

	getIconBig(slot: VDBSlotVizSlot, filters: Map<FilterType, boolean>): string {
		let icon = ''
		if (slot.slashing && !filters.get('slash')) {
			icon = 'person-remove-outline'
		} else if (slot.proposal && !filters.get('block')) {
			icon = 'cube-outline'
		} else if (slot.attestations && !filters.get('attestation')) {
			icon = 'document-text-outline'
		} else if (slot.sync && !filters.get('sync')) {
			icon = 'sync-outline'
		}
		return icon || 'nothing'
	}

	getCandidateIcons(slot: VDBSlotVizSlot, filters: Map<FilterType, boolean>): string[] {
		const big = this.getIconBig(slot, filters)
		const candidates: string[] = []
		if (slot.slashing && big !== 'person-remove-outline' && !filters.get('slash')) {
			candidates.push('person-remove-outline')
		}
		if (slot.proposal && big !== 'cube-outline' && !filters.get('block')) {
			candidates.push('cube-outline')
		}
		if (slot.sync && big !== 'sync-outline' && !filters.get('sync')) {
			candidates.push('sync-outline')
		}
		if (slot.attestations && big !== 'document-text-outline' && !filters.get('attestation')) {
			candidates.push('document-text-outline')
		}
		return candidates
	}

	getIconSmall(slot: VDBSlotVizSlot, filters: Map<FilterType, boolean>): string {
		const candidates = this.getCandidateIcons(slot, filters)
		if (candidates.length > 1) {
			return 'add-outline'
		}
		return candidates[0] || 'nothing'
	}

	getSquareCss(slot: VDBSlotVizSlot, filters: Map<FilterType, boolean>): string[] {
		const css = ['square']
		if (slot.status === 'proposed') {
			css.push('network-proposed')
		} else if (slot.status === 'missed') {
			css.push('network-missed')
		} else {
			css.push('network-scheduled')
		}

		// console.log("slot.slot: "+slot.slot+" | last animated slot", this.lastAnimated)
		if(slot.slot <= this.lastAnimated){
			css.push(this.getIconColor(slot, filters))
		}
		
		return css
	}

	// Returns the color for attestation-related state

	// Main method that combines the results from each duty.
	// It returns 'danger' if every applicable duty returns danger,
	// 'success' if every applicable duty returns success,
	// and 'warning' in all other cases.
	getIconColor(slot: VDBSlotVizSlot, _: Map<FilterType, boolean>): string {
		const colors: string[] = [getAttestationColor(slot), getProposalColor(slot), getSyncColor(slot), getSlashingColor(slot)].filter(
			(color) => color !== ''
		)
		if (colors.length === 0) {
			return ''
		}
		if (colors.every((color) => color === 'danger')) {
			return 'danger'
		}
		if (colors.every((color) => color === 'success')) {
			return 'success'
		}
		return 'warning'
	}

	statusIcon(ok: string, fail: string, scheduled: string, orphaned: string, slot: VDBSlotVizSlot): string {
		switch (slot.status) {
			case 'proposed':
				return ok
			case 'missed':
				return fail
			case 'scheduled':
				return scheduled
			case 'orphaned':
				return orphaned
			default:
				return 'help-circle'
		}
	}

	openEpochInWeb() {
		Browser.open({ url: this.api.getBaseUrl() + `/epoch/${this.epoch}` })
	}
}

export function getAttestationColor(slot: VDBSlotVizSlot): string {
	if (slot.attestations) {
		if (
			slot.attestations.failed &&
			slot.attestations.success &&
			slot.attestations.failed.total_count > 0 &&
			slot.attestations.success.total_count > 0
		) {
			return 'warning'
		}
		if (slot.attestations.failed && slot.attestations.failed.total_count > 0) {
			return 'danger'
		}
		if (slot.attestations.success && slot.attestations.success.total_count > 0) {
			return 'success'
		}
	}
	return ''
}

// Returns the color for proposal-related state
export function getProposalColor(slot: VDBSlotVizSlot): string {
	if (slot.proposal) {
		if (slot.status === 'missed' || slot.status === 'orphaned') {
			return 'danger'
		}
		if (slot.status === 'proposed') {
			return 'success'
		}
	}
	return ''
}

// Returns the color for sync-related state
export function getSyncColor(slot: VDBSlotVizSlot): string {
	if (slot.sync) {
		if (slot.sync.failed && slot.sync.failed.total_count > 0 && slot.sync?.success && slot.sync.success.total_count > 0) {
			return 'warning'
		}
		if (slot.sync.failed && slot.sync.failed.total_count > 0) {
			return 'danger'
		}
		if (slot.sync?.success && slot.sync.success.total_count > 0) {
			return 'success'
		}
	}
	return ''
}

// Returns the color for slashing-related state
export function getSlashingColor(slot: VDBSlotVizSlot): string {
	if (slot.slashing) {
		if (slot.slashing.success && slot.slashing.success.total_count > 0) {
			return 'success'
		}
		if (slot.slashing.failed && slot.slashing.failed.total_count > 0) {
			return 'danger'
		}
	}
	return ''
}
