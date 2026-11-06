/** Điều hướng dùng chung – nhãn lấy đúng theo Figma (header + footer). */
export interface NavChild { label: string; path: string; }
export interface NavItem { label: string; path?: string; children?: NavChild[]; }

// TODO: các route /spaces, /menu, /support, /policy, /terms, /about, /blog, /reviews chưa có trang.
export const MAIN_NAV: NavItem[] = [
  { label: 'Trang chủ', path: '/' },
  { label: 'Không gian', path: '/spaces' },
  { label: 'Menu', path: '/menu' },
  { label: 'Hỗ trợ', children: [
    { label: 'Trung tâm hỗ trợ', path: '/support' },
  ] },
  { label: 'Chính sách', children: [
    { label: 'Chính sách hoạt động', path: '/policy' },
    { label: 'Điều kiện & điều khoản', path: '/terms' },
  ] },
  { label: 'Về chúng tôi', children: [
    { label: 'Giới thiệu', path: '/about' },
    { label: 'Blog', path: '/blog' },
    { label: 'Đánh giá', path: '/reviews' },
  ] },
];

export const FOOTER_ABOUT: NavChild[] = [
  { label: 'Giới thiệu', path: '/about' },
  { label: 'Blog', path: '/blog' },
  { label: 'Đánh giá', path: '/reviews' },
  { label: 'Trung tâm hỗ trợ', path: '/support' },
  { label: 'Đặt chỗ của tôi', path: '/booking-list' },
];

export const FOOTER_POLICY: NavChild[] = [
  { label: 'Chính sách hoạt động', path: '/policy' },
  { label: 'Điều kiện & điều khoản', path: '/terms' },
];

/** Các route thuộc khu vực thành viên (dùng header đã đăng nhập). */
export const MEMBER_PATHS = [
  '/booking-list', '/booking-reschedule', '/booking-cancel',
  '/user-profile', '/security', '/points-tier', '/coins-rewards',
];
