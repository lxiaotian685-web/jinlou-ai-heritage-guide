const bundledCovers = {
  zhifangdi: '/images/zhifangdi-cover.jpg',
  duizhao: '/images/duizhao-cover.jpg',
  jinlou: '/images/jinlou-cover-v2.jpg',
  shouqingwu: '/images/shouqingwu-cover.jpg',
  'boshao-clinic': '/images/boshao-clinic-cover.jpg',
  nilou: '/images/nilou-cover.jpg',
  'wokear-house': '/images/wokear-house-cover.jpg',
  'yiyu-school': '/images/yiyu-school-cover.jpg',
  'twenty-four-odes': '/images/twenty-four-odes-cover.jpg',
  'baoyue-pavilion': '/images/baoyue-pavilion-cover.jpg',
  'diequ-pavilion': '/images/diequ-pavilion-cover.jpg',
  garden: '/images/garden-cover.jpg',
};

const placeholderPattern = /^\/images\/jinlou-0[1-3]\.jpg$/;

function applyBundledCover(spot) {
  if (!spot?.id || !bundledCovers[spot.id] || !placeholderPattern.test(spot.coverImage || '')) return spot;
  return { ...spot, coverImage: bundledCovers[spot.id] };
}

module.exports = { bundledCovers, applyBundledCover };
