module.exports = {
  // 教学版使用的微信云开发环境；正式采购版必须改用买方自有环境。
  cloudEnvId: 'cloud1-d8gmw1jur6dc98110',
  // 真机联调时填写运行后端电脑的 WLAN IPv4 地址；网络变化后需同步更新。
  apiBaseUrl: 'http://10.63.36.79:3000/api/v1',
  // 景区官方购票入口（2026-10 提供）；后端 ticket.url / ticket.appId 配置后优先使用。
  ticketMiniLink: '#小程序://大众点评美食电影运动旅游门票/Y7iQxlHsZjYX1El',
  ticketLegacyLink: 'http://u.pingxp.com/app/index.php?i=1&c=entry&eid=1',
};
