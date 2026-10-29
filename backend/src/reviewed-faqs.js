import { SOURCE_IDS } from './knowledge-sources.js';

export const reviewedFaqs = [
  {
    id: 'name-origin',
    question: '金楼为什么叫金楼？',
    keywords: ['为什么叫', '名字由来', '名称由来'],
    answer: '公开资料可确认金楼原名赋鹤楼，楼内木雕构件大量采用泥金、贴金装饰。现有资料未说明“金楼”名称的完整沿革，因此不对具体称呼过程作推断。',
    sources: [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU],
  },
  {
    id: 'building-age',
    question: '金楼是什么年代建造的？',
    keywords: ['年代', '建于', '始建', '什么时候建', '历史多久'],
    answer: '顺德区博物馆公开资料记载，金楼原名赋鹤楼，是清嘉庆、道光年间苏丕文所建的藏书楼。古建筑群内其他建筑的具体始建和重修年代不能据此一概而论。',
    sources: [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU],
  },
  {
    id: 'important-person',
    question: '苏丕文与金楼有什么关系？',
    keywords: ['人物', '谁建', '主人', '苏丕文', '名人'],
    answer: '顺德区博物馆资料记载，金楼原名赋鹤楼，是苏丕文所建的藏书楼。资料库未收录的其他人物故事与传说不作推断。',
    sources: [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU],
  },
  {
    id: 'woodcraft',
    question: '这里的木雕看什么？',
    keywords: ['木雕', '工艺'],
    answer: '可重点观察花罩、帘架、藻井和天花等木雕构件。顺德区博物馆资料列出的技法包括深浅浮雕、线刻、镂雕和玻璃镶嵌，表面使用泥金、贴金装饰；具体纹样寓意仍以景区展签为准。',
    sources: [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU, SOURCE_IDS.PROJECT_CRAFT_GUIDE],
  },
  {
    id: 'highlights',
    question: '有哪些重点看点？',
    keywords: ['看点', '值得看', '重点', '特色', '推荐看'],
    answer: '重点可看金楼内的饰金木雕、花罩、帘架、藻井和天花等构件。公开田野资料还提到古建筑群包含职方第、亦渔遗塾等建筑；现场参观可结合展签了解各点细节。',
    sources: [SOURCE_IDS.SHUNDE_MUSEUM_JINLOU, SOURCE_IDS.SYSU_FIELD_STUDY],
  },
];
