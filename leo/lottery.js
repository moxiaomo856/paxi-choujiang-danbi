/* =====================================================================
 * lottery.js —— 单币抽奖合约调用封装（纯查询 / 交易，不含 UI）
 *
 * 对接合约：paxi-lottery-single（无感签名版）
 *   执行 deposit / withdraw / register_session / revoke_session /
 *        create_pool / join / draw / claim_prize / claim_creator /
 *        claim_ops / claim_burn / refund / update_config / update_admin /
 *        pause / resume
 *   查询 config / pool / pools / participants / winners / payout /
 *        claimable / balance / session
 *
 * 资金模型（与旧直扣版的关键差异）：
 *   · 所有付费 = 从**合约内部余额**扣（先 Deposit 充值，不随交易带 funds）
 *   · 建池费永远用原生 upaxi（内部余额）；参与费用本站代币（内部余额）
 *   · create_pool / join / claim_prize / claim_creator / refund 五个操作
 *     支持无感签名（auth）：开启无感时由 CJSession.signPayload 注入，
 *     未开启时 auth:null、主钱包直签（owner = info.sender）
 *
 * 签名 amount 语义（必须与合约 session.rs 一致）：
 *   create_pool → 建池费；join → 参与费；
 *   claim_prize / claim_creator / refund → "0"（提现语义，不计每日额度）
 *
 * 注意：合约枚举 / 字段名区分大小写（status = "Open" / "Full" / "Drawn" /
 * "Expired"；expires_at 单位为**秒**）。toView 内部统一转小写做 UI 判定，
 * 并 ×1000 转毫秒。
 * ===================================================================== */
