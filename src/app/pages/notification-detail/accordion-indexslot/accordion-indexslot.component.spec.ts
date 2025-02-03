import { ComponentFixture, TestBed } from '@angular/core/testing'

import { AccordionIndexslotComponent } from './accordion-indexslot.component'

describe('AccordionIndexslotComponent', () => {
	let component: AccordionIndexslotComponent
	let fixture: ComponentFixture<AccordionIndexslotComponent>

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AccordionIndexslotComponent],
		}).compileComponents()

		fixture = TestBed.createComponent(AccordionIndexslotComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	})

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
