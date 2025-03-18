import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { IonicModule } from '@ionic/angular'
import { TooltipModule } from 'ng2-tooltip-directive-major-angular-updates'

@Component({
	selector: 'app-grid-cell-right',
	imports: [IonicModule, TooltipModule, CommonModule],
	templateUrl: './grid-cell-right.component.html',
	styleUrl: '../grid-cell-left/grid-cell-left.component.scss',
})
export class GridCellRightComponent {
	@Input() name: string = ''
	@Input() tooltipText: string | null = null

	@Output() valueClick = new EventEmitter<void>()

	onClick($event: { stopPropagation: () => void }) {
		$event.stopPropagation()
		this.valueClick.emit()
	}
}
