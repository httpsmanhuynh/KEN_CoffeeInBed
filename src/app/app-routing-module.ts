import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CustomerLayout } from './shared/layouts/customer-layout/customer-layout.component';
import { SupportComponent } from './pages/customer/support/support.component';

const routes: Routes = [
  {
    path: '',
    component: CustomerLayout,
    children: [
      { path: 'ho-tro', component: SupportComponent },
      { path: '', redirectTo: 'ho-tro', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}

