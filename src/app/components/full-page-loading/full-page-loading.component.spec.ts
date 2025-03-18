/// <reference types="vitest" />
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing'
import { FullPageLoadingComponent } from './full-page-loading.component'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'

describe('FullPageLoadingComponent', () => {
	let component: FullPageLoadingComponent
	let fixture: ComponentFixture<FullPageLoadingComponent>

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FullPageLoadingComponent, NoopAnimationsModule],
		}).compileComponents()

		fixture = TestBed.createComponent(FullPageLoadingComponent)
		component = fixture.componentInstance
	})

	it('should not show loading immediately when loading is true and then show it after SKIP_LOADING_IF_FASTER_THAN ms', fakeAsync(() => {
		// Instead of calling fixture.detectChanges(), call ngOnChanges() manually
		component.loading = true
		component.ngOnChanges() // simulate the one-time change

		// Immediately after, reset() was called so showLoading remains false.
		expect(component.showLoading).toBe(false)

		// Advance time past SKIP_LOADING_IF_FASTER_THAN (here using 35ms as a buffer).
		tick(35)
		// The setTimeout callback should now have run and, since loading is still true,
		// set showLoading to true (it also calls cdr.detectChanges(), so we don't trigger extra change detection).
		expect(component.showLoading).toBe(true)
	}))

	it('should skip showing the loading screen if loading becomes false quickly', fakeAsync(() => {
		// Start with loading true and call ngOnChanges once.
		component.loading = true
		component.ngOnChanges()
		tick(20)

		// Now simulate that loading becomes false quickly.
		component.loading = false
		// Call ngOnChanges again to simulate the input change.
		component.ngOnChanges()

		// Advance time to flush the pending timeout.
		tick(31)
		// In the "else" branch of ngOnChanges, loadingDoneStartPreRender() is called,
		// which sets showContent to true and ensures showLoading stays false.
		expect(component.showLoading).toBe(false)
		expect(component.showContent).toBe(true)

		// Because the real animation callbacks aren’t triggered in test mode (using NoopAnimationsModule),
		// manually simulate the animation finish.
		component.onLoadingAnimationDone()
		tick(component.renderWait)
		expect(component.fadeInComplete).toBe('done')
	}))

	it('should emit fadeInCompleted event after loading animation is done', fakeAsync(() => {
		const fadeInSpy = vi.spyOn(component.fadeInCompleted, 'emit')

		// For immediate loading completion, set loading to false and call ngOnChanges.
		component.loading = false
		component.ngOnChanges()

		tick(31)
		// Manually simulate the animation callback.
		component.onLoadingAnimationDone()
		tick(component.renderWait)

		expect(fadeInSpy).toHaveBeenCalled()
	}))

	it('should reset the component state when reset() is called', () => {
		// Set some non-default state.
		component.showContent = true
		component.fadeInComplete = 'done'
		component.showLoading = true

		// Call reset().
		component.reset()

		// Verify that state is reset to its initial values.
		expect(component.showContent).toBe(false)
		expect(component.fadeInComplete).toBe('wait')
		expect(component.showLoading).toBe(false)
	})

	it('onLoadingAnimationStart should mark that loading animation has started', () => {
		component.onLoadingAnimationStart()
		const loadingAnimationStarted = (component as any).loadingAnimationStarted
		expect(loadingAnimationStarted).toBe(true)
	})
})
