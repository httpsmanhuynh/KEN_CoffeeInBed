import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RegisterPage } from './pages/customer/auth/register-page/register-page';
import { OtpVerifyPage } from './pages/customer/auth/otp-verify-page/otp-verify-page';
import { LoginPage } from './pages/customer/auth/login-page/login-page';

const routes: Routes = [
  { path: '', redirectTo: 'register', pathMatch: 'full' },
  { path: 'register', component: RegisterPage },
  { path: 'otp-verify', component: OtpVerifyPage },
  { path: 'login', component: LoginPage },

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
