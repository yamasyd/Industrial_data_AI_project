/* ATLAS city: the bank as a miniature city. Districts = portal themes, cars = data and transactions. three.js r160 */
(function () {
  'use strict';

  window.createCity = function (host, opts) {
    opts = opts || {};
    if (!host || !window.THREE) return null;
    var T = window.THREE, renderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) { return null; }
    if (!renderer.getContext()) return null;

    var mobile = matchMedia('(max-width: 760px)').matches;
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    renderer.setPixelRatio(DPR);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    var BG = new T.Color(opts.bg || '#E7EDF4');
    var scene = new T.Scene();
    scene.background = BG.clone();
    scene.fog = new T.Fog(BG.clone(), 70, 175);

    var camera = new T.PerspectiveCamera(30, 1, 0.5, 600);

    /* ---------- light ---------- */
    var hemi = new T.HemisphereLight(0xffffff, 0xb9c6d8, 1.9);
    scene.add(hemi);
    var sun = new T.DirectionalLight(0xfff4e6, 2.3);
    sun.position.set(-34, 60, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    var sc = sun.shadow.camera;
    sc.left = -52; sc.right = 52; sc.top = 52; sc.bottom = -52; sc.near = 10; sc.far = 160;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 4;
    scene.add(sun);

    /* ---------- materials ---------- */
    function mat(c, o) { o = o || {}; o.color = c; if (o.roughness == null) o.roughness = 0.88; o.metalness = o.metalness || 0; return new T.MeshStandardMaterial(o); }
    var M = {
      ground: mat(0xdbe3ed, { roughness: 1 }),
      road: mat(0xc6d0de, { roughness: 1 }),
      walk: mat(0xeef2f7),
      clay: mat(0xf7f8fb),
      clay2: mat(0xe9eef5),
      clay3: mat(0xdde5ef),
      white: mat(0xffffff),
      ink: mat(0x0f1b3d, { roughness: .6 }),
      glass: mat(0x24345e, { roughness: .35 }),
      cobalt: mat(0x2747ff, { roughness: .55 }),
      cobaltGlow: mat(0x2747ff, { roughness: .4, emissive: 0x2747ff, emissiveIntensity: .55 }),
      sky: mat(0x8ccbff, { roughness: .6, emissive: 0x8ccbff, emissiveIntensity: .25 }),
      sun: mat(0xffc633, { roughness: .6 }),
      sunGlow: mat(0xffc633, { roughness: .5, emissive: 0xffb000, emissiveIntensity: .35 }),
      alarm: mat(0xff4c61, { roughness: .5, emissive: 0xff4c61, emissiveIntensity: .8 }),
      leaf: mat(0xa9d3bf),
      leaf2: mat(0x8cc4ab),
      trunk: mat(0xcbb79a),
      water: mat(0xb9dcff, { roughness: .25, metalness: .1 }),
      cloud: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: .92 })
    };

    /* ---------- geometry helpers ---------- */
    function rr(w, d, r) {
      var s = new T.Shape(), x = -w / 2, y = -d / 2; r = Math.max(.001, Math.min(r, w / 2, d / 2));
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
      s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
    }
    var gcache = {};
    function blockGeo(w, d, h, r, b) {
      r = r == null ? .3 : r; b = b == null ? Math.min(.08, h / 4) : b;
      var k = [w, d, h, r, b].join('|');
      if (gcache[k]) return gcache[k];
      var g = new T.ExtrudeGeometry(rr(w - 2 * b, d - 2 * b, Math.max(.01, r - b)), { depth: Math.max(.005, h - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 5 });
      g.rotateX(-Math.PI / 2); g.translate(0, b, 0);
      gcache[k] = g; return g;
    }
    function mesh(g, m, x, y, z, cast, recv) {
      var o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0);
      o.castShadow = cast !== false; o.receiveShadow = recv !== false; return o;
    }
    function block(w, d, h, m, x, y, z, r) { return mesh(blockGeo(w, d, h, r), m, x, y, z); }

    /* ---------- seeded random ---------- */
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    var city = new T.Group(); scene.add(city);
    var intro = []; // {obj, delay}
    function grow(obj, delay) { obj.scale.y = .001; intro.push({ obj: obj, delay: delay }); return obj; }

    /* ---------- ground and roads ---------- */
    var ground = mesh(new T.PlaneGeometry(700, 700), M.ground, 0, 0, 0, false, true);
    ground.rotation.x = -Math.PI / 2; scene.add(ground);

    var ROADS = [-30, -18, -6, 6, 18, 30], EXT = 44, RW = 2.8;
    ROADS.forEach(function (c) {
      var a = mesh(new T.BoxGeometry(EXT * 2, .04, RW), M.road, 0, .02, c, false, true);
      var b = mesh(new T.BoxGeometry(RW, .041, EXT * 2), M.road, c, .02, 0, false, true);
      city.add(a, b);
    });
    // lane dashes (instanced)
    var dashG = new T.BoxGeometry(.9, .02, .12), dashCount = 0, dashMax = 2400;
    var dashes = new T.InstancedMesh(dashG, M.white, dashMax);
    var dm = new T.Matrix4(), dq = new T.Quaternion(), dv = new T.Vector3(), ds = new T.Vector3(1, 1, 1), yAxis = new T.Vector3(0, 1, 0);
    ROADS.forEach(function (c) {
      for (var p = -EXT + 1; p < EXT; p += 2.2) {
        var near = ROADS.some(function (r) { return Math.abs(p - r) < RW; });
        if (near) continue;
        dq.setFromAxisAngle(yAxis, 0); dv.set(p, .05, c); dm.compose(dv, dq, ds); dashes.setMatrixAt(dashCount++, dm);
        dq.setFromAxisAngle(yAxis, Math.PI / 2); dv.set(c, .05, p); dm.compose(dv, dq, ds); dashes.setMatrixAt(dashCount++, dm);
      }
    });
    dashes.count = dashCount; dashes.receiveShadow = true; city.add(dashes);

    // sidewalk plots for every block
    var CENTERS = [-36, -24, -12, 0, 12, 24, 36];
    var PLOT = 12 - RW - .5;
    CENTERS.forEach(function (x) {
      CENTERS.forEach(function (z) {
        var edge = Math.abs(x) === 36 || Math.abs(z) === 36;
        var w = edge ? PLOT : PLOT, plot = block(w, w, .22, M.walk, x, 0, z, .5);
        plot.castShadow = false; city.add(plot);
      });
    });

    /* ---------- trees (instanced) ---------- */
    var treeSpots = [];
    function addTree(x, z, s) { treeSpots.push([x, z, s || 1]); }
    function buildTrees() {
      var n = treeSpots.length;
      var crownG = new T.IcosahedronGeometry(.8, 1), trunkG = new T.CylinderGeometry(.09, .12, .7, 6);
      var crowns = new T.InstancedMesh(crownG, M.leaf, n), trunks = new T.InstancedMesh(trunkG, M.trunk, n);
      var colA = new T.Color(0xa9d3bf), colB = new T.Color(0x8cc4ab), colC = new T.Color(0xc2e2cf);
      treeSpots.forEach(function (t, i) {
        var s = t[2] * (.75 + rnd() * .5);
        dq.identity(); dv.set(t[0], .22 + .35 * s, t[1]); ds.set(s, s, s); dm.compose(dv, dq, ds); trunks.setMatrixAt(i, dm);
        dv.set(t[0], .22 + (.7 + .55) * s, t[1]); ds.set(s, s * 1.08, s); dm.compose(dv, dq, ds); crowns.setMatrixAt(i, dm);
        var r = rnd(); crowns.setColorAt(i, r < .4 ? colA : r < .75 ? colB : colC);
      });
      ds.set(1, 1, 1);
      crowns.castShadow = trunks.castShadow = true; crowns.receiveShadow = true;
      city.add(crowns, trunks);
      return crowns;
    }

    /* ---------- filler buildings ---------- */
    var fillMats = [M.clay, M.clay2, M.clay3, M.clay];
    function filler(cx, cz, density, maxH) {
      var cells = [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]];
      cells.forEach(function (c) {
        if (rnd() > density) { addTree(cx + c[0] + (rnd() - .5), cz + c[1] + (rnd() - .5), 1); addTree(cx + c[0] + 1.2, cz + c[1] - 1, .8); return; }
        var w = 3.2 + rnd() * 1.2, d = 3.2 + rnd() * 1.2, h = 1.2 + Math.pow(rnd(), 1.6) * maxH;
        var m = fillMats[Math.floor(rnd() * fillMats.length)];
        var g = new T.Group(); g.position.set(cx + c[0], .22, cz + c[1]);
        g.add(block(w, d, h, m, 0, 0, 0, .35));
        if (h > 3 && rnd() > .45) g.add(block(w * .55, d * .55, 1 + rnd() * 1.5, m, (rnd() - .5) * .8, h, (rnd() - .5) * .8, .3));
        if (rnd() > .7) g.add(block(.9, .9, .5, M.clay3, w * .25, h, -d * .2, .15));
        // window band
        if (h > 2.2) g.add(block(w + .04, d + .04, .14, M.clay3, 0, h * .62, 0, .36));
        city.add(g); grow(g, .25 + rnd() * .9);
      });
    }

    /* ---------- district: bank core (temple + vault) ---------- */
    var districts = {};
    function coreDistrict(cx, cz) {
      var g = new T.Group(); g.position.set(cx, .22, cz);
      g.add(block(8.8, 7, .35, M.clay2, 0, 0, 0, .3));
      g.add(block(8.2, 6.4, .35, M.clay, 0, .35, 0, .25));
      g.add(block(7.6, 5.8, .35, M.clay, 0, .7, 0, .2));
      var cella = block(5.2, 3.6, 3.2, M.clay2, 0, 1.05, -.4, .15); g.add(cella);
      var colG = new T.CylinderGeometry(.26, .3, 3.2, 18);
      for (var i = 0; i < 6; i++) {
        var x = -3.1 + i * 1.24;
        g.add(mesh(colG, M.white, x, 2.65, 2.35));
        g.add(mesh(colG, M.white, x, 2.65, -2.35));
      }
      for (var j = 0; j < 3; j++) { g.add(mesh(colG, M.white, -3.1, 2.65, -1.2 + j * 1.2)); g.add(mesh(colG, M.white, 3.1, 2.65, -1.2 + j * 1.2)); }
      g.add(block(7.8, 6, .45, M.clay, 0, 4.25, 0, .15));
      var tri = new T.Shape(); tri.moveTo(-3.9, 0); tri.lineTo(3.9, 0); tri.lineTo(0, 1.35); tri.lineTo(-3.9, 0);
      var pedG = new T.ExtrudeGeometry(tri, { depth: 6, bevelEnabled: false }); pedG.translate(0, 0, -3);
      g.add(mesh(pedG, M.white, 0, 4.7, 0));
      var vault = mesh(new T.CylinderGeometry(1.05, 1.05, .22, 40), M.sun, 0, 2.55, 1.42); vault.rotation.x = Math.PI / 2; g.add(vault);
      var hub = mesh(new T.CylinderGeometry(.32, .32, .3, 20), M.ink, 0, 2.55, 1.6); hub.rotation.x = Math.PI / 2; g.add(hub);
      for (var k = 0; k < 3; k++) { var spoke = mesh(new T.BoxGeometry(1.5, .1, .1), M.ink, 0, 2.55, 1.56); spoke.rotation.z = k * Math.PI / 3; g.add(spoke); }
      city.add(g); grow(g, .1);
      addTree(cx - 4.2, cz + 4.1, .8); addTree(cx + 4.2, cz + 4.1, .8);
      districts.core = { group: g, anchor: new T.Vector3(cx, 7.6, cz), pick: pickBox(cx, cz, 9, 7, 9) };
    }

    /* ---------- district: cloud (server towers = provider shares) ---------- */
    var towers = [];
    var UNIT_H = .62, UNIT_GAP = .08, MAX_UNITS = 18;
    function cloudDistrict(cx, cz) {
      var g = new T.Group(); g.position.set(cx, .22, cz); city.add(g);
      var spots = [[-4.4, 0], [-2.64, 0], [-.88, 0], [.88, 0], [2.64, 0], [4.4, 0]];
      var unitG = blockGeo(1.45, 2.8, UNIT_H, .2, .05), ledG = new T.BoxGeometry(.95, .12, .06), led2G = new T.BoxGeometry(1.9, .12, .06);
      spots.forEach(function (s, idx) {
        var tw = new T.Group(); tw.position.set(s[0], 0, s[1]); g.add(tw);
        var units = [];
        for (var u = 0; u < MAX_UNITS; u++) {
          var ug = new T.Group(); ug.position.y = u * (UNIT_H + UNIT_GAP);
          ug.add(mesh(unitG, M.clay, 0, 0, 0));
          var led = mesh(ledG, idx < 3 ? M.cobaltGlow : M.sky, 0, UNIT_H * .55, 1.41, false, false); ug.add(led);
          var led2 = mesh(led2G, idx < 3 ? M.cobaltGlow : M.sky, .74, UNIT_H * .55, 0, false, false); led2.rotation.y = Math.PI / 2; ug.add(led2);
          ug.visible = false; ug.scale.y = 0; tw.add(ug); units.push(ug);
        }
        towers.push({ group: tw, units: units, value: 0, target: 0, anchor: new T.Vector3() });
      });
      // floating cloud
      var cl = new T.Group();
      [[0, 0, 0, 1.6], [1.5, -.2, .3, 1.2], [-1.5, -.3, -.2, 1.25], [.6, .6, -.5, 1.15], [-.7, .5, .6, 1.05], [2.6, -.5, -.2, .8], [-2.6, -.5, .2, .85]].forEach(function (p) {
        var b = mesh(new T.SphereGeometry(p[3], 24, 16), M.cloud, p[0], p[1], p[2], true, false); cl.add(b);
      });
      cl.position.set(cx, 15.5, cz); cl.scale.set(.001, .001, .001); city.add(cl);
      districts.cloud = { group: g, cloud: cl, anchor: new T.Vector3(cx, 19, cz), pick: pickBox(cx, cz, 9, 12, 7) };
    }
    function setTowerTargets(arr) {
      arr.forEach(function (v, i) { if (towers[i]) towers[i].target = Math.max(0, Math.min(MAX_UNITS, v)); });
    }

    /* ---------- district: AI (dome + gyroscope) ---------- */
    var aiRings = [], aiCore, aiNodes = [];
    function aiDistrict(cx, cz) {
      var g = new T.Group(); g.position.set(cx, .22, cz);
      g.add(mesh(new T.CylinderGeometry(4.5, 4.7, .35, 56), M.clay2, 0, .17, 0));
      g.add(mesh(new T.SphereGeometry(3.1, 56, 28, 0, Math.PI * 2, 0, Math.PI / 2), M.white, 0, .35, 0));
      var band = mesh(new T.TorusGeometry(3.12, .09, 10, 80), M.cobalt, 0, .45, 0); band.rotation.x = Math.PI / 2; g.add(band);
      var rib = new T.TorusGeometry(3.1, .045, 8, 64, Math.PI);
      for (var i = 0; i < 4; i++) { var r = mesh(rib, M.clay3, 0, .35, 0); r.rotation.y = i * Math.PI / 4; g.add(r); }
      city.add(g); grow(g, .35);
      var top = new T.Group(); top.position.set(cx, 6.6, cz); city.add(top);
      aiCore = mesh(new T.SphereGeometry(.95, 40, 24), M.cobaltGlow, 0, 0, 0); top.add(aiCore);
      for (var k = 0; k < 2; k++) {
        var ring = mesh(new T.TorusGeometry(2.1 + k * .55, .07, 10, 90), M.sunGlow, 0, 0, 0);
        ring.rotation.set(Math.PI / 2 + (k ? .7 : -.5), k ? .4 : 0, 0); top.add(ring); aiRings.push(ring);
        for (var n = 0; n < 3; n++) { var node = mesh(new T.SphereGeometry(.16, 16, 10), M.cobalt, 0, 0, 0); ring.add(node); aiNodes.push({ m: node, r: 2.1 + k * .55, a: n * 2.1 + k }); }
      }
      top.scale.set(.001, .001, .001);
      for (var t = 0; t < 7; t++) { var a = t / 7 * Math.PI * 2 + .3; addTree(cx + Math.cos(a) * 5, cz + Math.sin(a) * 5, .65); }
      districts.ai = { group: g, top: top, anchor: new T.Vector3(cx, 9.4, cz), pick: pickBox(cx, cz, 9, 10, 9) };
    }

    /* ---------- district: control (tower + beacon + barrier) ---------- */
    var beacon, beaconLight, barrierArm, pulseRing;
    function controlDistrict(cx, cz) {
      var g = new T.Group(); g.position.set(cx, .22, cz);
      g.add(block(5.4, 4, 2.4, M.clay2, -1.2, 0, 1.6, .3));
      g.add(block(5.4, 4.04, .16, M.clay3, -1.2, 1.5, 1.6, .3));
      g.add(block(2.6, 2.6, 1.2, M.clay, 2.4, 0, -2.2, .3));
      g.add(mesh(new T.CylinderGeometry(.75, 1, 11, 28), M.white, 1.6, 5.5, -.6));
      g.add(mesh(new T.CylinderGeometry(2.1, 1.7, 1.1, 32), M.clay, 1.6, 11.3, -.6));
      g.add(mesh(new T.CylinderGeometry(2.06, 2.06, .55, 32), M.glass, 1.6, 11.3, -.6));
      g.add(mesh(new T.CylinderGeometry(1.4, 2.2, .5, 32), M.clay, 1.6, 12.1, -.6));
      g.add(mesh(new T.CylinderGeometry(.08, .08, 1.5, 8), M.ink, 1.6, 13, -.6));
      beacon = mesh(new T.SphereGeometry(.38, 24, 16), M.alarm, 1.6, 13.9, -.6, false, false); g.add(beacon);
      beaconLight = new T.PointLight(0xff4c61, 0, 18, 1.6); beaconLight.position.set(1.6, 13.9, -.6); g.add(beaconLight);
      city.add(g); grow(g, .2);
      // barrier on the road east of the district
      var bx = cx + 5.6, bz = cz + 6;
      var post = block(.5, .5, 1.1, M.ink, bx + 1.7, 0, bz, .1); city.add(post);
      barrierArm = new T.Group(); barrierArm.position.set(bx + 1.7, 1, bz); city.add(barrierArm);
      for (var s = 0; s < 6; s++) { var seg = mesh(new T.BoxGeometry(.55, .16, .16), s % 2 ? M.white : M.alarm, -.4 - s * .55, 0, 0); barrierArm.add(seg); }
      // pulse ring on the ground
      pulseRing = mesh(new T.RingGeometry(.92, 1, 64), new T.MeshBasicMaterial({ color: 0xff4c61, transparent: true, opacity: 0, depthWrite: false }), cx + 1.6, .26, cz - .6, false, false);
      pulseRing.rotation.x = -Math.PI / 2; city.add(pulseRing);
      addTree(cx - 3.5, cz - 3.4, .9); addTree(cx - 1.6, cz - 3.8, .7);
      districts.control = { group: g, anchor: new T.Vector3(cx + 1.6, 16, cz - .6), pick: pickBox(cx, cz, 9, 14, 9) };
    }

    /* ---------- HQ plaza with the ATLAS mark ---------- */
    var mark;
    function hq() {
      var g = new T.Group(); g.position.set(0, .22, 0);
      g.add(mesh(new T.CylinderGeometry(4.6, 4.6, .12, 64), M.clay, 0, .06, 0));
      g.add(mesh(new T.CylinderGeometry(3.2, 3.2, .1, 64), M.water, 0, .1, 0));
      mark = new T.Group();
      var shape = new T.Shape(); shape.moveTo(0, 4.4); shape.lineTo(2.6, -.0); shape.lineTo(1.5, 0); shape.lineTo(0, 2.6); shape.lineTo(-1.5, 0); shape.lineTo(-2.6, 0); shape.lineTo(0, 4.4);
      var mg = new T.ExtrudeGeometry(shape, { depth: .7, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 2 }); mg.translate(0, 0, -.35);
      mark.add(mesh(mg, M.cobalt, 0, 0, 0));
      var tri = new T.Shape(); tri.moveTo(0, 2.6); tri.lineTo(1.5, 0); tri.lineTo(-1.5, 0); tri.lineTo(0, 2.6);
      var tg = new T.ExtrudeGeometry(tri, { depth: .5, bevelEnabled: false }); tg.translate(0, 0, -.25);
      mark.add(mesh(tg, M.sun, 0, 0, 0));
      mark.position.y = .15; g.add(mark);
      city.add(g); grow(g, 0);
      for (var t = 0; t < 10; t++) { var a = t / 10 * Math.PI * 2; addTree(Math.cos(a) * 4.6 + (t % 2 ? 0 : 0), Math.sin(a) * 4.6, .55); }
    }

    function park(cx, cz) {
      for (var i = 0; i < 14; i++) addTree(cx + (rnd() - .5) * 8, cz + (rnd() - .5) * 8, .7 + rnd() * .5);
      var p = mesh(new T.CylinderGeometry(1.4, 1.4, .08, 40), M.water, cx + 1.5, .26, cz - 1, false, true); city.add(p);
    }

    /* ---------- picking ---------- */
    var pickables = [];
    function pickBox(cx, cz, w, h, d) {
      var b = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ visible: false }));
      b.position.set(cx, h / 2, cz); scene.add(b); pickables.push(b); return b;
    }

    /* ---------- build the city ---------- */
    coreDistrict(-12, -12);
    cloudDistrict(12, -12);
    aiDistrict(12, 12);
    controlDistrict(-12, 12);
    hq();
    park(0, -12); park(0, 12);
    filler(-12, 0, .8, 5); filler(12, 0, .8, 5);
    CENTERS.forEach(function (x) {
      CENTERS.forEach(function (z) {
        if (Math.abs(x) <= 12 && Math.abs(z) <= 12) return;
        var far = Math.max(Math.abs(x), Math.abs(z));
        filler(x, z, far > 30 ? .75 : .85, far > 30 ? 4 : 7.5);
      });
    });
    var crowns = buildTrees();
    Object.keys(districts).forEach(function (k) { districts[k].pick.userData.key = k; });

    /* ---------- labels ---------- */
    var labelHost = opts.labelHost, labels = [];
    function addLabel(id, html, posFn, group, onClick, cls) {
      if (!labelHost) return;
      var el = document.createElement('button');
      el.className = 'tag' + (cls ? ' ' + cls : ''); el.type = 'button'; el.tabIndex = -1;
      el.innerHTML = '<b>' + html + '</b>';
      if (onClick) el.addEventListener('click', onClick);
      labelHost.appendChild(el);
      labels.push({ id: id, el: el, pos: posFn, group: group, inner: el.firstChild });
    }
    var labelGroup = 'districts', v3 = new T.Vector3();
    function updateLabels() {
      var w = host.clientWidth, h = host.clientHeight;
      labels.forEach(function (l) {
        var on = l.group === labelGroup && introDone;
        l.pos(v3); v3.project(camera);
        var vis = on && v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
        l.el.classList.toggle('on', vis);
        l.el.style.pointerEvents = vis ? 'auto' : 'none';
        if (vis || l.el.classList.contains('on')) l.el.style.transform = 'translate(' + ((v3.x * .5 + .5) * w).toFixed(1) + 'px,' + ((-v3.y * .5 + .5) * h).toFixed(1) + 'px) translate(-50%,-100%)';
      });
    }
    var DNAMES = { core: ['Ядро', '#FFC633'], cloud: ['Облако', '#8CCBFF'], ai: ['ИИ', '#2747FF'], control: ['Контроль', '#FF4C61'] };
    Object.keys(DNAMES).forEach(function (k) {
      addLabel(k, '<i style="--dot:' + DNAMES[k][1] + '"></i>' + DNAMES[k][0], function (o) {
        o.copy(districts[k].anchor);
        if (k === 'cloud') o.y = Math.max(8, tallest() + 3.2);
      }, 'districts', function () { if (opts.onPick) opts.onPick(k); });
    });
    towers.forEach(function (tw, i) {
      addLabel('t' + i, '', function (o) { tw.group.getWorldPosition(o); o.y = .22 + tw.value * (UNIT_H + UNIT_GAP) + .4; }, 'providers', null, 'small');
    });
    function tallest() { return towers.reduce(function (m, t) { return Math.max(m, t.value * (UNIT_H + UNIT_GAP)); }, 0); }

    /* ---------- pointer: parallax + hover + click ---------- */
    var pointer = new T.Vector2(), ptr = { x: 0, y: 0, sx: 0, sy: 0 }, ray = new T.Raycaster(), hovered = null, overStage = false;
    window.addEventListener('pointermove', function (e) {
      ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = e.clientY / innerHeight * 2 - 1;
      pointer.set(ptr.x, -ptr.y);
      overStage = e.target === renderer.domElement;
    }, { passive: true });
    function pickAt(x, y) {
      pointer.set(x / innerWidth * 2 - 1, -(y / innerHeight * 2 - 1));
      ray.setFromCamera(pointer, camera);
      var hit = ray.intersectObjects(pickables, false)[0];
      return hit ? hit.object.userData.key : null;
    }
    function setHover(k) {
      if (k === hovered) return; hovered = k;
      labels.forEach(function (l) { l.el.classList.toggle('hot', l.id === k); });
      if (opts.onHover) opts.onHover(k);
    }

    /* ---------- camera rig ---------- */
    var cam = { pos: new T.Vector3(60, 52, 66), look: new T.Vector3(0, 0, 0), shift: 0, shiftY: 0, fov: 30, orbit: 0 };
    var tgt = { pos: new T.Vector3(46, 40, 50), look: new T.Vector3(2, 0, 0), shift: .2, shiftY: 0, fov: 30, orbit: 1, alert: 0 };
    var alert = 0, ang = 0, lookTmp = new T.Vector3(), posTmp = new T.Vector3();
    // автокадрирование: камера отъезжает, пока подписи всех районов не попадут в заданную область экрана
    var fitK = 1, fitBox = null, fv = new T.Vector3();
    function updateFit(dt) {
      var want = 1;
      if (fitBox && introDone) {
        camera.updateMatrixWorld();
        var cx = (fitBox[0] + fitBox[1]) / 2, cy = (fitBox[2] + fitBox[3]) / 2, hx = (fitBox[1] - fitBox[0]) / 2, hy = (fitBox[3] - fitBox[2]) / 2, m = 0;
        labels.forEach(function (l) { if (l.group !== 'districts') return; l.pos(fv); fv.project(camera); m = Math.max(m, Math.abs(fv.x - cx) / hx, Math.abs(fv.y - cy) / hy); });
        want = m > 1 ? fitK * (1 + (m - 1) * .6) : m < .8 ? fitK * (1 - (.8 - m) * .3) : fitK;
        want = Math.max(1, Math.min(2.4, want));
      }
      fitK += (want - fitK) * Math.min(1, dt * 3);
      scene.fog.near = 70 * fitK; scene.fog.far = 175 * fitK;   // при отдалении туман не съедает город
    }
    function setTarget(t) {
      tgt.pos.fromArray(t.pos); tgt.look.fromArray(t.look);
      tgt.shift = t.shift || 0; tgt.fov = t.fov || 30; tgt.orbit = t.orbit || 0; tgt.alert = t.alert || 0;
      if ('fit' in t) fitBox = t.fit || null;
      tgt.shiftY = t.shiftY || 0;
      if (t.labels) labelGroup = t.labels;
      if (t.bg) { var c = new T.Color(t.bg); bgTarget.copy(c); }
    }
    var bgTarget = BG.clone();

    function resize() {
      var w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    function applyCamera() {
      var w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
      var shift = mobile ? 0 : cam.shift;
      camera.fov = cam.fov; camera.aspect = w / h;
      camera.setViewOffset(w, h, -shift * w, cam.shiftY * h, w, h);   // shiftY поднимает город над текстом на вертикальных экранах
      posTmp.copy(cam.pos).sub(cam.look).multiplyScalar(fitK);
      var a = ang * cam.orbit;
      var cs = Math.cos(a), sn = Math.sin(a), x = posTmp.x * cs - posTmp.z * sn, z = posTmp.x * sn + posTmp.z * cs;
      posTmp.set(x, posTmp.y, z).add(cam.look);
      posTmp.x += ptr.sx * 2.2; posTmp.y -= ptr.sy * 1.6;
      camera.position.copy(posTmp);
      camera.lookAt(cam.look);
    }

    /* ---------- covers: render district close-ups to images ---------- */
    function covers(list) {
      var out = {}, w = 960, h = 600;
      var saved = { bg: scene.background.clone(), fog: scene.fog.color.clone() };
      finishIntro(true);
      renderer.setPixelRatio(1); renderer.setSize(w, h, false);
      var c2 = new T.PerspectiveCamera(30, w / h, .5, 600);
      list.forEach(function (v) {
        var col = new T.Color(v.bg || '#E7EDF4');
        scene.background.copy(col); scene.fog.color.copy(col); ground.material.color.copy(col).offsetHSL(0, 0, -.045);
        c2.fov = v.fov || 30; c2.updateProjectionMatrix();
        c2.position.fromArray(v.pos); c2.lookAt(new T.Vector3().fromArray(v.look));
        renderer.render(scene, c2);
        try { out[v.id] = renderer.domElement.toDataURL('image/jpeg', .86); } catch (e) { }
      });
      scene.background.copy(saved.bg); scene.fog.color.copy(saved.fog); ground.material.color.set(0xdbe3ed);
      renderer.setPixelRatio(DPR); resize();
      if (introStart == null) {
        intro.forEach(function (it) { it.obj.scale.y = .001; });
        districts.cloud.cloud.scale.set(.001, .001, .001); districts.ai.top.scale.set(.001, .001, .001);
        towers.forEach(function (tw) { tw.value = 0; layoutTower(tw); });
      }
      return out;
    }

    /* ---------- intro ---------- */
    var t0 = performance.now() / 1000, introDone = false, introStart = null;
    function easeOut(x) { return 1 - Math.pow(1 - x, 4); }
    function easeBack(x) { var c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
    function finishIntro(silent) {
      intro.forEach(function (it) { it.obj.scale.y = 1; });
      districts.cloud.cloud.scale.set(1, 1, 1); districts.ai.top.scale.set(1, 1, 1);
      towers.forEach(function (tw) { tw.value = tw.target; layoutTower(tw); });
      if (!silent) introDone = true;
    }
    function layoutTower(tw) {
      var v = tw.value;
      tw.units.forEach(function (u, i) {
        var f = Math.max(0, Math.min(1, v - i));
        u.visible = f > .001; u.scale.y = f;
      });
    }
    function start() {
      introStart = performance.now() / 1000;
      if (reduced) { finishIntro(); introStart = -10; }
    }

    /* ---------- loop ---------- */
    var last = performance.now() / 1000, paused = false, running = true, raf;
    function frame() {
      raf = requestAnimationFrame(frame);
      if (!running) return;
      var now = performance.now() / 1000, dt = Math.min(.05, now - last); last = now;
      var time = now - t0;

      // intro
      if (introStart != null && !introDone) {
        var it = now - introStart, all = true;
        intro.forEach(function (o) {
          var p = Math.max(0, Math.min(1, (it - o.delay) / .9));
          o.obj.scale.y = Math.max(.001, easeBack(p)); if (p < 1) all = false;
        });
        var pc = Math.max(0, Math.min(1, (it - 1.1) / .9)), ec = Math.max(.001, easeBack(pc));
        districts.cloud.cloud.scale.set(ec, ec, ec); districts.ai.top.scale.set(ec, ec, ec);
        if (all && pc >= 1) introDone = true;
      }

      // towers
      towers.forEach(function (tw) {
        var d = tw.target - tw.value;
        if (Math.abs(d) > .002) { tw.value += d * Math.min(1, dt * (introStart != null && now - introStart > .6 ? 2.6 : 0)); layoutTower(tw); }
      });

      // camera damping
      var k = Math.min(1, dt * 2.1);
      cam.pos.lerp(tgt.pos, k); cam.look.lerp(tgt.look, k);
      cam.shift += (tgt.shift - cam.shift) * k; cam.shiftY += (tgt.shiftY - cam.shiftY) * k; cam.fov += (tgt.fov - cam.fov) * k; cam.orbit += (tgt.orbit - cam.orbit) * k;
      alert += (tgt.alert - alert) * k;
      ptr.sx += (ptr.x - ptr.sx) * Math.min(1, dt * 2.5); ptr.sy += (ptr.y - ptr.sy) * Math.min(1, dt * 2.5);
      if (!reduced && !paused) ang = Math.sin(time * .07) * .22;
      scene.background.lerp(bgTarget, k); scene.fog.color.copy(scene.background);
      applyCamera();
      updateFit(dt);

      // ambient motion
      if (!reduced && !paused) {
        districts.cloud.cloud.position.y = 15.5 + Math.sin(time * .8) * .35 + Math.max(0, tallest() - 9);
        aiRings[0].rotation.z = time * .5; aiRings[1].rotation.z = -time * .35;
        aiNodes.forEach(function (n) { var a = n.a + time * .6; n.m.position.set(Math.cos(a) * n.r, Math.sin(a) * n.r, 0); });
        var pulse = .55 + .45 * Math.sin(time * 2.4);
        aiCore.material.emissiveIntensity = .4 + .3 * pulse;
        mark.rotation.y = Math.sin(time * .3) * .35;
        barrierArm.rotation.z = Math.max(0, Math.sin(time * .9)) * 1.25;
        var bp = (time * (.6 + alert * .8)) % 1;
        beacon.material.emissiveIntensity = .5 + (1 + alert * 2) * (bp < .5 ? 1 - bp * 2 : 0);
        beaconLight.intensity = alert * 40 * (bp < .5 ? 1 - bp * 2 : 0);
        var s = 1 + bp * (4 + alert * 6); pulseRing.scale.set(s, s, s); pulseRing.material.opacity = (1 - bp) * (.12 + alert * .5);
      }

      // hover
      if (introDone && !mobile) { setHover(overStage ? pickAt((pointer.x * .5 + .5) * innerWidth, (-pointer.y * .5 + .5) * innerHeight) : null); renderer.domElement.style.cursor = hovered ? 'pointer' : ''; }

      renderer.render(scene, camera);
      updateLabels();
    }

    var frozen = false;
    document.addEventListener('visibilitychange', function () { running = !document.hidden && !frozen; last = performance.now() / 1000; });
    host.addEventListener('click', function (e) { var k = pickAt(e.clientX, e.clientY); if (k && opts.onPick) opts.onPick(k); });

    applyCamera();
    frame();

    return {
      start: start,
      setTarget: setTarget,
      setTowers: setTowerTargets,
      setLabelText: function (id, html) { labels.forEach(function (l) { if (l.id === id) l.inner.innerHTML = html; }); },
      setPaused: function (p) { paused = p; },
      freeze: function (f) { frozen = !!f; running = !f; if (f) { applyCamera(); renderer.render(scene, camera); updateLabels(); } else last = performance.now() / 1000; },
      snap: function () { cam.pos.copy(tgt.pos); cam.look.copy(tgt.look); cam.shift = tgt.shift; cam.shiftY = tgt.shiftY; cam.fov = tgt.fov; cam.orbit = tgt.orbit; alert = tgt.alert; towers.forEach(function (tw) { tw.value = tw.target; layoutTower(tw); }); },
      covers: covers,
      hovered: function () { return hovered; },
      resize: resize
    };
  };
})();
