import { CommonModule } from '@angular/common'
import { Component, Input, OnInit, HostListener, WritableSignal, computed, Signal } from '@angular/core'
import { Browser } from '@capacitor/browser'
import { FilterType, SlotVizProvider } from '@controllers/SlotVizController'
import { IonicModule } from '@ionic/angular'
import { VDBSlotVizSlot } from '@requests/types/slot_viz'
import { ApiService } from '@services/api.service'

/*
To to:
-) add header showing next duty
-) add filter like on web (disable/enable sync duties etc - next duty ts should adjust too)

-) add details on slot click (show countdown to that selected slot too)

-) sync up blinking of scheduled duties (still not working even with global animation)
-) border color transition, background color transition and icon color transition not working
*/

@Component({
	selector: 'app-slotgrid',
	imports: [CommonModule, IonicModule],
	templateUrl: './slotgrid.component.html',
	styleUrl: './slotgrid.component.scss',
})
export class SlotGridComponent implements OnInit {
	@Input() slots: Array<VDBSlotVizSlot> = []
	@Input() epoch = 0
	@Input() rowsToShow: number = 4
	@Input() margin: number = 5

	@Input() filterMap!: WritableSignal<Map<FilterType, boolean>>

	epochDescriptive: Signal<string> = computed(() => this.calculateDescriptiveEpoch())

	rows: VDBSlotVizSlot[][] = []
	squareSize: number = 50 // Dynamically calculated
	edgePadding: number = 0

	private readonly slotsPerRow: number = 8 // Fixed number of slots per row

	constructor(
		public slotViz: SlotVizProvider,
		private api: ApiService
	) {}

	ngOnInit() {
		this.calculateGrid()
		this.calculateSquareSize()
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

	private calculateGrid() {
		// Break slots into chunks for rows
		const chunkSize = this.slotsPerRow
		this.rows = []
		for (let i = 0; i < this.rowsToShow; i++) {
			const start = i * chunkSize
			const row = this.slots.slice(start, start + chunkSize)
			this.rows.unshift(row)
		}
	}

	private calculateSquareSize() {
		const rootStyles = getComputedStyle(document.documentElement)
		const edgePadding = parseInt(rootStyles.getPropertyValue('--edge-padding').split(' ')[1]) || 0
		this.edgePadding = edgePadding

		// Calculate available width with minimum edge padding
		const availableWidth = window.innerWidth - 2 * edgePadding
		const totalMargin = (this.slotsPerRow - 1) * this.margin
		const totalBorder = this.slotsPerRow * 2 // 2px per square

		this.squareSize = Math.floor((availableWidth - totalMargin - totalBorder) / this.slotsPerRow)
	}

	getIconBig(slot: VDBSlotVizSlot): string {
		let icon = ''
		if (slot.slashing && !this.filterMap().get('slash')) {
			icon = 'person-remove-outline'
		} else if (slot.proposal && !this.filterMap().get('block')) {
			icon = 'cube-outline'
		} else if (slot.attestations && !this.filterMap().get('attestation')) {
			icon = 'document-text-outline'
		} else if (slot.sync && !this.filterMap().get('sync')) {
			icon = 'sync-outline'
		}
		return icon
	}

	getCandidateIcons(slot: VDBSlotVizSlot): string[] {
		const big = this.getIconBig(slot)
		const candidates: string[] = []

		if (slot.slashing && big !== 'person-remove-outline' && !this.filterMap().get('slash')) {
			candidates.push('person-remove-outline')
		}
		if (slot.proposal && big !== 'cube-outline' && !this.filterMap().get('block')) {
			candidates.push('cube-outline')
		}
		if (slot.sync && big !== 'sync-outline' && !this.filterMap().get('sync')) {
			candidates.push('sync-outline')
		}
		if (slot.attestations && big !== 'document-text-outline' && !this.filterMap().get('attestation')) {
			candidates.push('document-text-outline')
		}

		return candidates
	}

	getIconSmall(slot: VDBSlotVizSlot): string {
		const candidates = this.getCandidateIcons(slot)
		// Maintain current behavior: if more than one candidate, show "add-outline"
		if (candidates.length > 1) {
			return 'add-outline'
		}
		return candidates[0] || ''
	}

	// Returns the color for attestation-related state
	private getAttestationColor(slot: VDBSlotVizSlot): string {
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
	private getProposalColor(slot: VDBSlotVizSlot): string {
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
	private getSyncColor(slot: VDBSlotVizSlot): string {
		if (slot.sync) {
			if (slot.sync.failed && slot.attestations?.success && slot.sync.failed.total_count > 0 && slot.attestations.success.total_count > 0) {
				return 'warning'
			}
			if (slot.sync.failed && slot.sync.failed.total_count > 0) {
				return 'danger'
			}
			if (slot.attestations?.success && slot.sync.success.total_count > 0) {
				return 'success'
			}
		}
		return ''
	}

	// Returns the color for slashing-related state
	private getSlashingColor(slot: VDBSlotVizSlot): string {
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

	// Main method that combines the results from each duty.
	// It returns 'danger' if every applicable duty returns danger,
	// 'green' if every applicable duty returns success,
	// and 'warning' in all other cases.
	getIconColor(slot: VDBSlotVizSlot): string {
		const colors: string[] = [
			this.getAttestationColor(slot),
			this.getProposalColor(slot),
			this.getSyncColor(slot),
			this.getSlashingColor(slot),
		].filter((color) => color !== '')

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

	getSquareCss(slot: VDBSlotVizSlot): string[] {
		const css = ['square']
		if (slot.status == 'proposed') {
			css.push('network-proposed')
		} else if (slot.status == 'missed') {
			css.push('network-missed')
		} else {
			css.push('network-scheduled')
		}
		css.push(this.getIconColor(slot))
		return css
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
		Browser.open({ url: this.api.getBaseUrl() + `epoch/${this.epoch}` })
	}
}
