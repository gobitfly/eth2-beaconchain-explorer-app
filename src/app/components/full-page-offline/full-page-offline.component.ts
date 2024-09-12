import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonIcon, IonLabel } from "@ionic/angular/standalone";

const MAX_WAIT_BEFORE_RETRY = 90 * 1000 // ms

@Component({
	selector: 'app-full-page-offline',
	standalone: true,
	imports: [IonLabel, IonIcon, CommonModule],
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
