import { reviewedNarrations } from '../src/reviewed-narrations.js';

// 每种语言使用同一声线，保证同一语种 15 段讲解听感一致。
const voices = {
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  yue: 'zh-HK-HiuMaanNeural',
  en: 'en-US-AriaNeural',
};

console.log(JSON.stringify(reviewedNarrations.map((item) => ({
  id: item.id,
  text: item.transcript,
  filename: item.audioUrl.split('/').at(-1),
  languageCode: item.languageCode,
  voice: voices[item.languageCode],
}))));

