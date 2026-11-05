import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { RegisterPage } from './pages/customer/auth/register-page/register-page';
import { OtpVerifyPage } from './pages/customer/auth/otp-verify-page/otp-verify-page';
import { OtpInput } from './shared/components/otp-input/otp-input';
import { provideHttpClient } from '@angular/common/http';
import { LoginPage } from './pages/customer/auth/login-page/login-page';

@NgModule({
  declarations: [App, RegisterPage, OtpVerifyPage, OtpInput, LoginPage],
  imports: [BrowserModule, AppRoutingModule, ReactiveFormsModule],
  providers: [provideHttpClient()],
  bootstrap: [App],
})
export class AppModule {}
