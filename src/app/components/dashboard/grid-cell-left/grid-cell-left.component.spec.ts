import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GridCellLeftComponent } from './grid-cell-left.component';

describe('GridCellLeftComponent', () => {
  let component: GridCellLeftComponent;
  let fixture: ComponentFixture<GridCellLeftComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridCellLeftComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GridCellLeftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
