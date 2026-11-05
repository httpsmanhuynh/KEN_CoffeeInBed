import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { SupportComponent } from './pages/customer/support/support';
import { HeaderComponent } from './shared/components/header/header';
import { Footer } from './shared/components/footer/footer';
import { CustomerLayout } from './shared/layouts/customer-layout/customer-layout';

@NgModule({
  declarations: [App, SupportComponent, HeaderComponent, Footer, CustomerLayout],
  imports: [BrowserModule, AppRoutingModule, ReactiveFormsModule],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}






