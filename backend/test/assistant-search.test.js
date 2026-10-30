import { test } from 'node:test';
import assert from 'node:assert/strict';
import knowledge from '../../frontend/cloudfunctions/bijiang-api/assistant/knowledge.js';
import chat from '../../frontend/cloudfunctions/bijiang-api/assistant/chat.js';
import search from '../../frontend/cloudfunctions/bijiang-api/assistant/web-search.js';
import { readFileSync } from 'node:fs';
const snapshot = JSON.parse(readFileSync(new URL('../../frontend/cloudfunctions/bijiang-api/data.json', import.meta.url)));
test('colloquial building-age questions retrieve the existing age FAQ', () => {
  const items = knowledge.buildKnowledgeItems({spots:snapshot.spots.data, faqs:snapshot.faqs});
  for (const question of ['这个楼建成的时间', '这座楼哪年修建的', '金楼什么时候建成的']) {
    assert.equal(knowledge.retrieve(items, question)[0].item.id, 'faq:building-age');
  }
});
test('web fallback carries sources and respects disabled state and quota', async () => {
  let requests = 0;
  const webSearch = search.createWebSearch({ASSISTANT_WEB_SEARCH_ENABLED:'true', DEEPSEEK_API_KEY:'test'}, async () => {
    requests++;
    return {results:[{title:'活动',url:'https://example.com/article',summary:'活动资料'}, {url:'javascript:bad',summary:'bad'}]};
  });
  const provider={name:'test', async answer({matches}) {assert.equal(matches[0].category,'web'); return {answer:'测试回答'};}};
  const args={question:'碧江有什么文化活动？',input:{},provider,webSearch};
  const result=await chat.answerQuestion(args);
  assert.equal(result.mode,'web_rag'); assert.equal(result.webSources.length,1);
  const denied=await chat.answerQuestion({...args,rateLimiter:{check:()=>({allowed:false})}});
  assert.equal(denied.fallbackReason,'rate_limited'); assert.equal(requests,1);
  const disabled=await chat.answerQuestion({...args,webSearch:search.createWebSearch({})});
  assert.equal(disabled.mode,'not_ready'); assert.equal(requests,1);
});
test('search outage returns a truthful fallback without calling the model', async () => {
  const result=await chat.answerQuestion({question:'碧江文化活动',input:{},provider:{answer(){throw new Error('must not call')}},webSearch:{enabled:true,async search(){throw new Error('offline')}}});
  assert.equal(result.mode,'not_ready');assert.equal(result.fallbackReason,'search_unavailable');
});

test('visit duration gives concrete planning estimates for natural questions', () => {
  for (const q of ['建议游览多久？','玩多久合适','几个小时能逛完']) {
    const result=knowledge.fixedFact({routes:[{name:'经典线',duration:'待现场实走确认'}]},q);
    assert.match(result.answer,/1—1.5小时/);
    assert.match(result.answer,/45—60分钟/);
    assert.match(result.answer,/1.5—2小时/);
    assert.match(result.answer,/不是实测/);
    assert.doesNotMatch(result.answer,/待现场/);
  }
});

test('irrelevant local matches trigger one web retry with only web sources', async () => {
  let searches=0, calls=0, charges=0;
  const input={spots:snapshot.spots.data,faqs:snapshot.faqs};
  const args={question:'金楼周边有什么好吃的',input,
    rateLimiter:{check(){charges++;return {allowed:true};}},
    provider:{name:'test',async answer({matches}){calls++;return matches[0].category==='web' ? {answer:'可参考餐饮信息[资料1]'} : {answer:'缺少周边餐饮资料',insufficientEvidence:true};}},
    webSearch:{enabled:true,async search(){searches++;return [{item:{id:'web:1',title:'餐饮',content:'周边餐饮资料',category:'web',sourceUrl:'https://example.com/food'}}];}}};
  const result=await chat.answerQuestion(args);
  assert.equal(result.mode,'web_rag');assert.equal(calls,2);assert.equal(searches,1);assert.equal(charges,1);
  assert.deepEqual(result.sourceIds,[]);assert.equal(result.webSources[0].url,'https://example.com/food');
  const failed=await chat.answerQuestion({...args,webSearch:{enabled:true,async search(){throw new Error('offline');}}});
  assert.equal(failed.mode,'not_ready');assert.equal(failed.fallbackReason,'search_unavailable');assert.deepEqual(failed.sourceIds,[]);
});

test('insufficient evidence handles empty search and second model timeout without looping', async () => {
  const input={spots:snapshot.spots.data,faqs:snapshot.faqs};
  let calls=0, searches=0;
  const provider={name:'test',async answer(){calls++;if(calls===1)return {answer:'资料不足',insufficientEvidence:true};throw Object.assign(new Error('timeout'),{name:'AbortError'});}};
  const args={question:'金楼周边有什么好吃的',input,provider};
  const empty=await chat.answerQuestion({...args,webSearch:{enabled:true,async search(){return [];}}});
  assert.equal(empty.fallbackReason,'search_empty');assert.equal(calls,1);
  calls=0;
  const failed=await chat.answerQuestion({...args,webSearch:{enabled:true,async search(){searches++;return [{item:{id:'web:1',title:'餐饮',content:'资料',category:'web',sourceUrl:'https://example.com/food'}}];}}});
  assert.equal(failed.mode,'web_fallback');assert.equal(calls,2);assert.equal(searches,1);
  assert.deepEqual(failed.sourceIds,[]);assert.equal(failed.webSources.length,1);
});

test('provider exposes evidence signal without leaking marker into visitor answer', async () => {
  const {default:providers}=await import('../../frontend/cloudfunctions/bijiang-api/assistant/providers.js');
  const provider=providers.createOpenAICompatibleProvider({apiKey:'test',baseUrl:'https://example.com',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'[INSUFFICIENT_EVIDENCE]缺少餐饮资料'}}]})})});
  const result=await provider.answer({question:'附近餐饮',matches:[]});
  assert.equal(result.insufficientEvidence,true);assert.equal(result.answer,'缺少餐饮资料');
});
