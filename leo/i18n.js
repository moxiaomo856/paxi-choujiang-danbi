/* =====================================================================
 * i18n.js —— 中英语言包 + 语言切换
 *
 *   window.CJ_I18N.t(key, params)   取词（缺失回退 key，再回退 zh）
 *   window.CJ_I18N.getLang() / setLang('zh'|'en')
 *   window.CJ_I18N.apply(root)      把 [data-i18n] / [data-i18n-placeholder] 刷成当前语言
 *
 * 语言包里 {token} 会被替换成 config.tokenName（见 localizeTokenName）。
 * 语言选择存 localStorage，键名带站点命名空间（同 origin 六站互不干扰）。
 * ===================================================================== */
(function () {
  const C = window.CJ_CONFIG || {};
  const NS = C.storageNs || 'root';
  const LS_LANG = 'cj_lang__' + NS;

  const zh = {
    'common.refresh': '刷新',
    'common.loading': '加载中…',
    'common.empty': '暂无数据',
    'common.copy': '点击复制',
    'common.copied': '已复制',
    'common.copyFail': '复制失败，请长按手动选择',
    'common.close': '关闭',
    'common.cancel': '取消',
    'common.confirm': '确认',
    'common.all': '全部',
    'common.back': '返回',
    'common.tierLocked': '当前合约不支持该档位',

    'wallet.notConnected': '未连接',
    'wallet.connect': '连接钱包',
    'wallet.connecting': '连接中…',

    'nav.tabPools': '奖池',
    'nav.tabCreate': '建池',
    'nav.tabMe': '钱包',
    'nav.tabAdmin': '管理',

    'status.open': '报名中',
    'status.full': '已满员',
    'status.drawn': '已开奖',
    'status.expired': '已过期',

    'banner.notDeployed': '本站奖池合约尚未部署，敬请期待。',
    'banner.needWallet': '未检测到 PaxiHub 钱包。请在 PaxiHub App 内置浏览器打开本页面。',

    'pools.filter.ongoing': '进行中',
    'pools.filter.all': '全部（含已结束）',
    'pools.filter.open': '报名中',
    'pools.filter.full': '已满员',
    'pools.filter.drawn': '已开奖',
    'pools.filter.expired': '已过期',
    'pools.claimsTitle': '🎁 待领奖',
    'pools.empty': '暂无奖池，去「建池」开一个吧',
    'pools.hot': '火热',
    'pools.closing': '即将截止',
    'pools.justFull': '刚满员',
    'pools.joined': '已参与',
    'pools.mine': '我建的',
    'pools.expectedFirst': '预计一等奖',

    'pool.joined': '参与',
    'pool.id': '奖池',
    'pool.creator': '建池者',
    'pool.each': '每人',
    'pool.people': '人数',
    'pool.count': '参与',
    'pool.pool': '总奖池',
    'pool.progress': '进度',
    'pool.expires': '截止',
    'pool.left': '剩余',
    'pool.drawBtn': '开奖',
    'pool.refundBtn': '退款',
    'pool.detailBtn': '详情',
    'pool.share': '分享',
    'pool.participants': '参与者',
    'pool.winners': '中奖名单',
    'pool.dist': '奖金分配',
    'pool.distFirst': '一等奖（1 名）',
    'pool.distSecond': '二等奖（2 名，各）',
    'pool.distCreator': '建池者',
    'pool.distOps': '运营',
    'pool.distBurn': '销毁 / 运营',
    'pool.distTotal': '合计',
    'pool.drawHint': '满员后任何人可触发开奖',
    'pool.drawnAt': '已开奖',
    'pool.needWalletToJoin': '请先连接钱包再参与',
    'pool.needWalletToDraw': '请先连接钱包再开奖',
    'pool.fullWaiting': '已满员，等待开奖',
    'pool.openWaiting': '正在报名中',
    'pool.expiredHint': '已过期，未满员，可退款',
    'pool.noWinners': '尚无中奖者',

    'claim.prize': '领取奖金',
    'claim.prizeFirst': '恭喜中了一等奖！',
    'claim.prizeSecond': '恭喜中了二等奖！',
    'claim.creator': '领取建池奖励',
    'claim.ops': '领取运营奖励',
    'claim.burn': '处理销毁 / 转运营',
    'claim.claimed': '已领取',
    'claim.youCanGet': '可领',
    'claim.notWon': '本期未中奖，下期再战',
    'claim.done': '领取成功',

    'create.title': '建池参数',
    'create.people': '人数上限',
    'create.peoplePh': '5 ~ 200',
    'create.joinAmount': '每份参与费（{token}）',
    'create.joinAmountPh': '5 ~ 150000',
    'create.fee': '建池费（upaxi）',
    'create.estPool': '满员总奖池',
    'create.estFirst': '预计一等奖',
    'create.btn': '建池并支付建池费',
    'create.hint': '建池费全额进入奖池并转运营；满员后任何人可触发开奖。',
    'create.needWallet': '请先连接钱包再建池',
    'create.adminForbidden': '管理员 / 运营地址不能建池',
    'create.done': '建池成功',

    'me.title': '钱包',
    'me.walletBal': '链上 {token}',
    'me.paxiBal': '链上 PAXI',
    'me.balAddr': '我的地址',
    'me.claims': '🎁 待领奖',
    'me.created': '🏗️ 我建的池',
    'me.joined': '🎯 我参与的池',
    'me.noClaims': '暂无待领奖',
    'me.noCreated': '还没建过池',
    'me.noJoined': '还没参与过',

    // ---- 无感会话 ----
    'wallet.openSession': '开无感',
    'wallet.closeSession': '关无感',
    'wallet.sessionTag': '无感',
    'wallet.home': '门户',
    'sessCard.titleEnable': '开启「无感」',
    'sessCard.descEnable': '开启后建池 / 参与 / 领取不用弹钱包（24 小时有效）',
    'sessCard.titleConnect': '请先连接钱包',
    'sessCard.descConnect': '连接后才能参与抽奖',
    'sessCard.btnEnable': '立即开启',
    'sessCard.btnConnect': '连接',
    'sessStatus.label': '无感会话',
    'sessStatus.off': '未开启',
    'sessStatus.on': '已开启（24 小时）',
    'sessStatus.offHint': '开启后建池 / 参与 / 领取不用弹钱包（24 小时有效）',
    'sessStatus.connectHint': '连接钱包后可开启',
    'sessStatus.gas': '会话 gas：{v} PAXI（约 {n} 次操作）',
    'sessStatus.gasLow': '会话 gas 仅剩 {v} PAXI，建议「关闭」后重新开启补充',
    'sessStatus.gasMissing': '会话账户未初始化（gas 未到账）',
    'sessStatus.notConnected': '未连接',
    'msg.sessionClosed': '已关闭无感',
    'msg.sessionSwept': '已退回剩余 gas {v} PAXI',
    'msg.sessionOpened': '无感已开启：{addr}',

    // ---- 内部余额 / 充值提现 ----
    'me.intBalTitle': '💰 合约内部余额',
    'me.intBal': '内部 {token}',
    'me.intBalPaxi': '内部 PAXI',
    'me.walletTitle': '👛 链上钱包',
    'me.depositWithdraw': '充值 / 提现',
    'me.amount': '数量',
    'me.deposit': '充值',
    'me.withdraw': '提现',
    'me.depositHint': '充值进合约内部余额后，建池 / 参与 / 领取才能扣款；提现会回到链上钱包地址。',
    'msg.depositOk': '充值成功：+{a} {token}',
    'msg.withdrawOk': '提现成功：-{a} {token}',

    'admin.title': '管理员操作',
    'admin.onlyAdmin': '仅管理员地址可见本页',
    'admin.opsConfig': '运营配置',
    'admin.treasury': '运营金库',
    'admin.setTreasury': '修改运营金库',
    'admin.setTreasuryBtn': '写入',
    'admin.fee': '建池费',
    'admin.setFee': '修改建池费（upaxi）',
    'admin.setFeeBtn': '写入',
    'admin.burnMode': '销毁方式（非 PAXI 的 6%）',
    'admin.burn0': '0 · 转运营',
    'admin.burn1': '1 · 销毁',
    'admin.burn2': '2 · 黑洞',
    'admin.applyBurnMode': '应用销毁方式',
    'admin.burnAddr': '黑洞地址（仅模式 2 / Native 销毁需要）',
    'admin.setBurnAddr': '设置黑洞地址',
    'admin.cancelTimeout': '超时秒数',
    'admin.setTimeoutBtn': '写入',
    'admin.adminList': '管理员',
    'admin.addAdmin': '新增管理员地址',
    'admin.removeAdmin': '移除管理员地址',
    'admin.updateAdminBtn': '更新管理员',
    'admin.pause': '暂停合约',
    'admin.resume': '恢复合约',
    'admin.pausedTag': '已暂停',
    'admin.updated': '已提交',

    'err.noContract': '合约地址未配置（config.js）',
    'err.invalidPeople': '人数需在 {min} ~ {max} 之间',
    'err.invalidAmount': '参与费需在 {min} ~ {max} 之间',
    'err.notFull': '尚未满员，无法开奖',
    'err.txFail': '交易失败',
    'err.invalidAmountInput': '请输入正确的数量',
    'err.insufficientInternal': '内部余额不足',
    'err.needDeposit': '内部余额不足：需 {need}，当前 {have}。请先到「我的」页充值',
    'err.needDepositFee': '内部 PAXI 不足以支付建池费：需 {need}，当前 {have}。请先到「我的」页充值',
  };

  const en = {
    'common.refresh': 'Refresh',
    'common.loading': 'Loading…',
    'common.empty': 'No data',
    'common.copy': 'Tap to copy',
    'common.copied': 'Copied',
    'common.copyFail': 'Copy failed, long-press to select',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.all': 'All',
    'common.back': 'Back',
    'common.tierLocked': 'Tier not supported by this contract',

    'wallet.notConnected': 'Not connected',
    'wallet.connect': 'Connect',
    'wallet.connecting': 'Connecting…',

    'nav.tabPools': 'Pools',
    'nav.tabCreate': 'Create',
    'nav.tabMe': 'Wallet',
    'nav.tabAdmin': 'Admin',

    'status.open': 'Open',
    'status.full': 'Full',
    'status.drawn': 'Drawn',
    'status.expired': 'Expired',

    'banner.notDeployed': 'This lottery contract is not deployed yet.',
    'banner.needWallet': 'PaxiHub wallet not detected. Please open this page inside the PaxiHub app.',

    'pools.filter.ongoing': 'Ongoing',
    'pools.filter.all': 'All',
    'pools.filter.open': 'Open',
    'pools.filter.full': 'Full',
    'pools.filter.drawn': 'Drawn',
    'pools.filter.expired': 'Expired',
    'pools.claimsTitle': '🎁 To claim',
    'pools.empty': 'No pools yet — create one',
    'pools.hot': 'Hot',
    'pools.closing': 'Closing',
    'pools.justFull': 'Just full',
    'pools.joined': 'Joined',
    'pools.mine': 'Mine',
    'pools.expectedFirst': 'Est. 1st prize',

    'pool.joined': 'Join',
    'pool.id': 'Pool',
    'pool.creator': 'Creator',
    'pool.each': 'Each',
    'pool.people': 'People',
    'pool.count': 'Joined',
    'pool.pool': 'Total pool',
    'pool.progress': 'Progress',
    'pool.expires': 'Ends',
    'pool.left': 'Left',
    'pool.drawBtn': 'Draw',
    'pool.refundBtn': 'Refund',
    'pool.detailBtn': 'Detail',
    'pool.share': 'Share',
    'pool.participants': 'Participants',
    'pool.winners': 'Winners',
    'pool.dist': 'Distribution',
    'pool.distFirst': '1st prize (1)',
    'pool.distSecond': '2nd prize (2 ×)',
    'pool.distCreator': 'Creator',
    'pool.distOps': 'Ops',
    'pool.distBurn': 'Burn / Ops',
    'pool.distTotal': 'Total',
    'pool.drawHint': 'Anyone can trigger the draw once full',
    'pool.drawnAt': 'Drawn',
    'pool.needWalletToJoin': 'Connect wallet to join',
    'pool.needWalletToDraw': 'Connect wallet to draw',
    'pool.fullWaiting': 'Full, waiting for draw',
    'pool.openWaiting': 'Open for entry',
    'pool.expiredHint': 'Expired (not full) — refundable',
    'pool.noWinners': 'No winners yet',

    'claim.prize': 'Claim prize',
    'claim.prizeFirst': 'You won the 1st prize!',
    'claim.prizeSecond': 'You won the 2nd prize!',
    'claim.creator': 'Claim creator reward',
    'claim.ops': 'Claim ops reward',
    'claim.burn': 'Process burn / ops',
    'claim.claimed': 'Claimed',
    'claim.youCanGet': 'You get',
    'claim.notWon': 'No luck this round',
    'claim.done': 'Claimed',

    'create.title': 'Pool parameters',
    'create.people': 'Max people',
    'create.peoplePh': '5 ~ 200',
    'create.joinAmount': 'Entry fee ({token})',
    'create.joinAmountPh': '5 ~ 150000',
    'create.fee': 'Create fee (upaxi)',
    'create.estPool': 'Full pool total',
    'create.estFirst': 'Est. 1st prize',
    'create.btn': 'Create & pay fee',
    'create.hint': 'The create fee goes into the pool and to ops; anyone can draw once full.',
    'create.needWallet': 'Connect wallet to create',
    'create.adminForbidden': 'Admin / treasury cannot create',
    'create.done': 'Pool created',

    'me.title': 'Wallet',
    'me.walletBal': 'On-chain {token}',
    'me.paxiBal': 'On-chain PAXI',
    'me.balAddr': 'My address',
    'me.claims': '🎁 To claim',
    'me.created': '🏗️ Created',
    'me.joined': '🎯 Joined',
    'me.noClaims': 'Nothing to claim',
    'me.noCreated': 'No pools created',
    'me.noJoined': 'No pools joined',

    // ---- Session ----
    'wallet.openSession': 'Enable',
    'wallet.closeSession': 'Disable',
    'wallet.sessionTag': 'Auto',
    'wallet.home': 'Hub',
    'sessCard.titleEnable': 'Enable "seamless mode"',
    'sessCard.descEnable': 'Create / join / claim without wallet popups (valid 24h)',
    'sessCard.titleConnect': 'Connect your wallet first',
    'sessCard.descConnect': 'Connect to join lotteries',
    'sessCard.btnEnable': 'Enable now',
    'sessCard.btnConnect': 'Connect',
    'sessStatus.label': 'Seamless session',
    'sessStatus.off': 'Off',
    'sessStatus.on': 'On (24 hours)',
    'sessStatus.offHint': 'Enable to skip wallet popups for create / join / claim',
    'sessStatus.connectHint': 'Connect wallet to enable',
    'sessStatus.gas': 'Session gas: {v} PAXI (~{n} ops)',
    'sessStatus.gasLow': 'Session gas low: {v} PAXI. Disable & re-enable to top up',
    'sessStatus.gasMissing': 'Session account not initialized (gas missing)',
    'sessStatus.notConnected': 'Not connected',
    'msg.sessionClosed': 'Seamless mode disabled',
    'msg.sessionSwept': 'Swept back {v} PAXI remaining gas',
    'msg.sessionOpened': 'Seamless mode enabled: {addr}',

    // ---- Internal balance / deposit & withdraw ----
    'me.intBalTitle': '💰 In-contract balance',
    'me.intBal': 'Internal {token}',
    'me.intBalPaxi': 'Internal PAXI',
    'me.walletTitle': '👛 On-chain wallet',
    'me.depositWithdraw': 'Deposit / Withdraw',
    'me.amount': 'Amount',
    'me.deposit': 'Deposit',
    'me.withdraw': 'Withdraw',
    'me.depositHint': 'Deposit to the in-contract balance first; create / join / claim debit from it. Withdraw returns to your wallet address.',
    'msg.depositOk': 'Deposited: +{a} {token}',
    'msg.withdrawOk': 'Withdrawn: -{a} {token}',

    'admin.title': 'Admin',
    'admin.onlyAdmin': 'Visible to admin addresses only',
    'admin.opsConfig': 'Ops config',
    'admin.treasury': 'Treasury',
    'admin.setTreasury': 'Set treasury',
    'admin.setTreasuryBtn': 'Write',
    'admin.fee': 'Create fee',
    'admin.setFee': 'Set create fee (upaxi)',
    'admin.setFeeBtn': 'Write',
    'admin.burnMode': 'Burn mode (6% of non-PAXI)',
    'admin.burn0': '0 · To treasury',
    'admin.burn1': '1 · Burn',
    'admin.burn2': '2 · Black hole',
    'admin.applyBurnMode': 'Apply burn mode',
    'admin.burnAddr': 'Black-hole address (mode 2 / native burn)',
    'admin.setBurnAddr': 'Set black-hole address',
    'admin.cancelTimeout': 'Timeout (secs)',
    'admin.setTimeoutBtn': 'Write',
    'admin.adminList': 'Admins',
    'admin.addAdmin': 'Add admin address',
    'admin.removeAdmin': 'Remove admin address',
    'admin.updateAdminBtn': 'Update admins',
    'admin.pause': 'Pause',
    'admin.resume': 'Resume',
    'admin.pausedTag': 'Paused',
    'admin.updated': 'Submitted',

    'err.noContract': 'Contract address not configured (config.js)',
    'err.invalidPeople': 'People must be {min} ~ {max}',
    'err.invalidAmount': 'Entry fee must be {min} ~ {max}',
    'err.notFull': 'Not full yet, cannot draw',
    'err.txFail': 'Transaction failed',
    'err.invalidAmountInput': 'Please enter a valid amount',
    'err.insufficientInternal': 'Insufficient internal balance',
    'err.needDeposit': 'Insufficient internal balance: need {need}, have {have}. Deposit on the Me page first',
    'err.needDepositFee': 'Not enough internal PAXI for the create fee: need {need}, have {have}. Deposit on the Me page first',
  };

  const DICT = { zh, en };
  let lang = (function () {
    try { return localStorage.getItem(LS_LANG) || 'zh'; } catch (_) { return 'zh'; }
  })();

  /** 把 {token} 等占位符替换成站点名 */
  function localizeTokenName(s) {
    const tn = C.tokenName || 'PAXI';
    return String(s).replace(/\{token\}/g, tn);
  }

  /** 取词：当前语言 → zh → key */
  function t(key, params) {
    const d = DICT[lang] || zh;
    let s = d[key];
    if (s === undefined) s = zh[key];
    if (s === undefined) s = key;
    s = localizeTokenName(s);
    if (params) {
      for (const k in params) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]));
      }
    }
    return s;
  }

  function getLang() { return lang; }

  function setLang(l) {
    lang = l === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(LS_LANG, lang); } catch (_) {}
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    apply();
    window.dispatchEvent(new Event('i18n-changed'));
  }

  /** 把 root 下所有 [data-i18n] / [data-i18n-placeholder] 刷成当前语言 */
  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    // 语言按钮文案：显示"另一种语言"
    document.querySelectorAll('#btnLang').forEach((el) => {
      el.textContent = lang === 'en' ? '中文' : 'EN';
    });
  }

  // 首次按浏览器语言猜一次（用户没手动选过时）
  try {
    if (!localStorage.getItem(LS_LANG)) {
      const nav = (navigator.language || '').toLowerCase();
      if (nav && !nav.startsWith('zh')) lang = 'en';
    }
  } catch (_) {}

  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';

  window.CJ_I18N = { t, getLang, setLang, apply, localizeTokenName };
})();
