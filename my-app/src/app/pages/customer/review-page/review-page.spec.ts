import { TestBed } from '@angular/core/testing';
import { AppModule } from '../../../app-module';
import { ReviewPage } from './review-page';
import { AuthService } from '../../../core/auth.service';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

describe('ReviewPage', () => {
  async function configure(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: AuthService, useValue: { ensureSession: () => of(null) } },
      ],
    }).compileComponents();
  }

  it('creates the page', async () => {
    await configure();
    const fixture = TestBed.createComponent(ReviewPage);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('redirects a guest to login when they try to submit a review', async () => {
    await configure();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ReviewPage);

    fixture.componentInstance.submit();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/reviews' },
    });
  });

  it('fails closed to login if the session cannot be checked', async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: AuthService, useValue: { ensureSession: () => throwError(() => new Error('API unavailable')) } },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ReviewPage);

    fixture.componentInstance.submit();

    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/reviews' },
    });
  });
});
