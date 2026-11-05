import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SupportComponent } from './support';

@NgModule({
  declarations: [SupportComponent],
  imports: [CommonModule, ReactiveFormsModule],
})
class SupportTestModule {}

describe('SupportComponent', () => {
  let component: SupportComponent;
  let fixture: ComponentFixture<SupportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupportTestModule],
    }).compileComponents();

    fixture = TestBed.createComponent(SupportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter FAQ by keyword', () => {
    component.searchQuery = 'hai lần';
    expect(component.filteredFAQ.length).toBe(1);
  });

  it('should toggle FAQ', () => {
    const faq = component.faqItems[0];
    component.toggleFAQ(faq);
    expect(faq.isOpen).toBe(true);
  });

  it('should require support form fields', () => {
    expect(component.supportForm.invalid).toBe(true);
  });

  it('should reset the form', () => {
    component.supportForm.patchValue({ fullName: 'Test' });
    component.resetForm();
    expect(component.supportForm.get('fullName')?.value).toBeNull();
  });
});

