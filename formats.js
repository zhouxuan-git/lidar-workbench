(function () {
  'use strict';

  const maxBytes = 384 * 1024 * 1024;
  const maxRenderedPoints = 500000;
  const maxHeaderBytes = 128 * 1024;
  const fallbackColor = [168, 192, 212];
  const asciiDecoder = new TextDecoder('windows-1252');
  const floatBits = new DataView(new ArrayBuffer(4));
  const xyzNames = [
    ['x', 'coord_x', 'position_x', 'pos_x'],
    ['y', 'coord_y', 'position_y', 'pos_y'],
    ['z', 'coord_z', 'position_z', 'pos_z']
  ];
  const rgbNames = [
    ['red', 'r', 'diffuse_red', 'color_r'],
    ['green', 'g', 'diffuse_green', 'color_g'],
    ['blue', 'b', 'diffuse_blue', 'color_b']
  ];
  const labelNames = ['label', 'class', 'class_id', 'classid', 'classification',
    'semantic', 'semantic_label', 'segment', 'scalar_label', 'scalar_classification'];

  const scalarTypes = {
    char: ['getInt8', 1], int8: ['getInt8', 1],
    uchar: ['getUint8', 1], uint8: ['getUint8', 1],
    short: ['getInt16', 2], int16: ['getInt16', 2],
    ushort: ['getUint16', 2], uint16: ['getUint16', 2],
    int: ['getInt32', 4], int32: ['getInt32', 4],
    uint: ['getUint32', 4], uint32: ['getUint32', 4],
    float: ['getFloat32', 4], float32: ['getFloat32', 4],
    double: ['getFloat64', 8], float64: ['getFloat64', 8]
  };

  function collect() {
    const positions = new Float32Array(maxRenderedPoints * 3);
    const colors = new Uint8Array(maxRenderedPoints * 3);
    const labels = new Uint8Array(maxRenderedPoints);
    let pointCount = 0;
    let hasColor = false;
    let hasLabels = false;
    let seed = 0x340719f7;

    return {
      add(x, y, z, red, green, blue, label, normalized = false) {
        if (![x, y, z].every(value => Number.isFinite(Math.fround(value)))) return;

        let index = pointCount++;
        if (index >= maxRenderedPoints) {
          // Reservoir sampling keeps the complete scan represented and is repeatable.
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          index = Math.floor((seed >>> 0) / 4294967296 * pointCount);
        }

        const withColor = Number.isFinite(red) && Number.isFinite(green) && Number.isFinite(blue);
        const withLabel = Number.isInteger(label) && label >= 0 && label < 255;
        hasColor ||= withColor;
        hasLabels ||= withLabel;
        if (index >= maxRenderedPoints) return;

        const offset = index * 3;
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
        const scale = normalized && red >= 0 && green >= 0 && blue >= 0 &&
          red <= 1 && green <= 1 && blue <= 1 ? 255 : 1;
        colors[offset] = withColor ? clampColor(red * scale) : fallbackColor[0];
        colors[offset + 1] = withColor ? clampColor(green * scale) : fallbackColor[1];
        colors[offset + 2] = withColor ? clampColor(blue * scale) : fallbackColor[2];
        labels[index] = withLabel ? label : 255;
      },
      result(name) {
        if (!pointCount) throw new Error('没有找到有效的三维点。请检查文件是否含有数值型 X、Y、Z 坐标。');
        const sampleCount = Math.min(pointCount, maxRenderedPoints);
        return {
          positions: positions.slice(0, sampleCount * 3), colors: colors.slice(0, sampleCount * 3),
          labels: labels.slice(0, sampleCount), pointCount, sampleCount, name, hasColor, hasLabels
        };
      }
    };
  }

  function clampColor(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function numeric(value) {
    return value === undefined || value === '' ? NaN : Number(value);
  }

  function validCount(value) {
    return Number.isSafeInteger(value) && value >= 0;
  }

  function matchField(fields, aliases) {
    return fields.find(field => aliases.includes(field.name));
  }

  function cloudFields(fields) {
    const xyz = xyzNames.map(names => matchField(fields, names));
    if (!xyz.every(Boolean)) throw new Error('文件头缺少 X、Y、Z 字段。请以包含坐标的点云格式导出。');
    const rgb = rgbNames.map(names => matchField(fields, names));
    return {
      xyz, rgb, packed: rgb.every(Boolean) ? undefined : matchField(fields, ['rgb', 'rgba']),
      label: matchField(fields, labelNames),
      normalized: rgb.every(field => field?.reader?.startsWith('getFloat'))
    };
  }

  function addPoint(collector, fields, readField, readPacked) {
    const [x, y, z] = fields.xyz;
    const [red, green, blue] = fields.rgb;
    if (fields.packed && readPacked) {
      const packed = readPacked(fields.packed);
      collector.add(readField(x), readField(y), readField(z),
        packed === undefined ? NaN : (packed >>> 16) & 255,
        packed === undefined ? NaN : (packed >>> 8) & 255,
        packed === undefined ? NaN : packed & 255, readField(fields.label));
      return;
    }
    collector.add(readField(x), readField(y), readField(z), readField(red), readField(green),
      readField(blue), readField(fields.label), fields.normalized);
  }

  async function readHeader(file, isLastLine) {
    const head = asciiDecoder.decode(await file.slice(0, maxHeaderBytes).arrayBuffer());
    const lines = [];
    let start = 0;
    while (start < head.length) {
      const next = head.indexOf('\n', start);
      if (next < 0) break;
      const line = head.slice(start, next).trim();
      lines.push(line);
      if (isLastLine(line)) return { lines, offset: next + 1 };
      start = next + 1;
    }
    throw new Error('点云文件头不完整或过长，请检查文件是否已完整下载。');
  }

  async function* textLines(blob) {
    const decoder = new TextDecoder('utf-8');
    const reader = blob.stream().getReader();
    let tail = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = tail + decoder.decode(value, { stream: true });
        let start = 0;
        let next = chunk.indexOf('\n');
        while (next >= 0) {
          yield chunk.slice(start, next).trim();
          start = next + 1;
          next = chunk.indexOf('\n', start);
        }
        tail = chunk.slice(start);
        if (tail.length > maxHeaderBytes) throw new Error('文本存在过长的记录。请检查点是否逐行保存。');
      }
      tail += decoder.decode();
      if (tail) yield tail.trim();
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }

  function toWords(line) {
    return line.split(/\s+/);
  }

  async function asciiVertices(file, offset, count, skip, consume) {
    let read = 0;
    if (!count) return;
    for await (const line of textLines(file.slice(offset))) {
      if (!line || line.startsWith('#')) continue;
      if (skip) {
        skip--;
        continue;
      }
      consume(toWords(line));
      if (++read >= count) break;
    }
    if (read < count) throw new Error('点云数据行少于文件头声明的数量，文件可能未下载完整。');
  }

  async function binaryVertices(file, offset, stride, count, consume) {
    if (!stride || !Number.isSafeInteger(stride * count) || offset + stride * count > file.size) {
      throw new Error('二进制点云数据短于文件头声明的大小，文件可能未下载完整。');
    }
    const rowsPerChunk = Math.max(1, Math.floor(1024 * 1024 / stride));
    for (let first = 0; first < count; first += rowsPerChunk) {
      const batch = Math.min(rowsPerChunk, count - first);
      const start = offset + first * stride;
      const view = new DataView(await file.slice(start, start + batch * stride).arrayBuffer());
      for (let row = 0; row < batch; row++) consume(view, row * stride);
    }
  }

  async function ply(file, collector) {
    const header = await readHeader(file, line => line.toLowerCase() === 'end_header');
    if (header.lines[0]?.toLowerCase() !== 'ply') throw new Error('文件不含有效的 PLY 文件头。');
    let format;
    let element;
    const elements = [];
    for (const line of header.lines.slice(1)) {
      const words = toWords(line.toLowerCase());
      if (words[0] === 'format') format = words[1];
      if (words[0] === 'element') {
        const count = numeric(words[2]);
        if (!validCount(count) || !words[1]) throw new Error('PLY 文件头的元素数量无效。');
        element = { name: words[1], count, stride: 0, fields: [], fixed: true };
        elements.push(element);
      }
      if (words[0] !== 'property' || !element) continue;
      const scalar = scalarTypes[words[1]];
      if (words[1] === 'list' || !scalar || !words[2]) {
        element.fixed = false;
        continue;
      }
      element.fields.push({ name: words[2], reader: scalar[0], size: scalar[1],
        offset: element.stride, index: element.fields.length });
      element.stride += scalar[1];
    }
    const vertexIndex = elements.findIndex(item => item.name === 'vertex');
    if (vertexIndex < 0) throw new Error('PLY 文件不含 vertex 顶点数据。');
    const vertex = elements[vertexIndex];
    if (!vertex.fixed) throw new Error('暂不支持带列表或自定义类型的 PLY 顶点属性。请导出为仅包含标准点属性的 PLY。');
    const fields = cloudFields(vertex.fields);
    const prefix = elements.slice(0, vertexIndex);
    if (format === 'ascii') {
      const skip = prefix.reduce((total, item) => total + item.count, 0);
      await asciiVertices(file, header.offset, vertex.count, skip, words => {
        addPoint(collector, fields, field => numeric(words[field?.index]));
      });
      return;
    }
    if (format !== 'binary_little_endian' && format !== 'binary_big_endian') {
      throw new Error('无法识别此 PLY 编码。请导出 ASCII 或标准二进制 PLY。');
    }
    if (prefix.some(item => !item.fixed && item.count)) {
      throw new Error('此二进制 PLY 在顶点前含有变长数据。请将顶点保存为文件中的第一组数据。');
    }
    const little = format === 'binary_little_endian';
    const offset = prefix.reduce((total, item) => total + item.count * item.stride, header.offset);
    await binaryVertices(file, offset, vertex.stride, vertex.count, (view, row) => {
      addPoint(collector, fields, field => field && view[field.reader](row + field.offset, little));
    });
  }

  function pcdScalar(type, size) {
    if (type === 'F') return size === 4 ? 'getFloat32' : size === 8 ? 'getFloat64' : undefined;
    if (![1, 2, 4].includes(size)) return undefined;
    if (type === 'I') return `getInt${size * 8}`;
    if (type === 'U') return `getUint${size * 8}`;
    return undefined;
  }

  function asciiPacked(value, field) {
    if (!Number.isFinite(value)) return undefined;
    if (field.reader === 'getFloat32') {
      floatBits.setFloat32(0, value, true);
      return floatBits.getUint32(0, true);
    }
    return value >>> 0;
  }

  async function pcd(file, collector) {
    const header = await readHeader(file, line => /^data\s/i.test(line));
    const meta = new Map();
    for (const line of header.lines) {
      if (!line || line.startsWith('#')) continue;
      const [key, ...values] = toWords(line);
      meta.set(key.toUpperCase(), values);
    }
    const names = meta.get('FIELDS') || meta.get('FIELD');
    const sizes = meta.get('SIZE');
    const types = meta.get('TYPE');
    const counts = meta.get('COUNT');
    const data = meta.get('DATA')?.[0]?.toLowerCase();
    if (data === 'binary_compressed') throw new Error('暂不支持压缩 PCD。请导出为普通二进制 PCD 或 ASCII PCD。');
    if (!names || names.length !== sizes?.length || names.length !== types?.length ||
        (counts && names.length !== counts.length)) throw new Error('PCD 文件头的 FIELDS、SIZE、TYPE 或 COUNT 不匹配。');

    let stride = 0;
    let column = 0;
    const attributes = names.map((name, position) => {
      const size = numeric(sizes[position]);
      const count = counts ? numeric(counts[position]) : 1;
      const reader = pcdScalar(types[position].toUpperCase(), size);
      if (!reader || !validCount(count) || count < 1) throw new Error('PCD 包含不受支持的字段类型或无效 COUNT。');
      const field = { name: name.toLowerCase(), reader, size, offset: stride, index: column };
      stride += size * count;
      column += count;
      return field;
    });
    const fields = cloudFields(attributes);
    const count = meta.has('POINTS') ? numeric(meta.get('POINTS')[0]) :
      numeric(meta.get('WIDTH')?.[0]) * numeric(meta.get('HEIGHT')?.[0] ?? '1');
    if (!validCount(count) || !Number.isSafeInteger(stride)) throw new Error('PCD 文件头的点数或字段大小无效。');

    if (data === 'ascii') {
      await asciiVertices(file, header.offset, count, 0, words => {
        addPoint(collector, fields, field => numeric(words[field?.index]),
          field => field.size === 4 ? asciiPacked(numeric(words[field.index]), field) : undefined);
      });
      return;
    }
    if (data !== 'binary') throw new Error('无法识别此 PCD 编码。请导出 ASCII 或普通二进制 PCD。');
    await binaryVertices(file, header.offset, stride, count, (view, row) => {
      addPoint(collector, fields, field => field && view[field.reader](row + field.offset, true),
        field => field.size === 4 ? view.getUint32(row + field.offset, true) : undefined);
    });
  }

  function textColumns(line) {
    const delimiter = line.includes(',') ? ',' : line.includes(';') ? ';' : line.includes('\t') ? '\t' : null;
    return delimiter ? line.split(delimiter).map(value => value.trim().replace(/^"(.*)"$/, '$1')) : toWords(line);
  }

  async function textCloud(file, collector) {
    let fields;
    let firstRow = true;
    for await (const line of textLines(file)) {
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
      const columns = textColumns(line);
      if (columns.length < 3) continue;
      if (firstRow) {
        firstRow = false;
        const names = columns.map((name, index) => ({ name: name.toLowerCase(), index }));
        if (xyzNames.every(aliases => matchField(names, aliases))) {
          fields = cloudFields(names);
          continue;
        }
      }
      if (fields) {
        addPoint(collector, fields, field => numeric(columns[field?.index]));
        continue;
      }
      const colored = columns.length >= 6;
      collector.add(numeric(columns[0]), numeric(columns[1]), numeric(columns[2]),
        colored ? numeric(columns[3]) : NaN, colored ? numeric(columns[4]) : NaN,
        colored ? numeric(columns[5]) : NaN, numeric(columns[6]));
    }
  }

  async function read(file) {
    if (!file?.name || !file.size) throw new Error('请选择一个非空点云文件。');
    if (file.size > maxBytes) throw new Error('单个导入文件最大为 384 MB。请先将点云分块或采样后再导入。');
    const extension = file.name.split('.').pop().toLowerCase();
    const readers = { ply, pcd, xyz: textCloud, txt: textCloud, csv: textCloud };
    if (!Object.hasOwn(readers, extension)) throw new Error('支持 PLY、PCD、XYZ、TXT 和 CSV 点云文件。请先解压数据或转换格式。');
    const collector = collect();
    await readers[extension](file, collector);
    return collector.result(file.name);
  }

  window.LidarFormats = { read };
})();
