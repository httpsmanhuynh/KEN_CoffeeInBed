/** Điều hướng dùng chung – nhãn lấy đúng theo Figma (header + footer). */
export interface NavChild { label: string; path: string; }
export interface NavItem {
  label: string; path?: string; children?: NavChild[];
  /** Các đường dẫn làm mục này sáng/gạch chân (mặc định chỉ `path`). */
  match?: string[];
}

// TODO: các route /spaces, /menu, /support, /policy, /terms, /about, /blog, /reviews chưa có trang.
export const MAIN_NAV: NavItem[] = [
  { label: 'Trang chủ', path: '/' },
  { label: 'Không gian', path: '/spaces' },
  { label: 'Menu', path: '/menu' },
  { label: 'Top Trending', path: '/top-trending' },
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

/** Các route xác thực; không dùng URL để xác định trạng thái phiên hay header. */
export const GUEST_PATHS = [
  '/register', '/otp-verify', '/login',
  '/forgot-password', '/forgot-otp', '/reset-password',
];

/** true nếu URL là route xác thực (kể cả có query, hash, dấu "/" cuối hoặc route con). */
export function isGuestPath(url: string): boolean {
  const path = '/' + url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '').toLowerCase();
  if (path === '/') return true; // "/" được điều hướng về /register
  return GUEST_PATHS.some(g => path === g || path.startsWith(g + '/'));
}
