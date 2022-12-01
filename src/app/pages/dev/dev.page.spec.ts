import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { DevPage } from './dev.page';

describe('DevPage', () => {
  let component: DevPage;
  let fixture: ComponentFixture<DevPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DevPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(DevPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
