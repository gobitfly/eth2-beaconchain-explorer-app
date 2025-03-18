import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { IonicModule } from '@ionic/angular'

const MAX_WAIT_BEFORE_RETRY = 90 * 1000 // ms

@Component({
	selector: 'app-full-page-offline',
	imports: [IonicModule, CommonModule],
	standalone: true,
	templateUrl: './full-page-offline.component.html',
	styleUrl: './full-page-offline.component.scss',
})
export class FullPageOfflineComponent {
	@Input() online: boolean
	@Input() fixInfiniteScroll: boolean = false
	@Output() retry = new EventEmitter<void>()

	private lastRetryClick = new Date().getTime()
	private waitBeforeRetry = 500 // ms
	onRetryClick() {
		if (new Date().getTime() - this.lastRetryClick < this.waitBeforeRetry) return
		this.waitBeforeRetry *= 6
		if (this.waitBeforeRetry > MAX_WAIT_BEFORE_RETRY) this.waitBeforeRetry = MAX_WAIT_BEFORE_RETRY
		this.retry.emit()
	}
}
