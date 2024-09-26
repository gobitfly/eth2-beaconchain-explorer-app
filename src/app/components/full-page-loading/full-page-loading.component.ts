import { animate, state, style, transition, trigger } from '@angular/animations'
import { CommonModule } from '@angular/common'
import { Component, Input, ChangeDetectorRef, OnChanges, Output, EventEmitter } from '@angular/core'
import { IonLabel, IonSpinner } from '@ionic/angular/standalone'

const SKIP_LOADING_IF_FASTER_THAN = 30 //ms

@Component({
	selector: 'app-full-page-loading',
	standalone: true,
	imports: [IonLabel, IonSpinner, CommonModule],
	templateUrl: './full-page-loading.component.html',
	styleUrls: ['./full-page-loading.component.scss'],
	animations: [
		trigger('fadeIn', [
			state('wait', style({ opacity: 0 })),
			state('fading', style({ opacity: 1 })),
			state('done', style({ opacity: 1 })),
			transition('wait => fading', animate('250ms ease-in')),
		]),
		trigger('out', [transition(':leave', [style({ opacity: 1 }), animate('0.2s ease-in', style({ opacity: 0 }))])]),
	],
})
export class FullPageLoadingComponent implements OnChanges {
	@Input() fixInfiniteScroll: boolean = false
	@Input() loading: boolean // the real loading state
	showLoading = false // the fake loading state, is only shown if loading is still true after SKIP_LOADING_IF_FASTER_THAN

	// Wait ms before triggering fade in, this is so view can pre render in opacity state preventing flicker
	// some big components like dashboard need more time to render, consider increasing this value on a per component basis
	@Input() renderWait: number = 40

	@Output() fadeInCompleted = new EventEmitter<void>()

	showContent = false
	fadeInComplete: 'wait' | 'done' | 'fading' = 'wait'

	private startRenderTime: number

	constructor(private cdr: ChangeDetectorRef) {}

	ngOnChanges() {
		if (this.loading) {
			this.reset()

			/*
			 * We do not immediately show loader but only if after SKIP_LOADING_IF_FASTER_THAN millisecons loading is still true
			 * The idea is to not show the loading screen if it loads faster than 50ms, for example requests are cached
			 */
			setTimeout(() => {
				if (this.loading) {
					// still loading, show loader
					this.showLoading = true
					this.cdr.detectChanges()
				} else {
					this.loadingDoneStartPreRender()
					this.onLoadingAnimationDone() // just skip to done if all is available from cache, no animation
				}
			}, SKIP_LOADING_IF_FASTER_THAN)
		} else {
			this.loadingDoneStartPreRender()
		}
	}

	loadingDoneStartPreRender() {
		this.showLoading = false

		// start rendering content (while hidden)
		this.showContent = true
		this.startRenderTime = Date.now()
	}

	/**
	 * Reset the component to initial state, useful for pull to refresh
	 */
	reset() {
		this.showContent = false
		this.fadeInComplete = 'wait'
		this.showLoading = false
	}

	// Called after showLoading animation is faded out, we may display the content now after waiting the render wait
	onLoadingAnimationDone() {
		if (!this.loading) {
			// If the time it took to render up to now is bigger than renderWait, display immediately else wait the difference
			const diff = Date.now() - this.startRenderTime

			this.mayRenderWait(() => {
				this.fadeInComplete = 'done'
				this.fadeInCompleted.emit()
				this.cdr.detectChanges()
			}, diff)
		}
	}

	/**
	 *
	 * @param callback Execute immediately or wait for render depending on when render started
	 * and if it is past the renderWait time
	 * @param diff Difference between now and the start of the render
	 */
	mayRenderWait(callback: () => void, diff: number) {
		if (diff > SKIP_LOADING_IF_FASTER_THAN) {
			callback()
		} else {
			// wait for view to render before fading in
			setTimeout(() => {
				callback()
			}, this.renderWait - diff)
		}
	}
}
