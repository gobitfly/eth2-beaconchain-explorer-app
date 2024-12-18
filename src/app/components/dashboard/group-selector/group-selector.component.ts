import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { GroupEntries } from '@utils/DashboardUtils';

@Component({
	selector: 'app-group-selector',
	standalone: true,
	imports: [CommonModule, IonicModule],
	templateUrl: './group-selector.component.html',
	styleUrl: './group-selector.component.scss',
})
export class GroupSelectorComponent {
	@Input() preSelectGroupID: number
	@Input() groups: GroupEntries[]

	@Output() groupChanged = new EventEmitter<number>()

	selectGroup(event: CustomEvent<{ value: number }>): void {
		const selectedGroupID = event.detail.value 
		this.groupChanged.emit(selectedGroupID)
	}
}
