import { CommonModule } from '@angular/common'
import { Component, Input, OnInit, HostListener } from '@angular/core'
import { SlotVizProvider } from '@controllers/SlotVizController'
import { IonicModule } from '@ionic/angular'
import { VDBSlotVizSlot } from '@requests/types/slot_viz'

/*
To to:
-) add link to legend
-) use "+" symbol if more than 2 duties per slot
-) add details on slot click (show countdown to that selected slot too)
-) add header showing next duty
-) instead of displaying epoch numbers, display "current epoch", "next epoch" etc (maybe with a link to the epoch page)
-) add filter like on web (disable/enable sync duties etc - next duty ts should adjust too)
-) sync up blinking of scheduled duties (still not working even with global animation)
-) border color transition, background color transition and icon color transition not working
*/

@Component({
	selector: 'app-slotgrid',
	standalone: true,
	imports: [CommonModule, IonicModule],
	templateUrl: './slotgrid.component.html',
	styleUrl: './slotgrid.component.scss',
})
export class SlotGridComponent implements OnInit {
	@Input() slots: Array<VDBSlotVizSlot> = []

	@Input() epoch = 0
	@Input() rowsToShow: number = 4
	@Input() margin: number = 5

	rows: VDBSlotVizSlot[][] = []
	squareSize: number = 50 // Dynamically calculated

	private readonly slotsPerRow: number = 8 // Fixed number of slots per row

	constructor(public slotViz: SlotVizProvider) {}

	ngOnInit() {
		this.calculateGrid()
		this.calculateSquareSize()
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
		// Calculate available width
		const availableWidth = window.innerWidth
		const totalMargin = (this.slotsPerRow - 1) * this.margin
		const totalBorder = this.slotsPerRow * 2 // 2px per square
		this.squareSize = Math.floor((availableWidth - totalMargin - totalBorder) / this.slotsPerRow)
	}

	getIconSmall(slot: VDBSlotVizSlot): string {
		const big = this.getIconBig(slot)
		if (slot.proposal && big != 'cube-outline') {
			return 'cube-outline'
		} else if (slot.sync && big != 'sync-outline') {
			return 'sync-outline'
		} else if (slot.attestations && big != 'document-text-outline') {
			return 'document-text-outline'
		}
		return ''
	}

	getIconBig(slot: VDBSlotVizSlot): string {
		if (slot.proposal) {
			return 'cube-outline'
		} else if (slot.attestations) {
			return 'document-text-outline'
		} else if (slot.sync) {
			return 'sync-outline'
		}
		return ''
	}

	getIconColor(prev: VDBSlotVizSlot): string {
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
}
