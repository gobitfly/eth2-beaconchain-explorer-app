import { ComponentFixture, TestBed } from '@angular/core/testing'

import { BaseHistoryItemComponent } from './base-history-item.component'

describe('BaseHistoryItemComponent', () => {
	let component: BaseHistoryItemComponent
	let fixture: ComponentFixture<BaseHistoryItemComponent>

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [BaseHistoryItemComponent],
		}).compileComponents()

		fixture = TestBed.createComponent(BaseHistoryItemComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	})

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
