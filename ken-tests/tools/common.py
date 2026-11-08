import re
def load_manual(path, marker_start, marker_end):
    src = open(path, encoding='utf-8').read()
    s = src.index(marker_start); e = src.index(marker_end)
    ns = {}
    exec("C=[]\nT=C\nadd=a=lambda *x:C.append(x)\n" + src[s:e], ns)
    return ns['T'] if ns.get('T') and ns['T'] is not ns['C'] and ns['T'] else ns['C']

def typ(cn, ti):
    if any(k in cn for k in ('Phân quyền', 'Chống gian lận', 'Chống thanh toán')) or any(k in ti for k in ('DevTools', 'Postman', 'Sửa giá', 'người khác', 'khi chưa đăng nhập', 'Customer không')): return 'Security'
    if any(k in ti for k in ('âm', '0 hoặc', 'thập phân', 'quá dung lượng', 'Số lượng', 'liên tiếp', 'hết thời gian', 'khi hết', 'Hết hạn')): return 'Boundary'
    if any(k in ti.lower() for k in ('sai', 'trống', 'nhập chữ', 'khóa', 'không ', 'thất bại', 'hủy', 'lỗi', 'bị ')): return 'Negative'
    return 'Positive'

def manual_rows(C, gmap, api_prefix, rules, default_br=''):
    out = []
    for (mod, cn, pr, ti, dk, st, dl, ex, ref) in C:
        g = gmap(mod, cn, ti) if callable(gmap) else gmap[mod]
        br = next((v for k, v in rules if k in ti), None) or next((v for k, v in rules if k == cn), default_br)
        out.append(dict(g=g, api=f'{api_prefix} › {cn}', type=typ(cn, ti), desc=ti, pre=dk, data=dl, steps=st, exp=ex, http='—', br=br, note=f'Tham chiếu {ref} | Ưu tiên {pr}'))
    return out

def A(g, api, type, desc, pre, data, steps, exp, http, br, auto):
    return dict(g=g, api=api, type=type, desc=desc, pre=pre, data=data, steps=steps, exp=exp, http=http, br=br, note=f'Tự động: {auto}')
