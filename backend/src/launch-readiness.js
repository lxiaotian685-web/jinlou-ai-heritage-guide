const requiredFields = [
  ['officialName', '小程序正式名称'],
  ['logoFile', '正式Logo文件'],
  ['logoAuthorizationFile', 'Logo公开使用授权'],
  ['authorizedImageManifest', '授权图片清单'],
  ['legalEntity', '认证主体'],
  ['administratorName', '小程序管理员'],
  ['administratorContact', '管理员联系方式'],
  ['customerServicePhone', '客服电话'],
  ['privacyContactName', '隐私事务联系人'],
  ['privacyContactMethod', '隐私事务联系方式'],
  ['contentOwner', '内容更新负责人'],
  ['privacyPolicyApproval', '隐私说明审核记录'],
];

function hasValue(value) {
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim().length > 0;
}

export function evaluateLaunchReadiness(profile = {}) {
  const checks = requiredFields.map(([key, label]) => ({ key, label, ready: hasValue(profile[key]) }));
  const missing = checks.filter((item) => !item.ready);
  return {
    ready: missing.length === 0,
    completedCount: checks.length - missing.length,
    totalCount: checks.length,
    checks,
    missing,
  };
}
