(() => {
  'use strict';

  const magic = [76, 73, 68, 65, 82, 80, 75, 0]; // LIDARPK followed by NUL.
  const version = 1;
  const headerBytes = 16;
  const pointBytes = 16;
  const maxManifestBytes = 2_000_000;
  const maxSampleCount = 500_000;
  const classNames = [
    'ceiling', 'floor', 'wall', 'beam', 'column', 'window', 'door', 'table',
    'chair', 'sofa', 'bookcase', 'board', 'clutter',
  ];
  const errors = {
    'invalid-pack': 'This file is not a valid LiDAR Workbench scene library.',
    'unsupported-pack-version': 'This scene library was made for a different version of LiDAR Workbench.',
    'incomplete-pack': 'The scene library is incomplete or damaged.',
    'missing-pack-scene': 'The requested room is not in this scene library.',
  };

  function failure(code) {
    const error = new Error(errors[code]);
    error.code = code;
    return error;
  }

  function isScene(scene) {
    return scene && typeof scene.area === 'string' && /^Area_[1-9][0-9]*$/.test(scene.area)
      && typeof scene.room === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(scene.room)
      && scene.id === scene.area + '/' + scene.room
      && typeof scene.file === 'string' && /^data\/[\w.-]+\.js$/.test(scene.file)
      && Number.isSafeInteger(scene.sampleCount) && scene.sampleCount > 0
      && scene.sampleCount <= maxSampleCount
      && Number.isSafeInteger(scene.pointCount) && scene.pointCount >= scene.sampleCount
      && Array.isArray(scene.classes) && scene.classes.length === classNames.length
      && scene.classes.every(count => Number.isSafeInteger(count) && count >= 0)
      && scene.classes.reduce((sum, count) => sum + count, 0) <= scene.pointCount;
  }

  function readCatalog(manifest) {
    let catalog;
    try {
      catalog = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifest));
    } catch {
      throw failure('invalid-pack');
    }
    if (!catalog || !Array.isArray(catalog.classNames)
        || catalog.classNames.length !== classNames.length
        || !classNames.every((name, index) => name === catalog.classNames[index])
        || !Array.isArray(catalog.scenes) || !catalog.scenes.length
        || !catalog.scenes.every(isScene)) {
      throw failure('invalid-pack');
    }
    return catalog;
  }

  async function open(file) {
    if (!file || typeof file.slice !== 'function' || !Number.isSafeInteger(file.size)
        || file.size < headerBytes) {
      throw failure('invalid-pack');
    }
    const header = await file.slice(0, headerBytes).arrayBuffer();
    const headerView = new Uint8Array(header);
    if (header.byteLength !== headerBytes
        || !magic.every((byte, index) => headerView[index] === byte)) {
      throw failure('invalid-pack');
    }
    const fixed = new DataView(header);
    if (fixed.getUint32(8, true) !== version) {
      throw failure('unsupported-pack-version');
    }
    const manifestBytes = fixed.getUint32(12, true);
    if (!manifestBytes || manifestBytes > maxManifestBytes) {
      throw failure('invalid-pack');
    }
    const dataStart = headerBytes + manifestBytes;
    if (dataStart > file.size) {
      throw failure('incomplete-pack');
    }

    const manifest = await file.slice(headerBytes, dataStart).arrayBuffer();
    if (manifest.byteLength !== manifestBytes) {
      throw failure('incomplete-pack');
    }
    const catalog = readCatalog(manifest);
    const rooms = new Map();
    let offset = dataStart;
    for (const scene of catalog.scenes) {
      if (rooms.has(scene.id)) {
        throw failure('invalid-pack');
      }
      const end = offset + scene.sampleCount * pointBytes;
      if (!Number.isSafeInteger(end) || end > file.size) {
        throw failure('incomplete-pack');
      }
      rooms.set(scene.id, { start: offset, end });
      offset = end;
    }
    if (!rooms.has(catalog.defaultScene)) {
      throw failure('invalid-pack');
    }
    if (offset !== file.size) {
      throw failure('incomplete-pack');
    }

    return {
      catalog,
      async read(scene) {
        const room = rooms.get(scene?.id);
        if (!room) {
          throw failure('missing-pack-scene');
        }
        const buffer = await file.slice(room.start, room.end).arrayBuffer();
        if (buffer.byteLength !== room.end - room.start) {
          throw failure('incomplete-pack');
        }
        return buffer;
      },
    };
  }

  window.LidarScenePack = Object.freeze({ open });
})();
