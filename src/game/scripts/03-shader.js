

/* ===============================================================
   v25 SHADER VARIANTS
   Real fullscreen GLSL post-processing, kept optional and lightweight.
   Modes: vanilla / vivid / cinematic / toon / night
   =============================================================== */
(function(){
  'use strict';
window._bwShaderMode = bwStorage.get('bw_shader_mode') || 'vanilla';
  let _rt=null, _ppScene=null, _ppCamera=null, _ppMesh=null;

  const VERT = `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = vec4(position,1.0);
    }`;

  const FRAG = `
    uniform sampler2D tDiffuse;
    uniform float mode;
    uniform float time;
    uniform vec2 resolution;
    varying vec2 vUv;

    vec3 acesLike(vec3 x){
      return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);
    }

    vec3 sampleBlur(vec2 uv, vec2 px){
      vec3 s=texture2D(tDiffuse,uv).rgb;
      s+=texture2D(tDiffuse,uv+px*vec2(1.0,0.0)).rgb;
      s+=texture2D(tDiffuse,uv-px*vec2(1.0,0.0)).rgb;
      s+=texture2D(tDiffuse,uv+px*vec2(0.0,1.0)).rgb;
      s+=texture2D(tDiffuse,uv-px*vec2(0.0,1.0)).rgb;
      return s/5.0;
    }

    void main(){
      vec2 px=1.0/resolution;
      vec4 src=texture2D(tDiffuse,vUv);
      vec3 c=src.rgb;

      if(mode<0.5){
        gl_FragColor=src;
        return;
      }

      float l=dot(c,vec3(0.2126,0.7152,0.0722));

      if(mode<1.5){
        // Vivid: controlled saturation + local contrast.
        vec3 b=sampleBlur(vUv,px);
        c += (c-b)*0.16;
        c=mix(vec3(l),c,1.13);
        c=(c-0.5)*1.075+0.5;
        c=acesLike(c*1.015);
      }else if(mode<2.5){
        // Cinematic: filmic response, subtle bloom approximation and vignette.
        vec3 b=sampleBlur(vUv,px*3.0);
        float bright=max(0.0,dot(b,vec3(0.299,0.587,0.114))-0.62);
        c += b*bright*0.20;
        c=acesLike(c*1.09);
        float d=distance(vUv,vec2(0.5));
        float vig=1.0-smoothstep(0.28,0.78,d)*0.16;
        c*=vig;
      }else if(mode<3.5){
        // Toon: stepped tones plus edge-preserving local contrast.
        vec3 b=sampleBlur(vUv,px);
        c += (c-b)*0.20;
        c=acesLike(c*1.02);
        c=floor(c*6.0+0.5)/6.0;
        c=mix(c,pow(max(c,0.0),vec3(0.92)),0.25);
      }else{
        // Night: blue moonlight, preserved highlights and mild vignette.
        float nl=smoothstep(0.0,0.85,l);
        vec3 moon=mix(vec3(0.035,0.065,0.13),vec3(0.30,0.46,0.72),nl);
        c=mix(c,moon,0.48);
        c=acesLike(c*0.90);
        float d=distance(vUv,vec2(0.5));
        c*=1.0-smoothstep(0.30,0.80,d)*0.12;
      }

      // Tiny temporal dither to reduce banding in gradients.
      float n=fract(sin(dot(vUv*vec2(127.1,311.7)+time*0.001,
                            vec2(12.9898,78.233)))*43758.5453)-0.5;
      c+=n/255.0;

      gl_FragColor=vec4(clamp(c,0.0,1.0),src.a);
    }`

  function modeNumber(){
    return ({vanilla:0,vivid:1,cinematic:2,toon:3,night:4}[
      window._bwShaderMode
    ] ?? 0);
  }

  function _bwLiveRenderer(){
    // v25追記: window.renderer が同期されていない場合でも、
    // 同一ドキュメント内のトップレベルlet変数(renderer)を直接参照できるのでフォールバックする。
    try{ if(window.renderer) return window.renderer; }catch(e){}
    try{ if(typeof renderer!=='undefined' && renderer) return renderer; }catch(e){}
    return null;
  }
  function _bwLiveScene(){
    try{ if(window.scene) return window.scene; }catch(e){}
    try{ if(typeof scene!=='undefined' && scene) return scene; }catch(e){}
    return null;
  }
  function _bwLiveCamera(){
    try{ if(window.camera) return window.camera; }catch(e){}
    try{ if(typeof camera!=='undefined' && camera) return camera; }catch(e){}
    return null;
  }

  function ensure(){
    const R=_bwLiveRenderer(), S=_bwLiveScene(), C=_bwLiveCamera();
    if(!R || !S || !C || !window.THREE) return false;
    const w=Math.max(1,window.innerWidth||1), h=Math.max(1,window.innerHeight||1);
    if(!_rt){
      _rt=new THREE.WebGLRenderTarget(w,h,{
        depthBuffer:true,
        stencilBuffer:false,
        minFilter:THREE.LinearFilter,
        magFilter:THREE.LinearFilter
      });
      _ppScene=new THREE.Scene();
      _ppCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
      _ppMesh=new THREE.Mesh(
        new THREE.PlaneGeometry(2,2),
        new THREE.ShaderMaterial({
          uniforms:{
            tDiffuse:{value:_rt.texture},
            mode:{value:modeNumber()},
            time:{value:0},
            resolution:{value:new THREE.Vector2(Math.max(1,innerWidth),Math.max(1,innerHeight))}
          },
          vertexShader:VERT,
          fragmentShader:FRAG,
          depthTest:false,
          depthWrite:false
        })
      );
      _ppScene.add(_ppMesh);
    }
    if(_rt.width !== w || _rt.height !== h) _rt.setSize(w,h);
    _ppMesh.material.uniforms.resolution.value.set(w,h);
    _ppMesh.material.uniforms.mode.value=modeNumber();
    return true;
  }

  window._bwRender=function(sc,cam){
    const liveR=_bwLiveRenderer();
    if(!liveR || !sc || !cam) return;
    // v26追記: 実験的機能トグルがOFFの間は、ポストエフェクトを一切介さず
    // 直接描画する(従来通りの軽量な挙動をデフォルトとして維持する)。
    if(!window._bwExperimentalGraphics){
      liveR.render(sc,cam);
      return;
    }
    if(!ensure()){
      liveR.render(sc,cam);
      return;
    }
    const r=liveR;
    r.setRenderTarget(_rt);
    r.clear();
    r.render(sc,cam);
    r.setRenderTarget(null);
    _ppMesh.material.uniforms.time.value=performance.now()*0.001;
    r.render(_ppScene,_ppCamera);
  };

  window._bwSetShaderMode=function(mode){
    if(!['vanilla','vivid','cinematic','toon','night'].includes(mode)) mode='vanilla';
    window._bwShaderMode=mode;
    bwStorage.set('bw_shader_mode',mode);
    if(_ppMesh) _ppMesh.material.uniforms.mode.value=modeNumber();
    const el=document.getElementById('bw-shader-mode');
    if(el) el.value=mode;
  };

  window.addEventListener('resize',()=>{
    try{ if(_rt) _rt.setSize(Math.max(1,innerWidth),Math.max(1,innerHeight)); }catch(e){}
  });
})();
