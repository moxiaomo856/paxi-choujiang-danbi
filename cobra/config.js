/* =====================================================================
 * config.js —— 抽奖前端配置（本站点：COBRA）
 *
 * 【六站共用同一份代码】paxi/ orion/ pick/ leo/ cobra/ uscea/ 是同一套前端，
 * 只有本文件、manifest.json 和图标文件在各站之间不同。
 *
 * 契约：本站前端对接单币抽奖合约（paxi-lottery-single）。
 * ===================================================================== */
window.CJ_CONFIG = {
  // ======== 站点标识（六站各不相同）========
  appKey: 'cobra',
  storageNs: 'cobra',
  appTitle: 'Paxi 抽奖 · COBRA',
  tokenName: 'COBRA',
  accent: '#a855f7',
  accent2: '#c98bff',
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
  contract: 'paxi10vjktgaqc2mmkcdqewv60mw72mamrmu4kpu6yxfyv5ejyram3p5qd9ag5n',

  // ---- 本站参与代币 ----
  isPaxi: false,
  tokenKind: 'cw20',
  tokenDenom: '',
  tokenContract: 'paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u',
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
