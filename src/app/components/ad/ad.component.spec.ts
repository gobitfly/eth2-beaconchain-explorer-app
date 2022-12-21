import { async, ComponentFixture, TestBed } from '@angular/core/testing'
import { IonicModule } from '@ionic/angular'

import { AdComponent } from './ad.component'

describe('TextAdComponent', () => {
	let component: AdComponent
	let fixture: ComponentFixture<AdComponent>

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [AdComponent],
			imports: [IonicModule.forRoot()],
		}).compileComponents()

		fixture = TestBed.createComponent(AdComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	}))

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
