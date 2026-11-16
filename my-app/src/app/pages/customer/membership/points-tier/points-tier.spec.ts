import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PointsTierPage } from './points-tier';

describe('PointsTierPage', () => {
  let component: PointsTierPage;
  let fixture: ComponentFixture<PointsTierPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, RouterModule.forRoot([])],
      declarations: [PointsTierPage],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(PointsTierPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('calculates tier info and progress accurately', () => {
    component.tierCode = 'BASIC';
    component.tierPoints = 500;
    expect(component.tierInfo.name).toBe('Mới');
    expect(component.progressPercent).toBe(50);

    component.tierCode = 'SILVER';
    component.tierPoints = 3000;
    expect(component.tierInfo.name).toBe('Bạc');
    expect(component.tierInfo.discount).toBe(5);
  });
});
