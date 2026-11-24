(() => {
  'use strict';

  const messages = {
    brandCaption:['点云工作台','Point Cloud Workbench'],
    description:['并排对比、浏览和测量室内三维点云。','Compare, inspect and measure indoor 3D point clouds side by side.'],
    openPack:['打开数据包','Open data pack'],
    openFolder:['打开场景库','Open scene library'],
    importCloud:['导入点云','Import point cloud'],
    languageChooser:['网页语言','Page language'],
    loadingProgress:['导入进度','Import progress'],
    largeGuideTitle:['大点云怎么展示？','Working with large scans'],
    guidePackTitle:['S3DIS 场景库','S3DIS scene library'],
    guidePackBody:['用「打开数据包」选择预处理的 .lidar 文件。每次只读取所选房间。','Open a preprocessed .lidar pack. Only the selected rooms are read.'],
    guideSingleTitle:['单个大点云','Large point files'],
    guideSingleBody:['PLY、PCD 和文本点云可分块读取。视图显示抽样后的点。','PLY, PCD and text scans are read in chunks. The view shows sampled points.'],
    guideCompareTitle:['双栏查看','Compare two views'],
    guideCompareBody:['直接在左右两侧选房间或已导入的文件。','Select a room or an imported file in either view.'],
    scenes:['场景库','Scene library'], area:['区域','Areas'], search:['搜索房间','Search rooms'],
    rooms:['房间','Rooms'], roomList:['房间列表','Room list'], view:['三维视图','3D workspace'],
    loading:['正在载入','Loading'], compare:['双栏对比','Compare'], sync:['同步视角','Sync views'],
    left:['左侧','Left'], right:['右侧','Right'], leftView:['左侧视图','Left view'], rightView:['右侧视图','Right view'],
    leftScene:['左侧场景','Left scene'], rightScene:['右侧对照场景','Right comparison scene'],
    sameScene:['同左侧','Same as left'], leftColor:['左侧点云着色','Left point cloud coloring'],
    rightColor:['右侧点云着色','Right point cloud coloring'],
    rgb:['原色','RGB'], semantic:['语义','Labels'], height:['高度','Height'],
    rgbTitle:['原始颜色','Original colors'], semanticTitle:['语义标签','Semantic labels'],
    heightTitle:['相对高度','Relative height'], compareModeTitle:['右侧{0}','Right {0}'],
    canvasLeft:['左侧三维点云。方向键旋转，加减键缩放，Home 键回到初始视角。','Left 3D point cloud. Use arrow keys to orbit, plus and minus to zoom, and Home to reset.'],
    canvasRight:['右侧三维点云。方向键旋转，加减键缩放，Home 键回到初始视角。','Right 3D point cloud. Use arrow keys to orbit, plus and minus to zoom, and Home to reset.'],
    cameraLeft:['左侧相机方向','Left camera direction'], cameraRight:['右侧相机方向','Right camera direction'],
    iso:['斜视','Iso'], top:['顶视','Top'], front:['正视','Front'], side:['侧视','Side'],
    isoTitle:['斜视','Isometric view'], topTitle:['顶视','Top view'], frontTitle:['正视','Front view'], sideTitle:['侧视','Side view'],
    tools:['视图工具','View tools'], interaction:['交互工具','Interaction tools'],
    pick:['拾取','Pick'], measure:['测距','Measure'], clip:['剖切','Slice'], fit:['适应视图','Fit view'],
    snapshot:['导出截图','Export PNG'], clipHeight:['剖切高度','Slice height'],
    inspector:['数据检查','Inspector'], inspectorLeft:['左侧数据检查','Left inspector'],
    originalPoints:['原始点数','Source points'], renderPoints:['渲染点数','Visible points'],
    size:['场景尺寸','Scene dimensions'], pointSize:['点大小','Point size'],
    classes:['类别分布','Class distribution'], clearFilter:['取消筛选','Clear filter'],
    pickResult:['拾取结果','Point inspection'], measureResult:['测距结果','Measurement'], clear:['清除','Clear'],
    pickHint:['点击视图里的点查看坐标。','Select a point to inspect its coordinates.'],
    measureHint:['点击视图里的第一个点。','Select the first point.'],
    measureHow:['在左侧依次点击两个点测距','Select two points in the left view to measure'],
    leftMeasurePoints:['单指旋转 · 双指缩放和平移','Drag to orbit · Pinch to zoom · Two-finger drag to pan'],
    leftMousePoints:['拖拽旋转 · 滚轮缩放 · Shift 拖拽平移','Drag to orbit · Scroll to zoom · Shift-drag to pan'],
    class:['类别','Class'], classNumber:['类别 {0}','Class {0}'], unlabeled:['未标注','Unlabeled'],
    measureStart:['起点','Start'], measureEnd:['终点','End'], measureDistance:['直线距离','Distance'],
    measureUnit:['坐标单位','coordinate units'], secondPoint:['请点击第二个点','Select the second point'],
    demoArea:['演示','Demos'], importedArea:['本地导入','Local imports'],
    demoScenes:['演示场景','Demo scenes'], synthSource:['合成演示','Synthetic demo'],
    syntheticName:['合成 · {0}','Synthetic · {0}'], syntheticPath:['合成点云 · 演示场景','Synthetic point cloud · Demo scene'],
    localFile:['本地文件','Local file'], demoSummary:['{0} 个合成场景','{0} synthetic scenes'],
    catalogSummary:['{0} 个区域 · {1} 个房间','{0} areas · {1} rooms'],
    noRooms:['没有匹配的房间','No matching rooms'],
    readingScene:['正在读取 {0}…','Loading {0}…'], readingCloud:['正在读取点云','Loading point cloud'],
    readingFile:['正在解析 {0}…','Reading {0}…'], readingLocal:['正在解析本地文件','Reading local file'],
    readingPack:['正在打开 {0}…','Opening {0}…'], checkingPack:['正在检查数据包目录','Checking the data pack index'],
    loadFailed:['读取失败','Load failed'], importFailed:['导入失败','Import failed'],
    demoStatus:['合成演示数据','Synthetic demo data'], sampleStatus:['按房间采样显示','Sampled room view'],
    pointSampleStatus:['分块读取 · 抽样显示','Read in chunks · Sampled view'], ready:['数据已就绪','Data ready'],
    sizeMetric:['采样点的 X × Y × Z 尺寸，米','Sampled X × Y × Z extents in meters'],
    sizeNative:['采样点的 X × Y × Z 尺寸，原坐标单位','Sampled X × Y × Z extents in source units'],
    noClasses:['这份点云没有类别字段。','This point cloud has no class field.'],
    annotationStats:['人工标注 · 按原始点数统计','Human labels · Counts from source data'],
    syntheticStats:['合成类别 · 点击筛选','Synthetic labels · Select to filter'],
    fileStats:['文件类别 · 按采样点统计','File labels · Counts from sampled points'],
    points:['{0} 点','{0} points'], countTitle:['{0} 个采样点，当前显示 {1} 个','{0} sampled points · {1} visible'],
    clipValue:['剖切 ≤ {0}','Slice ≤ {0}'],
    savedComparison:['已导出左右视图。','Both views exported.'],
    savedView:['已导出当前视图。','View exported.'],
    snapshotError:['无法生成当前视图截图。','The current view could not be exported.'],
    errorView:['三维视图发生错误。请刷新页面重试。','The 3D view encountered an error. Refresh the page to retry.'],
    errorWebGL:['无法启动三维视图。请用启用了硬件加速的 Chrome 或 Edge 打开。','The 3D view could not start. Try Chrome or Edge with hardware acceleration enabled.'],
    statusWebGL:['WebGL 初始化失败','WebGL initialization failed'],
    errorSceneData:['场景文件缺少点云数据。','The scene file has no point cloud data.'],
    errorSceneFile:['无法读取场景文件，请确认 data 文件夹与网页同在。','Could not read the scene. Keep the data folder beside the page.'],
    errorSceneMissing:['场景库缺少 {0}。','The scene library is missing {0}.'],
    errorSceneMismatch:['场景文件与目录清单不匹配。','The scene file does not match the library index.'],
    errorPointMismatch:['场景点数与目录清单不匹配。','The point count does not match the library index.'],
    errorCoordinates:['场景包含无效坐标。','The scene contains invalid coordinates.'],
    errorValidCoordinates:['点云必须包含有效的 XYZ 坐标。','The point cloud must contain valid XYZ coordinates.'],
    errorCompare:['无法读取右侧点云。','Could not read the comparison point cloud.'],
    errorFolder:['请选择点云工作台里的 data 文件夹。','Select the data folder from LiDAR Workbench.'],
    errorCatalog:['场景库的目录清单格式不正确。','The scene library index has an invalid format.'],
    errorCatalogEmpty:['场景库没有有效的点云目录。','The scene library has no valid point cloud index.'],
    errorArchive:['S3DIS 压缩包需先预处理。请通过「打开数据包」选择已准备的 .lidar 文件。','Preprocess the S3DIS archive first, then choose its .lidar file with Open data pack.'],
    errorPackExtension:['请选择已经预处理的 .lidar 数据包。','Choose a preprocessed .lidar data pack.'],
    errorPack:['无法打开此数据包。请选择工作台生成的 .lidar 文件。','Could not open the data pack. Choose a .lidar file created for this workbench.'],
    errorPackVersion:['数据包版本不受支持，请重新生成数据包。','This data pack version is unsupported. Recreate the pack.'],
    errorIncompletePack:['数据包不完整，请重新复制文件。','The data pack is incomplete. Copy the file again.'],
    errorPackRoom:['数据包中找不到此场景。','This scene is missing from the data pack.'],
    errorImport:['无法读取此点云文件，请检查格式并重试。','Could not read this point cloud file. Check its format and try again.'],
  };
  const roomLabels = {
    office:['办公室','Office'], conferenceRoom:['会议室','Conference room'], hallway:['走廊','Hallway'],
    copyRoom:['复印室','Copy room'], storage:['储藏室','Storage room'], pantry:['茶水间','Pantry'],
    lobby:['大厅','Lobby'], lounge:['休息区','Lounge'], openspace:['开放空间','Open space'],
    WC:['卫生间','Restroom'], auditorium:['报告厅','Auditorium'],
  };
  const classes = [
    ['顶棚','Ceiling'], ['地板','Floor'], ['墙面','Wall'], ['梁','Beam'], ['柱','Column'],
    ['窗','Window'], ['门','Door'], ['桌子','Table'], ['椅子','Chair'],
    ['沙发','Sofa'], ['书柜','Bookcase'], ['白板','Whiteboard'], ['杂物','Clutter'],
  ];
  const parserErrors = {
    '没有找到有效的三维点。请检查文件是否含有数值型 X、Y、Z 坐标。':'No valid 3D points were found. Check that the file contains numeric X, Y and Z coordinates.',
    '文件头缺少 X、Y、Z 字段。请以包含坐标的点云格式导出。':'The file header is missing X, Y or Z fields. Export the cloud with coordinates.',
    '点云文件头不完整或过长，请检查文件是否已完整下载。':'The header is incomplete or too long. Check that the file finished downloading.',
    '文本存在过长的记录。请检查点是否逐行保存。':'A line is too long. Check that the file contains one point per line.',
    '点云数据行少于文件头声明的数量，文件可能未下载完整。':'The file has fewer data rows than declared. Check that it finished downloading.',
    '二进制点云数据短于文件头声明的大小，文件可能未下载完整。':'The binary data is shorter than declared. Check that the file finished downloading.',
    '文件不含有效的 PLY 文件头。':'The file has no valid PLY header.',
    'PLY 文件头的元素数量无效。':'The PLY header declares an invalid element count.',
    'PLY 文件不含 vertex 顶点数据。':'The PLY file contains no vertex data.',
    '暂不支持带列表或自定义类型的 PLY 顶点属性。请导出为仅包含标准点属性的 PLY。':'Vertex lists and custom vertex types are unsupported. Export a PLY with standard vertex properties.',
    '无法识别此 PLY 编码。请导出 ASCII 或标准二进制 PLY。':'Unrecognized PLY encoding. Export an ASCII or standard binary PLY.',
    '此二进制 PLY 在顶点前含有变长数据。请将顶点保存为文件中的第一组数据。':'Variable-length binary data precedes the vertices. Save the vertices as the first element group.',
    '暂不支持压缩 PCD。请导出为普通二进制 PCD 或 ASCII PCD。':'Compressed PCD is unsupported. Export a standard binary or ASCII PCD.',
    'PCD 文件头的 FIELDS、SIZE、TYPE 或 COUNT 不匹配。':'The PCD header has inconsistent FIELDS, SIZE, TYPE or COUNT entries.',
    'PCD 包含不受支持的字段类型或无效 COUNT。':'The PCD header contains an unsupported field type or invalid COUNT.',
    'PCD 文件头的点数或字段大小无效。':'The PCD header has an invalid point count or field size.',
    '无法识别此 PCD 编码。请导出 ASCII 或普通二进制 PCD。':'Unrecognized PCD encoding. Export an ASCII or standard binary PCD.',
    '请选择一个非空点云文件。':'Choose a non-empty point cloud file.',
    '支持 PLY、PCD、XYZ、TXT 和 CSV 点云文件。请先解压数据或转换格式。':'Choose a PLY, PCD, XYZ, TXT or CSV point cloud. Extract or convert the file first if needed.',
  };
  const knownErrors = {
    'invalid-pack':'errorPack', 'unsupported-pack-version':'errorPackVersion',
    'incomplete-pack':'errorIncompletePack', 'missing-pack-scene':'errorPackRoom',
    '点云必须包含有效的 XYZ 坐标。':'errorValidCoordinates', '点云包含无效坐标。':'errorCoordinates',
    '当前浏览器无法启用 WebGL。':'errorWebGL',
  };

  let language = 'en';
  let formatter = new Intl.NumberFormat('en-US');
  const getWord = list => list?.[language === 'en' ? 1 : 0];
  const t = (key, ...args) => (getWord(messages[key]) || key).replace(/\{(\d+)\}/g, (_, index) => args[index] ?? '');

  function setLanguage(value) {
    if (value !== 'en' && value !== 'zh') return false;
    language = value;
    formatter = new Intl.NumberFormat(value === 'en' ? 'en-US' : 'zh-CN');
    return true;
  }

  function describeError(error, fallback) {
    if (error?.translation) return t(error.translation.key, ...error.translation.args);
    const known = knownErrors[error?.code] || knownErrors[error?.message];
    if (typeof known === 'string') return t(known);
    if (Object.hasOwn(parserErrors, error?.message)) {
      return language === 'en' ? parserErrors[error.message] : error.message;
    }
    return t(fallback);
  }

  function localError(key, ...args) {
    const error = new Error(t(key, ...args));
    error.translation = {key, args};
    return error;
  }

  function applyStatic(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    root.querySelectorAll('[data-i18n-label]').forEach(element => {
      element.setAttribute('aria-label', t(element.dataset.i18nLabel));
    });
    const labelText = {
      '#library-button':'openFolder', '#import-button':'importCloud', '.library .panel-title h2':'scenes',
      '.list-heading span:first-child':'rooms', '#compare-toggle':'compare', '#sync-toggle':'sync',
      '#primary-label > span':'left', 'label[for="compare-scene"] > span':'right',
      '#inspect-tool':'pick', '#measure-tool':'measure', '#clip-tool':'clip', '#home-tool':'fit',
      '#snapshot-tool':'snapshot', 'label[for="clip-range"]':'clipHeight', 'label[for="point-size"]':'pointSize',
      '.scene-stats div:nth-child(1) dt':'originalPoints', '.scene-stats div:nth-child(2) dt':'renderPoints',
      '.scene-stats div:nth-child(3) dt':'size', '#classes-title':'classes', '#reset-class':'clearFilter',
      '#clear-selection':'clear',
    };
    for (const [selector, key] of Object.entries(labelText)) {
      const element = root.querySelector(selector);
      if (!element || element.querySelector('[data-i18n]')) continue;
      const value = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (value) value.textContent = t(key);
      else element.textContent = t(key);
    }
    const ariaLabels = {
      '.library':'scenes', '#areas':'area', '#room-search':'search', '#rooms':'roomList',
      '.editor':'view', '.viewport-panel:not(#compare-panel)':'leftView', '#compare-panel':'rightView',
      '#primary-scene':'leftScene', '#compare-scene':'rightScene', '#modes':'leftColor',
      '#compare-modes':'rightColor', '#viewport':'canvasLeft', '#compare-viewport':'canvasRight',
      '#orientations':'cameraLeft', '#compare-orientations':'cameraRight',
      '.tool-row':'tools', '.tool-row [role="group"]':'interaction', '.inspector':'inspector',
    };
    for (const [selector, key] of Object.entries(ariaLabels)) root.querySelector(selector)?.setAttribute('aria-label', t(key));
    const search = root.querySelector('#room-search');
    if (search) search.placeholder = t('search');
    for (const element of root.querySelectorAll('button[data-mode], button[data-view]')) {
      const key = element.dataset.mode || element.dataset.view;
      const title = t(key + 'Title');
      const compare = element.closest('#compare-modes, #compare-orientations');
      element.textContent = t(key);
      element.setAttribute('aria-label', compare ? t('compareModeTitle', title.toLowerCase()) : title);
    }
  }

  window.LidarI18n = {
    get language() { return language; },
    setLanguage, t, applyStatic, localError, describeError,
    number: value => formatter.format(value),
    room: name => getWord(roomLabels[name]),
    roomTerms: name => roomLabels[name] || [],
    classLabel: index => getWord(classes[index]),
  };
})();
