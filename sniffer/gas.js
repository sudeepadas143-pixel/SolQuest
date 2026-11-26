// Toon gas: instanced, noise-lumped puff-balls with 3-band cel shading, a rim light, an inverted-hull outline and a
// noise dissolve as they age. Opaque (alpha-cut), so no sorting and little overdraw; holds up right against the lens.
// Palette sampled from the reference art (pale sage → lime highlights).
import * as THREE from 'three';

const NOISE = `
vec3 h3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return -1.+2.*fract(sin(p)*43758.5453);}
float gn(vec3 p){vec3 i=floor(p),f=fract(p);vec3 u=f*f*(3.-2.*f);
  return mix(mix(mix(dot(h3(i),f),dot(h3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),mix(dot(h3(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(h3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
             mix(mix(dot(h3(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(h3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),mix(dot(h3(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(h3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);}
float fbm3(vec3 p){return gn(p)*.6+gn(p*2.1)*.28+gn(p*4.3)*.12;}`;

const VERT = (outline) => `
attribute float iSeed;attribute float iAge;attribute float iHeat;
uniform float uT,uOutline;
varying vec3 vN,vW;varying float vAge,vSeed,vHeat;
${NOISE}
void main(){
  vec3 p=position;vec3 sp=p*1.3+vec3(iSeed*17.,iSeed*7.,iSeed*3.)+vec3(0.,uT*.35,uT*.2);
  float d=fbm3(sp)*.55+gn(p*3.1+iSeed*11.)*.12;               // lumpy cauliflower bulges
  vec3 n=normalize(normal);
  p+=n*d*.9;
  ${outline ? 'p+=n*uOutline;' : ''}
  vec4 w=modelMatrix*instanceMatrix*vec4(p,1.);
  vW=w.xyz;vN=normalize(mat3(modelMatrix*instanceMatrix)*n);vAge=iAge;vSeed=iSeed;vHeat=iHeat;
  gl_Position=projectionMatrix*viewMatrix*w;}`;

const FRAG = (outline) => `
uniform vec3 uL,uLit,uMid,uShade,uDeep,uRim,uLine,uHot,uFogC;uniform float uFogN,uFogF,uT;
varying vec3 vN,vW;varying float vAge,vSeed,vHeat;
${NOISE}
void main(){
  float n=fbm3(vW*2.2+vec3(vSeed*9.,uT*.4,0.))*.5+.5;
  float cutT=smoothstep(.45,1.,vAge)*1.15;                    // dissolve from the thin parts as it ages
  if(n<cutT)discard;
  float dist=length(vW-cameraPosition);float fog=smoothstep(uFogN,uFogF,dist);
  ${outline ? `gl_FragColor=vec4(mix(uLine,uFogC,fog),1.);` : `
  vec3 N=normalize(vN);vec3 V=normalize(cameraPosition-vW);
  float ndl=dot(N,normalize(uL))*.5+.5;
  float w=fwidth(ndl)*1.5+.01;
  vec3 c=mix(uDeep,uShade,smoothstep(.22-w,.22+w,ndl));      // 4 cel bands
  c=mix(c,uMid,smoothstep(.48-w,.48+w,ndl));
  c=mix(c,uLit,smoothstep(.74-w,.74+w,ndl));
  float rim=pow(1.-max(dot(N,V),0.),3.);c+=uRim*smoothstep(.45,.55,rim)*.35;
  c=mix(c,uHot,vHeat*.55);                                    // fresh puffs are a hotter lime
  float edge=1.-smoothstep(0.,.05,n-cutT);c=mix(c,uLine,edge*step(.01,cutT)*.8); // dark rim where it dissolves
  gl_FragColor=vec4(mix(c,uFogC,fog),1.);`}
  #include <colorspace_fragment>
}`;

