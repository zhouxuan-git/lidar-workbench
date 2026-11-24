(function () {
  'use strict';

  const FIELD_OF_VIEW = Math.PI / 4;
  const CAMERA_PRESETS = {
    iso: { azimuth: -0.94, elevation: 0.66, orthographic: false },
    top: { azimuth: -Math.PI / 2, elevation: Math.PI / 2, orthographic: true },
    front: { azimuth: -Math.PI / 2, elevation: 0, orthographic: true },
    side: { azimuth: 0, elevation: 0, orthographic: true },
  };

  const POINT_VERTEX = `
    attribute vec3 aPosition;
    attribute vec3 aRgb;
    attribute vec3 aSemantic;
    attribute float aLabel;
    uniform mat4 uProjection;
    uniform mediump float uSize;
    uniform float uClip;
    uniform float uClipEnabled;
    uniform float uFilter;
    uniform vec2 uZRange;
    uniform int uMode;
    varying mediump vec3 vColor;
    varying mediump float vHidden;

    vec3 heightColor(float height) {
      vec3 blue = vec3(0.21, 0.36, 0.57);
      vec3 mint = vec3(0.24, 0.51, 0.44);
      vec3 amber = vec3(0.72, 0.40, 0.21);
      if (height < 0.52) return mix(blue, mint, height / 0.52);
      return mix(mint, amber, (height - 0.52) / 0.48);
    }

    void main() {
      vHidden = 0.0;
      if ((uClipEnabled > 0.5 && aPosition.z > uClip) ||
          (uFilter >= 0.0 && abs(aLabel - uFilter) > 0.5)) {
        vHidden = 1.0;
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      } else {
        gl_Position = uProjection * vec4(aPosition, 1.0);
      }
      gl_PointSize = uSize;
      vColor = aRgb;
      if (uMode == 1) vColor = aSemantic;
      if (uMode == 2) {
        float height = clamp((aPosition.z - uZRange.x) / max(uZRange.y - uZRange.x, 0.00001), 0.0, 1.0);
        vColor = heightColor(height);
      }
    }
  `;

  const POINT_FRAGMENT = `
    precision mediump float;
    uniform mediump float uSize;
    varying mediump vec3 vColor;
    varying mediump float vHidden;
    void main() {
      if (vHidden > 0.5) discard;
      float radius = distance(gl_PointCoord, vec2(0.5));
      if (uSize > 1.75 && radius > 0.5) discard;
      float opacity = uSize > 1.75 ? 1.0 - 0.40 * smoothstep(0.30, 0.50, radius) : 1.0;
      float luminance = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
      float paleEdge = smoothstep(0.62, 0.97, luminance) * smoothstep(0.20, 0.48, radius);
      gl_FragColor = vec4(vColor * (1.0 - 0.27 * paleEdge), opacity);
    }
  `;

  const LINE_VERTEX = `
    attribute vec3 aPosition;
    uniform mat4 uProjection;
    uniform float uSize;
    void main() {
      gl_Position = uProjection * vec4(aPosition, 1.0);
      gl_PointSize = uSize;
    }
  `;

  const LINE_FRAGMENT = `
    precision mediump float;
    uniform vec4 uColor;
    uniform float uMarker;
    void main() {
      if (uMarker > 0.5) {
        float radius = distance(gl_PointCoord, vec2(0.5));
        if (radius > 0.50) discard;
        gl_FragColor = vec4(mix(vec3(0.99, 0.97, 0.94), uColor.rgb, smoothstep(0.23, 0.33, radius)), uColor.a);
      } else {
        gl_FragColor = uColor;
      }
    }
  `;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  function programFor(gl, vertexSource, fragmentSource, attributes, uniforms) {
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`WebGL shader failed to compile. ${message}`);
      }
      return shader;
    }

    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`WebGL program failed to link. ${message}`);
    }
    return {
      program,
      attributes: Object.fromEntries(attributes.map((name) => [name, gl.getAttribLocation(program, name)])),
      uniforms: Object.fromEntries(uniforms.map((name) => [name, gl.getUniformLocation(program, name)])),
    };
  }

  function multiplyMatrices(a, b) {
    const result = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        result[column * 4 + row] = a[row] * b[column * 4]
          + a[4 + row] * b[column * 4 + 1]
          + a[8 + row] * b[column * 4 + 2]
          + a[12 + row] * b[column * 4 + 3];
      }
    }
    return result;
  }

  function cameraAxes(azimuth, elevation) {
    const yawSin = Math.sin(azimuth), yawCos = Math.cos(azimuth);
    const pitchSin = Math.sin(elevation), pitchCos = Math.cos(elevation);
    return {
      right: [-yawSin, yawCos, 0],
      up: [-pitchSin * yawCos, -pitchSin * yawSin, pitchCos],
      back: [pitchCos * yawCos, pitchCos * yawSin, pitchSin],
    };
  }

  function cameraMatrix(camera, aspect, radius) {
    const { right, up, back } = cameraAxes(camera.azimuth, camera.elevation);
    const eye = camera.target.map((component, index) => component + back[index] * camera.distance);
    const view = [
      right[0], up[0], back[0], 0,
      right[1], up[1], back[1], 0,
      right[2], up[2], back[2], 0,
      -dot(right, eye), -dot(up, eye), -dot(back, eye), 1,
    ];
    const far = camera.distance + Math.hypot(...camera.target) + radius * 4 + 0.01;
    const near = Math.max(radius * 0.0005, 0.000001, camera.distance - Math.hypot(...camera.target) - radius * 2.5);
    if (camera.orthographic) {
      const halfHeight = camera.halfHeight;
      const projection = [
        1 / (halfHeight * aspect), 0, 0, 0,
        0, 1 / halfHeight, 0, 0,
        0, 0, -2 / (far - near), 0,
        0, 0, -(far + near) / (far - near), 1,
      ];
      return multiplyMatrices(projection, view);
    }
    const f = 1 / Math.tan(FIELD_OF_VIEW / 2);
    const projection = [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, 2 * far * near / (near - far), 0,
    ];
    return multiplyMatrices(projection, view);
  }

  function parseHexColor(color) {
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return [160, 179, 195];
    return [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
  }

  function prepareCloud(input) {
    if (!(input?.positions instanceof Float32Array) || !input.positions.length || input.positions.length % 3 !== 0) {
      throw new Error('点云必须包含有效的 XYZ 坐标。');
    }
    const count = input.positions.length / 3;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < input.positions.length; index += 1) {
      const coordinate = input.positions[index];
      if (!Number.isFinite(coordinate)) throw new Error('点云包含无效坐标。');
      const axis = index % 3;
      if (coordinate < min[axis]) min[axis] = coordinate;
      if (coordinate > max[axis]) max[axis] = coordinate;
    }
    const origin = min.map((coordinate, axis) => (coordinate + max[axis]) / 2);
    const bounds = min.map((coordinate, axis) => (max[axis] - coordinate) / 2);
    const localPositions = new Float32Array(input.positions.length);
    for (let index = 0; index < localPositions.length; index += 1) {
      localPositions[index] = input.positions[index] - origin[index % 3];
    }
    const colors = input.colors instanceof Uint8Array && input.colors.length === count * 3
      ? input.colors : new Uint8Array(count * 3).fill(186);
    const labels = input.labels instanceof Uint8Array && input.labels.length === count
      ? input.labels : new Uint8Array(count).fill(255);
    return {
      count,
      colors,
      labels,
      localPositions,
      worldPositions: input.positions,
      origin,
      bounds,
      radius: Math.max(0.001, Math.hypot(...bounds)),
    };
  }

  function gridVertices(cloud) {
    const [halfX, halfY, halfZ] = cloud.bounds;
    const scale = Math.max(halfX, halfY, cloud.radius * 0.10);
    const approximateStep = 2 * scale / 11;
    const decade = 10 ** Math.floor(Math.log10(approximateStep));
    const step = ([1, 2, 5, 10].find((value) => value * decade >= approximateStep) || 10) * decade;
    const countX = Math.max(3, Math.ceil(halfX / step) + 1);
    const countY = Math.max(3, Math.ceil(halfY / step) + 1);
    const extentX = countX * step;
    const extentY = countY * step;
    const floor = -halfZ - cloud.radius * 0.012;
    const lines = [];
    for (let column = -countX; column <= countX; column += 1) {
      const x = column * step;
      lines.push(x, -extentY, floor, x, extentY, floor);
    }
    for (let row = -countY; row <= countY; row += 1) {
      const y = row * step;
      lines.push(-extentX, y, floor, extentX, y, floor);
    }
    return new Float32Array(lines);
  }

  function create(canvas, callbacks = {}) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true })
      || canvas.getContext('experimental-webgl', { alpha: true, antialias: true });
    if (!gl) throw new Error('当前浏览器无法启用 WebGL。');

    const camera = { ...CAMERA_PRESETS.iso, name: 'iso', target: [0, 0, 0], distance: 4, halfHeight: 1, fitted: true };
    const pointers = new Map();
    const modes = { rgb: 0, semantic: 1, height: 2 };
    const listeners = [];
    let gpu;
    let cloud;
    let palette = [];
    let pointSize = 2;
    let mode = 'rgb';
    let filter = null;
    let clip = null;
    let measurement = null;
    let projection;
    let frame = 0;
    let pixelRatio = 1;
    let gridCount = 0;
    let measurementCount = 0;
    let lost = false;
    let disposed = false;

    function initialize() {
      gpu = {
        points: programFor(gl, POINT_VERTEX, POINT_FRAGMENT,
          ['aPosition', 'aRgb', 'aSemantic', 'aLabel'],
          ['uProjection', 'uSize', 'uClip', 'uClipEnabled', 'uFilter', 'uZRange', 'uMode']),
        line: programFor(gl, LINE_VERTEX, LINE_FRAGMENT, ['aPosition'],
          ['uProjection', 'uSize', 'uColor', 'uMarker']),
        positions: gl.createBuffer(),
        rgb: gl.createBuffer(),
        semantic: gl.createBuffer(),
        labels: gl.createBuffer(),
        grid: gl.createBuffer(),
        measurement: gl.createBuffer(),
        pointSizeRange: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE),
        sizeLimit: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      };
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    function upload(buffer, data, usage = gl.STATIC_DRAW) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    }

    function updateSemantic() {
      if (!cloud || lost) return;
      const rgb = new Uint8Array(cloud.count * 3);
      const fallback = [160, 179, 195];
      for (let index = 0; index < cloud.count; index += 1) {
        const color = palette[cloud.labels[index]] || fallback;
        const offset = index * 3;
        rgb[offset] = color[0];
        rgb[offset + 1] = color[1];
        rgb[offset + 2] = color[2];
      }
      upload(gpu.semantic, rgb);
    }

    function uploadCloud() {
      if (!cloud || lost) return;
      upload(gpu.positions, cloud.localPositions);
      upload(gpu.rgb, cloud.colors);
      upload(gpu.labels, cloud.labels);
      updateSemantic();
      const vertices = gridVertices(cloud);
      gridCount = vertices.length / 3;
      upload(gpu.grid, vertices);
    }

    function updateMeasurement() {
      if (!cloud || lost) return;
      const vertices = measurement ? [measurement.start, measurement.end].filter(Boolean) : [];
      measurementCount = vertices.length;
      const local = vertices.flatMap((point) => point.map((coordinate, axis) => coordinate - cloud.origin[axis]));
      upload(gpu.measurement, new Float32Array(local), gl.DYNAMIC_DRAW);
    }

    function setAttribute(location, buffer, size, type, normalized = false) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, type, normalized, 0, 0);
    }

    function releaseAttributes(attributes) {
      for (const location of Object.values(attributes)) gl.disableVertexAttribArray(location);
    }

    function drawLines(buffer, count, color, style = gl.LINES, marker = false) {
      const { program, attributes, uniforms } = gpu.line;
      gl.useProgram(program);
      gl.uniformMatrix4fv(uniforms.uProjection, false, projection);
      gl.uniform4fv(uniforms.uColor, color);
      gl.uniform1f(uniforms.uSize, 10 * pixelRatio);
      gl.uniform1f(uniforms.uMarker, marker ? 1 : 0);
      setAttribute(attributes.aPosition, buffer, 3, gl.FLOAT);
      gl.drawArrays(style, 0, count);
      releaseAttributes(attributes);
    }

    function drawPoints() {
      const { program, attributes, uniforms } = gpu.points;
      gl.useProgram(program);
      gl.uniformMatrix4fv(uniforms.uProjection, false, projection);
      gl.uniform1f(uniforms.uSize, clamp(pointSize * pixelRatio, gpu.pointSizeRange[0], gpu.pointSizeRange[1]));
      gl.uniform1f(uniforms.uFilter, filter === null ? -1 : filter);
      gl.uniform1f(uniforms.uClipEnabled, clip === null ? 0 : 1);
      gl.uniform1f(uniforms.uClip, clip === null ? 0 : clip - cloud.origin[2]);
      gl.uniform2f(uniforms.uZRange, -cloud.bounds[2], cloud.bounds[2]);
      gl.uniform1i(uniforms.uMode, modes[mode]);
      setAttribute(attributes.aPosition, gpu.positions, 3, gl.FLOAT);
      setAttribute(attributes.aRgb, gpu.rgb, 3, gl.UNSIGNED_BYTE, true);
      setAttribute(attributes.aSemantic, gpu.semantic, 3, gl.UNSIGNED_BYTE, true);
      setAttribute(attributes.aLabel, gpu.labels, 1, gl.UNSIGNED_BYTE);
      gl.drawArrays(gl.POINTS, 0, cloud.count);
      releaseAttributes(attributes);
    }

    function draw() {
      if (lost || disposed) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!cloud) return;
      projection = cameraMatrix(camera, canvas.width / canvas.height, cloud.radius);

      gl.depthMask(false);
      drawLines(gpu.grid, gridCount, [0.52, 0.46, 0.38, 0.35]);
      gl.depthMask(true);
      drawPoints();
      if (measurementCount > 0) {
        gl.disable(gl.DEPTH_TEST);
        const color = [0.62, 0.25, 0.17, 1];
        if (measurementCount === 2) drawLines(gpu.measurement, 2, color);
        drawLines(gpu.measurement, measurementCount, color, gl.POINTS, true);
        gl.enable(gl.DEPTH_TEST);
      }
    }

    function invalidate() {
      if (frame || disposed || lost) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        draw();
      });
    }

    function fittedSize() {
      const aspect = canvas.width / canvas.height;
      const { right, up, back } = cameraAxes(camera.azimuth, camera.elevation);
      const [halfX, halfY, halfZ] = cloud.bounds;
      const tangent = Math.tan(FIELD_OF_VIEW / 2);
      let distance = cloud.radius * 1.1;
      let halfHeight = cloud.radius * 0.02;
      for (const x of [-halfX, halfX]) {
        for (const y of [-halfY, halfY]) {
          for (const z of [-halfZ, halfZ]) {
            const corner = [x, y, z];
            const span = Math.max(Math.abs(dot(corner, right)) / aspect, Math.abs(dot(corner, up))) / 0.84;
            halfHeight = Math.max(halfHeight, span);
            distance = Math.max(distance, dot(corner, back) + span / tangent);
          }
        }
      }
      return { distance: camera.orthographic ? cloud.radius * 3 : distance, halfHeight };
    }

    function fitCamera() {
      if (!cloud) return;
      const { distance, halfHeight } = fittedSize();
      camera.target = [0, 0, 0];
      camera.halfHeight = halfHeight;
      camera.distance = distance;
      camera.fitted = true;
    }

    function getCamera() {
      if (!cloud) return null;
      const { azimuth, elevation, orthographic, name, fitted } = camera;
      const size = fittedSize();
      return {
        azimuth,
        elevation,
        orthographic,
        name,
        fitted,
        target: camera.target.map((component) => component / cloud.radius),
        zoom: orthographic ? camera.halfHeight / size.halfHeight : camera.distance / size.distance,
      };
    }

    function applyCamera(state) {
      if (!cloud || !state || disposed) return;
      const previousName = camera.name;
      const { azimuth, elevation, orthographic, name, fitted, target, zoom } = state;
      Object.assign(camera, { azimuth, elevation, orthographic, name, fitted });
      const size = fittedSize();
      camera.target = target.map((component) => component * cloud.radius);
      camera.distance = orthographic ? size.distance : size.distance * zoom;
      camera.halfHeight = orthographic ? size.halfHeight * zoom : size.halfHeight;
      if (previousName !== name) callbacks.onViewChange?.(name);
      invalidate();
    }

    function notifyCamera() {
      if (cloud) callbacks.onCameraChange?.(getCamera());
    }

    function setView(name, notify = true) {
      const preset = CAMERA_PRESETS[name];
      if (!preset) return;
      Object.assign(camera, preset, { name });
      fitCamera();
      callbacks.onViewChange?.(name);
      invalidate();
      if (notify) notifyCamera();
    }

    function resize() {
      const rectangle = canvas.getBoundingClientRect();
      if (!rectangle.width || !rectangle.height) return;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2,
        gpu.sizeLimit[0] / rectangle.width, gpu.sizeLimit[1] / rectangle.height);
      const width = Math.max(1, Math.round(rectangle.width * pixelRatio));
      const height = Math.max(1, Math.round(rectangle.height * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        if (camera.fitted) fitCamera();
      }
      invalidate();
    }

    function orbit(dx, dy) {
      camera.azimuth -= dx * 0.007;
      camera.elevation = clamp(camera.elevation + dy * 0.007, -Math.PI / 2, Math.PI / 2);
      camera.fitted = false;
      if (camera.name !== 'custom') {
        camera.name = 'custom';
        callbacks.onViewChange?.('custom');
      }
      invalidate();
    }

    function zoom(factor) {
      if (camera.orthographic) {
        camera.halfHeight = clamp(camera.halfHeight * factor, cloud.radius * 0.004, cloud.radius * 500);
      } else {
        camera.distance = clamp(camera.distance * factor, cloud.radius * 0.013, cloud.radius * 1000);
      }
      camera.fitted = false;
      invalidate();
    }

    function pan(dx, dy) {
      const { right, up } = cameraAxes(camera.azimuth, camera.elevation);
      const halfHeight = camera.orthographic ? camera.halfHeight : camera.distance * Math.tan(FIELD_OF_VIEW / 2);
      const worldPerPixel = (2 * halfHeight / canvas.height) * pixelRatio;
      camera.target = camera.target.map((component, axis) => component
        + worldPerPixel * (-dx * right[axis] + dy * up[axis]));
      camera.fitted = false;
      invalidate();
    }

    function pick(clientX, clientY) {
      if (!callbacks.onPick || !cloud || lost) return;
      const rectangle = canvas.getBoundingClientRect();
      const width = rectangle.width;
      const height = rectangle.height;
      const mx = clientX - rectangle.left;
      const my = clientY - rectangle.top;
      const matrix = cameraMatrix(camera, canvas.width / canvas.height, cloud.radius);
      const points = cloud.localPositions;
      const relativeClip = clip === null ? Infinity : clip - cloud.origin[2];
      const pickRadius = Math.max(6, pointSize * 0.7);
      const pointRadius = Math.max(1, pointSize / 2);
      let bestPixelDistance = pickRadius * pickRadius;
      let bestDepth = Infinity;
      let bestIndex = -1;
      for (let offset = 0, index = 0; offset < points.length; offset += 3, index += 1) {
        const x = points[offset], y = points[offset + 1], z = points[offset + 2];
        if (z > relativeClip || (filter !== null && cloud.labels[index] !== filter)) continue;
        const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
        if (w <= 0) continue;
        const ndcX = (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w;
        const dx = (ndcX + 1) * 0.5 * width - mx;
        if (Math.abs(dx) > pickRadius) continue;
        const ndcY = (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w;
        const dy = (1 - ndcY) * 0.5 * height - my;
        const distance = dx * dx + dy * dy;
        if (distance > pickRadius * pickRadius) continue;
        const ndcZ = (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w;
        if (ndcZ < -1 || ndcZ > 1) continue;
        const insideSprite = distance <= pointRadius * pointRadius;
        const coveredBySprite = bestPixelDistance <= pointRadius * pointRadius;
        if ((insideSprite && (!coveredBySprite || ndcZ < bestDepth))
          || (!insideSprite && !coveredBySprite && distance < bestPixelDistance)) {
          bestIndex = index;
          bestPixelDistance = distance;
          bestDepth = ndcZ;
        }
      }
      if (bestIndex < 0) return;
      const offset = bestIndex * 3;
      callbacks.onPick({ index: bestIndex, x: cloud.worldPositions[offset],
        y: cloud.worldPositions[offset + 1], z: cloud.worldPositions[offset + 2] });
    }

    function listen(target, type, callback, options) {
      target.addEventListener(type, callback, options);
      listeners.push(() => target.removeEventListener(type, callback, options));
    }

    initialize();
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    listen(window, 'resize', resize);
    const previousTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';

    listen(canvas, 'pointerdown', (event) => {
      if (!cloud || lost || (event.pointerType === 'mouse' && event.button > 2)) return;
      const pointer = { x: event.clientX, y: event.clientY, moved: false, pan: event.button > 0 || event.shiftKey };
      pointers.set(event.pointerId, pointer);
      if (pointers.size > 1) {
        for (const active of pointers.values()) active.moved = true;
      }
      if (event.pointerType === 'mouse') canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
    });

    listen(canvas, 'pointermove', (event) => {
      const pointer = pointers.get(event.pointerId);
      if (!pointer || lost) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.moved && Math.hypot(dx, dy) < 4) return;
      pointer.moved = true;
      if (pointers.size > 1) {
        const other = Array.from(pointers.values()).find((active) => active !== pointer);
        const previousDistance = Math.hypot(pointer.x - other.x, pointer.y - other.y);
        const distance = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (previousDistance > 4 && distance > 4) zoom(previousDistance / distance);
        pan(dx / 2, dy / 2);
      } else if (pointer.pan || event.shiftKey) {
        pan(dx, dy);
      } else {
        orbit(dx, dy);
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      notifyCamera();
    });

    listen(canvas, 'pointerup', (event) => {
      const pointer = pointers.get(event.pointerId);
      pointers.delete(event.pointerId);
      if (pointer && !pointer.moved && !pointer.pan) pick(event.clientX, event.clientY);
    });
    listen(canvas, 'pointercancel', (event) => pointers.delete(event.pointerId));
    listen(canvas, 'lostpointercapture', (event) => pointers.delete(event.pointerId));
    listen(canvas, 'contextmenu', (event) => { if (cloud) event.preventDefault(); });
    listen(canvas, 'wheel', (event) => {
      if (!cloud || lost || event.ctrlKey) return;
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 15 : event.deltaMode === 2 ? 240 : 1;
      zoom(Math.exp(clamp(event.deltaY * scale, -220, 220) * 0.0024));
      notifyCamera();
    }, { passive: false });

    listen(canvas, 'keydown', (event) => {
      if (!cloud || lost || event.altKey || event.ctrlKey || event.metaKey) return;
      const delta = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.key];
      if (delta) {
        event.preventDefault();
        if (event.shiftKey) pan(...delta);
        else orbit(...delta);
        notifyCamera();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoom(0.84);
        notifyCamera();
      } else if (event.key === '-') {
        event.preventDefault();
        zoom(1.19);
        notifyCamera();
      } else if (event.key === '0') {
        event.preventDefault();
        setView('iso');
      }
    });

    listen(canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      lost = true;
      pointers.clear();
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    });
    listen(canvas, 'webglcontextrestored', () => {
      lost = false;
      initialize();
      uploadCloud();
      updateMeasurement();
      resize();
    });

    return {
      setCloud(input) {
        cloud = prepareCloud(input);
        measurement = null;
        uploadCloud();
        updateMeasurement();
        setView('iso', false);
      },
      setClassColors(colors) {
        palette = colors.map(parseHexColor);
        updateSemantic();
        invalidate();
      },
      setColorMode(value) {
        if (!Object.hasOwn(modes, value)) return;
        mode = value;
        invalidate();
      },
      setClassFilter(value) { filter = Number.isInteger(value) ? value : null; invalidate(); },
      setPointSize(value) { if (Number.isFinite(value)) pointSize = clamp(value, 1, 14); invalidate(); },
      setClip(value) { clip = Number.isFinite(value) ? value : null; invalidate(); },
      setView(name) { setView(name); },
      getCamera,
      applyCamera,
      setMeasurement(value) { measurement = value; updateMeasurement(); invalidate(); },
      home() { setView('iso'); },
      capture() { draw(); return canvas.toDataURL('image/png'); },
      dispose() {
        if (disposed) return;
        disposed = true;
        if (frame) window.cancelAnimationFrame(frame);
        observer.disconnect();
        for (const remove of listeners) remove();
        canvas.style.touchAction = previousTouchAction;
        if (lost) return;
        for (const { program } of [gpu.points, gpu.line]) gl.deleteProgram(program);
        for (const key of ['positions', 'rgb', 'semantic', 'labels', 'grid', 'measurement']) gl.deleteBuffer(gpu[key]);
      },
    };
  }

  window.LidarViewer = { create };
})();
