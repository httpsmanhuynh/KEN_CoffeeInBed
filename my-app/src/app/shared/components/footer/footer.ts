import { Component } from '@angular/core';
import { FOOTER_ABOUT, FOOTER_POLICY } from '../../../core/nav-links';

@Component({
  selector: 'app-footer',
  standalone: false,
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  readonly about = FOOTER_ABOUT;
  readonly policy = FOOTER_POLICY;
  readonly year = new Date().getFullYear();

  /** Logo đối tác: đặt file vào public/images/payments/<id>.png */
  readonly payments = [
    { id: 'momo', name: 'MoMo' }, { id: 'acb', name: 'ACB' }, { id: 'hsbc', name: 'HSBC' },
    { id: 'vietcombank', name: 'Vietcombank' }, { id: 'mb', name: 'MB' }, { id: 'citibank', name: 'Citibank' },
    { id: 'vietinbank', name: 'VietinBank' }, { id: 'tpbank', name: 'TPBank' }, { id: 'bidv', name: 'BIDV' },
  ];

}