export function createGas(scene, { max = 260, palette = {} } = {}) {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const seedA = new THREE.InstancedBufferAttribute(new Float32Array(max), 1), ageA = new THREE.InstancedBufferAttribute(new Float32Array(max), 1), heatA = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  for (const a of [seedA, ageA, heatA]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iSeed', seedA); geo.setAttribute('iAge', ageA); geo.setAttribute('iHeat', heatA);
  const C = (h) => new THREE.Color(h);
  const uniforms = {
    uT: { value: 0 }, uOutline: { value: .07 }, uL: { value: new THREE.Vector3(.4, .85, .35) },
    uLit: { value: C(palette.lit ?? 0xe9f0c9) }, uMid: { value: C(palette.mid ?? 0xc3cf98) }, uShade: { value: C(palette.shade ?? 0x8f9d6a) },
    uDeep: { value: C(palette.deep ?? 0x5d6b40) }, uRim: { value: C(0xfaffe0) }, uLine: { value: C(palette.line ?? 0x2b3a1c) }, uHot: { value: C(0xc8ff6a) },
    uFogC: { value: new THREE.Color(0xe7896f) }, uFogN: { value: 40 }, uFogF: { value: 130 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT(false), fragmentShader: FRAG(false) });
  const line = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT(true), fragmentShader: FRAG(true), side: THREE.BackSide });
  const mesh = new THREE.InstancedMesh(geo, mat, max), hull = new THREE.InstancedMesh(geo, line, max);
  for (const m of [mesh, hull]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
  mesh.castShadow = true;
  const P = [], _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  const api = {
    mesh, hull, P, uniforms, air: new THREE.Vector3(),
    emit(x, y, z, o = {}) {
      if (P.length >= max) P.shift();
      P.push({ x, y, z, vx: o.vx ?? 0, vy: o.vy ?? .4, vz: o.vz ?? 0, age: 0, life: o.life ?? 1.6, s0: o.s0 ?? .12, s1: o.s1 ?? .45,
        drag: o.drag ?? 2, seed: Math.random(), rx: Math.random() * 6, ry: Math.random() * 6, heat: o.heat ?? 1, squash: .8 + Math.random() * .3, buoy: o.buoy ?? .5 });
    },
    burst(pos, dir, n = 30, power = 1, o = {}) {
      for (let i = 0; i < n; i++) {
        const sp = (1.5 + Math.random() * 3.5) * power, j = () => (Math.random() - .5) * 2.2 * power;
        api.emit(pos.x + (Math.random() - .5) * .15, pos.y + (Math.random() - .3) * .15, pos.z + (Math.random() - .5) * .15,
          { vx: dir.x * sp + j(), vy: dir.y * sp + .3 + Math.random() * power, vz: dir.z * sp + j(), life: 1.8 + Math.random() * 1.5,
            s0: .14 * power, s1: (.35 + Math.random() * .45) * power * (o.scale ?? 1), drag: 1.7, heat: 1 });
      }
    },
    clear() { P.length = 0; mesh.count = hull.count = 0; },
    near(x, y, z, r) { let n = 0; const r2 = r * r; for (const p of P) { const dx = p.x - x, dy = p.y - y, dz = p.z - z; if (dx * dx + dy * dy + dz * dz < r2) n += 1 - p.age / p.life; } return n; },
    step(dt, t) {
      uniforms.uT.value = t;
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]; p.age += dt; if (p.age >= p.life) { P.splice(i, 1); continue; }
        const k = Math.min(1, dt * p.drag);
        p.vx += (api.air.x - p.vx) * k; p.vz += (api.air.z - p.vz) * k * .6; p.vy += (p.buoy - p.vy) * k * .5;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += dt * .4; p.heat = Math.max(0, p.heat - dt * 2.2);
      }
      const n = P.length;
      for (let i = 0; i < n; i++) {
        const p = P[i], u = p.age / p.life, s = p.s0 + (p.s1 - p.s0) * (1 - Math.pow(1 - Math.min(1, u * 1.6), 3));
        _m.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e.set(p.rx, p.ry, 0)), _s.set(s, s * p.squash, s));
        mesh.setMatrixAt(i, _m); hull.setMatrixAt(i, _m); seedA.setX(i, p.seed); ageA.setX(i, u); heatA.setX(i, p.heat);
      }
      mesh.count = hull.count = n;
      mesh.instanceMatrix.needsUpdate = hull.instanceMatrix.needsUpdate = seedA.needsUpdate = ageA.needsUpdate = heatA.needsUpdate = true;
    },
    setFog(color, near, far) { uniforms.uFogC.value.copy(color); uniforms.uFogN.value = near; uniforms.uFogF.value = far; },
    attach(sc) { sc.add(mesh); sc.add(hull); },
  };
  return api;
}
