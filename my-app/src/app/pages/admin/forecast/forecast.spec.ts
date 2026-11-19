import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Forecast } from './forecast';

describe('Forecast', () => {
  let component: Forecast;
  let fixture: ComponentFixture<Forecast>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Forecast],
    }).compileComponents();

    fixture = TestBed.createComponent(Forecast);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
