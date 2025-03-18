import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { IonicModule } from '@ionic/angular'
import { TooltipModule } from 'ng2-tooltip-directive-major-angular-updates'

@Component({
	selector: 'app-grid-cell-left',
	imports: [IonicModule, TooltipModule, CommonModule],
	templateUrl: './grid-cell-left.component.html',
	styleUrl: './grid-cell-left.component.scss',
})
export class GridCellLeftComponent {
	@Input() name: string = ''
	@Input() tooltipText: string | null = null

	@Output() valueClick = new EventEmitter<void>()

	onClick($event: { stopPropagation: () => void }) {
		$event.stopPropagation()
		this.valueClick.emit()
	}
}
