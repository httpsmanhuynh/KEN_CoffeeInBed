import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const url = req.url;
        const isAuthEndpoint =
          url.includes('/api/auth/me') ||
          url.includes('/api/auth/login') ||
          url.includes('/api/auth/register') ||
          url.includes('/api/auth/verify-otp') ||
          url.includes('/api/auth/forgot-password') ||
          url.includes('/api/auth/reset-password');

        if (err.status === 401 && !isAuthEndpoint) {
          auth.setUser(null);
          const returnUrl = router.url && !router.url.startsWith('/login') ? router.url : '/';
          router.navigate(['/login'], { queryParams: { returnUrl } });
        } else if (err.status === 403 && !isAuthEndpoint) {
          router.navigate(['/access-denied']);
        } else if (err.status === 404 && req.method === 'GET' && !url.includes('/api/auth/')) {
          router.navigate(['/404']);
        }
      }
      return throwError(() => err);
    }),
  );
};
