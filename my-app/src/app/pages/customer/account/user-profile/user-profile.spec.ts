import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserProfile } from './user-profile';

describe('UserProfile', () => {
  let component: UserProfile;
  let fixture: ComponentFixture<UserProfile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, RouterModule.forRoot([])],
      declarations: [UserProfile],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(UserProfile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('rejects an empty name and a malformed email', () => {
    component.form.name = '  ';
    component.form.email = 'abc';
    component.onUpdate();
    expect(component.errors.name).toBeTruthy();
    expect(component.errors.email).toBeTruthy();
    expect(component.messageType).toBe('error');
  });

  it('saves valid changes and cancel restores the saved values', () => {
    component.form.name = 'Thanh';
    expect(component.dirty).toBe(true);
    component.onUpdate();
    expect(component.messageType).toBe('ok');
    expect(component.dirty).toBe(false);
    component.form.name = 'Khác';
    component.onCancel();
    expect(component.form.name).toBe('Thanh');
  });
});
