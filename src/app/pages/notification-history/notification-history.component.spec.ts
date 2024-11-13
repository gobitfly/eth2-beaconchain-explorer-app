import { ComponentFixture, TestBed } from '@angular/core/testing'

import { NoticationHistoryComponent } from './notification-history.component'

describe('NoticationHistoryComponent', () => {
	let component: NoticationHistoryComponent
	let fixture: ComponentFixture<NoticationHistoryComponent>

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [NoticationHistoryComponent],
		}).compileComponents()

		fixture = TestBed.createComponent(NoticationHistoryComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	})

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
