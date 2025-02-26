import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { IonicModule } from '@ionic/angular'
import { PopoverController } from '@ionic/angular'
import { VDBSlotVizSlot } from '@requests/types/slot_viz'
import { getAttestationColor, getProposalColor, getSlashingColor, getSyncColor } from '../slotgrid.component'
import { Browser } from '@capacitor/browser'
import { ApiService } from '@services/api.service'
import { slotToSecondsTimestamp } from '@utils/TimeUtils'
import { PipesModule } from '@pipes/pipes.module'

@Component({
	selector: 'app-slot-detail-popover',
	imports: [CommonModule, IonicModule, PipesModule],
	templateUrl: './details.component.html',
	styleUrl: './details.component.scss',
})
export class SlotDetailPopoverComponent {
	@Input() slot!: VDBSlotVizSlot

	slotTs: number = 0

	constructor(
		private popoverCtrl: PopoverController,
		private api: ApiService
	) {}

	ngOnInit() {
		this.slotTs = slotToSecondsTimestamp(this.api.networkConfig.supportedChainIds, this.slot.slot) * 1000
	}

	dismiss() {
		this.popoverCtrl.dismiss()
	}

	getAttestationColor = getAttestationColor
	getProposalColor = getProposalColor
	getSlashingColor = getSlashingColor
	getSyncColor = getSyncColor

	openSlot() {
		Browser.open({ url: this.api.getBaseUrl() + `/slot/${this.slot.slot}` })
	}
}
