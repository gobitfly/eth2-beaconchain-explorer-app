import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { IonicModule, ModalController } from '@ionic/angular'

@Component({
	selector: 'app-slotviz-legend',
	imports: [CommonModule, IonicModule],
	templateUrl: './slotviz-legend.component.html',
	styleUrl: './slotviz-legend.component.scss',
})
export class SlotvizLegendComponent {
	constructor(private modalCtrl: ModalController) {}

	closeModal() {
		this.modalCtrl.dismiss()
	}
}
