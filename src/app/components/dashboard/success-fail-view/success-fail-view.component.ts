import { CommonModule } from '@angular/common'
import { Component, computed, Input, WritableSignal } from '@angular/core'
import { IonLabel, IonItem } from '@ionic/angular/standalone'
import { PipesModule } from 'src/app/pipes/pipes.module'
import { StorageService } from 'src/app/services/storage.service'

@Component({
	selector: 'app-success-fail-view',
	standalone: true,
	imports: [IonItem, IonLabel, CommonModule, PipesModule],
	templateUrl: './success-fail-view.component.html',
	styleUrl: './success-fail-view.component.scss',
})
export class SuccessFailViewComponent {
	@Input() name: string
	@Input() data: SuccessFailData
	@Input() mode: WritableSignal<Mode>

	constructor(private storage: StorageService) {}

	percent = computed(() => {
		const total = this.data.success + this.data.failed
		if (total === 0) return 0
		return (this.data.success / total) * 100
	})

	switchMode() {
		if (this.mode() === 'absolute') {
			this.mode.set('percentage')
		} else {
			this.mode.set('absolute')
		}
		setSuccessFailMode(this.storage, this.mode())
	}
}

export async function getSuccessFailMode(storage: StorageService): Promise<Mode> {
	return (await storage.getBooleanSetting('success_fail_mode_perc', true)) ? 'percentage' : 'absolute'
}

export async function setSuccessFailMode(storage: StorageService, mode: Mode): Promise<void> {
	await storage.setBooleanSetting('success_fail_mode_perc', mode === 'percentage')
}

export interface SuccessFailData {
	success: number
	failed: number
}

export type Mode = 'absolute' | 'percentage'
