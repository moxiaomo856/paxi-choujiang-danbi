# -*- coding: utf-8 -*-
"""一键生成六站单币抽奖前端：
   1) 从 paxi/ 母版复制共享前端（app.js / i18n.js / lottery.js / chain.js /
      hash.js / styles.css / sw.js / index.html / vendor/）到六个目录；
   2) 按站点写 config.js + manifest.json；
   3) 用 PIL 生成各站 PWA / favicon 图标集（accent 主色 + 代币符号）。

用法（仓库根目录下）：
    python tools/build_sites.py
"""
import os
import shutil
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TEMPLATE = os.path.join(ROOT, 'paxi')          # 母版目录
SHARED = ['app.js', 'i18n.js', 'lottery.js', 'session.js', 'chain.js', 'hash.js',
          'styles.css', 'sw.js', 'index.html']

# 六站配置（合约 / 代币地址来自部署清单）
ADMINS = ['paxi1qvrmsftn402cumn0axqjc4dgvmkge6lhp0y39j',
          'paxi1rdarmm997hqwfdgl9wvnpffe28zmex3kfyg7xd']
TREASURY = 'paxi194kpjqhyz7re2g749lc2030cgeg4sql5ldvyem'

SITES = [
    dict(key='paxi',  title='Paxi 抽奖 · PAXI',  token='PAXI',  accent='#ff6b35', accent2='#ff8f5e',
         contract='paxi1qnucu7mhfs9sw5gyghvtdntv8dwdpsfyuh4ewj3zsz5lmphqkymsswcve0',
         isPaxi=True,  tokenKind='native', tokenDenom='upaxi', tokenContract=''),
    dict(key='orion', title='Paxi 抽奖 · ORION', token='ORION', accent='#4f8cff', accent2='#7faeff',
         contract='paxi183n52emwcxpnma7fvsh35k83t0959gk9et0kpkgzystmqyfjay0qjx5pun',
         isPaxi=False, tokenKind='cw20', tokenDenom='', tokenContract='paxi1y0vna6d25hmgpsl63w2v2ks7j4tj7mwplr0pzfjmes5yqld59egsc7ahnz'),
    dict(key='pick',  title='Paxi 抽奖 · PICK',  token='PICK',  accent='#22c55e', accent2='#4ade80',
         contract='paxi1n9qjwneu8pw02jjjf2t80ekagsxrxgk883s0nsxuqz3kxweegjvqp6afvg',
         isPaxi=False, tokenKind='cw20', tokenDenom='', tokenContract='paxi1wh57kws25k7qz235x3u98r7tkgq2saxfl7z8nk7mnhhqtszwptsqye7fpx'),
    dict(key='leo',   title='Paxi 抽奖 · LEO',   token='LEO',   accent='#f5b301', accent2='#ffd24d',
         contract='paxi16a2k2mena62e5gwq00qtaamg0czalgvt6wsaa5j29w53q2arhtdq4hkrcg',
         isPaxi=False, tokenKind='cw20', tokenDenom='', tokenContract='paxi1fl9glyfffr8kewueguj6jsnex3whxrhn44ucsv7djgec6prdp7jqenytw2'),
    dict(key='cobra', title='Paxi 抽奖 · COBRA', token='COBRA', accent='#a855f7', accent2='#c98bff',
         contract='paxi10vjktgaqc2mmkcdqewv60mw72mamrmu4kpu6yxfyv5ejyram3p5qd9ag5n',
         isPaxi=False, tokenKind='cw20', tokenDenom='', tokenContract='paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u'),
    dict(key='uscea', title='Paxi 抽奖 · USCEA', token='USCEA', accent='#14b8a6', accent2='#4fd6c4',
         contract='paxi1fdsnh4xz6d0ssfusfznl8ngdcvmgdrfv346jpjnyqftzl4rjfv4srqcepf',
         isPaxi=False, tokenKind='cw20', tokenDenom='', tokenContract='paxi1l0vrqcxhrd4x4y02w6ahp58evmkgvf7kv962mj0k7qgwcz8tuqnqsct788'),
]


