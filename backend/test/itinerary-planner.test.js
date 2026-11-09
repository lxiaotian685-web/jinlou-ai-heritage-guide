import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import planner from '../../frontend/miniprogram/utils/itinerary-planner.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const snapshot = JSON.parse(readFileSync(resolve(repositoryRoot, 'frontend/cloudfunctions/bijiang-api/data.json'), 'utf8'));
const spots = snapshot.spots.data;
const routes = snapshot.routes.data;
const validSpotIds = new Set(spots.map((spot) => spot.id));

test('planner supports the three promised durations with bounded stop counts', () => {
  const expected = new Map([[45, 3], [90, 5], [120, 7]]);
  for (const [duration, maxStops] of expected) {
    const result = planner.buildItinerary({ spots, routes, duration, companion: 'solo', interests: ['architecture'] });
    assert.equal(result.duration, duration);
    assert.ok(result.stops.length > 0);
    assert.ok(result.stops.length <= maxStops);
    assert.equal(result.stopIds.length, result.stops.length);
  }
});

test('all companion and interest combinations stay inside the 15-spot whitelist', () => {
  const companions = ['solo', 'family', 'senior', 'study'];
  const interests = ['craft', 'architecture', 'garden', 'history', 'photo'];
  for (const companion of companions) {
    for (const interest of interests) {
      const result = planner.buildItinerary({ spots, routes, duration: 90, companion, interests: [interest] });
      assert.ok(result.stops.every((spot) => validSpotIds.has(spot.id)));
      assert.ok(routes.some((route) => route.id === result.sourceRouteId));
    }
  }
});

test('garden family preference chooses the existing garden route', () => {
  const result = planner.buildItinerary({ spots, routes, duration: 90, companion: 'family', interests: ['garden'] });
  assert.equal(result.sourceRouteId, 'garden-slow');
  assert.ok(result.stopIds.includes('garden'));
  assert.ok(result.stopIds.includes('baoyue-pavilion'));
});

test('architecture study preference chooses the existing architecture route', () => {
  const result = planner.buildItinerary({ spots, routes, duration: 120, companion: 'study', interests: ['architecture', 'craft'] });
  assert.equal(result.sourceRouteId, 'architecture-focus');
  assert.ok(result.stopIds.includes('jinlou'));
  assert.ok(result.stops.length <= 7);
});

test('unknown route stops and invalid preferences cannot leak into the result', () => {
  const unsafeRoutes = [{ id: 'visitor-classic', name: '测试路线', stops: ['金楼', '不存在的景点'], points: [] }];
  const result = planner.buildItinerary({ spots, routes: unsafeRoutes, duration: 999, companion: 'unknown', interests: ['unknown'] });
  assert.equal(result.duration, 90);
  assert.equal(result.companion, 'solo');
  assert.deepEqual(result.interests, ['architecture']);
  assert.deepEqual(result.stopIds, ['jinlou']);
});

test('selected guide route contains only structured whitelisted points', () => {
  const result = planner.buildItinerary({ spots, routes, duration: 45, companion: 'senior', interests: ['history'] });
  const selected = planner.toSelectedRoute(result);
  assert.equal(selected.personalized, true);
  assert.deepEqual(selected.stopIds, result.stopIds);
  assert.ok(selected.points.every((point) => validSpotIds.has(point.spotId)));
});

test('assistant prompt forbids adding spots and operational facts', () => {
  for (const duration of [45, 90, 120]) {
    const result = planner.buildItinerary({ spots, routes, duration, companion: 'family', interests: ['craft', 'architecture', 'history'] });
    const question = planner.buildAssistantQuestion(result);
    assert.match(question, /不要新增景点、路线、票价或开放时间/);
    assert.ok(question.length <= 200);
  }
});

test('mini program registers and links the itinerary page', () => {
  const appConfig = JSON.parse(readFileSync(resolve(repositoryRoot, 'frontend/miniprogram/app.json'), 'utf8'));
  const routePage = readFileSync(resolve(repositoryRoot, 'frontend/miniprogram/pages/routes/index.wxml'), 'utf8');
  const itineraryPage = readFileSync(resolve(repositoryRoot, 'frontend/miniprogram/pages/itinerary/index.wxml'), 'utf8');
  assert.ok(appConfig.pages.includes('pages/itinerary/index'));
  assert.match(routePage, /openItineraryPlanner/);
  assert.match(itineraryPage, /generatePlan/);
  assert.match(itineraryPage, /在导览图中使用/);
});
