import { reviewedSpotContent } from './reviewed-spots.js';

const spotNames = {
  'nanshan-hall': '南山祠',
  zhifangdi: '职方第',
  duizhao: '对朝',
  jinlou: '金楼',
  shouqingwu: '守清屋',
  'boshao-clinic': '伯韶医馆',
  nilou: '泥楼',
  'wokear-residence': '镬耳民居',
  'wokear-house': '镬耳大屋',
  'yiyu-school': '亦渔遗塾',
  'components-exhibit': '民居构件展示',
  'twenty-four-odes': '二十四咏',
  'baoyue-pavilion': '抱月亭',
  'diequ-pavilion': '叠趣亭',
  garden: '后花园',
};

export const reviewedNarrations = reviewedSpotContent.map((spot) => ({
  id: `${spot.id}-zh`,
  spotId: spot.id,
  languageCode: 'zh-CN',
  languageLabel: '普通话',
  transcript: `欢迎来到${spotNames[spot.id]}。${spot.summary}`,
  audioUrl: '',
}));
