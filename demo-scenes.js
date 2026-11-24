(function () {
  'use strict';

  const category = {
    floor: 1,
    wall: 2,
    beam: 3,
    column: 4,
    window: 5,
    door: 6,
    table: 7,
    seat: 8,
    sofa: 9,
    bookcase: 10,
    board: 11,
    clutter: 12,
  };

  const material = {
    floor: [119, 130, 129],
    wall: [185, 181, 172],
    brightWall: [193, 197, 198],
    glass: [115, 164, 188],
    wood: [167, 127, 91],
    darkWood: [149, 120, 99],
    frame: [89, 97, 101],
    deskChair: [109, 125, 153],
    blueTextile: [84, 122, 151],
    greenTextile: [115, 143, 129],
    whiteboard: [222, 225, 214],
  };

  function generator(seed) {
    const positions = [], colors = [], labels = [];

    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    function point(x, y, z, label, rgb) {
      positions.push(x + (random() - .5) * .014, y + (random() - .5) * .014, z + (random() - .5) * .014);
      for (const channel of rgb) colors.push(Math.max(0, Math.min(255, channel + Math.floor(random() * 15) - 7)));
      labels.push(label);
    }

    function surface(min, max, label, count, rgb, pose = null) {
      const width = max[0] - min[0], depth = max[1] - min[1], height = max[2] - min[2];
      for (let i = 0; i < count; i++) {
        const x = min[0] + random() * width;
        const y = min[1] + random() * depth;
        const z = min[2] + random() * height;
        if (pose) point(pose.x + x * pose.cos - y * pose.sin, pose.y + x * pose.sin + y * pose.cos, z, label, rgb);
        else point(x, y, z, label, rgb);
      }
    }

    function box(min, max, label, facePoints, rgb, pose = null) {
      for (let axis = 0; axis < 3; axis++) {
        for (const value of [min[axis], max[axis]]) {
          const start = min.slice(), end = max.slice();
          start[axis] = end[axis] = value;
          surface(start, end, label, facePoints, rgb, pose);
        }
      }
    }

    function room(width, depth, height, openings, wallColor = material.wall) {
      surface([-width, -depth, 0], [width, depth, 0], category.floor, Math.round(5400 + width * depth * 67), material.floor);
      surface([-width, -depth, 0], [-width, depth, height], category.wall, Math.round(depth * height * 210), wallColor);

      function wallStrip(from, to, minHeight, maxHeight) {
        const count = Math.round((to - from) * (maxHeight - minHeight) * 139);
        surface([from, depth, minHeight], [to, depth, maxHeight], category.wall, count, wallColor);
      }

      let wallStart = -width;
      for (const opening of openings) {
        const { from, to, bottom, top, label, color } = opening;
        wallStrip(wallStart, from, 0, height);
        wallStrip(from, to, 0, bottom);
        wallStrip(from, to, top, height);
        const count = Math.round((to - from) * (top - bottom) * 224);
        surface([from, depth - .035, bottom], [to, depth - .035, top], label, count, color);
        wallStart = to;
      }
      wallStrip(wallStart, width, 0, height);
    }

    function chair(x, y, yaw, rgb = material.deskChair) {
      const pose = { x, y, sin: Math.sin(yaw), cos: Math.cos(yaw) };
      box([-.28,-.24,.41], [.28,.24,.50], category.seat, 87, rgb, pose);
      box([-.29,.19,.46], [.29,.27,.94], category.seat, 78, rgb, pose);
      for (const legX of [-.22, .22]) {
        for (const legY of [-.19, .19]) box([legX-.02,legY-.02,.03], [legX+.02,legY+.02,.42], category.seat, 8, material.frame, pose);
      }
    }

    function desk(minX, minY, maxX, maxY, z, rgb = material.wood) {
      box([minX,minY,z-.08], [maxX,maxY,z], category.table, 395, rgb);
      for (const x of [minX+.10, maxX-.16]) {
        for (const y of [minY+.10, maxY-.16]) box([x,y,.03], [x+.065,y+.065,z-.08], category.table, 39, material.frame);
      }
    }

    function conferenceTable() {
      for (let i = 0; i < 2900; i++) {
        const angle = random() * Math.PI * 2;
        const rim = i >= 2200;
        const radius = rim ? 1 : Math.sqrt(random());
        const z = rim ? .69 + random() * .13 : .82;
        point(2.55 * radius * Math.cos(angle), 1.12 * radius * Math.sin(angle), z, category.table, material.wood);
      }
      for (const x of [-1.52, .95]) box([x,-.34,.02], [x+.57,.34,.70], category.table, 135, material.frame);
    }

    function sofa(x, y, yaw, width, rgb) {
      const pose = { x, y, sin: Math.sin(yaw), cos: Math.cos(yaw) };
      box([-width/2,-.42,.12], [width/2,.43,.48], category.sofa, 175, rgb, pose);
      box([-width/2,.30,.43], [width/2,.46,.91], category.sofa, 162, rgb, pose);
      for (const x of [-width/2, width/2-.15]) box([x,-.42,.39], [x+.15,.35,.69], category.sofa, 85, rgb, pose);
    }

    function finish() {
      return {
        positions: new Float32Array(positions),
        colors: new Uint8Array(colors),
        labels: new Uint8Array(labels),
        hasColor: true,
        hasLabels: true,
        pointCount: labels.length,
        sampleCount: labels.length,
      };
    }

    return { room, surface, box, chair, desk, conferenceTable, sofa, finish };
  }

  function office(scene) {
    scene.room(4, 2.9, 2.9, [
      { from: -3.07, to: -.4, bottom: .97, top: 2.27, label: category.window, color: material.glass },
      { from: 2.40, to: 3.57, bottom: .02, top: 2.16, label: category.door, color: material.darkWood },
    ]);
    scene.desk(-2.55,-1.08,1.82,.42,.79);
    scene.desk(-3.73,1.25,-1.65,2.17,.76);
    for (const x of [-1.92, -.46, 1.05]) scene.chair(x,-1.70,Math.PI);
    for (const x of [-1.92, -.46, 1.05]) scene.chair(x,1.00,0);
    scene.box([-3.77,-2.22,.04], [-3.30,-.30,1.62], category.bookcase, 366, material.darkWood);
    scene.box([-2.83,1.68,.79], [-2.21,1.77,1.17], category.clutter, 70, material.frame);
    scene.box([-.47,-.55,.79], [-.01,-.22,.83], category.clutter, 74, material.whiteboard);
  }

  function conference(scene) {
    scene.room(5.1, 3.32, 3.05, [
      { from: -4.23, to: -1.14, bottom: .95, top: 2.55, label: category.window, color: material.glass },
      { from: -.98, to: 2.22, bottom: .95, top: 2.55, label: category.window, color: material.glass },
      { from: 3.39, to: 4.54, bottom: .02, top: 2.26, label: category.door, color: material.darkWood },
    ], material.brightWall);
    scene.conferenceTable();
    for (const x of [-1.65, -.56, .56, 1.65]) {
      scene.chair(x,-1.55,Math.PI,material.greenTextile);
      scene.chair(x,1.55,0,material.greenTextile);
    }
    scene.chair(-3.03,0,Math.PI / 2,material.greenTextile);
    scene.chair(3.03,0,-Math.PI / 2,material.greenTextile);
    scene.box([-5.08,-1.63,1.03], [-4.99,1.46,2.32], category.board, 185, material.whiteboard);
    scene.box([-3.56,2.53,.04], [-1.05,3.08,.87], category.bookcase, 230, material.darkWood);
    scene.box([-.38,-.16,.82], [.38,.16,.87], category.clutter, 68, material.frame);
  }

  function hallway(scene) {
    scene.room(6.15, 1.65, 3.1, [
      { from: -5.15, to: -3.81, bottom: .03, top: 2.28, label: category.door, color: material.darkWood },
      { from: -2.64, to: -1.3, bottom: .03, top: 2.28, label: category.door, color: material.darkWood },
      { from: -.13, to: 1.21, bottom: .03, top: 2.28, label: category.door, color: material.darkWood },
      { from: 3.19, to: 5.32, bottom: .93, top: 2.44, label: category.window, color: material.glass },
    ]);
    scene.surface([-6.15,-1.65,0], [6.15,-1.65,.42], category.wall, 1330, material.brightWall);
    for (const x of [-5.48, -2.98, -.48, 2.45, 5.68]) {
      scene.box([x-.13,1.35,.03], [x+.13,1.64,3.05], category.column, 210, material.brightWall);
    }
    for (const x of [-4.20, 2.25, 4.92]) {
      scene.box([x-.14,-1.59,2.72], [x+.14,1.59,2.97], category.beam, 240, material.brightWall);
    }
    for (const x of [-3.1, .55, 3.03]) {
      scene.box([x,-1.43,.39], [x+1.26,-1.03,.48], category.seat, 170, material.greenTextile);
      scene.box([x+.11,-1.36,.02], [x+1.17,-1.09,.39], category.seat, 55, material.frame);
    }
    scene.box([2.34,1.48,1.45], [3.04,1.53,1.95], category.board, 95, material.whiteboard);
  }

  function lounge(scene) {
    scene.room(4.18, 3.2, 2.91, [
      { from: -3.41, to: -1.34, bottom: .82, top: 2.42, label: category.window, color: material.glass },
      { from: -1.18, to: 1.49, bottom: .82, top: 2.42, label: category.window, color: material.glass },
      { from: 2.49, to: 3.64, bottom: .02, top: 2.14, label: category.door, color: material.darkWood },
    ], material.brightWall);
    scene.sofa(-.25,2.03,0,3.35,material.blueTextile);
    scene.sofa(-2.62,.12,Math.PI/2,2.57,material.blueTextile);
    scene.sofa(2.4,.41,-Math.PI/2,1.05,material.greenTextile);
    scene.sofa(2.38,-.98,-Math.PI/2,1.05,material.greenTextile);
    scene.desk(-1.18,-.67,1.04,.73,.47);
    scene.box([-3.97,-2.49,.05], [-3.47,-.97,1.27], category.bookcase, 370, material.darkWood);
    scene.box([-3.10,2.45,.05], [-2.48,2.91,.62], category.clutter, 125, [144,120,91]);
    scene.box([-3.01,2.50,.62], [-2.58,2.83,1.12], category.clutter, 120, material.greenTextile);
  }

  function storage(scene) {
    scene.room(3.65, 2.92, 2.85, [
      { from: 1.93, to: 3.12, bottom: .02, top: 2.12, label: category.door, color: material.darkWood },
    ]);
    for (const x of [-2.39, -.49, 1.40]) {
      for (const y of [-1.27, 1.11]) {
        for (const level of [.35, .88, 1.41, 1.94]) {
          scene.box([x-.66,y-.29,level], [x+.66,y+.29,level+.067], category.bookcase, 77, material.frame);
          scene.box([x-.5,y-.22,level+.068], [x+.02,y+.18,level+.32], category.clutter, 31, [171,137,100]);
          scene.box([x+.12,y-.20,level+.068], [x+.50,y+.09,level+.27], category.clutter, 26, [126,155,161]);
        }
        for (const postX of [x-.62, x+.57]) {
          for (const postY of [y-.28, y+.22]) scene.box([postX,postY,.04], [postX+.043,postY+.043,2.13], category.bookcase, 32, material.frame);
        }
      }
    }
    scene.box([-3.41,1.57,1.24], [-3.34,2.42,1.92], category.board, 125, material.whiteboard);
  }

  const definitions = [
    { id: 'demo/office', room: 'office_1', seed: 16900, build: office },
    { id: 'demo/conference', room: 'conferenceRoom_1', seed: 27919, build: conference },
    { id: 'demo/hallway', room: 'hallway_1', seed: 39887, build: hallway },
    { id: 'demo/lounge', room: 'lounge_1', seed: 41777, build: lounge },
    { id: 'demo/storage', room: 'storage_1', seed: 53093, build: storage },
  ];

  window.LidarDemos = {
    scenes: definitions.map(({ id, room }) => ({ id, area: 'Demo', room, demo: true })),
    defaultScene: 'demo/office',
    compareScene: 'demo/conference',
    make(id) {
      const definition = definitions.find(item => item.id === id);
      if (!definition) throw new Error('找不到这个演示场景。');
      const scene = generator(definition.seed);
      definition.build(scene);
      return scene.finish();
    },
  };
})();
