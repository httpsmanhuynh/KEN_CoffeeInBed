import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { AccountSidebar } from './account-sidebar';

describe('AccountSidebar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [AccountSidebar],
    }).compileComponents();
  });

  it('marks the active section', async () => {
    const f = TestBed.createComponent(AccountSidebar);
    f.componentRef.setInput('active', 'bookings');
    await f.whenStable();
    const active = (f.nativeElement as HTMLElement).querySelectorAll('.item.is-active');
    expect(active.length).toBe(1);
    expect(active[0].textContent).toContain('Lịch sử đặt chỗ');
  });
});
