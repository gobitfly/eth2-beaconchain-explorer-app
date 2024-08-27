import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { IonicModule } from '@ionic/angular'
import { TooltipModule } from 'ng2-tooltip-directive-major-angular-updates'

@Component({
	selector: 'app-grid-cell-right',
	standalone: true,
	imports: [IonicModule, TooltipModule, CommonModule],
	templateUrl: './grid-cell-right.component.html',
	styleUrl: '../grid-cell-left/grid-cell-left.component.scss',
})
export class GridCellRightComponent {
	@Input() name: string = ''
	@Input() tooltip: string | null = null

	@Output() valueClick = new EventEmitter<void>()
}
