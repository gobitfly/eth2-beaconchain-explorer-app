import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { IonIcon } from '@ionic/angular/standalone'

@Component({
	selector: 'app-bool-checked',
	imports: [IonIcon, CommonModule],
	templateUrl: './bool-checked.component.html',
	styleUrl: './bool-checked.component.scss',
})
export class BoolCheckedComponent {
	@Input() value: boolean = false
}
