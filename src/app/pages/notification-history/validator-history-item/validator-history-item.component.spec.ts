import { ComponentFixture, TestBed } from '@angular/core/testing'

import { NotificationHistoryItemComponent } from './validator-history-item.component'

describe('NotificationHistoryItemComponent', () => {
	let component: NotificationHistoryItemComponent
	let fixture: ComponentFixture<NotificationHistoryItemComponent>

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [NotificationHistoryItemComponent],
		}).compileComponents()

		fixture = TestBed.createComponent(NotificationHistoryItemComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	})

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
