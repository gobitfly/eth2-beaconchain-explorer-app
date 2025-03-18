import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core'
import { GestureController, Gesture, GestureDetail } from '@ionic/angular'

@Directive({
	// Using the attribute name "press" so you can declare (press)="doAction()"
	selector: '[press]',
	standalone: true,
})
export class PressDirective implements OnInit, OnDestroy {
	/**
	 * Output event that fires when a long press is detected.
	 * You can bind to it as (press)="doAction()".
	 */
	@Output() press = new EventEmitter<GestureDetail>()

	/**
	 * How long (in ms) the user must press before it’s considered a long press.
	 * Default is 500ms.
	 */
	@Input() pressDuration = 300

	private gesture: Gesture
	private pressTimeout: any

	constructor(
		private elementRef: ElementRef,
		private gestureCtrl: GestureController
	) {}

	ngOnInit(): void {
		this.gesture = this.gestureCtrl.create({
			el: this.elementRef.nativeElement,
			gestureName: 'long-press',
			threshold: 0,
			onStart: (ev: GestureDetail) => this.startPressTimer(ev),
			// Cancel the timer on end or if the pointer moves out
			onEnd: () => this.cancelPressTimer(),
			onMove: () => this.cancelPressTimer(),
		})
		this.gesture.enable(true)
	}

	private startPressTimer(ev: GestureDetail): void {
		this.cancelPressTimer() // Ensure no previous timer is running
		this.pressTimeout = setTimeout(() => {
			// When the timer fires, emit the event
			this.press.emit(ev)
		}, this.pressDuration)
	}

	private cancelPressTimer(): void {
		if (this.pressTimeout) {
			clearTimeout(this.pressTimeout)
			this.pressTimeout = null
		}
	}

	ngOnDestroy(): void {
		if (this.gesture) {
			this.gesture.destroy()
		}
	}
}
