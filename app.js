(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const i18n = window.LidarI18n;
  const {t, localError, describeError, number} = i18n;
  const palette = ['#687e9c', '#526b82', '#3f8a91', '#81568f', '#607f36', '#6654ba', '#ae664b', '#24866c', '#9e601b', '#ae5277', '#436db2', '#807238', '#827357'];
  const classColors = Array.from({length: 256}, (_, index) => palette[index % palette.length]);
  classColors[255] = '#68747e';
  const roomOrder = new Intl.Collator('en', {numeric: true});
  const areaLabel = area => area === 'Demo' ? t('demoArea') : area === 'Imported' ? t('importedArea') : area.replace('_', ' ');
  const pointSize = $('point-size');
  const requests = new Map();
  const messages = new Map();
  const demos = window.LidarDemos;
  const importedScenes = [];
  let catalog = window.LidarData || demos;
  let libraryFiles = null;
  let scenePack = null;
  let area = null;
  let selectedId = null;
  let active = null;
  let requestId = 0;
  let colorMode = 'semantic';
  let classFilter = null;
  let clip = false;
  let tool = 'inspect';
  let selection = null;
  let toastTimer;
  let viewer;
  let compareViewer;
  let comparison = null;
  let compareChoice = catalog.compareScene || '';
  let compareRequestId = 0;
  let compareOpen = true;
  let syncEnabled = true;
  let compareMode = catalog === demos ? 'semantic' : 'rgb';

  window.LidarRegister = (id, encoded) => {
    const request = requests.get(id);
    if (request) request.encoded = encoded;
  };
  window.addEventListener('error', event => {
    if (event.target !== $('viewport')) return;
    showStageMessage('errorView');
  }, true);

  $('language-zh').addEventListener('click', () => switchLanguage('zh'));
  $('language-en').addEventListener('click', () => switchLanguage('en'));
  switchLanguage('en');

  try {
    viewer = window.LidarViewer.create($('viewport'), {
      onPick: pickPoint,
      onViewChange: name => setPressed($('orientations'), 'view', name),
      onCameraChange: camera => { if (camerasLinked()) compareViewer.applyCamera(camera); },
    });
    viewer.setClassColors(classColors);
    viewer.setPointSize(Number(pointSize.value));
  } catch (error) {
    showStageMessage('errorWebGL');
    setStatus('statusWebGL');
    console.error(error);
    for (const button of document.querySelectorAll('button:not(#language-zh):not(#language-en)')) button.disabled = true;
    return;
  }

  function roomName(scene) {
    if (scene.imported) return scene.room;
    const match = /^(.*)_(\d+)$/.exec(scene.room);
    const label = match && i18n.room(match[1]);
    if (label) return label + ' ' + match[2];
    return scene.room;
  }

  function className(index) {
    if (index === 255) return t('unlabeled');
    return (active?.builtIn && i18n.classLabel(index)) || t('classNumber', index);
  }

  function renderMessage(id) {
    const message = messages.get(id);
    const element = $(id);
    element.textContent = message ? message() : '';
    if (id !== 'load-status') element.hidden = !message;
  }

  function setMessage(id, key, ...args) {
    if (key) {
      messages.set(id, typeof key === 'function' ? key : () => t(key, ...args.map(arg => typeof arg === 'function' ? arg() : arg)));
    } else {
      messages.delete(id);
    }
    renderMessage(id);
  }

  function showStageMessage(key, ...args) {
    setMessage('stage-message', key, ...args);
  }

  function notify(key, ...args) {
    clearTimeout(toastTimer);
    setMessage('toast', key, ...args);
    toastTimer = setTimeout(() => setMessage('toast', ''), 4200);
  }

  function setPressed(parent, property, value) {
    for (const button of parent.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset[property] === value));
    }
  }

  function setStatus(key) {
    setMessage('load-status', key);
  }

  function switchLanguage(value) {
    if (!i18n.setLanguage(value)) return;
    document.documentElement.lang = value === 'en' ? 'en' : 'zh-CN';
    document.title = value === 'en' ? 'LiDAR Workbench' : t('brandCaption');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('description'));
    $('language-en').setAttribute('aria-pressed', String(value === 'en'));
    $('language-zh').setAttribute('aria-pressed', String(value === 'zh'));
    i18n.applyStatic();
    $('inspector-title').textContent = t(compareOpen ? 'inspectorLeft' : 'inspector');
    if (!active) $('scene-name').textContent = t('loading');
    renderSceneChoices();
    renderLibrary();
    renderActiveDetails();
    renderComparisonDetails();
    updateClip();
    renderClasses();
    renderSelection();
    updateTool();
    for (const id of messages.keys()) renderMessage(id);
  }

  function allScenes() {
    return [...catalog.scenes, ...importedScenes];
  }

  function sceneSource(scene) {
    if (scene.demo) return t('synthSource');
    if (scene.imported) return t('localFile');
    return scene.id.replace('_', ' ');
  }

  function sceneUnits(scene, suffix = ' m') {
    return scene.imported ? '' : suffix;
  }

  function makeRoomIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(ns, 'svg');
    const reference = document.createElementNS(ns, 'use');
    icon.setAttribute('class', 'icon');
    icon.setAttribute('aria-hidden', 'true');
    reference.setAttribute('href', '#i-cube');
    icon.append(reference);
    return icon;
  }

  function renderLibrary(scrollSelected = false) {
    const entries = allScenes();
    const areas = [...new Set(entries.map(scene => scene.area))];
    const scenes = entries.filter(scene => scene.area === area);
    const search = $('room-search').value.trim().toLowerCase();
    const matches = scenes
      .filter(scene => {
        const match = !scene.imported && /^(.*)_(\d+)$/.exec(scene.room);
        const labels = match ? i18n.roomTerms(match[1]).map(label => label + ' ' + match[2]) : [];
        return [scene.room, roomName(scene), ...labels].some(label => label.toLowerCase().includes(search));
      })
      .sort((a, b) => roomOrder.compare(a.room, b.room));
    const catalogAreaCount = new Set(catalog.scenes.map(scene => scene.area)).size;
    $('dataset-name').textContent = catalog === demos ? t('demoScenes') : 'S3DIS';
    $('dataset-summary').textContent = catalog === demos ? t('demoSummary', number(catalog.scenes.length)) : t('catalogSummary', number(catalogAreaCount), number(catalog.scenes.length));
    $('areas').replaceChildren(...areas.map(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = areaLabel(item);
      button.setAttribute('aria-pressed', String(item === area));
      button.addEventListener('click', () => {
        if (area === item) return;
        area = item;
        $('room-search').value = '';
        const first = entries.find(scene => scene.area === area);
        if (first) loadScene(first);
        else renderLibrary();
      });
      return button;
    }));
    $('room-count').textContent = number(matches.length);
    const roomButtons = matches.map(scene => {
      const button = document.createElement('button');
      const label = document.createElement('span');
      button.type = 'button';
      button.className = 'room';
      button.title = scene.room;
      button.setAttribute('aria-current', String(scene.id === selectedId));
      label.textContent = roomName(scene);
      button.append(makeRoomIcon(), label);
      button.addEventListener('click', () => loadScene(scene));
      return button;
    });
    if (!roomButtons.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-text';
      empty.textContent = t('noRooms');
      roomButtons.push(empty);
    }
    const list = $('rooms');
    const previousScroll = list.scrollTop;
    list.replaceChildren(...roomButtons);
    list.scrollTop = previousScroll;
    const current = list.querySelector('[aria-current="true"]');
    if (scrollSelected && current) list.scrollTop = Math.max(0, current.offsetTop - list.offsetTop - 24);
  }

  function readSceneScript(scene) {
    if (requests.has(scene.id)) return requests.get(scene.id).promise;
    const request = {};
    request.promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scene.file;
      const finish = error => {
        script.remove();
        requests.delete(scene.id);
        if (error) reject(error);
        else if (request.encoded) resolve(request.encoded);
        else reject(localError('errorSceneData'));
      };
      script.onload = () => finish();
      script.onerror = () => finish(localError('errorSceneFile'));
      document.head.append(script);
    });
    requests.set(scene.id, request);
    return request.promise;
  }

  async function readSelectedScene(scene) {
    const filename = scene.file.split('/').pop();
    const file = libraryFiles.get(filename);
    if (!file) throw localError('errorSceneMissing', filename);
    const text = await file.text();
    const match = /^\s*window\.LidarRegister\(\s*("(?:[^"\\]|\\.)*")\s*,\s*"([A-Za-z0-9+/=]+)"\s*\)\s*;\s*$/.exec(text);
    if (!match || JSON.parse(match[1]) !== scene.id) throw localError('errorSceneMismatch');
    return match[2];
  }

  function decodeScene(scene, source) {
    let raw;
    if (typeof source === 'string') {
      const bytes = atob(source);
      raw = new Uint8Array(bytes.length);
      for (let index = 0; index < bytes.length; index++) raw[index] = bytes.charCodeAt(index);
    } else {
      raw = new Uint8Array(source);
    }
    const count = scene.sampleCount;
    if (raw.length !== count * 16) throw localError('errorPointMismatch');
    const view = new DataView(raw.buffer);
    const positions = new Float32Array(count * 3);
    const colors = new Uint8Array(count * 3);
    const labels = new Uint8Array(count);
    for (let index = 0; index < count; index++) {
      const offset = index * 16;
      const vec = index * 3;
      for (let axis = 0; axis < 3; axis++) {
        positions[vec + axis] = view.getFloat32(offset + axis * 4, true);
        if (!Number.isFinite(positions[vec + axis])) throw localError('errorCoordinates');
        colors[vec + axis] = raw[offset + 12 + axis];
      }
      labels[index] = raw[offset + 15];
    }
    return {positions, colors, labels, hasColor:true, hasLabels:true, pointCount:scene.pointCount, sampleCount:count};
  }

  async function readCloud(scene) {
    if (scene.imported) return scene.cloud;
    if (scene.demo) return demos.make(scene.id);
    if (scenePack) return decodeScene(scene, await scenePack.read(scene));
    return decodeScene(scene, await (libraryFiles ? readSelectedScene(scene) : readSceneScript(scene)));
  }

  function computeBounds(positions) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < positions.length; index += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const point = positions[index + axis];
        if (point < min[axis]) min[axis] = point;
        if (point > max[axis]) max[axis] = point;
      }
    }
    return {min,max};
  }

  async function loadScene(scene) {
    const token = ++requestId;
    selectedId = scene.id;
    area = scene.area;
    $('primary-scene').value = selectedId;
    renderLibrary(true);
    setImportProgress(null);
    showStageMessage('readingScene', () => roomName(scene));
    setStatus('readingCloud');
    try {
      const cloud = await readCloud(scene);
      if (token !== requestId) return;
      showCloud(cloud, {scene, builtIn:!scene.imported});
    } catch (error) {
      if (token !== requestId) return;
      selectedId = active?.scene?.id || null;
      $('primary-scene').value = selectedId || '';
      renderLibrary(true);
      showStageMessage(() => describeError(error, 'errorSceneFile'));
      setStatus('loadFailed');
    }
  }

  function showCloud(cloud, options) {
    const bounds = computeBounds(cloud.positions);
    const scene = options.scene;
    const originalClasses = scene && Array.isArray(scene.classes);
    const counts = originalClasses ? scene.classes : Array(256).fill(0);
    if (!originalClasses) for (const index of cloud.labels) counts[index]++;
    active = {...options, cloud, bounds, counts, originalClasses};
    classFilter = null;
    selection = null;
    tool = 'inspect';
    clip = !scene.imported && !scene.demo;
    $('clip-range').value = clip ? '880' : '1000';
    renderActiveDetails();
    setAvailableModes($('modes'), cloud);
    viewer.setClassFilter(null);
    viewer.setMeasurement(null);
    viewer.setCloud(cloud);
    if (options.builtIn) colorMode = 'semantic';
    else colorMode = cloud.hasColor ? 'rgb' : (cloud.hasLabels ? 'semantic' : 'height');
    setColorMode(colorMode);
    updateClip();
    renderClasses();
    renderSelection();
    updateTool();
    showStageMessage('');
    setStatus(scene.demo ? 'demoStatus' : (cloud.sampleCount < cloud.pointCount ? (scene.imported ? 'pointSampleStatus' : 'sampleStatus') : 'ready'));
    updateComparison();
  }

  function renderActiveDetails() {
    if (!active) return;
    const {scene, cloud, bounds} = active;
    $('scene-path').textContent = scene.imported ? t('importedArea') : (scene.demo ? t('syntheticPath') : 'S3DIS / ' + areaLabel(scene.area));
    $('scene-name').textContent = roomName(scene);
    $('stage-source').textContent = sceneSource(scene);
    $('raw-count').textContent = number(cloud.pointCount);
    $('scene-size').textContent = bounds.max.map((value, index) => (value - bounds.min[index]).toFixed(2)).join(' × ') + sceneUnits(scene);
    $('scene-size').title = t(scene.imported ? 'sizeNative' : 'sizeMetric');
    $('height-low').textContent = '0';
    $('height-high').textContent = (bounds.max[2] - bounds.min[2]).toFixed(2) + sceneUnits(scene);
  }

  function setAvailableModes(buttons, cloud) {
    buttons.querySelector('[data-mode="rgb"]').disabled = !cloud.hasColor;
    buttons.querySelector('[data-mode="semantic"]').disabled = !cloud.hasLabels;
  }

  function setColorMode(mode) {
    colorMode = mode;
    viewer.setColorMode(mode);
    setPressed($('modes'), 'mode', mode);
    $('height-legend').hidden = mode !== 'height';
  }

  function camerasLinked() {
    return compareOpen && syncEnabled && comparison !== null;
  }

  function matchLeftCamera() {
    if (camerasLinked()) compareViewer.applyCamera(viewer.getCamera());
  }

  function setCompareOpen(open) {
    compareOpen = open;
    $('compare-toggle').setAttribute('aria-pressed', String(open));
    $('viewports').classList.toggle('is-comparing', open);
    $('compare-panel').hidden = !open;
    $('sync-toggle').hidden = !open;
    $('primary-label').hidden = !open;
    $('inspector-title').textContent = t(open ? 'inspectorLeft' : 'inspector');
    if (open) {
      updateComparison();
      requestAnimationFrame(matchLeftCamera);
    } else {
      compareRequestId++;
    }
  }

  function renderSceneChoices() {
    const groups = new Map();
    const entries = allScenes();
    for (const scene of entries) {
      if (!groups.has(scene.area)) {
        const group = document.createElement('optgroup');
        group.label = areaLabel(scene.area);
        groups.set(scene.area, group);
      }
      groups.get(scene.area).append(new Option(roomName(scene), scene.id));
    }
    if (!entries.some(scene => scene.id === compareChoice)) compareChoice = '';
    $('primary-scene').replaceChildren(...[...groups.values()].map(group => group.cloneNode(true)));
    $('primary-scene').value = selectedId || catalog.defaultScene;
    $('compare-scene').replaceChildren(new Option(t('sameScene'), ''), ...groups.values());
    $('compare-scene').value = compareChoice;
  }

  function compareMessage(key, ...args) {
    setMessage('compare-message', key, ...args);
  }

  function setComparisonMode(mode) {
    if (!comparison) return;
    const cloud = comparison.cloud;
    const available = mode === 'height' || (mode === 'rgb' && cloud.hasColor) || (mode === 'semantic' && cloud.hasLabels);
    const selectedMode = available ? mode : (cloud.hasColor ? 'rgb' : (cloud.hasLabels ? 'semantic' : 'height'));
    compareViewer.setColorMode(selectedMode);
    setPressed($('compare-modes'), 'mode', selectedMode);
    $('compare-height-legend').hidden = selectedMode !== 'height';
  }

  async function updateComparison() {
    if (!compareOpen || !active) return;
    const token = ++compareRequestId;
    const target = allScenes().find(scene => scene.id === compareChoice) || active.scene;
    if (comparison?.scene === target) {
      compareMessage('');
      updateCompareClip();
      matchLeftCamera();
      return;
    }
    compareMessage('readingScene', () => roomName(target));
    try {
      const cloud = target === active.scene ? active.cloud : await readCloud(target);
      if (token !== compareRequestId) return;
      if (!compareViewer) {
        compareViewer = window.LidarViewer.create($('compare-viewport'), {
          onViewChange: name => setPressed($('compare-orientations'), 'view', name),
          onCameraChange: camera => { if (camerasLinked()) viewer.applyCamera(camera); },
        });
        compareViewer.setClassColors(classColors);
        compareViewer.setPointSize(Number(pointSize.value));
      }
      const bounds = target === active.scene ? active.bounds : computeBounds(cloud.positions);
      compareViewer.setCloud(cloud);
      comparison = {scene:target, cloud, bounds};
      renderComparisonDetails();
      setAvailableModes($('compare-modes'), cloud);
      setComparisonMode(compareMode);
      updateCompareClip();
      matchLeftCamera();
      compareMessage('');
    } catch (error) {
      if (token !== compareRequestId) return;
      compareMessage(() => describeError(error, 'errorCompare'));
    }
  }

  function renderComparisonDetails() {
    if (!comparison) return;
    const {scene, bounds} = comparison;
    $('compare-source').textContent = scene.demo ? t('syntheticName', roomName(scene)) : sceneSource(scene);
    $('compare-height-high').textContent = (bounds.max[2] - bounds.min[2]).toFixed(2) + sceneUnits(scene);
  }

  function renderClasses() {
    const list = $('classes');
    const description = $('class-description');
    $('reset-class').hidden = classFilter === null;
    list.replaceChildren();
    if (!active?.cloud.hasLabels) {
      description.textContent = t('noClasses');
      return;
    }
    const items = active.counts
      .map((count, index) => ({count, index}))
      .filter(item => item.count > 0 && item.index !== 255)
      .sort((a,b) => b.count - a.count);
    const denominator = active.originalClasses ? active.cloud.pointCount : active.cloud.sampleCount;
    description.textContent = t(active.originalClasses ? 'annotationStats' : (active.scene.demo ? 'syntheticStats' : 'fileStats'));
    for (const item of items) {
      const button = document.createElement('button');
      const swatch = document.createElement('span');
      const label = document.createElement('span');
      const share = document.createElement('span');
      const percent = item.count / denominator * 100;
      button.type = 'button';
      button.className = 'class-row';
      button.style.setProperty('--class-color', classColors[item.index]);
      button.style.setProperty('--share', percent + '%');
      button.setAttribute('aria-pressed', String(item.index === classFilter));
      swatch.className = 'swatch';
      label.textContent = className(item.index);
      share.className = 'percent numeric';
      share.textContent = percent < 0.1 ? '<0.1%' : percent.toFixed(1) + '%';
      button.title = label.textContent + ' · ' + t('points', number(item.count));
      button.append(swatch, label, share);
      button.addEventListener('click', () => changeFilter(classFilter === item.index ? null : item.index));
      list.append(button);
    }
  }

  function changeFilter(filter) {
    classFilter = filter;
    viewer.setClassFilter(filter);
    if (filter !== null) setColorMode('semantic');
    clearSelection();
    renderClasses();
    updateRenderCount();
  }

  function currentCut(bounds) {
    if (!bounds || !clip) return null;
    const {min,max} = bounds;
    return min[2] + (max[2] - min[2]) * (Number($('clip-range').value) / 1000);
  }

  function countVisible(cloud, cut, filter = null) {
    const {positions,labels} = cloud;
    let count = labels.length;
    if (cut !== null || filter !== null) {
      count = 0;
      for (let index = 0; index < labels.length; index++) {
        if (filter !== null && labels[index] !== filter) continue;
        if (cut !== null && positions[index * 3 + 2] > cut) continue;
        count++;
      }
    }
    return count;
  }

  function updateRenderCount() {
    if (!active) return;
    const count = countVisible(active.cloud, currentCut(active.bounds), classFilter);
    $('render-count').textContent = number(count);
    $('render-count').title = t('countTitle', number(active.cloud.sampleCount), number(count));
  }

  function updateClip() {
    if (!active) return;
    const cut = currentCut(active.bounds);
    viewer.setClip(cut);
    $('clip-options').hidden = cut === null;
    $('clip-tool').setAttribute('aria-pressed', String(cut !== null));
    $('stage-clip').hidden = cut === null;
    if (cut !== null) {
      const height = (cut - active.bounds.min[2]).toFixed(2) + sceneUnits(active.scene);
      $('clip-value').textContent = height;
      $('stage-clip').textContent = t('clipValue', height);
    }
    updateRenderCount();
    updateCompareClip();
  }

  function updateCompareClip() {
    if (!compareOpen || !comparison) return;
    const {bounds, cloud, scene} = comparison;
    const cut = currentCut(bounds);
    compareViewer.setClip(cut);
    $('compare-clip').hidden = cut === null;
    if (cut !== null) $('compare-clip').textContent = '≤ ' + (cut - bounds.min[2]).toFixed(2) + sceneUnits(scene);
    $('compare-count').textContent = t('points', number(countVisible(cloud, cut)));
  }

  function updateTool() {
    $('inspect-tool').setAttribute('aria-pressed', String(tool === 'inspect'));
    $('measure-tool').setAttribute('aria-pressed', String(tool === 'measure'));
    $('selection-title').textContent = t(tool === 'measure' ? 'measureResult' : 'pickResult');
    const touch = matchMedia('(pointer: coarse)').matches;
    $('hint').textContent = t(tool === 'measure' ? 'measureHow' : (touch ? 'leftMeasurePoints' : 'leftMousePoints'));
  }

  function asArray(point) {
    return [point.x,point.y,point.z];
  }

  function pickPoint(point) {
    if (!active || !point) return;
    if (tool === 'measure') {
      if (!selection?.start || selection.end) selection = {start:point};
      else selection.end = point;
      viewer.setMeasurement({start:asArray(selection.start), end:selection.end ? asArray(selection.end) : undefined});
    } else {
      selection = {point};
      viewer.setMeasurement({start:asArray(point)});
    }
    renderSelection();
  }

  function renderSelection() {
    const target = $('selection');
    target.replaceChildren();
    $('clear-selection').hidden = !selection;
    if (!selection) {
      const message = document.createElement('p');
      message.className = 'section-meta';
      message.textContent = t(tool === 'measure' ? 'measureHint' : 'pickHint');
      target.append(message);
      return;
    }
    const result = document.createElement('div');
    result.className = 'selection-data';
    function line(label, value) {
      const row = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = value;
      row.append(label + ' ', strong);
      result.append(row);
    }
    if (selection.point) {
      const point = selection.point;
      for (const axis of ['x', 'y', 'z']) line(axis.toUpperCase(), point[axis].toFixed(3));
      if (active.cloud.hasLabels) line(t('class'), className(active.cloud.labels[point.index]));
    } else {
      line(t('measureStart'), asArray(selection.start).map(value => value.toFixed(2)).join(', '));
      if (selection.end) {
        const {start,end} = selection;
        line(t('measureEnd'), asArray(end).map(value => value.toFixed(2)).join(', '));
        line(t('measureDistance'), Math.hypot(start.x-end.x, start.y-end.y, start.z-end.z).toFixed(3) + (active.scene.imported ? ' ' + t('measureUnit') : ' m'));
      } else line(t('measureEnd'), t('secondPoint'));
    }
    target.append(result);
  }

  function clearSelection() {
    selection = null;
    viewer.setMeasurement(null);
    renderSelection();
  }

  function changeTool(next) {
    tool = next;
    clearSelection();
    updateTool();
  }

  function isScene(scene) {
    return scene && typeof scene.id === 'string' && typeof scene.area === 'string' && typeof scene.room === 'string'
      && Number.isSafeInteger(scene.pointCount) && Number.isSafeInteger(scene.sampleCount)
      && scene.pointCount >= scene.sampleCount && scene.sampleCount > 0 && scene.sampleCount <= 500000
      && /^data\/[\w.-]+\.js$/.test(scene.file)
      && Array.isArray(scene.classes) && scene.classes.length === 13
      && scene.classes.every(value => Number.isSafeInteger(value) && value >= 0);
  }

  async function readLibrary(files) {
    const items = new Map([...files].filter(file => file.name.endsWith('.js')).map(file => [file.name,file]));
    const catalogFile = items.get('catalog.js');
    if (!catalogFile || catalogFile.size > 2000000) throw localError('errorFolder');
    const match = /^\s*window\.LidarData\s*=\s*(\{[\s\S]*\})\s*;\s*$/.exec(await catalogFile.text());
    if (!match) throw localError('errorCatalog');
    let incoming;
    try { incoming = JSON.parse(match[1]); } catch { throw localError('errorCatalog'); }
    return {catalog:incoming, items};
  }

  async function openSceneLibrary(read, filename, fallback) {
    const token = ++requestId;
    setImportProgress(null);
    showStageMessage('readingPack', filename);
    setStatus('checkingPack');
    try {
      const result = await read();
      if (token !== requestId) return;
      const incoming = result.catalog;
      if (!Array.isArray(incoming?.scenes) || !incoming.scenes.length || !incoming.scenes.every(isScene)) {
        throw localError('errorCatalogEmpty');
      }
      scenePack = result.read ? result : null;
      libraryFiles = result.items || null;
      catalog = incoming;
      compareChoice = '';
      renderSceneChoices();
      $('room-search').value = '';
      await loadScene(catalog.scenes.find(scene => scene.id === catalog.defaultScene) || catalog.scenes[0]);
    } catch (error) {
      if (token !== requestId) return;
      showStageMessage('');
      setStatus('importFailed');
      notify(() => describeError(error, fallback));
    }
  }

  function openDataPack(file) {
    if (isRawArchive(file.name)) {
      notify('errorArchive');
      return;
    }
    if (!/\.lidar$/i.test(file.name)) {
      notify('errorPackExtension');
      return;
    }
    return openSceneLibrary(() => window.LidarScenePack.open(file), file.name, 'errorPack');
  }

  function isRawArchive(name) {
    return /\.(?:tar|gz|tgz|zip|7z)$/i.test(name);
  }

  function setImportProgress(value) {
    const progress = $('import-progress');
    progress.hidden = value === null;
    if (value !== null) progress.value = value;
  }

  async function importFile(file) {
    if (/\.lidar$/i.test(file.name)) {
      await openDataPack(file);
      return;
    }
    if (isRawArchive(file.name)) {
      notify('errorArchive');
      return;
    }
    const token = ++requestId;
    showStageMessage('readingFile', file.name);
    setStatus('readingLocal');
    setImportProgress(0);
    try {
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      const cloud = await window.LidarFormats.read(file, {
        onProgress(value) {
          if (token !== requestId) throw new DOMException('Import superseded', 'AbortError');
          setImportProgress(value);
        },
      });
      if (token !== requestId) return;
      const duplicate = importedScenes.filter(scene => scene.cloud.name === cloud.name).length;
      const room = cloud.name + (duplicate ? ' (' + (duplicate + 1) + ')' : '');
      const scene = {id:'local:' + (importedScenes.length + 1), area:'Imported', room, imported:true, cloud};
      importedScenes.push(scene);
      $('room-search').value = '';
      renderSceneChoices();
      loadScene(scene);
    } catch (error) {
      if (token !== requestId) return;
      setImportProgress(null);
      showStageMessage('');
      setStatus('importFailed');
      notify(() => describeError(error, 'errorImport'));
    }
  }

  function loadSnapshot(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
  }

  function fillSnapshot(context, x, y, width, height) {
    const gradient = context.createRadialGradient(x + width / 2, y + height / 3, 0, x + width / 2, y + height / 2, Math.max(width, height) * .68);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#f5f5f2');
    context.fillStyle = gradient;
    context.fillRect(x, y, width, height);
  }

  async function exportSnapshot() {
    if (!active) return;
    try {
      const frames = [{name:roomName(active.scene), image:loadSnapshot(viewer.capture())}];
      const includeComparison = compareOpen && comparison;
      if (includeComparison) frames.push({name:roomName(comparison.scene), image:loadSnapshot(compareViewer.capture())});
      const images = await Promise.all(frames.map(frame => frame.image));
      const gap = includeComparison ? 8 : 0;
      const heading = includeComparison ? 36 : 0;
      const canvas = document.createElement('canvas');
      canvas.width = images.reduce((width, image) => width + image.naturalWidth, 0) + gap;
      canvas.height = Math.max(...images.map(image => image.naturalHeight)) + heading;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      let offset = 0;
      images.forEach((image, index) => {
        fillSnapshot(context, offset, heading, image.naturalWidth, canvas.height - heading);
        context.drawImage(image, offset, heading);
        if (includeComparison) {
          context.fillStyle = '#20211d';
          context.font = '600 15px sans-serif';
          context.fillText(frames[index].name, offset + 10, 23, image.naturalWidth - 20);
        }
        offset += image.naturalWidth + gap;
      });
      const link = document.createElement('a');
      link.download = includeComparison ? 'point-cloud-comparison.png' : 'point-cloud-' + active.scene.room + '.png';
      link.href = canvas.toDataURL('image/png');
      document.body.append(link);
      link.click();
      link.remove();
      notify(includeComparison ? 'savedComparison' : 'savedView');
    } catch {
      notify('snapshotError');
    }
  }

  $('modes').addEventListener('click', event => {
    const button = event.target.closest('[data-mode]');
    if (button && !button.disabled) setColorMode(button.dataset.mode);
  });
  $('orientations').addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (button) viewer.setView(button.dataset.view);
  });
  $('compare-toggle').addEventListener('click', () => setCompareOpen(!compareOpen));
  $('sync-toggle').addEventListener('click', () => {
    syncEnabled = !syncEnabled;
    $('sync-toggle').setAttribute('aria-pressed', String(syncEnabled));
    matchLeftCamera();
  });
  $('primary-scene').addEventListener('change', event => {
    const scene = allScenes().find(item => item.id === event.target.value);
    if (!scene) return;
    $('room-search').value = '';
    loadScene(scene);
  });
  $('compare-scene').addEventListener('change', event => {
    compareChoice = event.target.value;
    updateComparison();
  });
  $('compare-modes').addEventListener('click', event => {
    const button = event.target.closest('[data-mode]');
    if (!button || button.disabled) return;
    compareMode = button.dataset.mode;
    setComparisonMode(compareMode);
  });
  $('compare-orientations').addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (button) compareViewer?.setView(button.dataset.view);
  });
  $('room-search').addEventListener('input', () => renderLibrary());
  $('reset-class').addEventListener('click', () => changeFilter(null));
  $('clear-selection').addEventListener('click', clearSelection);
  $('inspect-tool').addEventListener('click', () => changeTool('inspect'));
  $('measure-tool').addEventListener('click', () => changeTool('measure'));
  $('clip-tool').addEventListener('click', () => {
    clip = !clip;
    if (clip && $('clip-range').value === '1000') $('clip-range').value = '880';
    updateClip();
  });
  $('clip-range').addEventListener('input', updateClip);
  $('home-tool').addEventListener('click', () => {
    viewer.home();
    if (compareOpen && !syncEnabled) compareViewer?.home();
  });
  pointSize.addEventListener('input', () => {
    viewer.setPointSize(Number(pointSize.value));
    compareViewer?.setPointSize(Number(pointSize.value));
    $('size-value').textContent = Number(pointSize.value).toFixed(1) + ' px';
  });
  $('snapshot-tool').addEventListener('click', exportSnapshot);
  $('library-button').addEventListener('click', () => $('library-input').click());
  $('library-input').addEventListener('change', event => {
    const files = [...event.target.files];
    event.target.value = '';
    if (!files.length) return;
    const folderName = files[0].webkitRelativePath?.split('/')[0] || t('scenes');
    openSceneLibrary(() => readLibrary(files), folderName, 'errorCatalog');
  });
  $('archive-button').addEventListener('click', () => $('archive-input').click());
  $('archive-input').addEventListener('change', event => {
    const [file] = event.target.files;
    event.target.value = '';
    if (file) openDataPack(file);
  });
  $('import-button').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', event => {
    const [file] = event.target.files;
    event.target.value = '';
    if (file) importFile(file);
  });
  const initial = catalog.scenes.find(scene => scene.id === catalog.defaultScene) || catalog.scenes[0];
  if (initial) loadScene(initial);
})();
