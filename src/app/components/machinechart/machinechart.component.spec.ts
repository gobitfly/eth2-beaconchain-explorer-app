import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing'
import { IonicModule } from '@ionic/angular'

import { MachinechartComponent } from './machinechart.component'

describe('MachinechartComponent', () => {
	let component: MachinechartComponent
	let fixture: ComponentFixture<MachinechartComponent>

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [MachinechartComponent],
			imports: [IonicModule.forRoot()],
		}).compileComponents()

		fixture = TestBed.createComponent(MachinechartComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	}))

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
