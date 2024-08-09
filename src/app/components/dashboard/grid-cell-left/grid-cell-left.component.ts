import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { TooltipModule } from 'ng2-tooltip-directive-major-angular-updates';

@Component({
	selector: 'app-grid-cell-left',
	standalone: true,
	imports: [IonicModule, TooltipModule, CommonModule],
	templateUrl: './grid-cell-left.component.html',
	styleUrl: './grid-cell-left.component.scss',
})
export class GridCellLeftComponent {
	@Input() name: string = ''
	@Input() tooltip: string | null = null

	@Output() valueClick = new EventEmitter<void>()
}