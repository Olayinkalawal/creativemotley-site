/* A minimal glTF 2.0 binary loader for camera3d.js (three r186), in place of GLTFLoader.
   GLTFLoader imports three's animation system (keyframe tracks, PropertyBinding, mixers), which keeps those classes in
   the site's shared three chunk for every visitor (+15.6 KB gzip) although this model has no animation; this reads
   exactly what assemble.mjs writes and nothing else (≈4 KB gzip):
     - meshes: triangle primitives, any attributes (POSITION -> position, NORMAL -> normal, TEXCOORD_n -> uv/uvN,
       COLOR_0 -> color, custom ones lower-cased: _PBR -> _pbr), indices, normalized integers (KHR_mesh_quantization)
     - EXT_meshopt_compression buffer views (decoded with three's MeshoptDecoder), EXT_mesh_gpu_instancing
     - materials: metallic-roughness (+ textures), normal / occlusion / emissive, alpha blend, double-sided,
       KHR_materials_clearcoat, KHR_materials_iridescence; textures from EXT_texture_webp (or PNG/JPEG), samplers
     - nodes: names, TRS or matrix, extras -> userData, the default scene
   Output matches GLTFLoader's where camera3d.js looks: material names and extras, per-variant material clones with
   vertexColors and a flipped normalScale.y (derivative tangents), texture names, flipY false, colour spaces. */