def config_js(s):
    # Python bool → JS bool（True/False 直接插值会生成非法 JS：isPaxi: True）
    s = dict(s, isPaxi='true' if s['isPaxi'] else 'false')
    return '''/* =====================================================================
 * config.js —— 抽奖前端配置（本站点：%(token)s）
 *
 * 【六站共用同一份代码】paxi/ orion/ pick/ leo/ cobra/ uscea/ 是同一套前端，
 * 只有本文件、manifest.json 和图标文件在各站之间不同。
 *
 * 契约：本站前端对接单币抽奖合约（paxi-lottery-single）。
 * ===================================================================== */
window.CJ_CONFIG = {
  // ======== 站点标识（六站各不相同）========
  appKey: '%(key)s',
  storageNs: '%(key)s',
  appTitle: '%(title)s',
  tokenName: '%(token)s',
  accent: '%(accent)s',
  accent2: '%(accent2)s',
  deployed: true,
  notDeployedMsg: '',

  // ---- 链 ----
  chainId: 'paxi-mainnet',
  rpc: 'https://mainnet-rpc.paxinet.io',
  lcd: 'https://mainnet-lcd.paxinet.io',
  bech32Prefix: 'paxi',
  coinDenom: 'PAXI',
  coinMinimalDenom: 'upaxi',
  coinDecimals: 6,
  gasPrice: 0.05,
  defaultGas: 600000,

  // ---- 签名域名（必须与合约 state.rs 的 SIGN_DOMAIN 一致）----
  signDomain: 'lottery',

  // ==== 合约（本站专属）====
  contract: '%(contract)s',

  // ---- 本站参与代币 ----
  isPaxi: %(isPaxi)s,
  tokenKind: '%(tokenKind)s',
  tokenDenom: '%(tokenDenom)s',
  tokenContract: '%(tokenContract)s',
  tokenDecimals: 6,

  // ---- 合约参数（只读展示 + 前端输入预校验，真值以链上 config 为准）----
  createFeeUpaxi: '20000000',
  minPeople: 5,
  maxPeople: 200,
  minJoinRaw: '5000000',
  maxJoinRaw: '150000000000',
  cancelTimeoutSecs: 86400,

  // ---- 管理员 / 运营（六站一致）----
  admins: [
    'paxi1qvrmsftn402cumn0axqjc4dgvmkge6lhp0y39j',
    'paxi1rdarmm997hqwfdgl9wvnpffe28zmex3kfyg7xd',
  ],
  treasury: 'paxi194kpjqhyz7re2g749lc2030cgeg4sql5ldvyem',

  // ---- 无感会话 ----
  sessionDailyLimit: '1000000000000',
  sessionGasFund: '2000000',
  keepSeamless: true,
  sessionTtlHours: 24,

  // ---- 列表轮询 ----
  pollInterval: 10000,
};
''' % s


