(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const classLabels = ['顶棚', '地板', '墙面', '梁', '柱', '窗', '门', '桌子', '椅子', '沙发', '书柜', '白板', '杂物'];
  const palette = ['#a6bbd7', '#547b9d', '#7db4c9', '#d0a3dc', '#97bd6d', '#7c6eed', '#d59a83', '#73e1bd', '#ffca8a', '#ed91bc', '#7c9eff', '#f2eed7', '#b6ab88'];
  const classColors = Array.from({length: 256}, (_, index) => palette[index % palette.length]);
  classColors[255] = '#a3aeba';
  const number = new Intl.NumberFormat('zh-CN');
  const roomOrder = new Intl.Collator('en', {numeric: true});
  const roomLabels = {office: '办公室', conferenceRoom: '会议室', hallway: '走廊', copyRoom: '复印室', storage: '储藏室', pantry: '茶水间', lobby: '大厅', lounge: '休息区', openspace: '开放空间', WC: '卫生间', auditorium: '报告厅'};
  const areaLabel = area => area === 'Demo' ? '演示' : area.replace('_', ' ');
  const pointSize = $('point-size');
  const requests = new Map();
  const demoScene = { id:'demo/office', area:'Demo', room:'office_1', demo:true };
  let catalog = window.LidarData || {scenes:[demoScene], defaultScene:demoScene.id};
  let libraryFiles = null;
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

  window.LidarRegister = (id, encoded) => {
    const request = requests.get(id);
    if (request) request.encoded = encoded;
  };
  window.addEventListener('error', event => {
    if (event.target !== $('viewport')) return;
    showStageMessage('三维视图发生错误。请刷新页面重试。');
  }, true);

  try {
    viewer = window.LidarViewer.create($('viewport'), {
      onPick: pickPoint,
      onViewChange: name => setPressed($('orientations'), 'view', name),
    });
    viewer.setClassColors(classColors);
    viewer.setPointSize(Number(pointSize.value));
  } catch (error) {
    showStageMessage('无法启动三维视图。请用启用了硬件加速的 Chrome 或 Edge 打开。');
    $('load-status').textContent = 'WebGL 初始化失败';
    console.error(error);
    for (const button of document.querySelectorAll('button')) button.disabled = true;
    return;
  }

  function roomName(scene) {
    const match = /^(.*)_(\d+)$/.exec(scene.room);
    if (match && roomLabels[match[1]]) return roomLabels[match[1]] + ' ' + match[2];
    return scene.room;
  }

  function className(index) {
    if (index === 255) return '未标注';
    return (active?.builtIn && classLabels[index]) || ('类别 ' + index);
  }

  function showStageMessage(message) {
    $('stage-message').textContent = message;
    $('stage-message').hidden = !message;
  }

  function notify(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3400);
  }

  function setPressed(parent, property, value) {
    for (const button of parent.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset[property] === value));
    }
  }

  function setStatus(message) {
    $('load-status').textContent = message;
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
    const areas = [...new Set(catalog.scenes.map(scene => scene.area))];
    const scenes = catalog.scenes.filter(scene => scene.area === area);
    const search = $('room-search').value.trim().toLowerCase();
    const matches = scenes
      .filter(scene => (scene.room + ' ' + roomName(scene)).toLowerCase().includes(search))
      .sort((a, b) => roomOrder.compare(a.room, b.room));
    $('dataset-name').textContent = catalog === demoCatalog ? '演示场景' : 'S3DIS';
    $('dataset-summary').textContent = catalog === demoCatalog ? '合成点云' : areas.length + ' 个区域 · ' + catalog.scenes.length + ' 个房间';
    $('areas').replaceChildren(...areas.map(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = areaLabel(item);
      button.setAttribute('aria-pressed', String(item === area));
      button.addEventListener('click', () => {
        if (area === item) return;
        area = item;
        $('room-search').value = '';
        const first = catalog.scenes.find(scene => scene.area === area);
        if (first) loadScene(first);
        else renderLibrary();
      });
      return button;
    }));
    $('room-count').textContent = number.format(matches.length);
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
      empty.textContent = '没有匹配的房间';
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
        else reject(new Error('场景文件缺少点云数据。'));
      };
      script.onload = () => finish();
      script.onerror = () => finish(new Error('无法读取场景文件，请确认 data 文件夹与网页同在。'));
      document.head.append(script);
    });
    requests.set(scene.id, request);
    return request.promise;
  }

  async function readSelectedScene(scene) {
    const filename = scene.file.split('/').pop();
    const file = libraryFiles.get(filename);
    if (!file) throw new Error('场景库缺少 ' + filename + '。');
    const text = await file.text();
    const match = /^\s*window\.LidarRegister\(\s*("(?:[^"\\]|\\.)*")\s*,\s*"([A-Za-z0-9+/=]+)"\s*\)\s*;\s*$/.exec(text);
    if (!match || JSON.parse(match[1]) !== scene.id) throw new Error('场景文件与目录清单不匹配。');
    return match[2];
  }

  function decodeScene(scene, encoded) {
    const bytes = atob(encoded);
    const count = scene.sampleCount;
    if (bytes.length !== count * 16) throw new Error('场景点数与目录清单不匹配。');
    const raw = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index++) raw[index] = bytes.charCodeAt(index);
    const view = new DataView(raw.buffer);
    const positions = new Float32Array(count * 3);
    const colors = new Uint8Array(count * 3);
    const labels = new Uint8Array(count);
    for (let index = 0; index < count; index++) {
      const offset = index * 16;
      const vec = index * 3;
      for (let axis = 0; axis < 3; axis++) {
        positions[vec + axis] = view.getFloat32(offset + axis * 4, true);
        if (!Number.isFinite(positions[vec + axis])) throw new Error('场景包含无效坐标。');
        colors[vec + axis] = raw[offset + 12 + axis];
      }
      labels[index] = raw[offset + 15];
    }
    return {positions, colors, labels, hasColor:true, hasLabels:true, pointCount:scene.pointCount, sampleCount:count};
  }

  function makeDemo() {
    const points = [], colors = [], labels = [];
    let seed = 16900;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    function surface(min, max, label, count, rgb) {
      for (let index = 0; index < count; index++) {
        for (let axis = 0; axis < 3; axis++) {
          points.push(min[axis] + random() * (max[axis] - min[axis]) + (random() - .5) * .015);
          colors.push(rgb[axis] + Math.floor(random() * 24) - 12);
        }
        labels.push(label);
      }
    }
    function box(min, max, classId, count, rgb) {
      for (let axis = 0; axis < 3; axis++) {
        for (const end of [min[axis], max[axis]]) {
          const left = min.slice(), right = max.slice();
          left[axis] = end;
          right[axis] = end;
          surface(left, right, classId, count, rgb);
        }
      }
    }
    surface([-4,-2.9,0], [4,2.9,0], 1, 6100, [119,130,129]);
    surface([-4,-2.9,0], [4,-2.9,2.9], 2, 3400, [185,181,172]);
    surface([-4,-2.9,0], [-4,2.9,2.9], 2, 2750, [185,181,172]);
    surface([-3.1,-2.87,.97], [-.44,-2.87,2.27], 5, 1300, [115,164,188]);
    surface([2.36,-2.85,.05], [3.68,-2.85,2.23], 6, 900, [157,121,93]);
    box([-2.45,-1.17,.71], [1.96,.46,.82], 7, 650, [168,129,90]);
    for (const x of [-2.29, 1.79]) {
      for (const y of [-1.05, .34]) box([x,y,0], [x+.1,y+.1,.73], 7, 66, [89,97,101]);
    }
    for (const x of [-1.87, -.43, 1.13]) {
      box([x,-1.96,.39], [x+.57,-1.45,.48], 8, 175, [111,122,145]);
      box([x,-2.03,.46], [x+.57,-1.96,.92], 8, 125, [111,122,145]);
      box([x,.68,.39], [x+.57,1.23,.48], 8, 175, [111,122,145]);
      box([x,1.22,.46], [x+.57,1.29,.92], 8, 125, [111,122,145]);
    }
    box([-3.85,.76,.05], [-3.38,2.52,1.56], 10, 390, [149,120,99]);
    return {positions:new Float32Array(points), colors:new Uint8Array(colors), labels:new Uint8Array(labels), hasColor:true, hasLabels:true, pointCount:labels.length, sampleCount:labels.length};
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
    renderLibrary(true);
    showStageMessage('正在读取 ' + roomName(scene) + '…');
    setStatus('正在读取点云');
    try {
      const cloud = scene.demo ? makeDemo() : decodeScene(scene, await (libraryFiles ? readSelectedScene(scene) : readSceneScript(scene)));
      if (token !== requestId) return;
      showCloud(cloud, {scene, builtIn:true});
    } catch (error) {
      if (token !== requestId) return;
      selectedId = active?.scene?.id || null;
      renderLibrary(true);
      showStageMessage(error.message);
      setStatus('读取失败');
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
    clip = Boolean(scene && !scene.demo);
    $('clip-range').value = clip ? '880' : '1000';
    $('scene-path').textContent = scene ? (scene.demo ? '合成点云 · 演示场景' : 'S3DIS / ' + areaLabel(scene.area)) : '本地导入';
    $('scene-name').textContent = scene ? roomName(scene) : cloud.name;
    $('stage-source').textContent = scene ? (scene.demo ? '合成演示' : scene.id.replace('_', ' ')) : '本地文件';
    $('raw-count').textContent = number.format(cloud.pointCount);
    $('scene-size').textContent = bounds.max.map((value, index) => (value - bounds.min[index]).toFixed(2)).join(' × ') + (scene ? ' m' : '');
    $('scene-size').title = scene ? '采样点的 X × Y × Z 尺寸，米' : '采样点的 X × Y × Z 尺寸，原坐标单位';
    $('height-low').textContent = '0';
    $('height-high').textContent = (bounds.max[2] - bounds.min[2]).toFixed(2) + (scene ? ' m' : '');
    $('modes').querySelector('[data-mode="rgb"]').disabled = !cloud.hasColor;
    $('modes').querySelector('[data-mode="semantic"]').disabled = !cloud.hasLabels;
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
    setStatus(scene?.demo ? '合成演示数据' : (cloud.sampleCount < cloud.pointCount ? '按房间采样显示' : '数据已就绪'));
  }

  function setColorMode(mode) {
    colorMode = mode;
    viewer.setColorMode(mode);
    setPressed($('modes'), 'mode', mode);
    $('height-legend').hidden = mode !== 'height';
  }

  function renderClasses() {
    const list = $('classes');
    const description = $('class-description');
    $('reset-class').hidden = classFilter === null;
    list.replaceChildren();
    if (!active?.cloud.hasLabels) {
      description.textContent = '这份点云没有类别字段。';
      return;
    }
    const items = active.counts
      .map((count, index) => ({count, index}))
      .filter(item => item.count > 0 && item.index !== 255)
      .sort((a,b) => b.count - a.count);
    const denominator = active.originalClasses ? active.cloud.pointCount : active.cloud.sampleCount;
    description.textContent = active.originalClasses ? '人工标注 · 按原始点数统计' : (active.scene?.demo ? '合成类别 · 点击筛选' : '文件类别 · 按采样点统计');
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
      button.title = label.textContent + ' · ' + number.format(item.count) + ' 点';
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

  function currentCut() {
    if (!active || !clip) return null;
    const {min,max} = active.bounds;
    return min[2] + (max[2] - min[2]) * (Number($('clip-range').value) / 1000);
  }

  function updateRenderCount() {
    if (!active) return;
    const {positions,labels} = active.cloud;
    const cut = currentCut();
    let count = labels.length;
    if (cut !== null || classFilter !== null) {
      count = 0;
      for (let index = 0; index < labels.length; index++) {
        if (classFilter !== null && labels[index] !== classFilter) continue;
        if (cut !== null && positions[index * 3 + 2] > cut) continue;
        count++;
      }
    }
    $('render-count').textContent = number.format(count);
    $('render-count').title = number.format(active.cloud.sampleCount) + ' 个采样点，当前显示 ' + number.format(count) + ' 个';
  }

  function updateClip() {
    if (!active) return;
    const cut = currentCut();
    viewer.setClip(cut);
    $('clip-options').hidden = cut === null;
    $('clip-tool').setAttribute('aria-pressed', String(cut !== null));
    $('stage-clip').hidden = cut === null;
    if (cut !== null) {
      const height = (cut - active.bounds.min[2]).toFixed(2) + (active.scene ? ' m' : '');
      $('clip-value').textContent = height;
      $('stage-clip').textContent = '剖切 ≤ ' + height;
    }
    updateRenderCount();
  }

  function updateTool() {
    $('inspect-tool').setAttribute('aria-pressed', String(tool === 'inspect'));
    $('measure-tool').setAttribute('aria-pressed', String(tool === 'measure'));
    $('selection-title').textContent = tool === 'measure' ? '测距结果' : '拾取结果';
    $('hint').textContent = tool === 'measure' ? '依次点击两个点测量直线距离' : '拖拽旋转 · 滚轮缩放 · Shift 拖拽平移';
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
      message.textContent = tool === 'measure' ? '点击视图里的第一个点。' : '点击视图里的点查看坐标。';
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
      if (active.cloud.hasLabels) line('类别', className(active.cloud.labels[point.index]));
    } else {
      line('起点', asArray(selection.start).map(value => value.toFixed(2)).join(', '));
      if (selection.end) {
        const {start,end} = selection;
        line('终点', asArray(end).map(value => value.toFixed(2)).join(', '));
        line('直线距离', Math.hypot(start.x-end.x, start.y-end.y, start.z-end.z).toFixed(3) + (active.scene ? ' m' : ' 坐标单位'));
      } else line('终点', '请点击第二个点');
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
    if (!catalogFile || catalogFile.size > 2000000) throw new Error('请选择点云工作台里的 data 文件夹。');
    const match = /^\s*window\.LidarData\s*=\s*(\{[\s\S]*\})\s*;\s*$/.exec(await catalogFile.text());
    if (!match) throw new Error('场景库的目录清单格式不正确。');
    const incoming = JSON.parse(match[1]);
    if (!Array.isArray(incoming.scenes) || !incoming.scenes.length || !incoming.scenes.every(isScene)) {
      throw new Error('场景库没有有效的点云目录。');
    }
    libraryFiles = items;
    catalog = incoming;
    $('room-search').value = '';
    await loadScene(catalog.scenes.find(scene => scene.id === catalog.defaultScene) || catalog.scenes[0]);
  }

  const demoCatalog = window.LidarData ? null : catalog;
  $('modes').addEventListener('click', event => {
    const button = event.target.closest('[data-mode]');
    if (button && !button.disabled) setColorMode(button.dataset.mode);
  });
  $('orientations').addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (button) viewer.setView(button.dataset.view);
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
  $('home-tool').addEventListener('click', () => viewer.home());
  pointSize.addEventListener('input', () => {
    viewer.setPointSize(Number(pointSize.value));
    $('size-value').textContent = Number(pointSize.value).toFixed(1) + ' px';
  });
  $('snapshot-tool').addEventListener('click', () => {
    if (!active) return;
    try {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        const background = context.createRadialGradient(canvas.width / 2, canvas.height / 3, 0, canvas.width / 2, canvas.height / 2, canvas.width * .68);
        background.addColorStop(0, '#213849');
        background.addColorStop(1, '#0a151f');
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        const link = document.createElement('a');
        link.download = 'point-cloud-' + (active.scene?.room || 'imported') + '.png';
        link.href = canvas.toDataURL('image/png');
        document.body.append(link);
        link.click();
        link.remove();
        notify('已导出当前视图。');
      };
      image.onerror = () => notify('无法生成当前视图截图。');
      image.src = viewer.capture();
    } catch {
      notify('无法生成当前视图截图。');
    }
  });
  $('library-button').addEventListener('click', () => $('library-input').click());
  $('library-input').addEventListener('change', async event => {
    const files = [...event.target.files];
    event.target.value = '';
    if (!files.length) return;
    try {
      await readLibrary(files);
    } catch (error) {
      notify(error.message);
    }
  });
  $('import-button').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', async event => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    const token = ++requestId;
    showStageMessage('正在解析 ' + file.name + '…');
    setStatus('正在解析本地文件');
    try {
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      const cloud = await window.LidarFormats.read(file);
      if (token !== requestId) return;
      selectedId = null;
      renderLibrary();
      showCloud(cloud, {builtIn:false});
    } catch (error) {
      if (token !== requestId) return;
      showStageMessage('');
      setStatus('导入失败');
      notify(error.message);
    }
  });
  const initial = catalog.scenes.find(scene => scene.id === catalog.defaultScene) || catalog.scenes[0];
  if (initial) loadScene(initial);
})();