import * as THREE from 'three';

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const FILTER = { 9728: THREE.NearestFilter, 9729: THREE.LinearFilter, 9984: THREE.NearestMipmapNearestFilter, 9985: THREE.LinearMipmapNearestFilter, 9986: THREE.NearestMipmapLinearFilter, 9987: THREE.LinearMipmapLinearFilter };
const WRAP = { 33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping, 10497: THREE.RepeatWrapping };
const ATTR = { POSITION: 'position', NORMAL: 'normal', TANGENT: 'tangent', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1', TEXCOORD_2: 'uv2', TEXCOORD_3: 'uv3', COLOR_0: 'color' };

export async function parseGLB(buffer, { meshoptDecoder } = {}) {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('glb: not a binary glTF');
  let off = 12, json = null, bin = null;
  while (off < dv.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, off + 8, len)));
    else if (type === 0x004e4942) bin = new Uint8Array(buffer, off + 8, len);
    off += 8 + len;
  }
  const J = json, views = [], accessors = [], textures = [], materials = [], variants = new Map();
  if (meshoptDecoder) await meshoptDecoder.ready;

  const view = (i) => {
    if (views[i]) return views[i];
    const v = J.bufferViews[i], mx = v.extensions?.EXT_meshopt_compression;
    let out;
    if (mx) {
      if (!meshoptDecoder) throw new Error('glb: meshopt-compressed data needs the decoder');
      const src = new Uint8Array(bin.buffer, bin.byteOffset + (mx.byteOffset || 0), mx.byteLength);
      out = new Uint8Array(mx.count * mx.byteStride);
      meshoptDecoder.decodeGltfBuffer(out, mx.count, mx.byteStride, src, mx.mode, mx.filter);
    } else out = new Uint8Array(bin.buffer, bin.byteOffset + (v.byteOffset || 0), v.byteLength);
    return (views[i] = out);
  };
  const accessor = (i) => {
    if (accessors[i]) return accessors[i];
    const a = J.accessors[i], T = COMP[a.componentType], n = SIZE[a.type], bv = J.bufferViews[a.bufferView];
    const raw = view(a.bufferView), stride = bv.byteStride || bv.extensions?.EXT_meshopt_compression?.byteStride || 0, el = n * T.BYTES_PER_ELEMENT;
    let attr;
    if (stride && stride !== el) {
      const ib = new THREE.InterleavedBuffer(new T(raw.buffer, raw.byteOffset, (raw.byteLength) / T.BYTES_PER_ELEMENT), stride / T.BYTES_PER_ELEMENT);
      attr = new THREE.InterleavedBufferAttribute(ib, n, (a.byteOffset || 0) / T.BYTES_PER_ELEMENT, !!a.normalized);
    } else {
      const arr = new T(raw.buffer, raw.byteOffset + (a.byteOffset || 0), a.count * n);
      attr = new THREE.BufferAttribute(arr, n, !!a.normalized);
    }
    return (accessors[i] = attr);
  };
  const texture = async (i) => {
    if (textures[i]) return textures[i];
    const t = J.textures[i], src = t.extensions?.EXT_texture_webp?.source ?? t.source, img = J.images[src];
    const blob = new Blob([view(img.bufferView)], { type: img.mimeType });
    const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const tex = new THREE.Texture(bmp);
    tex.flipY = false; tex.name = t.name || img.name || '';
    const s = (J.samplers || [])[t.sampler] || {};
    tex.magFilter = FILTER[s.magFilter] || THREE.LinearFilter; tex.minFilter = FILTER[s.minFilter] || THREE.LinearMipmapLinearFilter;
    tex.wrapS = WRAP[s.wrapS] || THREE.RepeatWrapping; tex.wrapT = WRAP[s.wrapT] || THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return (textures[i] = tex);
  };
  for (let i = 0; i < (J.textures || []).length; i++) await texture(i);
  const tex = (info, srgb) => { if (!info) return null; const t = textures[info.index]; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  for (const m of J.materials || []) {
    const pbr = m.pbrMetallicRoughness || {}, X = m.extensions || {};
    const physical = !!(X.KHR_materials_clearcoat || X.KHR_materials_iridescence);
    const mat = physical ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
    mat.name = m.name || '';
    const c = pbr.baseColorFactor || [1, 1, 1, 1];
    mat.color.setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace); mat.opacity = c[3];
    mat.map = tex(pbr.baseColorTexture, true);
    mat.metalness = pbr.metallicFactor ?? 1; mat.roughness = pbr.roughnessFactor ?? 1;
    if (pbr.metallicRoughnessTexture) mat.metalnessMap = mat.roughnessMap = tex(pbr.metallicRoughnessTexture);
    if (m.normalTexture) { mat.normalMap = tex(m.normalTexture); const s = m.normalTexture.scale ?? 1; mat.normalScale.set(s, s); }
    if (m.occlusionTexture) { mat.aoMap = tex(m.occlusionTexture); mat.aoMapIntensity = m.occlusionTexture.strength ?? 1; }
    if (m.emissiveTexture) mat.emissiveMap = tex(m.emissiveTexture, true);
    if (m.emissiveFactor) mat.emissive.setRGB(...m.emissiveFactor, THREE.LinearSRGBColorSpace);
    if (m.alphaMode === 'BLEND') { mat.transparent = true; mat.depthWrite = false; }
    if (m.alphaMode === 'MASK') mat.alphaTest = m.alphaCutoff ?? 0.5;
    if (m.doubleSided) mat.side = THREE.DoubleSide;
    const cc = X.KHR_materials_clearcoat;
    if (cc) { mat.clearcoat = cc.clearcoatFactor || 0; mat.clearcoatRoughness = cc.clearcoatRoughnessFactor || 0; }
    const ir = X.KHR_materials_iridescence;
    if (ir) {
      mat.iridescence = ir.iridescenceFactor || 0; mat.iridescenceIOR = ir.iridescenceIor ?? 1.3;
      mat.iridescenceThicknessRange = [ir.iridescenceThicknessMinimum ?? 100, ir.iridescenceThicknessMaximum ?? 400];
      if (ir.iridescenceThicknessTexture) mat.iridescenceThicknessMap = tex(ir.iridescenceThicknessTexture);
    }
    mat.userData = m.extras || {};
    materials.push(mat);
  }
  /* GLTFLoader's final material: a clone per variant (vertex colours; derivative tangents flip normalScale.y) */
  const finalMaterial = (mat, geo) => {
    const vc = !!geo.attributes.color, key = mat.uuid + (vc ? ':vc' : '');
    if (variants.has(key)) return variants.get(key);
    const m = mat.clone(); m.name = mat.name; m.userData = mat.userData;
    if (vc) m.vertexColors = true;
    if (m.normalScale) m.normalScale.y *= -1;
    variants.set(key, m);
    return m;
  };
  const meshNodes = (mi, nodeDef) => {
    const md = J.meshes[mi], out = [];
    md.primitives.forEach((p, k) => {
      if ((p.mode ?? 4) !== 4) return;
      const geo = new THREE.BufferGeometry();
      for (const [name, ai] of Object.entries(p.attributes)) geo.setAttribute(ATTR[name] || name.toLowerCase(), accessor(ai));
      if (p.indices !== undefined) geo.setIndex(accessor(p.indices));
      const mat = finalMaterial(p.material !== undefined ? materials[p.material] : new THREE.MeshStandardMaterial(), geo);
      const gi = nodeDef.extensions?.EXT_mesh_gpu_instancing;
      let mesh;
      if (gi) {
        const A = gi.attributes, T = A.TRANSLATION !== undefined ? accessor(A.TRANSLATION) : null, R = A.ROTATION !== undefined ? accessor(A.ROTATION) : null, S = A.SCALE !== undefined ? accessor(A.SCALE) : null;
        const n = (T || R || S).count;
        mesh = new THREE.InstancedMesh(geo, mat, n);
        const m4 = new THREE.Matrix4(), p3 = new THREE.Vector3(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(1, 1, 1);
        for (let i = 0; i < n; i++) {
          if (T) p3.fromBufferAttribute(T, i); if (R) q.fromBufferAttribute(R, i); if (S) s3.fromBufferAttribute(S, i);
          mesh.setMatrixAt(i, m4.compose(p3, q, s3));
        }
      } else mesh = new THREE.Mesh(geo, mat);
      mesh.name = md.primitives.length > 1 ? `${md.name || 'mesh'}_${k}` : md.name || '';
      out.push(mesh);
    });
    return out;
  };
  const nodes = (J.nodes || []).map((nd) => {
    let o;
    if (nd.mesh !== undefined) {
      const ms = meshNodes(nd.mesh, nd);
      if (ms.length === 1) o = ms[0]; else { o = new THREE.Group(); ms.forEach((m) => o.add(m)); }
    } else o = new THREE.Object3D();
    o.name = nd.name || o.name || '';
    if (nd.extras) o.userData = { ...o.userData, ...nd.extras };
    if (nd.matrix) o.applyMatrix4(new THREE.Matrix4().fromArray(nd.matrix));
    else {
      if (nd.translation) o.position.fromArray(nd.translation);
      if (nd.rotation) o.quaternion.fromArray(nd.rotation);
      if (nd.scale) o.scale.fromArray(nd.scale);
    }
    return o;
  });
  (J.nodes || []).forEach((nd, i) => (nd.children || []).forEach((c) => nodes[i].add(nodes[c])));
  const sd = (J.scenes || [])[J.scene || 0] || { nodes: [] };
  const scene = new THREE.Group(); scene.name = sd.name || '';
  for (const i of sd.nodes) scene.add(nodes[i]);
  return { scene, json: J };
}