(function () {
  const C = window.CJ_CONFIG;
  const K = window.CJChain;
  const ti = (k, p) => (window.CJ_I18N ? window.CJ_I18N.t(k, p) : k);
  const hasI18n = () => !!window.CJ_I18N;
  const t = (k, p) => (hasI18n() ? window.CJ_I18N.t(k, p) : k);

  const isNative = () => C.tokenKind === 'native';

  // 代币精度：native 用 chain 配置；cw20 从代币合约 token_info 动态读取（避免硬编码错配）。
  let tokDecimals = C.tokenDecimals || 6;
  let tokSymbol = C.tokenName || C.coinDenom;

  async function refreshToken() {
    if (isNative()) { tokDecimals = C.coinDecimals; tokSymbol = C.coinDenom; return; }
    const info = await tokenInfo().catch(() => null);
    if (info && info.decimals != null) tokDecimals = info.decimals;
    if (info && info.symbol) tokSymbol = info.symbol;
  }
  const dec = () => tokDecimals;

  // ---------- 查询 ----------
  const config = () => K.queryContract({ config: {} });
  const pool = (id) => K.queryContract({ pool: { pool_id: Number(id) } });
  const pools = (startAfter = null, limit = 30) =>
    K.queryContract({ pools: { start_after: startAfter == null ? null : Number(startAfter), limit } });
  const participants = (id) => K.queryContract({ participants: { pool_id: Number(id) } });
  const winners = (id) => K.queryContract({ winners: { pool_id: Number(id) } });
  const payout = (id) => K.queryContract({ payout: { pool_id: Number(id) } });
  const claimable = (id, address) =>
    K.queryContract({ claimable: { pool_id: Number(id), address } });
  /** 合约内部余额：token=null 查原生 upaxi，token=代币合约地址查 PRC-20 */
  const internalBalance = (address, token) =>
    K.queryContract({ balance: { address, token: token || null } });

  async function tokenInfo() {
    if (isNative()) return { symbol: C.coinDenom, decimals: C.coinDecimals };
    if (!C.tokenContract) return null;
    return K.queryContract({ token_info: {} }, C.tokenContract).catch(() => null);
  }
  /** 本站代币余额：native 查 bank upaxi；cw20 查代币合约 balance（链上钱包里的） */
  async function tokenBalance(addr) {
    if (isNative() || !C.tokenContract || !addr) return null;
    return K.queryContract({ balance: { address: addr } }, C.tokenContract)
      .then((r) => (r && r.balance != null ? r.balance : null))
      .catch(() => null);
  }

  // ---------- 换算 / 格式化 ----------
  const toRaw = (human, d) => K.toRaw(human, d == null ? dec() : d);
  const paxiToRaw = (human) => K.toRaw(human, C.coinDecimals);

  function trimZeros(s) {
    const tt = String(s);
    if (tt.indexOf('.') < 0) return tt;
    return tt.replace(/0+$/, '').replace(/\.$/, '');
  }

  /** 整数个数 → 中文「万」（英文环境用千分位） */
  function fmtWan(count) {
    let n;
    try { n = BigInt(String(Math.trunc(Number(count)) || 0)); } catch (_) { n = 0n; }
    const en = hasI18n() && window.CJ_I18N.getLang() === 'en';
    if (en) return Number(n).toLocaleString('en-US');
    if (n < 10000n) return Number(n).toLocaleString('zh-CN');
    const wan = n / 10000n;
    const rest = n % 10000n;
    if (rest === 0n) return wan.toLocaleString('zh-CN') + '万';
    const frac = rest.toString().padStart(4, '0').slice(0, 2);
    return trimZeros(wan.toLocaleString('zh-CN') + '.' + frac) + '万';
  }

  /** PAXI（upaxi） */
  function fmtPaxi(raw) { return trimZeros(K.fmt(raw, C.coinDecimals)); }

  /** 参与代币：≥1 万走「万」，否则正常显示 */
  function fmtToken(raw, d) {
    const dd = d == null ? dec() : d;
    const full = trimZeros(K.fmt(raw, dd));
    let intPart;
    try { intPart = BigInt(String(raw || '0')) / (10n ** BigInt(dd)); } catch (_) { return full; }
    if (intPart < 10000n) return full;
    return fmtWan(intPart.toString());
  }

  function isNonZeroRaw(x) {
    try {
      const s = String(x == null ? '' : x).trim();
      if (!s) return false;
      return BigInt(s) > 0n;
    } catch (_) { return false; }
  }

  // ---------- 状态文案 ----------
  const statusKeys = { open: 'status.open', full: 'status.full', drawn: 'status.drawn', expired: 'status.expired' };
  function statusText(statusView) {
    const k = statusKeys[statusView] || '';
    return (k && hasI18n()) ? t(k) : (statusView || '');
  }

  // ---------- 展示视图 ----------
  function toView(l) {
    // 合约枚举 / 字段名区分大小写：Open / Full / Drawn / Expired
    const st = (l.status || '').toLowerCase();
    const expiresAt = Number(l.expires_at) * 1000;        // 秒 → 毫秒
    const expired = expiresAt < Date.now();
    // 链上 open 只代表"未开奖"；时间到了没满员也应视为可退款（expired）。
    // full 即使超时仍可开奖（合约 Draw 仅要求 Full），保持 full。
    let statusView;
    if (st === 'expired' || st === 'drawn') statusView = st;
    else if (st === 'open' && expired) statusView = 'expired';
    else statusView = st;                                 // open / full

    const totalRaw = l.total_amount || '0';
    const joinRaw = l.join_amount || '0';
    const po = l.payout || null;
    // 一等奖：已开奖用链上 payout.first（最精确）；未开奖用 38% 预估
    const firstRaw = (po && po.first != null)
      ? String(po.first)
      : ((() => { try { return (BigInt(totalRaw) * 3800n / 10000n).toString(); } catch (_) { return '0'; } })());
    const secondEachRaw = (po && po.second_each != null) ? String(po.second_each) : '0';
    const creatorRaw = (po && po.creator != null) ? String(po.creator) : '0';
    const opsRaw = (po && po.ops != null) ? String(po.ops) : '0';
    const burnRaw = (po && po.burn != null) ? String(po.burn) : '0';

    const isFull = st === 'full' || Number(l.participant_count) >= Number(l.max_people);

    return {
      id: l.id,
      creator: l.creator,
      joinAmountRaw: joinRaw,
      joinAmount: fmtToken(joinRaw),
      maxPeople: l.max_people,
      count: l.participant_count,
      totalRaw,
      total: fmtToken(totalRaw),
      firstRaw, first: fmtToken(firstRaw),
      secondEachRaw, secondEach: fmtToken(secondEachRaw),
      creatorRaw, creator: fmtToken(creatorRaw),
      opsRaw, ops: fmtToken(opsRaw),
      burnRaw, burn: fmtToken(burnRaw),
      status: l.status,
      statusView,
      statusText: statusText(statusView),
      expired,
      isFull,
      expiresAt,
      expiresText: new Date(expiresAt).toLocaleString(
        hasI18n() && window.CJ_I18N.getLang() === 'en' ? 'en-US' : 'zh-CN'
      ),
      winners: l.winners || null,     // { first, second:[2] }
      payout: po,
    };
  }

  // ---------- 交易：充值 / 提现（主钱包，弹一次） ----------
  /** 原生 upaxi 充值（带 funds 进合约内部余额） */
  function depositNative(amountRaw) {
    return K.execute(
      { deposit: {} },
      [{ denom: C.coinMinimalDenom, amount: String(amountRaw) }],
      { gas: 400000, memo: 'deposit paxi' }
    );
  }
  /** PRC-20 充值：调代币合约 send → 合约 Receive hook 入内部余额 */
  function depositToken(amountRaw) {
    const token = C.tokenContract;
    if (!token) throw new Error(t('err.noContract'));
    const hook = K.toBase64(new TextEncoder().encode(JSON.stringify({ deposit: {} })));
    return K.execute(
      { send: { contract: C.contract, amount: String(amountRaw), msg: hook } },
      [],
      { gas: 500000, contract: token, memo: 'deposit token' }
    );
  }
  /** 提现：token=null 原生 upaxi；token=代币合约地址 → PRC-20 */
  function withdraw(token, amountRaw) {
    return K.execute(
      { withdraw: { token: token || null, amount: String(amountRaw) } },
      [],
      { gas: 400000, memo: 'withdraw' }
    );
  }

  // ---------- 交易：建池 / 参与（无感或钱包双路径） ----------
  /**
   * 无感选项按「会话是否开启」动态生成：
   *   · 开启  → { action, roundId, amount }，chain.js 走会话签名路径（注入 auth）
   *   · 未开启 → null，chain.js 走钱包签名路径；消息里 auth:null 反序列化为
   *     None，合约以 info.sender（主钱包）为资金归属者 —— 双路径天然兼容。
   */
  const sessOpt = (action, roundId, amount) => {
    const S = window.CJSession;
    return (S && S.state && S.state.enabled) ? { action, roundId, amount } : null;
  };

  /**
   * 建池：max_people + join_amount。建池费从**内部余额**扣（原生 upaxi），
   * 不随交易带 funds。session 开启时走无感签名（签名金额 = 建池费）。
   */
  function createPool(maxPeople, joinAmountHuman, feeRaw) {
    const raw = toRaw(joinAmountHuman);
    const fee = String(feeRaw || C.createFeeUpaxi);
    const msg = { create_pool: { max_people: Number(maxPeople), join_amount: raw, auth: null } };
    return K.execute(msg, [], {
      gas: 700000, memo: 'create pool',
      session: sessOpt('create_pool', '0', fee),
    });
  }

  /**
   * 参与：参与费从**内部余额**扣（本站代币），不带 funds。
   * session 开启时走无感签名（签名金额 = 参与费）。
   */
  function join(poolId, joinAmountRaw) {
    const msg = { join: { pool_id: Number(poolId), auth: null } };
    return K.execute(msg, [], {
      gas: 600000, memo: 'join',
      session: sessOpt('join', String(poolId), String(joinAmountRaw)),
    });
  }

  // ---------- 交易：开奖 / 领取 / 退款 ----------
  /** 开奖：无资金操作，任何人可触发（不走无感，弹一次钱包也可以） */
  const draw = (id) => K.execute({ draw: { pool_id: Number(id) } }, [], { gas: 800000, memo: 'draw' });

  /**
   * 领奖：提现语义，签名金额固定 "0"（不计每日额度）。
   * 实际发放额由合约按链上 payout 与 winners 决定。session 开启 = 无感领取。
   */
  function claimPrize(id) {
    const msg = { claim_prize: { pool_id: Number(id), auth: null } };
    return K.execute(msg, [], {
      gas: 500000, memo: 'claim prize',
      session: sessOpt('claim_prize', String(id), '0'),
    });
  }
  function claimCreator(id) {
    const msg = { claim_creator: { pool_id: Number(id), auth: null } };
    return K.execute(msg, [], {
      gas: 500000, memo: 'claim creator',
      session: sessOpt('claim_creator', String(id), '0'),
    });
  }
  /** 运营领取：仅 treasury（合约无 auth 参数），主钱包路径 */
  const claimOps = (id) => K.execute({ claim_ops: { pool_id: Number(id) } }, [], { gas: 500000, memo: 'claim ops' });
  /** 销毁 / 转运营 6%：任何人可触发（合约无 auth 参数） */
  const claimBurn = (id) => K.execute({ claim_burn: { pool_id: Number(id) } }, [], { gas: 500000, memo: 'claim burn' });

  /** 退款：提现语义，签名金额固定 "0"。session 开启 = 无感退款。 */
  function refund(id) {
    const msg = { refund: { pool_id: Number(id), auth: null } };
    return K.execute(msg, [], {
      gas: 500000, memo: 'refund',
      session: sessOpt('refund', String(id), '0'),
    });
  }

  // ---------- 交易：管理员（主钱包路径） ----------
  function updateConfig(fields) {
    return K.execute({ update_config: fields }, [], { gas: 300000, memo: 'update config' });
  }
  function updateAdmin(add, remove) {
    return K.execute({ update_admin: { add: add || [], remove: remove || [] } }, [], {
      gas: 300000, memo: 'update admin',
    });
  }
  const pause = () => K.execute({ pause: {} }, [], { gas: 300000, memo: 'pause' });
  const resume = () => K.execute({ resume: {} }, [], { gas: 300000, memo: 'resume' });

  window.CJLottery = {
    isNative, refreshToken, dec,
    config, pool, pools, participants, winners, payout, claimable, internalBalance,
    tokenInfo, tokenBalance,
    toRaw, paxiToRaw, fmtPaxi, fmtToken, fmtWan, trimZeros, isNonZeroRaw, toView, statusText,
    depositNative, depositToken, withdraw,
    createPool, join,
    draw, claimPrize, claimCreator, claimOps, claimBurn, refund,
    updateConfig, updateAdmin, pause, resume,
  };
})();