def manifest_json(s):
    return '''{
  "name": "%(title)s",
  "short_name": "%(token)s抽奖",
  "description": "Paxi 链上单币 %(token)s 抽奖：满员自动开奖、一等奖 38%%、建池者 / 运营各 14%%",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f1115",
  "theme_color": "#0f1115",
  "icons": [
    { "src": "./icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
''' % s


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def load_font(size):
    candidates = [
        'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/segoeui.ttf',
        'C:/Windows/Fonts/arialbd.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf',
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()


def token_source(site_key):
    """返回站点代币图片路径（assets/tokens/<key>.jpg|.png|.jpeg），无则 None。"""
    for ext in ('.jpg', '.jpeg', '.png', '.webp'):
        p = os.path.join(ROOT, 'assets', 'tokens', site_key + ext)
        if os.path.exists(p):
            return p
    return None


def square_crop(img):
    """中心方裁：非正方形图取中间最大正方形。"""
    w, h = img.size
    if w == h:
        return img
    s = min(w, h)
    left, top = (w - s) // 2, (h - s) // 2
    return img.crop((left, top, left + s, top + s))


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def make_icon(site_key, token, accent, accent2, out_dir):
    S = 512
    accent_rgb = hex2rgb(accent)
    accent2_rgb = hex2rgb(accent2)
    src = token_source(site_key)

    if src:
        # ===== 用真实代币图片生成 =====
        base = square_crop(Image.open(src).convert('RGB')).resize((S, S), Image.LANCZOS)
        base.save(os.path.join(out_dir, 'icon-512.png'), optimize=True)
        base.resize((192, 192), Image.LANCZOS).save(os.path.join(out_dir, 'icon-192.png'), optimize=True)
        base.resize((128, 128), Image.LANCZOS).save(os.path.join(out_dir, 'icon-128.png'), optimize=True)
        base.resize((180, 180), Image.LANCZOS).save(os.path.join(out_dir, 'apple-touch-icon.png'), optimize=True)

        # maskable：主色底 + 中央 80% 圆角贴图（满足安全区，四周留 accent 边）
        mk = Image.new('RGB', (S, S), accent_rgb)
        inner = int(S * 0.80)
        im2 = square_crop(Image.open(src).convert('RGB')).resize((inner, inner), Image.LANCZOS)
        mk.paste(im2, ((S - inner) // 2, (S - inner) // 2), rounded_mask(inner, int(inner * 0.16)))
        mk.save(os.path.join(out_dir, 'icon-maskable-512.png'), optimize=True)
        return

    # ===== 无源图：PIL 占位图标（accent 底 + 代币符号）=====
    img = Image.new('RGB', (S, S), accent_rgb)
    d = ImageDraw.Draw(img)

    # 内层圆角卡（accent2），留出安全边距
    m = int(S * 0.10)
    d.rounded_rectangle([m, m, S - m, S - m], radius=int(S * 0.18), fill=accent2_rgb)
    # 白色细描边
    d.rounded_rectangle([m, m, S - m, S - m], radius=int(S * 0.18), outline=(255, 255, 255), width=4)

    # 代币符号文字（居中，按长度自适应字号）
    n = len(token)
    fs = 150 if n <= 4 else (118 if n == 5 else 96)
    font = load_font(fs)
    # 逐字符测量宽度
    try:
        bbox = d.textbbox((0, 0), token, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    except Exception:
        tw, th = S * 0.6, fs
    cx, cy = S // 2, S // 2
    d.text((cx - tw // 2 - bbox[0], cy - th // 2 - bbox[1]), token, fill=(255, 255, 255), font=font)

    img.save(os.path.join(out_dir, 'icon-512.png'), optimize=True)
    img.resize((192, 192), Image.LANCZOS).save(os.path.join(out_dir, 'icon-192.png'), optimize=True)
    img.resize((128, 128), Image.LANCZOS).save(os.path.join(out_dir, 'icon-128.png'), optimize=True)
    img.resize((180, 180), Image.LANCZOS).save(os.path.join(out_dir, 'apple-touch-icon.png'), optimize=True)

    # maskable：内层卡缩到中央 80%，四周留 accent 边（满足 PWA maskable 安全区）
    mk = Image.new('RGB', (S, S), accent_rgb)
    d2 = ImageDraw.Draw(mk)
    m2 = int(S * 0.06)
    d2.rounded_rectangle([m2, m2, S - m2, S - m2], radius=int(S * 0.16), fill=accent2_rgb)
    d2.rounded_rectangle([m2, m2, S - m2, S - m2], radius=int(S * 0.16), outline=(255, 255, 255), width=4)
    fss = int(fs * 0.86)
    font2 = load_font(fss)
    try:
        b2 = d2.textbbox((0, 0), token, font=font2)
        tw2, th2 = b2[2] - b2[0], b2[3] - b2[1]
        d2.text((cx - tw2 // 2 - b2[0], cy - th2 // 2 - b2[1]), token, fill=(255, 255, 255), font=font2)
    except Exception:
        pass
    mk.save(os.path.join(out_dir, 'icon-maskable-512.png'), optimize=True)


def main():
    missing = []
    for s in SITES:
        d = os.path.join(ROOT, s['key'])
        if not os.path.isdir(d):
            os.makedirs(d)
        # 复制共享前端（母版自身跳过，避免自我复制 WinError 32）
        for f in SHARED:
            src = os.path.join(TEMPLATE, f)
            dst = os.path.join(d, f)
            if os.path.abspath(src) == os.path.abspath(dst):
                continue
            if os.path.exists(src):
                shutil.copy2(src, dst)
        vdir = os.path.join(TEMPLATE, 'vendor')
        if os.path.isdir(vdir):
            tg = os.path.join(d, 'vendor')
            if os.path.abspath(vdir) == os.path.abspath(tg):
                pass  # 母版自身，不动 vendor
            else:
                if os.path.isdir(tg):
                    shutil.rmtree(tg)
                shutil.copytree(vdir, tg)
        # 写配置
        with open(os.path.join(d, 'config.js'), 'w', encoding='utf-8') as f:
            f.write(config_js(s))
        with open(os.path.join(d, 'manifest.json'), 'w', encoding='utf-8') as f:
            f.write(manifest_json(s))
        # 生成图标
        make_icon(s['key'], s['token'], s['accent'], s['accent2'], d)
        print('built: %-7s %s' % (s['key'], d))
    print('done. sites:', ', '.join(s['key'] for s in SITES))


if __name__ == '__main__':
    main()
