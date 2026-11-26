// Retro post pipeline, matched to the HOSS look (itshoss.fun), written from scratch:
//   near-native internal resolution, scaled per quality tier (high / med / low), smooth upscale
//   → depth-of-field gather (golden-angle disc, depth-aware, bright pixels weighted = bokeh)
//   → bloom (bright pass → quarter-res separable blur ×4)
//   → composite: chromatic aberration, bloom, warm anamorphic streaks, 55/45 luminance-preserving/ACES tone map,
//     slight desaturation + contrast, cool shadows, vignette, plus effect modes (CRT glitch, speed zoom, gas wipe).
import * as THREE from 'three';

export function createPost(R, { mobile = false, lines = 720, maxPixels = 2.4e6 } = {}) {
  const opt = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace };
  const rt = new THREE.WebGLRenderTarget(4, 4, opt);
  rt.depthTexture = new THREE.DepthTexture(4, 4); rt.depthTexture.type = THREE.UnsignedIntType;
  const rtD = new THREE.WebGLRenderTarget(4, 4, opt), bA = new THREE.WebGLRenderTarget(4, 4, opt), bB = new THREE.WebGLRenderTarget(4, 4, opt);
  const QV = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
  const pScene = new THREE.Scene(); pScene.add(quad); const pCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mkDof = (TAPS) => new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, vertexShader: QV,
    uniforms: { tC: { value: rt.texture }, tZ: { value: rt.depthTexture }, uNear: { value: .1 }, uFar: { value: 400 }, uPx: { value: new THREE.Vector2() },
      uFocus: { value: 3 }, uRange: { value: .25 }, uAp: { value: .5 }, uMax: { value: 10 } },
    fragmentShader: `uniform sampler2D tC,tZ;uniform vec2 uPx;uniform float uNear,uFar,uFocus,uRange,uAp,uMax;varying vec2 vUv;
      float lin(vec2 uv){float z=texture2D(tZ,uv).x*2.-1.;return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
      float coc(float z){return clamp((abs(z-uFocus)-uRange)/max(z,.001)*uAp*3.,0.,1.)*uMax;}
      void main(){
        float z0=lin(vUv),c0=coc(z0);vec3 base=texture2D(tC,vUv).rgb;
        if(c0<.6){gl_FragColor=vec4(base,1.);return;}
        vec3 acc=vec3(0.);float wsum=0.;
        for(int i=0;i<${TAPS};i++){
          float r=sqrt((float(i)+.5)/${TAPS}.)*c0,a=float(i)*2.39996;
          vec2 uv=vUv+vec2(cos(a),sin(a)*1.25)*r*uPx;
          vec3 s=texture2D(tC,uv).rgb;float zs=lin(uv);float cs=zs>z0?c0:coc(zs);   // nearer samples bleed only by their own blur
          float w=smoothstep(r-1.5,r+.5,cs);float l=dot(s,vec3(.2126,.7152,.0722));w*=1.+2.2*l*l;
          acc+=s*w;wsum+=w;}
        gl_FragColor=vec4(wsum>0.?acc/wsum:base,1.);}`,
  });
  const DOF = { hi: mkDof(mobile ? 24 : 40), lo: mkDof(14) }; let dof = DOF.hi;
  const bright = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, vertexShader: QV, uniforms: { tD: { value: rtD.texture }, uThr: { value: .85 } },
    fragmentShader: 'uniform sampler2D tD;uniform float uThr;varying vec2 vUv;void main(){vec3 c=texture2D(tD,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));gl_FragColor=vec4(c*smoothstep(uThr,uThr+1.3,l)+c*.04,1.);}',
  });
  const blur = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, vertexShader: QV, uniforms: { tD: { value: null }, uDir: { value: new THREE.Vector2() } },
    fragmentShader: 'uniform sampler2D tD;uniform vec2 uDir;varying vec2 vUv;void main(){vec3 c=texture2D(tD,vUv).rgb*.227;c+=(texture2D(tD,vUv+uDir*1.385).rgb+texture2D(tD,vUv-uDir*1.385).rgb)*.316;c+=(texture2D(tD,vUv+uDir*3.231).rgb+texture2D(tD,vUv-uDir*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}',
  });
  const comp = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, vertexShader: QV,
    uniforms: { tD: { value: rtD.texture }, tB: { value: bA.texture }, uPx: { value: new THREE.Vector2() }, uBloom: { value: .45 }, uExpo: { value: .95 }, uFade: { value: 1 },
      uStreak: { value: 1 }, uT: { value: 0 }, uGlitch: { value: 0 }, uZoom: { value: 0 }, uGas: { value: 0 },
      uGasA: { value: new THREE.Color(.16, .34, .07) }, uGasB: { value: new THREE.Color(.62, .92, .32) }, uGasC: { value: new THREE.Color(.9, 1., .66) } },
    fragmentShader: `uniform sampler2D tD,tB;uniform vec2 uPx;uniform float uBloom,uExpo,uFade,uStreak,uT,uGlitch,uZoom,uGas;uniform vec3 uGasA,uGasB,uGasC;varying vec2 vUv;
      float h1(float x){return fract(sin(x*127.1)*43758.5);}
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){return vn(p)*.55+vn(p*2.1)*.3+vn(p*4.3)*.15;}
      vec3 T(vec2 p){return texture2D(tD,p).rgb;}
      vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
      void main(){
        vec2 d=vUv-.5;float e=length(d)*2.,g=uGlitch,ca=.0012*e+.045*g*g;
        vec2 uv=vUv;float row=floor(vUv.y*72.);
        uv.x+=(h1(row+floor(uT*24.))-.5)*.08*g*g*step(.55,h1(row*1.7+floor(uT*12.)));             // CRT rows tearing
        vec3 c=vec3(0.);for(int i=-3;i<=3;i++){vec2 o=vec2(float(i)*.014*g*(.4+abs(d.x)*2.),0.);
          c+=vec3(T(uv+o+d*ca+vec2(.012*g,0.)).r,T(uv+o).g,T(uv+o-d*ca-vec2(.012*g,0.)).b);}c/=7.;   // RGB split (+ smear while glitching)
        c+=texture2D(tB,vUv).rgb*uBloom;
        if(uZoom>.001){float m=smoothstep(.6,1.3,e)*uZoom;vec3 z=vec3(0.);float j=h2(gl_FragCoord.xy+fract(uT));
          for(int i=1;i<=10;i++){float k=(float(i)-j)*.016*m;z+=min(vec3(T(vUv-d*k*1.25).r,T(vUv-d*k).g,T(vUv-d*k*.75).b),vec3(1.2));}
          c=mix(c,z*.1,clamp(m*1.4,0.,1.));c*=1.-.35*m;}                                         // speed vignette
        vec3 s=vec3(0.);for(int i=1;i<=8;i++){float o=float(i)*uPx.x*12.;float w=exp(-float(i)*.3);s+=w*(max(T(vUv+vec2(o,0.))-1.2,0.)+max(T(vUv-vec2(o,0.))-1.2,0.));}
        c+=dot(s,vec3(.33))*vec3(1.,.6,.3)*.25*uStreak;                                           // warm anamorphic streak
        c*=uExpo;
        float l=dot(c,vec3(.2126,.7152,.0722)),lt=aces(vec3(l)).x;vec3 lp=c*(lt/max(l,1e-4));
        c=mix(lp,aces(c),.45);                                                                     // 55% hue-preserving + 45% per-channel ACES
        l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,.92);c=(c-.5)*1.08+.5;
        c+=vec3(-.03,.012,.02)*(1.-smoothstep(0.,.45,l));                                         // teal-green shadows (the gassed city)
        c+=vec3(.035,.012,-.03)*smoothstep(.5,1.,l);                                               // warm golden highlights
        {vec2 vq=vUv-.5;c*=1.-dot(vq,vq)*.55;}                                                     // lens vignette
        c=clamp(c,0.,1.);
        { // modern-retro finish: 4x4 ordered dither into gentle colour banding + faint scanlines on the internal pixel grid
          vec2 px=floor(vUv/uPx);int bx=int(mod(px.x,4.)),by=int(mod(px.y,4.));
          float b=0.;int k=bx+by*4;
          if(k==0)b=0.;else if(k==1)b=8.;else if(k==2)b=2.;else if(k==3)b=10.;else if(k==4)b=12.;else if(k==5)b=4.;else if(k==6)b=14.;else if(k==7)b=6.;
          else if(k==8)b=3.;else if(k==9)b=11.;else if(k==10)b=1.;else if(k==11)b=9.;else if(k==12)b=15.;else if(k==13)b=7.;else if(k==14)b=13.;else b=5.;
          float lv=40.;c=floor(c*lv+(b/16.))/lv;
          c*=1.-.07*step(.5,fract(px.y*.5));}
        if(uGas>.001){ // toon gas wipe: posterised fbm with an outline at each band edge
          vec2 q=vUv*vec2(1.6,1.)*3.;float n=fbm(q+vec2(uT*.35,-uT*.22))*.7+fbm(q*2.3-uT*.5)*.3;float v=n+uGas*1.25-.75;
          float b1=step(.0,v),b2=step(.18,v),b3=step(.34,v);vec3 gc=mix(uGasA,uGasB,b2);gc=mix(gc,uGasC,b3);
          float edge=(1.-smoothstep(.0,.03,abs(v)))+(1.-smoothstep(.0,.025,abs(v-.18)))*.6;gc*=1.-edge*.6;
          c=mix(c,gc,b1);}
        c*=mix(1.,smoothstep(1.05,.2,length(d*vec2(1.,.85))),.6);                                  // vignette
        c+=vec3(.9,.95,1.)*g*g*g*.8;c*=1.-.25*g*step(.5,fract(vUv.y*240.));                        // flash residue + scanlines
        gl_FragColor=vec4(c*uFade,1.);
        #include <colorspace_fragment>
      }`,
  });

  let pr = 1, lastW = 1, lastH = 1;
  // quality tiers: internal resolution, DoF taps (or off), bloom passes
  const TIERS = { high: { lines, dof: 'hi', blur: 4 }, med: { lines: Math.round(lines * .88), dof: 'lo', blur: 2 }, low: { lines: Math.round(lines * .74), dof: null, blur: 2 } };
  let tier = TIERS.high;
  function setQuality(name) { tier = TIERS[name] || TIERS.high; if (tier.dof) dof = DOF[tier.dof]; for (const m of Object.values(DOF)) m.uniforms.uPx.value.copy(DOF.hi.uniforms.uPx.value); resize(lastW, lastH); }
  function resize(w, h) {
    lastW = w; lastH = h;
    pr = Math.min(devicePixelRatio, tier.lines / Math.min(w, h), Math.sqrt(maxPixels / (w * h)));
    R.setPixelRatio(pr); R.setSize(w, h, false);
    const W = Math.max(4, Math.floor(w * pr)), H = Math.max(4, Math.floor(h * pr));
    rt.setSize(W, H); rtD.setSize(W, H); bA.setSize(W >> 2, H >> 2); bB.setSize(W >> 2, H >> 2);
    for (const m of Object.values(DOF)) { m.uniforms.uPx.value.set(1 / W, 1 / H); m.uniforms.uMax.value = 12 * Math.min(W, H) / 780; } comp.uniforms.uPx.value.set(1 / W, 1 / H);
  }
  function render(scene, cam, { focus = 3, aperture = .5, bloom = 1, raw = false } = {}) {
    if (raw) { R.setRenderTarget(null); R.render(scene, cam); return; }
    R.setRenderTarget(rt); R.render(scene, cam);
    const u = dof.uniforms; u.uNear.value = cam.near; u.uFar.value = cam.far; u.uFocus.value = focus; u.uAp.value = aperture;
    comp.uniforms.uBloom.value = .45 * bloom;
    const src = tier.dof ? rtD : rt;
    if (tier.dof) { quad.material = dof; R.setRenderTarget(rtD); R.render(pScene, pCam); }
    bright.uniforms.tD.value = src.texture; comp.uniforms.tD.value = src.texture;
    quad.material = bright; R.setRenderTarget(bA); R.render(pScene, pCam);
    const w = bA.width, h = bA.height;
    for (const [x, y, src, dst] of [[1.2, 0, bA, bB], [0, 1.2, bB, bA], [2.6, 0, bA, bB], [0, 2.6, bB, bA]].slice(0, tier.blur)) {
      blur.uniforms.tD.value = src.texture; blur.uniforms.uDir.value.set(x / w, y / h); quad.material = blur; R.setRenderTarget(dst); R.render(pScene, pCam);
    }
    quad.material = comp; R.setRenderTarget(null); R.render(pScene, pCam);
  }
  return { resize, render, comp, setQuality, get dof() { return dof; }, get pixelRatio() { return pr; } };
}
