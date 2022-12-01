import { async, ComponentFixture, TestBed } from '@angular/core/testing'
import { IonicModule } from '@ionic/angular'

import { TextAdComponent } from './text-ad.component'

describe('TextAdComponent', () => {
	let component: TextAdComponent
	let fixture: ComponentFixture<TextAdComponent>

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [TextAdComponent],
			imports: [IonicModule.forRoot()],
		}).compileComponents()

		fixture = TestBed.createComponent(TextAdComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	}))

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
