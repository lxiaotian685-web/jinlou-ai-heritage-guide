(() => {
  'use strict';

  if (!window.cloudbase) {
    const message = document.getElementById('login-error');
    if (message) message.textContent = '网页基础组件加载失败，请刷新页面或更换网络后重试。';
    return;
  }

  const config = window.BIJIANG_ADMIN_CONFIG;
  const cloudApp = window.cloudbase.init({ env: config.envId, region: config.region });
  const state = { token: '', dashboard: null, analytics: null, homeSlides: [], activeSpotId: '', activeNarrationId: '', activeAdId: '', spotPreviewUrl: '' };
  let identityPromise = null;
  const viewNames = {
    overview: ['工作台', '内容总览'], home: ['首页内容', '首页封面与文案'], spots: ['景点管理', '景点图文资料'],
    audio: ['讲解与音频', '讲解稿与正式音频'], ads: ['周边推荐', '商家与推荐内容'], analytics: ['运营数据', '商家互动统计'],
  };
  const $ = (id) => document.getElementById(id);
  const value = (id) => $(id).value.trim();
  const setValue = (id, next = '') => { $(id).value = next ?? ''; };
  const bundledSpotCovers = {
    'nanshan-hall': './assets/spots/spot-nanshan-hall-v1.jpg',
    zhifangdi: './assets/spots/zhifangdi-cover.jpg', duizhao: './assets/spots/duizhao-cover.jpg', jinlou: './assets/spots/jinlou-cover-v2.jpg',
    shouqingwu: './assets/spots/shouqingwu-cover.jpg', 'boshao-clinic': './assets/spots/boshao-clinic-cover.jpg', nilou: './assets/spots/nilou-cover.jpg',
    'wokear-house': './assets/spots/wokear-house-cover.jpg', 'yiyu-school': './assets/spots/yiyu-school-cover.jpg', 'twenty-four-odes': './assets/spots/twenty-four-odes-cover.jpg',
    'baoyue-pavilion': './assets/spots/baoyue-pavilion-cover.jpg', 'diequ-pavilion': './assets/spots/diequ-pavilion-cover.jpg', garden: './assets/spots/garden-cover.jpg',
    'wokear-residence': './assets/spots/spot-wokear-residence-v1.jpg', 'components-exhibit': './assets/spots/spot-components-exhibit-v1.jpg',
  };
  const placeholderSpotImage = /^\/images\/jinlou-0[1-3]\.jpg$/;
  const defaultHomeSlides = Array.from({ length: 6 }, (_, index) => `/images/jinlou-home-slide-${index + 1}.jpg`);
  const adminHomeSlides = Object.fromEntries(defaultHomeSlides.map((location, index) => [location, `./assets/home-slides/jinlou-home-slide-${index + 1}.jpg`]));

  function authClient() {
    return typeof cloudApp.auth === 'function' ? cloudApp.auth() : cloudApp.auth;
  }

  async function ensureCloudIdentity() {
    if (!identityPromise) {
      identityPromise = (async () => {
        const auth = authClient();
        let result;
        if (auth.signInAnonymously) result = await auth.signInAnonymously();
        else if (auth.anonymousAuthProvider) result = await auth.anonymousAuthProvider().signIn();
        else throw new Error('当前CloudBase Web SDK不支持匿名登录');
        if (result?.error) {
          const detail = result.error.message || result.error.code || '未知原因';
          throw new Error(`网页云身份登录失败：${detail}`);
        }
        return result?.data || result;
      })();
    }
    try {
      return await identityPromise;
    } catch (error) {
      identityPromise = null;
      throw error;
    }
  }

  async function call(path, method = 'GET', body = null) {
    await ensureCloudIdentity();
    const response = await cloudApp.callFunction({
      name: config.functionName,
      data: { path, method, body, adminToken: state.token },
      parse: true,
    });
    const result = response.result;
    if (!result?.ok) throw new Error(result?.error?.message || '云端请求失败');
    return result.response;
  }

  function showMessage(message, error = false) {
    const target = $('global-message');
    target.textContent = message;
    target.classList.toggle('error', error);
    window.clearTimeout(showMessage.timer);
    if (message) showMessage.timer = window.setTimeout(() => { target.textContent = ''; }, 5000);
  }

  function setBusy(button, busy, busyLabel = '处理中') {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? busyLabel : button.dataset.label;
  }

  function switchView(name) {
    document.querySelectorAll('[data-view-panel]').forEach((panel) => { panel.hidden = panel.dataset.viewPanel !== name; });
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
    $('view-label').textContent = viewNames[name][0];
    $('view-title').textContent = viewNames[name][1];
    $('app-view').classList.remove('menu-open');
  }

  async function loadDashboard() {
    const [dashboardResponse, analyticsResponse] = await Promise.all([call('/admin/dashboard'), call('/admin/recommendation-analytics')]);
    state.dashboard = dashboardResponse.data;
    state.analytics = analyticsResponse.data;
    renderAll();
  }

  function renderAll() {
    const data = state.dashboard;
    $('spot-count').textContent = data.spots.length;
    $('audio-count').textContent = data.narrations.length;
    $('ad-count').textContent = data.recommendations.filter((item) => item.status === 'online').length;
    $('click-count').textContent = state.analytics?.last7Days || 0;
    $('trend-total').textContent = `${state.analytics?.total || 0} 次`;
    $('cover-health').textContent = `${data.spots.filter((item) => !placeholderSpotImage.test(item.coverImage || '') || bundledSpotCovers[item.id]).length} / ${data.spots.length}`;
    $('audio-health').textContent = `${data.narrations.filter((item) => item.audioType === 'recorded' && item.reviewStatus === 'approved' && item.audioUrl).length} / ${data.narrations.length}`;
    $('ad-health').textContent = `${data.recommendations.filter((item) => item.status === 'online').length} 条`;
    setValue('home-title', data.home.title);
    setValue('home-subtitle', data.home.subtitle);
    const savedSlides = Array.isArray(data.home.heroImages) && data.home.heroImages.length
      ? data.home.heroImages
      : (data.home.heroImage && data.home.heroImage !== '/images/jinlou-home-hero-v2.jpg' && !defaultHomeSlides.includes(data.home.heroImage) ? [data.home.heroImage, ...defaultHomeSlides] : defaultHomeSlides);
    state.homeSlides.forEach((item) => { if (item.objectUrl) URL.revokeObjectURL(item.objectUrl); });
    state.homeSlides = savedSlides.slice(0, 8).map((location) => ({ location }));
    renderHomeSlides();
    renderSpots();
    renderNarrations();
    renderAds();
    renderAnalytics();
    renderOverviewTrend();
  }

  function renderOverviewTrend() {
    const chart = $('overview-trend'); chart.replaceChildren();
    const daily = state.analytics?.daily || [];
    if (!daily.length || !daily.some((item) => item.total > 0)) {
      const empty = document.createElement('div'); empty.className = 'chart-empty'; empty.textContent = '新版小程序产生点击后，这里会显示每日变化'; chart.append(empty); return;
    }
    const maximum = Math.max(...daily.map((item) => item.total), 1);
    daily.forEach((item) => {
      const column = document.createElement('div'); column.className = 'trend-column'; column.title = `${item.date}：${item.total}次`;
      const bar = document.createElement('span'); bar.style.height = `${Math.max(8, Math.round(item.total / maximum * 100))}%`;
      const valueLabel = document.createElement('small'); valueLabel.textContent = String(item.total);
      column.append(valueLabel, bar); chart.append(column);
    });
  }

  function displayLocation(location) {
    return adminHomeSlides[location] || (location?.startsWith('/images/') ? './assets/home-hero.jpg' : location || '');
  }

  async function setPreviewImage(image, location) {
    const direct = displayLocation(location);
    if (!direct) return image.removeAttribute('src');
    if (!direct.startsWith('cloud://')) { image.src = direct; return; }
    try {
      const response = await cloudApp.getTempFileURL({ fileList: [direct] });
      image.src = response.fileList?.[0]?.tempFileURL || '';
    } catch (_error) { image.removeAttribute('src'); }
  }

  function renderHomeSlides() {
    const list = $('home-slide-list'); list.replaceChildren();
    state.homeSlides.forEach((item, index) => {
      const fragment = $('slide-template').content.cloneNode(true);
      const article = fragment.querySelector('.slide-item'); article.dataset.slideIndex = String(index);
      fragment.querySelector('.slide-number').textContent = index === 0 ? '首图' : `第${index + 1}张`;
      fragment.querySelector('.slide-title').textContent = index === 0 ? '进入首页首先展示' : `轮播顺序 ${index + 1}`;
      fragment.querySelector('.slide-hint').textContent = item.file ? `待上传：${item.file.name}` : '当前已保存照片';
      const image = fragment.querySelector('.slide-thumb'); setPreviewImage(image, item.objectUrl || item.location);
      fragment.querySelector('[data-slide-action="first"]').hidden = index === 0;
      fragment.querySelector('[data-slide-action="up"]').disabled = index === 0;
      fragment.querySelector('[data-slide-action="down"]').disabled = index === state.homeSlides.length - 1;
      list.append(fragment);
    });
    const first = state.homeSlides[0];
    setValue('home-image', first?.location || '');
    setPreviewImage($('home-preview'), first?.objectUrl || first?.location || '');
  }

  function moveHomeSlide(index, nextIndex) {
    if (index < 0 || nextIndex < 0 || index >= state.homeSlides.length || nextIndex >= state.homeSlides.length) return;
    const [item] = state.homeSlides.splice(index, 1); state.homeSlides.splice(nextIndex, 0, item); renderHomeSlides();
  }

  function renderSpots() {
    const spots = state.dashboard.spots;
    state.activeSpotId = spots.some((item) => item.id === state.activeSpotId) ? state.activeSpotId : spots[0]?.id || '';
    $('spot-select').replaceChildren(...spots.map((item) => new Option(item.name, item.id)));
    $('spot-select').value = state.activeSpotId;
    $('spot-list').replaceChildren(...spots.map((item) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = item.name; button.dataset.id = item.id;
      button.classList.toggle('active', item.id === state.activeSpotId);
      button.addEventListener('click', () => selectSpot(item.id));
      return button;
    }));
    fillSpot();
  }

  function selectSpot(id) { state.activeSpotId = id; renderSpots(); }
  function fillSpot() {
    const item = state.dashboard.spots.find((spot) => spot.id === state.activeSpotId);
    if (!item) return;
    if (state.spotPreviewUrl) URL.revokeObjectURL(state.spotPreviewUrl);
    state.spotPreviewUrl = '';
    setValue('spot-id', item.id); setValue('spot-name', item.name); setValue('spot-category', item.category);
    setValue('spot-summary', item.summary); setValue('spot-image', item.coverImage);
    showStoredSpotPreview(item); resetFileChoice('spot-file', 'spot-file-name', bundledSpotCovers[item.id] ? '当前显示原有照片，如需更换请点击“选择照片”' : '该景点暂缺实拍封面，请点击“选择照片”补充');
    $('spot-cancel-file').hidden = true;
    $('spot-restore-previous').hidden = !item.previousCoverImage;
    $('spot-previous-note').hidden = !item.previousCoverImage;
  }

  function showStoredSpotPreview(item) {
    const previewLocation = placeholderSpotImage.test(item.coverImage || '') ? (bundledSpotCovers[item.id] || '') : item.coverImage;
    $('spot-preview-empty').hidden = Boolean(previewLocation);
    updateMediaPreview('spot-preview', previewLocation);
  }

  function renderNarrations() {
    const items = state.dashboard.narrations;
    state.activeNarrationId = items.some((item) => item.id === state.activeNarrationId) ? state.activeNarrationId : items[0]?.id || '';
    $('audio-select').replaceChildren(...items.map((item) => {
      const spot = state.dashboard.spots.find((entry) => entry.id === item.spotId);
      return new Option(`${spot?.name || item.spotId} / ${item.languageLabel}`, item.id);
    }));
    $('audio-select').value = state.activeNarrationId;
    fillNarration();
  }

  function fillNarration() {
    const item = state.dashboard.narrations.find((entry) => entry.id === state.activeNarrationId);
    if (!item) return;
    setValue('audio-id', item.id); setValue('audio-transcript', item.transcript); setValue('audio-url', item.audioUrl); setValue('audio-status', item.reviewStatus);
    resetFileChoice('audio-file', 'audio-file-name');
  }

  function categoryName(category) { return { food: '美食', hotel: '住宿', transport: '交通', attraction: '周边景点' }[category] || category; }

  function setAdCategory(category) {
    const next = ['food', 'hotel', 'transport', 'attraction'].includes(category) ? category : 'food';
    setValue('ad-category', next);
    setValue('ad-category-advanced', next);
    $('ad-category-label').textContent = categoryName(next);
    document.querySelectorAll('[data-category]').forEach((button) => button.classList.toggle('active', button.dataset.category === next));
  }
  function renderAds() {
    const items = [...state.dashboard.recommendations].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const list = $('ad-list'); list.replaceChildren();
    if (!items.length) list.append($('empty-template').content.cloneNode(true));
    items.forEach((item) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'ad-card';
      button.classList.toggle('active', item.id === state.activeAdId);
      const name = document.createElement('strong'); name.textContent = item.name;
      const meta = document.createElement('span'); meta.textContent = `${categoryName(item.category)} / 顺序 ${item.sortOrder ?? 100}`;
      const status = document.createElement('span'); status.className = `status ${item.status === 'online' ? '' : 'offline'}`; status.textContent = item.status === 'online' ? '已上架' : '草稿';
      button.append(name, meta, status); button.addEventListener('click', () => { state.activeAdId = item.id; fillAd(item); renderAds(); }); list.append(button);
    });
    if (state.activeAdId) fillAd(items.find((item) => item.id === state.activeAdId)); else resetAdForm();
  }

  function fillAd(item) {
    if (!item) return resetAdForm();
    setValue('ad-id', item.id); setAdCategory(item.category); setValue('ad-status', item.status || 'offline'); setValue('ad-name', item.name);
    setValue('ad-type', item.type); setValue('ad-sort', item.sortOrder ?? 100); setValue('ad-product', item.productName); setValue('ad-description', item.description);
    setValue('ad-address', item.address); setValue('ad-hours', item.availability); setValue('ad-phone', item.phone); setValue('ad-link', item.linkUrl); setValue('ad-image', item.image);
    $('ad-current-category').hidden = false; $('ad-new-category').hidden = true; showStoredAdPreview(item);
    resetFileChoice('ad-file', 'ad-file-name', item.image && !item.image.startsWith('/images/') ? '当前显示原有照片，如需更换请点击“选择照片”' : '这条内容暂缺商家照片，请点击“选择照片”补充');
  }

  function resetAdForm() {
    state.activeAdId = '';
    ['ad-id','ad-name','ad-type','ad-product','ad-description','ad-address','ad-hours','ad-phone','ad-link','ad-image'].forEach((id) => setValue(id));
    setAdCategory('food'); setValue('ad-status', 'offline'); setValue('ad-sort', '100');
    $('ad-current-category').hidden = true; $('ad-new-category').hidden = false; $('ad-preview-empty').hidden = false; updateMediaPreview('ad-preview', ''); resetFileChoice('ad-file', 'ad-file-name', '新增内容，请选择一张商家照片');
  }

  function showStoredAdPreview(item) {
    const previewLocation = item.image && !item.image.startsWith('/images/') ? item.image : '';
    $('ad-preview-empty').hidden = Boolean(previewLocation);
    updateMediaPreview('ad-preview', previewLocation);
  }

  function renderAnalytics() {
    const analytics = state.analytics || { total: 0, actions: {}, items: [] };
    $('analytics-total').textContent = analytics.total || 0;
    $('analytics-detail').textContent = analytics.actions?.detail || 0;
    $('analytics-phone').textContent = analytics.actions?.phone || 0;
    $('analytics-link').textContent = analytics.actions?.link || 0;
    renderAnalyticsCharts(analytics);
    const rows = $('analytics-rows'); rows.replaceChildren();
    (analytics.items || []).forEach((item) => {
      const row = document.createElement('tr');
      [item.name, categoryName(item.category), item.total, item.detail, item.phone, item.link].forEach((content, index) => {
        const cell = document.createElement('td'); cell.textContent = content ?? 0; if (index === 0) cell.className = 'merchant-name'; row.append(cell);
      });
      rows.append(row);
    });
    $('analytics-empty').hidden = Boolean((analytics.items || []).length);
    document.querySelector('.table-scroll').hidden = !(analytics.items || []).length;
  }

  function renderAnalyticsCharts(analytics) {
    const actionEntries = [
      { label: '打开详情', value: Number(analytics.actions?.detail) || 0, color: '#1f6f60' },
      { label: '拨打电话', value: Number(analytics.actions?.phone) || 0, color: '#c28a2c' },
      { label: '复制链接', value: Number(analytics.actions?.link) || 0, color: '#7c9e92' },
    ];
    const total = actionEntries.reduce((sum, item) => sum + item.value, 0);
    $('analytics-chart-total').textContent = `${total} 次`;
    $('analytics-donut-total').textContent = String(total);

    const dailyByDate = new Map((analytics.daily || []).map((item) => [item.date, Number(item.total) || 0]));
    const daily = Array.from({ length: 30 }, (_, offset) => {
      const date = new Date(Date.now() - (29 - offset) * 86400000).toISOString().slice(0, 10);
      return { date, total: dailyByDate.get(date) || 0 };
    });
    const dailyMaximum = Math.max(...daily.map((item) => item.total), 1);
    const dailyBars = $('analytics-daily-bars'); dailyBars.replaceChildren();
    daily.forEach((item) => {
      const column = document.createElement('div'); column.className = 'analytics-bar-column'; column.title = `${item.date}：${item.total}次`;
      const value = document.createElement('span'); value.className = 'analytics-bar-value'; value.textContent = item.total ? String(item.total) : '';
      const bar = document.createElement('i'); bar.style.height = `${item.total ? Math.max(6, Math.round(item.total / dailyMaximum * 100)) : 2}%`;
      if (!item.total) bar.classList.add('is-zero');
      column.append(value, bar); dailyBars.append(column);
    });

    const donut = $('analytics-action-donut');
    if (!total) donut.style.background = 'conic-gradient(#e4eae7 0 100%)';
    else {
      let cursor = 0;
      const stops = actionEntries.map((item) => {
        const start = cursor; cursor += item.value / total * 100;
        return `${item.color} ${start}% ${cursor}%`;
      });
      donut.style.background = `conic-gradient(${stops.join(',')})`;
    }
    const legend = $('analytics-action-legend'); legend.replaceChildren();
    actionEntries.forEach((item) => {
      const row = document.createElement('div');
      const label = document.createElement('span'); const swatch = document.createElement('i'); swatch.style.background = item.color;
      label.append(swatch, document.createTextNode(item.label));
      const value = document.createElement('strong'); value.textContent = total ? `${item.value} 次 · ${Math.round(item.value / total * 100)}%` : '0 次 · 0%';
      row.append(label, value); legend.append(row);
    });

    const categoryTotals = { food: 0, hotel: 0, transport: 0, attraction: 0 };
    (analytics.items || []).forEach((item) => { if (Object.hasOwn(categoryTotals, item.category)) categoryTotals[item.category] += Number(item.total) || 0; });
    const categoryMaximum = Math.max(...Object.values(categoryTotals), 1);
    const categoryBars = $('analytics-category-bars'); categoryBars.replaceChildren();
    Object.entries(categoryTotals).forEach(([category, value]) => {
      const row = document.createElement('div'); row.className = 'category-bar-row';
      const label = document.createElement('strong'); label.textContent = categoryName(category);
      const track = document.createElement('span'); const fill = document.createElement('i'); fill.style.width = `${value ? Math.max(3, value / categoryMaximum * 100) : 0}%`; track.append(fill);
      const count = document.createElement('b'); count.textContent = `${value} 次`;
      row.append(label, track, count); categoryBars.append(row);
    });
  }

  async function updateMediaPreview(imageId, location) {
    const image = $(imageId);
    if (!location) return image.removeAttribute('src');
    if (location.startsWith('cloud://')) {
      try {
        const response = await cloudApp.getTempFileURL({ fileList: [location] });
        image.src = response.fileList?.[0]?.tempFileURL || '';
      } catch (_error) { image.removeAttribute('src'); }
      return;
    }
    image.src = location.startsWith('/images/') ? './assets/home-hero.jpg' : location;
  }

  function resetFileChoice(fileInputId, labelId, customText = '') {
    $(fileInputId).value = '';
    $(labelId).textContent = customText || (fileInputId === 'audio-file' ? '尚未选择新音频' : '尚未选择新照片');
  }

  function showSelectedFile(fileInputId, labelId, previewId = '') {
    const file = $(fileInputId).files[0];
    $(labelId).textContent = file ? `已选择：${file.name}` : (fileInputId === 'audio-file' ? '尚未选择新音频' : '尚未选择新照片');
    if (file && previewId) {
      if (previewId === 'spot-preview' && state.spotPreviewUrl) URL.revokeObjectURL(state.spotPreviewUrl);
      const objectUrl = URL.createObjectURL(file);
      $(previewId).src = objectUrl;
      if (previewId === 'spot-preview') state.spotPreviewUrl = objectUrl;
      if (previewId === 'spot-preview') $('spot-preview-empty').hidden = true;
      if (previewId === 'ad-preview') $('ad-preview-empty').hidden = true;
    }
  }

  async function imageToUploadPayload(file) {
    if (file.size > 30 * 1024 * 1024) throw new Error('原始照片不能超过30MB');
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('无法读取这张照片')); image.src = objectUrl; });
      const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.86; let blob;
      do {
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        quality -= 0.1;
      } while (blob && blob.size > 2 * 1024 * 1024 && quality >= 0.46);
      if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('照片处理后仍超过2MB，请换一张较小的照片');
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
      return { base64: String(dataUrl).split(',')[1], mimeType: 'image/jpeg' };
    } finally { URL.revokeObjectURL(objectUrl); }
  }

  async function uploadSelectedImage(fileInputId, destinationInputId, group, targetId, previewId) {
    const file = $(fileInputId).files[0];
    if (!file) return '';
    const fileId = await uploadImageFile(file, group, targetId);
    setValue(destinationInputId, fileId); await updateMediaPreview(previewId, fileId);
    return fileId;
  }

  async function uploadImageFile(file, group, targetId) {
    const payload = await imageToUploadPayload(file);
    const response = await call('/admin/media/images', 'POST', { ...payload, group, targetId });
    const fileId = response.data?.fileID;
    if (!fileId) throw new Error('图片上传成功，但未返回文件ID');
    return fileId;
  }

  async function uploadSelectedAudio(fileInputId, destinationInputId, group, maxMegabytes) {
    const file = $(fileInputId).files[0];
    if (!file) return '';
    if (file.size > maxMegabytes * 1024 * 1024) throw new Error(`文件不能超过 ${maxMegabytes}MB`);
    await ensureCloudIdentity();
    const extension = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cloudPath = `${config.storagePrefix}/${group}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const response = await cloudApp.uploadFile({ cloudPath, filePath: file });
    const fileId = response.fileID || response.fileId;
    if (!fileId) throw new Error('文件上传成功，但未返回文件ID');
    setValue(destinationInputId, fileId);
    return fileId;
  }

  async function submitWith(button, task, successText) {
    setBusy(button, true, '正在保存');
    try { await task(); await loadDashboard(); showMessage(successText); }
    catch (error) { showMessage(error.message || '保存失败', true); }
    finally { setBusy(button, false); }
  }

  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const button = $('login-button'); setBusy(button, true, '正在连接'); $('login-error').textContent = '';
    try {
      state.token = value('admin-token'); await call('/admin/session', 'POST'); await loadDashboard();
      $('login-view').hidden = true; $('app-view').hidden = false;
    } catch (error) { state.token = ''; $('login-error').textContent = error.message || '登录失败'; }
    finally { setBusy(button, false); }
  });
  $('logout-button').addEventListener('click', () => { state.token = ''; state.dashboard = null; setValue('admin-token'); $('app-view').hidden = true; $('login-view').hidden = false; });
  $('main-nav').addEventListener('click', (event) => { if (event.target.dataset.view) switchView(event.target.dataset.view); });
  document.addEventListener('click', (event) => { const target = event.target.closest('[data-jump-view]'); if (target) switchView(target.dataset.jumpView); });
  $('menu-button').addEventListener('click', () => $('app-view').classList.toggle('menu-open'));
  $('refresh-button').addEventListener('click', async () => { try { await loadDashboard(); showMessage('已刷新云端数据'); } catch (error) { showMessage(error.message, true); } });
  $('spot-select').addEventListener('change', (event) => selectSpot(event.target.value));
  $('audio-select').addEventListener('change', (event) => { state.activeNarrationId = event.target.value; fillNarration(); });
  $('new-ad-button').addEventListener('click', () => { resetAdForm(); renderAds(); $('ad-name').focus(); });
  $('spot-image').addEventListener('change', () => { $('spot-preview-empty').hidden = Boolean(value('spot-image')); updateMediaPreview('spot-preview', value('spot-image')); });
  $('ad-image').addEventListener('change', () => { $('ad-preview-empty').hidden = Boolean(value('ad-image')); updateMediaPreview('ad-preview', value('ad-image')); });
  $('home-file').addEventListener('change', () => {
    const files = Array.from($('home-file').files || []);
    const available = Math.max(0, 8 - state.homeSlides.length);
    files.slice(0, available).forEach((file) => state.homeSlides.push({ file, objectUrl: URL.createObjectURL(file) }));
    $('home-file-name').textContent = files.length > available ? `已添加${available}张，轮播最多保留8张` : `已添加${Math.min(files.length, available)}张，请检查顺序`;
    $('home-file').value = '';
    renderHomeSlides();
  });
  $('spot-file').addEventListener('change', () => {
    showSelectedFile('spot-file', 'spot-file-name', 'spot-preview');
    $('spot-cancel-file').hidden = !$('spot-file').files[0];
  });
  $('spot-cancel-file').addEventListener('click', () => {
    const item = state.dashboard.spots.find((spot) => spot.id === state.activeSpotId);
    if (!item) return;
    if (state.spotPreviewUrl) URL.revokeObjectURL(state.spotPreviewUrl);
    state.spotPreviewUrl = '';
    setValue('spot-image', item.coverImage);
    resetFileChoice('spot-file', 'spot-file-name', '已取消本次选择，仍使用当前已保存照片');
    $('spot-cancel-file').hidden = true;
    showStoredSpotPreview(item);
  });
  $('spot-restore-previous').addEventListener('click', () => {
    const item = state.dashboard.spots.find((spot) => spot.id === state.activeSpotId);
    if (!item?.previousCoverImage) return;
    if (state.spotPreviewUrl) URL.revokeObjectURL(state.spotPreviewUrl);
    state.spotPreviewUrl = '';
    resetFileChoice('spot-file', 'spot-file-name', '已选择上一张照片，点击“保存景点”后生效');
    $('spot-cancel-file').hidden = true;
    setValue('spot-image', item.previousCoverImage);
    $('spot-preview-empty').hidden = true;
    updateMediaPreview('spot-preview', item.previousCoverImage);
  });
  $('ad-file').addEventListener('change', () => showSelectedFile('ad-file', 'ad-file-name', 'ad-preview'));
  $('audio-file').addEventListener('change', () => showSelectedFile('audio-file', 'audio-file-name'));
  $('ad-new-category').addEventListener('click', (event) => { if (event.target.dataset.category) setAdCategory(event.target.dataset.category); });
  $('ad-category-advanced').addEventListener('change', (event) => setAdCategory(event.target.value));
  $('analytics-refresh').addEventListener('click', async (event) => { setBusy(event.currentTarget, true, '正在刷新'); try { await loadDashboard(); showMessage('运营数据已刷新'); } catch (error) { showMessage(error.message, true); } finally { setBusy(event.currentTarget, false); } });
  $('home-slide-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-slide-action]'); if (!button) return;
    const article = button.closest('[data-slide-index]'); const index = Number(article?.dataset.slideIndex);
    if (!Number.isInteger(index)) return;
    if (button.dataset.slideAction === 'first') moveHomeSlide(index, 0);
    if (button.dataset.slideAction === 'up') moveHomeSlide(index, index - 1);
    if (button.dataset.slideAction === 'down') moveHomeSlide(index, index + 1);
    if (button.dataset.slideAction === 'remove' && state.homeSlides.length > 1) {
      const [removed] = state.homeSlides.splice(index, 1); if (removed.objectUrl) URL.revokeObjectURL(removed.objectUrl); renderHomeSlides();
    } else if (button.dataset.slideAction === 'remove') showMessage('首页轮播至少保留1张照片', true);
  });

  $('home-form').addEventListener('submit', (event) => {
    event.preventDefault(); submitWith(event.submitter, async () => {
      if (!state.homeSlides.length) throw new Error('首页轮播至少需要1张照片');
      const heroImages = [];
      for (let index = 0; index < state.homeSlides.length; index += 1) {
        const item = state.homeSlides[index];
        heroImages.push(item.file ? await uploadImageFile(item.file, 'home', `slide-${index + 1}`) : item.location);
      }
      await call('/admin/home', 'PATCH', { title: value('home-title'), subtitle: value('home-subtitle'), heroImage: heroImages[0], heroImages });
      $('home-file-name').textContent = '轮播照片和顺序已保存';
    }, '首页轮播已保存，第1张将首先展示');
  });
  $('spot-form').addEventListener('submit', (event) => {
    event.preventDefault(); submitWith(event.submitter, async () => {
      await uploadSelectedImage('spot-file', 'spot-image', 'spots', value('spot-id'), 'spot-preview');
      await call(`/admin/spots/${encodeURIComponent(value('spot-id'))}`, 'PATCH', { name: value('spot-name'), category: value('spot-category'), summary: value('spot-summary'), coverImage: value('spot-image') });
      resetFileChoice('spot-file', 'spot-file-name');
    }, '景点资料已保存，游客端将在一分钟内更新');
  });
  $('audio-form').addEventListener('submit', (event) => {
    event.preventDefault(); submitWith(event.submitter, async () => {
      await uploadSelectedAudio('audio-file', 'audio-url', `audio/${value('audio-id')}`, 25);
      await call(`/admin/narrations/${encodeURIComponent(value('audio-id'))}`, 'PATCH', { transcript: value('audio-transcript'), audioUrl: value('audio-url'), reviewStatus: value('audio-status') });
    }, '讲解资料已保存');
  });
  $('ad-form').addEventListener('submit', (event) => {
    event.preventDefault(); const requestedStatus = event.submitter?.dataset.saveStatus || value('ad-status'); setValue('ad-status', requestedStatus); submitWith(event.submitter, async () => {
      await uploadSelectedImage('ad-file', 'ad-image', 'recommendations', value('ad-id') || value('ad-name'), 'ad-preview');
      const body = { id: value('ad-id'), category: value('ad-category'), status: value('ad-status'), name: value('ad-name'), type: value('ad-type'), sortOrder: Number(value('ad-sort')), productName: value('ad-product'), description: value('ad-description'), address: value('ad-address'), availability: value('ad-hours'), phone: value('ad-phone'), linkUrl: value('ad-link'), image: value('ad-image') };
      const response = await call('/admin/recommendations', 'PUT', body); state.activeAdId = response.data.id;
      resetFileChoice('ad-file', 'ad-file-name');
    }, requestedStatus === 'online' ? '周边推荐已保存并上架' : '周边推荐已保存为草稿');
  });
  $('delete-ad-button').addEventListener('click', async (event) => {
    if (!value('ad-id')) return showMessage('当前是新建内容，无需删除', true);
    if (!window.confirm('确定删除这条周边推荐吗？此操作无法在网页内撤销。')) return;
    setBusy(event.currentTarget, true, '正在删除');
    try { await call(`/admin/recommendations/${encodeURIComponent(value('ad-id'))}`, 'DELETE'); state.activeAdId = ''; await loadDashboard(); showMessage('周边推荐已删除'); }
    catch (error) { showMessage(error.message || '删除失败', true); }
    finally { setBusy(event.currentTarget, false); }
  });

  if (new URLSearchParams(window.location.search).get('smoke') === '1') {
    $('login-error').textContent = '正在检查云端连接';
    call('/home').then(() => { document.body.dataset.cloudSmoke = 'ok'; $('login-error').textContent = '云端自检通过'; $('login-error').classList.remove('error'); }).catch((error) => {
      document.body.dataset.cloudSmoke = 'failed';
      document.body.dataset.cloudSmokeReason = String(error.message || error).slice(0, 120);
      $('login-error').textContent = `云端自检失败：${document.body.dataset.cloudSmokeReason}`;
    });
  }
})();
