import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { BookingsComponent } from './bookings/bookings.component';
import { CustomersComponent } from './customers/customers.component';
import { AreasComponent } from './areas/areas.component';
import { SpacesComponent } from './spaces/spaces.component';
import { ServicePackages } from './service-packages/service-packages';
import { Addons } from './addons/addons';
import { Voucher } from './voucher/voucher';
import { Forecast } from './forecast/forecast';
import { adminGuard } from './admin.guard';

export const adminRoutes: Routes = [
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    canActivateChild: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'bookings', component: BookingsComponent },
      { path: 'customers', component: CustomersComponent },
      { path: 'zones', component: AreasComponent },
      { path: 'zones/new', component: AreasComponent },
      { path: 'areas', component: AreasComponent },
      { path: 'areas/new', component: AreasComponent },
      { path: 'spaces', component: SpacesComponent },
      { path: 'spaces/new', component: SpacesComponent },
      { path: 'spaces/:id/edit', component: SpacesComponent },
      { path: 'packages', component: ServicePackages },
      { path: 'packages/new', component: ServicePackages },
      { path: 'packages/:id/edit', component: ServicePackages },
      { path: 'packages/:id', component: ServicePackages },
      { path: 'addons', component: Addons },
      { path: 'vouchers', component: Voucher },
      { path: 'forecast', component: Forecast },
    ],
  },
];
