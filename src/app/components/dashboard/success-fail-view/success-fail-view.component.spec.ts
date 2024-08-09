import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuccessFailViewComponent } from './success-fail-view.component';

describe('SuccessFailViewComponent', () => {
  let component: SuccessFailViewComponent;
  let fixture: ComponentFixture<SuccessFailViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuccessFailViewComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SuccessFailViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
