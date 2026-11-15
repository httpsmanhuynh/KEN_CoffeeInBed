import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Addons } from './addons';

describe('Addons', () => {
  let component: Addons;
  let fixture: ComponentFixture<Addons>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Addons],
    }).compileComponents();

    fixture = TestBed.createComponent(Addons);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
