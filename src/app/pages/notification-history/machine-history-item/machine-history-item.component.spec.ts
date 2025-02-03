import { ComponentFixture, TestBed } from '@angular/core/testing'

import { MachineHistoryItemComponent } from './machine-history-item.component'

describe('MachineHistoryItemComponent', () => {
	let component: MachineHistoryItemComponent
	let fixture: ComponentFixture<MachineHistoryItemComponent>

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [MachineHistoryItemComponent],
		}).compileComponents()

		fixture = TestBed.createComponent(MachineHistoryItemComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	})

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
