/* =====================================================================
 * app.js —— 单币抽奖前端主逻辑（奖池 / 建池 / 我的 / 管理 + 池详情弹窗）
 *
 * 依赖：CJ_CONFIG（config.js）、CJ_I18N（i18n.js）、CJChain（chain.js）、
 *       CJLottery（lottery.js）。六站共用同一份代码，仅 config.js 不同。
 * ===================================================================== */
(function () {
  const C = window.CJ_CONFIG;
  const K = window.CJChain;
  const L = window.CJLottery;
  const I = window.CJ_I18N;
  const t = (k, p) => (I ? I.t(k, p) : k);
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const tokenName = () => (C.tokenName || 'PAXI');

  // ----------------------------- 状态 -----------------------------
  const S = {
    cfg: null,            // 链上 config
    pools: [],            // 原始 pool 数组
    views: [],            // toView 后的数组
    addr: '',
    isAdmin: false,
    balTok: null,         // 链上钱包本站代币余额（raw）
    balPaxi: null,        // 链上钱包 upaxi 余额（raw）
    balInt: null,         // 合约内部余额（本站代币，raw）
    balIntPaxi: null,     // 合约内部原生 upaxi（非 PAXI 站的建池费用池）
    busy: false,          // 交易进行中
    loaded: false,
  };

  const cfgMin = () => (S.cfg ? S.cfg.min_people : (C.minPeople || 5));
  const cfgMax = () => (S.cfg ? S.cfg.max_people : (C.maxPeople || 200));
  const cfgMinJoin = () => (S.cfg ? S.cfg.min_join_amount : (C.minJoinRaw || '5000000'));
  const cfgMaxJoin = () => (S.cfg ? S.cfg.max_join_amount : (C.maxJoinRaw || '150000000000'));
  const cfgFee = () => (S.cfg ? S.cfg.create_fee_upaxi : (C.createFeeUpaxi || '20000000'));

  // ----------------------------- 工具 -----------------------------
  function isPAXI() { return C.isPaxi === true; }

  function toast(msg, type) {
    const wrap = $('#toastWrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.textContent = msg;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, 2600);
  }

  function banner(msg, cls) {
    const b = $('#banner');
    if (!b) return;
    if (!msg) { b.hidden = true; return; }
    b.hidden = false;
    b.className = 'banner ' + (cls || 'info');
    b.textContent = msg;
  }

  function log(msg) {
    const lg = $('#log');
    if (lg) lg.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg + '\n' + lg.textContent;
  }

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => toast(t('common.copied'), 'info'), () => toast(t('common.copyFail'), 'warn'));
        return;
      }
    } catch (_) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      toast(t('common.copied'), 'info');
    } catch (_) { toast(t('common.copyFail'), 'warn'); }
  }

  function shortAddr(a) {
    if (!a) return '';
    return a.length > 16 ? a.slice(0, 8) + '…' + a.slice(-6) : a;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // 把合约业务错误 / 节点错误翻译成用户可读文案
  function friendlyError(e) {
    const m = (e && e.message) ? e.message : String(e);
    if (e && e.nodeDown) return '链上节点暂时不可用，请稍后重试（与你的账户 / 余额无关）。';
    if (e && e.needSession) return m;
    // 英文合约错误 → 中文提示 + 原文
    if (/[一-龥]/.test(m) === false && /[A-Za-z]/.test(m)) {
      const pairs = [
        ['Pool', '奖池'], ['not found', '不存在'], ['not open', '未开放'], ['not full', '未满员'],
        ['already drawn', '已开奖'], ['already joined', '已参与'], ['already claimed', '已领取'],
        ['expired', '已过期'], ['NotExpired', '未过期'], ['Unauthorized', '无权限'],
        ['is paused', '合约已暂停'], ['Invalid amount', '金额不匹配'], ['Invalid join_amount', '参与费不在允许范围'],
        ['Invalid max_people', '人数不在允许范围'], ['Admin cannot', '管理员 / 运营不可操作'],
        ['Burn address not configured', '未配置黑洞地址'], ['Invalid burn mode', '销毁方式非法'],
        ['insufficient funds', '余额不足'], ['Nothing to claim', '没有可领取的奖励'],
      ];
      let zh = m;
      for (const [en, z] of pairs) zh = zh.replace(new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), z);
      return zh + '（' + m + '）';
    }
    return m;
  }

  function setBusy(b) {
    S.busy = b;
    $$('#page-pools .btn, #page-create .btn, #page-me .btn, #page-admin .btn, .modal .btn').forEach((x) => { x.disabled = b; });
  }

  // ----------------------------- 钱包 -----------------------------
  /** 连接成功后的公共后续（连接按钮与静默连接共用） */
  async function afterConnect(addr) {
    S.addr = addr;
    $('#addr').textContent = shortAddr(addr);
    $('#btnConnect').textContent = shortAddr(addr);
    $('#btnConnect').classList.add('ghost');
    $('#btnConnect').classList.remove('primary');
    $('#btnSession').hidden = false;
    log('已连接：' + addr);

    // 恢复本机保存的无感会话（以链上 nonce 为准；会话已失效则清掉）
    if (window.CJSession && window.CJSession.restore()) {
      await window.CJSession.syncNonce();
      if (window.CJSession.state.enabled) {
        $('#sessTag').hidden = false;
        $('#btnSession').textContent = t('wallet.closeSession');
      } else {
        $('#sessTag').hidden = true;
        $('#btnSession').textContent = t('wallet.openSession');
      }
    } else if (window.CJSession) {
      $('#btnSession').textContent = t('wallet.openSession');
    }

    await refreshAll();
    renderSessionCard();
    renderMe();
    if (currentTab() === 'me') renderMe();
  }

  async function connectWallet() {
    try {
      banner('', null);
      const addr = await K.connect();
      await afterConnect(addr);
    } catch (e) {
      toast(friendlyError(e), 'err');
      log('连接失败：' + (e && e.message));
    }
  }

  // ----------------------------- 无感会话 -----------------------------
  function sessionEnabled() {
    return !!(window.CJSession && window.CJSession.state.enabled);
  }

  /** 奖池页的无感引导卡片：未连接→引导连接；已连接未开启→引导开启 */
  function renderSessionCard() {
    const card = $('#sessionCard');
    if (!card) return;
    if (!K.wallet.address) {
      card.hidden = false;
      $('#sessionCardTitle').textContent = t('sessCard.titleConnect');
      $('#sessionCardDesc').textContent = t('sessCard.descConnect');
      $('#btnSessionCard').textContent = t('sessCard.btnConnect');
      return;
    }
    if (sessionEnabled()) { card.hidden = true; return; }
    card.hidden = false;
    $('#sessionCardTitle').textContent = t('sessCard.titleEnable');
    $('#sessionCardDesc').textContent = t('sessCard.descEnable');
    $('#btnSessionCard').textContent = t('sessCard.btnEnable');
  }

  /** 开 / 关无感（开：注册会话 + 充 gas 一笔交易，只弹一次钱包） */
  async function doSessionToggle() {
    if (S.busy) return;
    setBusy(true);
    try {
      if (sessionEnabled()) {
        const swept = await window.CJSession.disable().catch(() => '0');
        $('#sessTag').hidden = true;
        $('#btnSession').textContent = t('wallet.openSession');
        toast(t('msg.sessionClosed'), 'info');
        if (BigInt(swept || '0') > 0n) toast(t('msg.sessionSwept', { v: L.fmtPaxi(swept) }), 'info');
      } else {
        const a = await window.CJSession.enable();
        $('#sessTag').hidden = false;
        $('#btnSession').textContent = t('wallet.closeSession');
        toast(t('msg.sessionOpened', { addr: shortAddr(a) }), 'info');
      }
      renderSessionCard();
      await renderMe();
    } catch (e) {
      toast(friendlyError(e), 'err');
      log('无感切换失败：' + (e && e.message));
    } finally { setBusy(false); }
  }

  // ----------------------------- 充值 / 提现 -----------------------------
  async function doDeposit() {
    if (S.busy) return;
    const kind = $('#depToken') ? $('#depToken').value : 'token';
    const amt = $('#depAmount').value;
    let raw;
    try { raw = L.toRaw(amt || '0'); } catch (_) { raw = '0'; }
    if (!amt || BigInt(raw) <= 0n) { toast(t('err.invalidAmountInput'), 'warn'); return; }
    setBusy(true);
    try {
      if (kind === 'paxi' && !isPAXI()) await L.depositNative(raw);
      else if (isPAXI()) await L.depositNative(raw);
      else await L.depositToken(raw);
      toast(t('msg.depositOk', { a: L.fmtToken(raw) }), 'info');
      $('#depAmount').value = '';
      await refreshAll();
    } catch (e) { toast(friendlyError(e), 'err'); log('充值失败：' + (e && e.message)); }
    finally { setBusy(false); }
  }

  async function doWithdraw() {
    if (S.busy) return;
    const kind = $('#depToken') ? $('#depToken').value : 'token';
    const amt = $('#depAmount').value;
    let raw;
    try { raw = L.toRaw(amt || '0'); } catch (_) { raw = '0'; }
    if (!amt || BigInt(raw) <= 0n) { toast(t('err.invalidAmountInput'), 'warn'); return; }
    const intBal = (kind === 'paxi' && !isPAXI()) ? S.balIntPaxi : S.balInt;
    if (intBal != null && BigInt(raw) > BigInt(intBal)) {
      toast(t('err.insufficientInternal'), 'warn'); return;
    }
    setBusy(true);
    try {
      if (kind === 'paxi' && !isPAXI()) await L.withdraw(null, raw);
      else if (isPAXI()) await L.withdraw(null, raw);
      else await L.withdraw(C.tokenContract, raw);
      toast(t('msg.withdrawOk', { a: L.fmtToken(raw) }), 'info');
      $('#depAmount').value = '';
      await refreshAll();
    } catch (e) { toast(friendlyError(e), 'err'); log('提现失败：' + (e && e.message)); }
    finally { setBusy(false); }
  }

  // ----------------------------- 加载数据 -----------------------------
  async function loadConfig() {
    try {
      const cfg = await L.config();
      S.cfg = cfg;
      S.isAdmin = !!(S.addr && cfg.admins && cfg.admins.some((a) => a === S.addr));
      applyAdminVisibility();
      // 创建页费用展示
      $('#costCreate').textContent = L.fmtPaxi(cfgFee());
      // 管理员页展示
      renderAdminStatus();
    } catch (e) {
      log('config 查询失败：' + (e && e.message));
    }
  }

  async function loadPools() {
    const r = await L.pools(null, 200);
    S.pools = (r && r.pools) || [];
    S.views = S.pools.map((p) => L.toView(p));
    renderPools();
    await renderClaimsTop();
  }

  async function loadBalances() {
    if (!S.addr) return;
    try {
      if (!isPAXI()) {
        S.balTok = await L.tokenBalance(S.addr);
      } else {
        S.balTok = await K.getBankUpaxi(S.addr);
      }
      S.balPaxi = await K.getBankUpaxi(S.addr);
      // 合约内部余额：PAXI 站代币即原生 upaxi（一次查询）；PRC-20 站查两笔
      const int = (token) =>
        L.internalBalance(S.addr, token)
          .then((r) => (r && r.balance != null ? r.balance : null))
          .catch(() => null);
      if (isPAXI()) {
        S.balInt = await int(null);
        S.balIntPaxi = S.balInt;
      } else {
        S.balInt = await int(C.tokenContract || null);
        S.balIntPaxi = await int(null);
      }
    } catch (e) {
      log('余额查询失败：' + (e && e.message));
    }
  }

  let refreshing = false;
  async function refreshAll() {
    if (refreshing) return;
    refreshing = true;
    try {
      await loadConfig();
      await loadPools();
      await loadBalances();
      if (currentTab() === 'me') renderMe();
      if (currentTab() === 'admin') renderAdmin();
      S.loaded = true;
    } catch (e) {
      log('刷新失败：' + (e && e.message));
      toast(friendlyError(e), 'err');
    } finally {
      refreshing = false;
    }
  }

  // ----------------------------- 渲染：奖池列表 -----------------------------
  function filteredViews() {
    const f = $('#fStatus') ? $('#fStatus').value : '';
    if (!f) return S.views.filter((v) => v.statusView === 'open' || v.statusView === 'full');
    if (f === 'all') return S.views;
    return S.views.filter((v) => v.statusView === f);
  }

  function renderPools() {
    const list = $('#list');
    if (!list) return;
    const views = filteredViews();
    if (!views.length) {
      list.innerHTML = '<div class="empty"><span class="big">🎲</span>' + escapeHtml(t('pools.empty')) + '</div>';
      return;
    }
    list.innerHTML = views.map(poolCardHTML).join('');
  }

  function poolCardHTML(v) {
    const pct = Math.max(0, Math.min(100, Math.round((Number(v.count) / Math.max(1, Number(v.maxPeople))) * 100)));
    const leftCls = (v.expired && v.statusView === 'open') ? 'left soon' : 'left';
    return ''
      + '<div class="item is-' + v.statusView + '" data-id="' + v.id + '">'
      + '  <div class="item-top"><span class="id">#' + v.id + '</span>'
      + '    <span class="st ' + v.statusView + '">' + escapeHtml(v.statusText) + '</span></div>'
      + '  <div class="meta"><b>' + escapeHtml(v.joinAmount) + '</b> ' + escapeHtml(tokenName()) + ' / 人 · <span class="' + leftCls + '">' + escapeHtml(v.expiresText) + '</span></div>'
      + '  <div class="bar"><i style="width:' + pct + '%"></i></div>'
      + '  <div class="meta">' + v.count + '/' + v.maxPeople + ' 人 · 总奖池 <b>' + escapeHtml(v.total) + '</b> · ' + escapeHtml(t('pools.expectedFirst')) + ' <b>' + escapeHtml(v.first) + '</b></div>'
      + '  <div class="acts"><button class="btn sm primary" data-act="detail">' + escapeHtml(t('pool.detailBtn')) + '</button></div>'
      + '</div>';
  }

  // ----------------------------- 渲染：待领奖（顶部 + 我的页） -----------------------------
  /** 扫描已开奖池，找出我能领的奖（一等奖 / 二等奖 / 建池奖励 / 运营奖励） */
  async function computeWinClaims() {
    if (!S.addr) return [];
    const treasury = S.cfg ? S.cfg.treasury : (C.treasury || '');
    const items = [];
    const needClaimable = [];
    for (const v of S.views) {
      if (v.statusView !== 'drawn') continue;
      const w = v.winners;
      if (w) {
        if (w.first === S.addr) items.push({ view: v, kind: 'prizeFirst', amountRaw: v.firstRaw, claimed: false });
        if (Array.isArray(w.second) && w.second.indexOf(S.addr) >= 0) items.push({ view: v, kind: 'prizeSecond', amountRaw: v.secondEachRaw, claimed: false });
      }
      if (v.creator === S.addr) items.push({ view: v, kind: 'creator', amountRaw: v.creatorRaw, claimed: false });
      if (treasury && S.addr === treasury) items.push({ view: v, kind: 'ops', amountRaw: v.opsRaw, claimed: false });
    }
    // 再查 claimable 确认是否已领取 + 精确金额
    if (items.length) {
      const res = await Promise.all(items.map((it) =>
        L.claimable(it.view.id, S.addr).then((c) => ({ it, c })).catch(() => ({ it, c: null }))
      ));
      for (const { it, c } of res) {
        if (!c) continue;
        if (it.kind === 'prizeFirst' || it.kind === 'prizeSecond') { it.claimed = !!c.prize_claimed; it.amountRaw = c.prize_amount; }
        else if (it.kind === 'creator') { it.claimed = !!c.creator_claimed; it.amountRaw = c.creator_amount; }
        else if (it.kind === 'ops') { it.claimed = !!c.ops_claimed; it.amountRaw = c.ops_amount; }
      }
    }
    return items;
  }

  async function renderClaimsTop() {
    const box = $('#claimsTop');
    const list = $('#claimsTopList');
    if (!box || !list) return;
    if (!S.addr) { box.hidden = true; return; }
    const items = await computeWinClaims();
    const pending = items.filter((i) => !i.claimed && L.isNonZeroRaw(i.amountRaw));
    if (!pending.length) { box.hidden = true; return; }
    box.hidden = false;
    $('#claimsCount').textContent = pending.length;
    list.innerHTML = pending.map(claimCardHTML).join('');
    // 我的页红点
    const dot = $('#tabMeDot');
    if (dot) dot.hidden = false;
  }

  function claimCardHTML(it) {
    const key = it.kind === 'prizeFirst' ? 'claim.prizeFirst'
      : it.kind === 'prizeSecond' ? 'claim.prizeSecond'
      : it.kind === 'creator' ? 'claim.creator'
      : 'claim.ops';
    const amount = L.fmtToken(it.amountRaw);
    return ''
      + '<div class="item is-drawn" data-id="' + it.view.id + '">'
      + '  <div class="item-top"><span class="id">#' + it.view.id + '</span>'
      + '    <span class="st first">' + escapeHtml(t(key)) + '</span></div>'
      + '  <div class="meta">' + escapeHtml(t('claim.youCanGet')) + ' <b>' + escapeHtml(amount) + '</b> ' + escapeHtml(tokenName()) + '</div>'
      + '  <div class="acts"><button class="btn sm primary" data-act="detail">' + escapeHtml(t('pool.detailBtn')) + '</button></div>'
      + '</div>';
  }

  // ----------------------------- 渲染：我的页 -----------------------------
  async function renderMe() {
    const box = $('#page-me');
    if (!box || box.hidden) return;
    // 内部余额（建池 / 参与 / 领取从这里扣）
    $('#balIntLabel').textContent = t('me.intBal', { token: tokenName() });
    $('#balInt').textContent = S.balInt != null ? L.fmtToken(S.balInt) : '—';
    $('#balIntPaxiBox').style.display = isPAXI() ? 'none' : '';
    if (!isPAXI()) $('#balIntPaxi').textContent = S.balIntPaxi != null ? L.fmtPaxi(S.balIntPaxi) : '—';
    // 链上钱包
    $('#balTokLabel').textContent = t('me.walletBal', { token: tokenName() });
    $('#balTok').textContent = S.balTok != null ? L.fmtToken(S.balTok) : '—';
    $('#balPaxi').textContent = S.balPaxi != null ? L.fmtPaxi(S.balPaxi) : '—';
    $('#balAddr').textContent = S.addr ? shortAddr(S.addr) : '—';
    $('#balPaxiBox').style.display = isPAXI() ? 'none' : '';
    // 充值/提现代币选择：PAXI 站只有一种货币，隐藏 PAXI 选项
    const optToken = $('#depOptToken');
    if (optToken) optToken.textContent = tokenName();
    const optPaxi = $('#depOptPaxi');
    if (optPaxi) optPaxi.style.display = isPAXI() ? 'none' : '';
    const depSel = $('#depToken');
    if (depSel && isPAXI() && depSel.value === 'paxi') depSel.value = 'token';
    // 无感会话状态行
    renderSessionStatus();

    const myClaims = $('#myClaims');
    const myCreated = $('#myCreated');
    const myJoined = $('#myJoined');

    if (!S.addr) {
      myClaims.innerHTML = '<div class="empty">' + escapeHtml(t('wallet.notConnected')) + '</div>';
      myCreated.innerHTML = '<div class="empty">' + escapeHtml(t('wallet.notConnected')) + '</div>';
      myJoined.innerHTML = '<div class="empty">' + escapeHtml(t('wallet.notConnected')) + '</div>';
      return;
    }

    const items = await computeWinClaims();
    const pending = items.filter((i) => !i.claimed && L.isNonZeroRaw(i.amountRaw));
    if (!pending.length) myClaims.innerHTML = '<div class="empty">' + escapeHtml(t('me.noClaims')) + '</div>';
    else myClaims.innerHTML = pending.map(claimCardHTML).join('');

    // 我建的池
    const created = S.views.filter((v) => v.creator === S.addr);
    if (!created.length) myCreated.innerHTML = '<div class="empty">' + escapeHtml(t('me.noCreated')) + '</div>';
    else myCreated.innerHTML = created.map(poolCardHTML).join('');

    // 我参与的池（open/expired 中，需要查 participants 才知道是否参与）
    const candidates = S.views.filter((v) => (v.statusView === 'open' || v.statusView === 'expired') && v.creator !== S.addr);
    const joinedIds = new Set();
    await Promise.all(candidates.map(async (v) => {
      try {
        const pr = await L.participants(v.id);
        if (pr && pr.participants && pr.participants.indexOf(S.addr) >= 0) joinedIds.add(v.id);
      } catch (_) {}
    }));
    const joined = S.views.filter((v) => joinedIds.has(v.id));
    if (!joined.length) myJoined.innerHTML = '<div class="empty">' + escapeHtml(t('me.noJoined')) + '</div>';
    else myJoined.innerHTML = joined.map(poolCardHTML).join('');
  }

  /** 我的页：无感会话状态 + 会话账户 gas 余额 */
  async function renderSessionStatus() {
    const el = $('#sessStateText');
    const gasEl = $('#sessGasText');
    const btn = $('#btnSessionMe');
    if (!el || !btn) return;

    if (!K.wallet.address) {
      el.textContent = t('sessStatus.notConnected');
      el.className = 'v off';
      gasEl.textContent = t('sessStatus.connectHint');
      gasEl.className = 'hint';
      btn.textContent = t('wallet.connect');
      return;
    }

    if (!sessionEnabled()) {
      el.textContent = t('sessStatus.off');
      el.className = 'v off';
      gasEl.textContent = t('sessStatus.offHint');
      gasEl.className = 'hint';
      btn.textContent = t('sessCard.btnEnable');
      return;
    }

    el.textContent = t('sessStatus.on');
    el.className = 'v on';
    btn.textContent = t('wallet.closeSession');

    // gas 余额：会话账户自己付 gas，用完会静默回退弹钱包，这里提前提醒
    try {
      const raw = await K.getBankUpaxi(window.CJSession.state.sessAddr);
      const paxi = L.fmtPaxi(raw);
      const perOp = Math.max(1, Number(C.defaultGas || 600000) * (C.gasPrice || 0.05));
      const times = Math.floor(Number(raw || 0) / perOp);
      gasEl.textContent = t('sessStatus.gas', { v: paxi, n: times });
      gasEl.className = Number(raw || 0) < 100000 ? 'hint low' : 'hint';
      if (Number(raw || 0) < 100000) {
        gasEl.textContent = t('sessStatus.gasLow', { v: paxi });
      }
    } catch (_) {
      gasEl.textContent = t('sessStatus.gasMissing');
      gasEl.className = 'hint low';
    }
  }

  // ----------------------------- 渲染：管理页 -----------------------------
  function applyAdminVisibility() {
    const tab = $('#tabAdmin');
    if (tab) tab.hidden = !S.isAdmin;
  }

  function renderAdminStatus() {
    const cfg = S.cfg;
    if (!cfg) return;
    $('#adminsStatus').textContent = t('admin.adminList') + '：' + (cfg.admins || []).join(' , ');
    $('#treasuryStatus').textContent = t('admin.treasury') + '：' + cfg.treasury;
    const pausedTag = cfg.paused ? '（' + t('admin.pausedTag') + '）' : '';
    $('#configStatus').textContent = '建池费 ' + L.fmtPaxi(cfg.create_fee_upaxi) + ' · 销毁模式 ' + cfg.burn_mode + ' · 超时 ' + cfg.cancel_timeout + 's ' + pausedTag;
    $('#btnPause').style.display = cfg.paused ? 'none' : '';
    $('#btnResume').style.display = cfg.paused ? '' : 'none';
    const bm = $('#burnMode'); if (bm) bm.value = String(cfg.burn_mode);
    const hint = $('#burnHint');
    if (hint) {
      if (isPAXI()) hint.textContent = 'PAXI 实例：销毁方式固定为「转运营」（模式 0），不可修改。';
      else hint.textContent = '模式 0=转运营；1=销毁（Cw20 走合约 burn）；2=黑洞（需填黑洞地址）。';
    }
    const burnSec = $('#burnMode');
    // PAXI 时禁用 burn 设置
    if (burnSec) burnSec.disabled = isPAXI();
    // 管理员列表
    $('#adminListBox').textContent = (cfg.admins || []).map((a) => shortAddr(a)).join('  ');
  }

  function renderAdmin() {
    const page = $('#page-admin');
    if (!page || page.hidden) return;
    renderAdminStatus();
  }

  // ----------------------------- 池详情弹窗 -----------------------------
  let modalEl = null;
  async function openDetail(id) {
    const raw = S.pools.find((p) => Number(p.id) === Number(id));
    if (!raw) { toast('奖池不存在', 'warn'); return; }
    const v = L.toView(raw);
    // 取参与者（用于判断是否已参与、展示名单）
    let parts = [];
    try { const pr = await L.participants(v.id); if (pr && pr.participants) parts = pr.participants; } catch (_) {}
    const joined = S.addr ? parts.indexOf(S.addr) >= 0 : false;

    // claimable（已领取状态）
    let cl = null;
    if (S.addr && v.statusView === 'drawn') {
      try { cl = await L.claimable(v.id, S.addr); } catch (_) {}
    }

    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = ''
      + '<div class="modal" role="dialog">'
      + '  <h3 class="modal-title">' + escapeHtml(t('pool.id')) + ' #' + v.id + '</h3>'
      + '  <div class="item-top"><span class="st ' + v.statusView + '">' + escapeHtml(v.statusText) + '</span></div>'
      + '  <div class="meta">' + escapeHtml(t('pool.creator')) + '：<span class="copyable" data-copy="' + escapeHtml(v.creator) + '">' + escapeHtml(shortAddr(v.creator)) + '</span></div>'
      + '  <div class="meta">' + escapeHtml(t('pool.each')) + '：<b>' + escapeHtml(v.joinAmount) + '</b> ' + escapeHtml(tokenName()) + '</div>'
      + '  <div class="meta">' + escapeHtml(t('pool.people')) + '：' + v.count + ' / ' + v.maxPeople + '</div>'
      + '  <div class="bar"><i style="width:' + Math.max(0, Math.min(100, Math.round((Number(v.count) / Math.max(1, Number(v.maxPeople))) * 100))) + '%"></i></div>'
      + '  <div class="meta">' + escapeHtml(t('pool.pool')) + '：<b>' + escapeHtml(v.total) + '</b> ' + escapeHtml(tokenName()) + '</div>'
      + '  <div class="meta">' + escapeHtml(t('pool.expires')) + '：<span class="' + ((v.expired && v.statusView === 'open') ? 'left soon' : 'left') + '">' + escapeHtml(v.expiresText) + '</span></div>'
      + '  <div id="modalActions"></div>'
      + '  <div id="modalWin"></div>'
      + '  <div id="modalDist"></div>'
      + '  <details class="collapse"><summary>' + escapeHtml(t('pool.participants')) + '（' + parts.length + '）</summary><div class="participants">' + (parts.length ? parts.map((a) => '<div class="meta">' + escapeHtml(shortAddr(a)) + (a === S.addr ? ' · 我' : '') + '</div>').join('') : escapeHtml(t('common.empty'))) + '</div></details>'
      + '  <div class="acts" style="margin-top:14px"><button class="btn ghost sm" data-act="close">' + escapeHtml(t('common.close')) + '</button>'
      + '    <button class="btn ghost sm" data-act="share">' + escapeHtml(t('pool.share')) + '</button></div>'
      + '</div>';

    document.body.appendChild(mask);
    modalEl = mask;

    // 操作区
    renderModalActions(v, joined, cl);
    // 中奖名单
    renderModalWinners(v);
    // 分配明细
    renderModalDist(v);

    mask.addEventListener('click', (e) => {
      if (e.target === mask) closeModal();
      const actEl = e.target.closest('[data-act]');
      if (!actEl) return;
      const act = actEl.getAttribute('data-act');
      if (act === 'close') closeModal();
      else if (act === 'share') sharePool(v.id);
      else if (act === 'join') doJoin(v);
      else if (act === 'draw') doDraw(v);
      else if (act === 'refund') doRefund(v);
      else if (act === 'claimPrize') doClaim('prize', v);
      else if (act === 'claimCreator') doClaim('creator', v);
      else if (act === 'claimOps') doClaim('ops', v);
      else if (act === 'claimBurn') doClaim('burn', v);
    });
    // 复制地址
    mask.querySelectorAll('[data-copy]').forEach((el) => el.addEventListener('click', () => copyText(el.getAttribute('data-copy'))));
  }

  function renderModalActions(v, joined, cl) {
    const box = $('#modalActions');
    if (!box) return;
    let html = '';
    const needWallet = !S.addr;
    if (v.statusView === 'open' && !v.isFull) {
      if (needWallet) html += '<div class="hint">' + escapeHtml(t('pool.needWalletToJoin')) + '</div>';
      else if (joined) html += '<div class="hint">' + escapeHtml(t('pools.joined')) + ' ✓</div>';
      else html += '<button class="claim-btn" data-act="join">' + escapeHtml(t('pool.joined')) + ' · ' + escapeHtml(v.joinAmount) + ' ' + escapeHtml(tokenName()) + '</button>';
    } else if (v.isFull && v.statusView !== 'drawn' && v.statusView !== 'expired') {
      html += '<button class="btn primary block" data-act="draw">' + escapeHtml(t('pool.drawBtn')) + '</button>';
      html += '<div class="hint">' + escapeHtml(t('pool.drawHint')) + '</div>';
    } else if (v.statusView === 'expired') {
      if (joined) html += '<button class="btn block" data-act="refund">' + escapeHtml(t('pool.refundBtn')) + '</button>';
      else html += '<div class="hint">' + escapeHtml(t('pool.expiredHint')) + '</div>';
    } else if (v.statusView === 'drawn') {
      html += renderModalClaimButtons(v, cl);
    }
    box.innerHTML = html;
  }

  function renderModalClaimButtons(v, cl) {
    if (!S.addr) return '<div class="hint">' + escapeHtml(t('pool.needWalletToJoin')) + '</div>';
    let h = '';
    const treasury = S.cfg ? S.cfg.treasury : (C.treasury || '');
    // 一等奖
    if (v.winners && v.winners.first === S.addr) {
      const claimed = cl ? !!cl.prize_claimed : false;
      h += claimBtn('claimPrize', v.first, 'prizeFirst', claimed);
    }
    // 二等奖
    if (v.winners && Array.isArray(v.winners.second) && v.winners.second.indexOf(S.addr) >= 0) {
      const claimed = cl ? !!cl.prize_claimed : false;
      h += claimBtn('claimPrize', v.secondEach, 'prizeSecond', claimed);
    }
    // 建池奖励
    if (v.creator === S.addr) {
      const claimed = cl ? !!cl.creator_claimed : false;
      h += claimBtn('claimCreator', v.creator, 'creator', claimed);
    }
    // 运营奖励
    if (treasury && S.addr === treasury) {
      const claimed = cl ? !!cl.ops_claimed : false;
      h += claimBtn('claimOps', v.ops, 'ops', claimed);
    }
    // 销毁 / 转运营（任何人可触发）
    const burnClaimed = cl ? !!cl.burn_claimed : false;
    h += claimBtn('claimBurn', v.burn, 'burn', burnClaimed);
    return h;
  }

  function claimBtn(act, amountRaw, kind, claimed) {
    const labelKey = kind === 'prizeFirst' ? 'claim.prizeFirst'
      : kind === 'prizeSecond' ? 'claim.prizeSecond'
      : kind === 'creator' ? 'claim.creator'
      : kind === 'ops' ? 'claim.ops'
      : 'claim.burn';
    if (claimed) {
      return '<button class="btn block" disabled>' + escapeHtml(t('claim.claimed')) + '</button>';
    }
    const amt = L.fmtToken(amountRaw);
    return '<button class="claim-btn' + (kind === 'prizeSecond' ? ' second' : '') + '" data-act="' + act + '">'
      + escapeHtml(t(labelKey)) + ' · ' + escapeHtml(amt) + ' ' + escapeHtml(tokenName()) + '</button>';
  }

  function renderModalWinners(v) {
    const box = $('#modalWin');
    if (!box) return;
    if (v.statusView !== 'drawn' || !v.winners) { box.innerHTML = ''; return; }
    const w = v.winners;
    const row = (medal, addr, me, amt) =>
      '<div class="winner ' + (me ? 'me ' : '') + (medal === '🥇' ? 'first' : 'second') + '">'
      + '<span class="medal">' + medal + '</span><span class="copyable" data-copy="' + escapeHtml(addr) + '">' + escapeHtml(shortAddr(addr)) + (me ? ' <span class="me-tag">我</span>' : '') + '</span>'
      + '<span class="amt">' + escapeHtml(L.fmtToken(amt)) + ' ' + escapeHtml(tokenName()) + '</span></div>';
    let html = '<div class="winners-box"><div class="winners-title">' + escapeHtml(t('pool.winners')) + '</div>';
    html += row('🥇', w.first, w.first === S.addr, v.firstRaw);
    if (Array.isArray(w.second)) w.second.forEach((a) => { html += row('🥈', a, a === S.addr, v.secondEachRaw); });
    html += '</div>';
    box.innerHTML = html;
    box.querySelectorAll('[data-copy]').forEach((el) => el.addEventListener('click', () => copyText(el.getAttribute('data-copy'))));
  }

  function renderModalDist(v) {
    const box = $('#modalDist');
    if (!box) return;
    if (v.statusView !== 'drawn' || !v.payout) { box.innerHTML = ''; return; }
    const dist = (name, amt, pct) =>
      '<div class="meta dist"><span class="d-name">' + escapeHtml(name) + '</span>'
      + '<span class="amt">' + escapeHtml(L.fmtToken(amt)) + ' ' + escapeHtml(tokenName()) + '</span>'
      + '<span class="pct">' + escapeHtml(pct) + '</span></div>';
    box.innerHTML = '<details class="draw-detail"><summary>' + escapeHtml(t('pool.dist')) + '</summary>'
      + dist(t('pool.distFirst'), v.firstRaw, '38%')
      + dist(t('pool.distSecond'), v.secondEachRaw, '14% ×2')
      + dist(t('pool.distCreator'), v.creatorRaw, '14%')
      + dist(t('pool.distOps'), v.opsRaw, '14%')
      + dist(t('pool.distBurn'), v.burnRaw, '6%')
      + '<div class="meta dist total"><span class="d-name">' + escapeHtml(t('pool.distTotal')) + '</span><span class="amt">' + escapeHtml(v.total) + ' ' + escapeHtml(tokenName()) + '</span></div>'
      + '</details>';
  }

  function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }

  function sharePool(id) {
    const url = location.origin + location.pathname + '?pool=' + id;
    copyText(url);
  }

  // ----------------------------- 交易动作 -----------------------------
  async function doJoin(v) {
    if (!S.addr) { toast(t('pool.needWalletToJoin'), 'warn'); return; }
    if (S.busy) return;
    // 参与费从合约内部余额扣：余额不足时引导去「我的」页充值
    if (S.balInt != null && BigInt(S.balInt) < BigInt(v.joinAmountRaw)) {
      toast(t('err.needDeposit', { need: L.fmtToken(v.joinAmountRaw), have: L.fmtToken(S.balInt) }), 'warn');
      switchTab('me');
      return;
    }
    setBusy(true);
    try {
      await L.join(v.id, v.joinAmountRaw);
      toast(I && I.getLang() === 'en' ? 'Joined' : '参与成功', 'info');
      closeModal();
      await refreshAll();
    } catch (e) {
      toast(friendlyError(e), 'err');
      log('参与失败：' + (e && e.message));
    } finally { setBusy(false); }
  }

  async function doDraw(v) {
    if (!S.addr) { toast(t('pool.needWalletToDraw'), 'warn'); return; }
    if (S.busy) return;
    setBusy(true);
    try {
      await L.draw(v.id);
      toast('开奖成功', 'info');
      closeModal();
      await refreshAll();
    } catch (e) { toast(friendlyError(e), 'err'); log('开奖失败：' + (e && e.message)); }
    finally { setBusy(false); }
  }

  async function doRefund(v) {
    if (S.busy) return;
    setBusy(true);
    try {
      await L.refund(v.id);
      toast('退款成功', 'info');
      closeModal();
      await refreshAll();
    } catch (e) { toast(friendlyError(e), 'err'); log('退款失败：' + (e && e.message)); }
    finally { setBusy(false); }
  }

  async function doClaim(kind, v) {
    if (S.busy) return;
    setBusy(true);
    try {
      if (kind === 'prize') await L.claimPrize(v.id);
      else if (kind === 'creator') await L.claimCreator(v.id);
      else if (kind === 'ops') await L.claimOps(v.id);
      else if (kind === 'burn') await L.claimBurn(v.id);
      toast(t('claim.done'), 'info');
      closeModal();
      await refreshAll();
    } catch (e) { toast(friendlyError(e), 'err'); log('领取失败：' + (e && e.message)); }
    finally { setBusy(false); }
  }

  // ----------------------------- 创建 -----------------------------
  function updateCreateEstimate() {
    const mp = Number($('#inpPeople').value) || 0;
    const amt = $('#inpJoin').value;
    $('#costCreate').textContent = L.fmtPaxi(cfgFee());
    let raw = '0';
    try { raw = L.toRaw(amt || '0'); } catch (_) {}
    let poolTotal = '0', first = '0';
    try {
      const mpn = BigInt(mp || 0);
      const rn = BigInt(raw || '0');
      const tot = (mpn * rn).toString();
      poolTotal = L.fmtToken(tot);
      first = L.fmtToken((rn * 3800n / 10000n).toString());
    } catch (_) {}
    $('#costPool').textContent = poolTotal + ' ' + tokenName();
    $('#costFirst').textContent = first + ' ' + tokenName();
  }

  async function doCreate() {
    if (!S.addr) { toast(t('create.needWallet'), 'warn'); return; }
    if (S.isAdmin) { toast(t('create.adminForbidden'), 'warn'); return; }
    if (S.busy) return;
    const mp = Number($('#inpPeople').value);
    const amt = $('#inpJoin').value;
    if (!mp || mp < cfgMin() || mp > cfgMax()) {
      toast(t('err.invalidPeople', { min: cfgMin(), max: cfgMax() }), 'warn'); return;
    }
    let raw;
    try { raw = L.toRaw(amt); } catch (_) { raw = '0'; }
    if (BigInt(raw) < BigInt(cfgMinJoin()) || BigInt(raw) > BigInt(cfgMaxJoin())) {
      toast(t('err.invalidAmount', { min: L.fmtToken(cfgMinJoin()), max: L.fmtToken(cfgMaxJoin()) }), 'warn'); return;
    }
    // 建池费从内部原生 upaxi 扣：余额不足时引导去「我的」页充值
    const feeBal = isPAXI() ? S.balInt : S.balIntPaxi;
    if (feeBal != null && BigInt(feeBal) < BigInt(cfgFee())) {
      toast(t('err.needDepositFee', { need: L.fmtPaxi(cfgFee()), have: L.fmtPaxi(feeBal) }), 'warn');
      switchTab('me');
      return;
    }
    setBusy(true);
    try {
      await L.createPool(mp, amt, cfgFee());
      toast(t('create.done'), 'info');
      await refreshAll();
      switchTab('pools');
    } catch (e) { toast(friendlyError(e), 'err'); log('建池失败：' + (e && e.message)); }
    finally { setBusy(false); }
  }

  // ----------------------------- 管理动作 -----------------------------
  async function adminSetTreasury() {
    const v = $('#inpTreasury').value.trim();
    if (!v) return;
    if (S.busy) return; setBusy(true);
    try { await L.updateConfig({ treasury: v }); toast(t('admin.updated'), 'info'); await refreshAll(); }
    catch (e) { toast(friendlyError(e), 'err'); } finally { setBusy(false); }
  }
  async function adminSetFee() {
    const v = Number($('#inpFee').value);
    if (!v) return;
    if (S.busy) return; setBusy(true);
    try { await L.updateConfig({ create_fee_upaxi: String(Math.round(v * (C.coinDecimals ? 10 ** C.coinDecimals : 1e6))) }); toast(t('admin.updated'), 'info'); await refreshAll(); }
    catch (e) { toast(friendlyError(e), 'err'); } finally { setBusy(false); }
  }
  async function adminSetTimeout() {
    const v = Number($('#inpTimeout').value);
    if (!v) return;
    if (S.busy) return; setBusy(true);
    try { await L.updateConfig({ cancel_timeout: String(v) }); toast(t('admin.updated'), 'info'); await refreshAll(); }
    catch (e) { toast(friendlyError(e), 'err'); } finally { setBusy(false); }
  }
  async function adminApplyBurn() {
    const v = Number($('#burnMode').value);
    if (isPAXI()) { toast('PAXI 实例不可修改销毁方式', 'warn'); return; }
    if (S.busy) return; setBusy(true);
    try {
      const fields = { burn_mode: v };
      if (v === 2) {
        const addr = $('#inpBurnAddr').value.trim();
        if (!addr) { toast('模式 2 需要黑洞地址', 'warn'); setBusy(false); return; }
        fields.burn_address = addr;
      }
      await L.updateConfig(fields); toast(t('admin.updated'), 'info'); await refreshAll();
    } catch (e) { toast(friendlyError(e), 'err'); } finally { setBusy(false); }
  }
  async function adminUpdateAdmin(kind) {
    const inp = kind === 'add' ? $('#inpAddAdmin') : $('#inpRmAdmin');
    const v = inp.value.trim();
    if (!v) return;
    if (S.busy) return; setBusy(true);
    try {
      if (kind === 'add') await L.updateAdmin([v], []);
      else await L.updateAdmin([], [v]);
      toast(t('admin.updated'), 'info'); await refreshAll();
    } catch (e) { toast(friendlyError(e), 'err'); } finally { setBusy(false); }
  }
  async function adminPause() {
    if (S.busy) return; setBusy(true);
    try { await L.pause(); toast(t('admin.updated'), 'info'); await refreshAll(); }
    catch (e) { toast(friendlyError(e), 'err'); } finally { setBusy(false); }
  }
  async function adminResume() {
    if (S.busy) return; setBusy(true);
    try { await L.resume(); toast(t('admin.updated'), 'info'); await refreshAll(); }
    catch (e) { toast(friendlyError(e), 'err'); } finally { setBusy(false); }
  }

  // ----------------------------- Tab 切换 -----------------------------
  function currentTab() { const a = $('.tab.active'); return a ? a.getAttribute('data-tab') : 'pools'; }
  function switchTab(tab) {
    $$('.tab').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
    $$('.page').forEach((p) => { p.hidden = (p.id !== 'page-' + tab); });
    if (tab === 'me') renderMe();
    if (tab === 'admin') renderAdmin();
    if (tab === 'create') updateCreateEstimate();
  }

  // ----------------------------- 事件绑定 -----------------------------
  function bind() {
    $('#btnConnect').addEventListener('click', connectWallet);
    $('#btnLang').addEventListener('click', () => { if (I) I.setLang(I.getLang() === 'en' ? 'zh' : 'en'); });
    $('#btnRefresh').addEventListener('click', refreshAll);
    $('#fStatus').addEventListener('change', renderPools);

    // 我的页：待领奖 / 我建的池 / 我参与的池 手风琴——点一个展开一个，收起其他
    $$('#page-me details.me-sec').forEach((d) => {
      d.addEventListener('toggle', () => {
        if (d.open) $$('#page-me details.me-sec').forEach((o) => { if (o !== d) o.open = false; });
      });
    });

    // 无感会话（顶栏 / 引导卡 / 我的页，同一动作）
    $('#btnSession').addEventListener('click', doSessionToggle);
    $('#btnSessionCard').addEventListener('click', doSessionToggle);
    $('#btnSessionMe').addEventListener('click', doSessionToggle);
    // 充值 / 提现
    $('#btnDeposit').addEventListener('click', doDeposit);
    $('#btnWithdraw').addEventListener('click', doWithdraw);

    $$('.tab').forEach((b) => b.addEventListener('click', () => switchTab(b.getAttribute('data-tab'))));

    // 列表点击（奖池 / 待领奖）
    ['#list', '#claimsTopList', '#myCreated', '#myJoined', '#myClaims'].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('click', (e) => {
        const card = e.target.closest('[data-id]');
        if (!card) return;
        const act = e.target.closest('[data-act]');
        if (act && act.getAttribute('data-act') === 'detail') openDetail(card.getAttribute('data-id'));
      });
    });

    // 创建页
    $('#btnCreate').addEventListener('click', doCreate);
    $('#inpPeople').addEventListener('input', updateCreateEstimate);
    $('#inpJoin').addEventListener('input', updateCreateEstimate);

    // 管理页
    $('#btnPause').addEventListener('click', adminPause);
    $('#btnResume').addEventListener('click', adminResume);
    $('#btnSetTreasury').addEventListener('click', adminSetTreasury);
    $('#btnSetFee').addEventListener('click', adminSetFee);
    $('#btnSetTimeout').addEventListener('click', adminSetTimeout);
    $('#btnApplyBurn').addEventListener('click', adminApplyBurn);
    $('#btnAddAdmin').addEventListener('click', () => adminUpdateAdmin('add'));
    $('#btnRmAdmin').addEventListener('click', () => adminUpdateAdmin('remove'));

    // 语言切换后重渲染当前页
    window.addEventListener('i18n-changed', () => {
      if (I) I.apply();
      renderPools();
      renderSessionCard();
      const tab = currentTab();
      if (tab === 'me') renderMe();
      if (tab === 'admin') renderAdmin();
      if (tab === 'create') updateCreateEstimate();
    });

    // 可见性变化暂停轮询
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && S.loaded) refreshAll();
    });

    // 深度链接 ?pool=ID 自动打开详情
    const q = new URLSearchParams(location.search);
    const pid = q.get('pool');
    if (pid) setTimeout(() => openDetail(pid), 600);
  }

  // ----------------------------- 启动 -----------------------------
  async function boot() {
    if (I) I.apply();
    if (L) await L.refreshToken().catch(() => {});
    bind();
    updateCreateEstimate();
    // 静默尝试连接（在 PaxiHub 内通常已注入钱包）
    try {
      if (K.hasWallet && (await K.waitForWallet(1500))) {
        try {
          const addr = await K.connect();
          await afterConnect(addr);
        } catch (_) {}
      }
    } catch (_) {}
    renderSessionCard();
    // 首次加载
    refreshAll();
    // 轮询
    const iv = (C.pollInterval || 10000);
    setInterval(() => { if (!document.hidden && !refreshing) refreshAll(); }, iv);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
