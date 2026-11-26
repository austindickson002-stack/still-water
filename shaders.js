'use strict';
(function (G) {
  const HEAD = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 uSunDir, uSunCol, uZen, uHor, uGlow, uAmbSky, uAmbGnd, uCam;
uniform float uFogD, uTime, uClip, uCloud;
`;
  const LIB = `
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s/.97;}
float fbm3(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*vnoise(p);p=p*2.07+vec2(5.1,1.3);a*=.5;}return s/.875;}
vec3 skyBase(vec3 d){
 float y=clamp(d.y,0.,1.);
 float mu=max(dot(d,uSunDir),0.);
 vec3 c=mix(uHor,uZen,pow(y,.42));
 float hz=exp(-y*7.);
 c+=uGlow*(hz*(.12+.8*pow(mu,5.))+pow(mu,24.)*.45+pow(mu,260.)*2.2);
 return c;
}
vec3 fogCol(vec3 dir){return skyBase(normalize(vec3(dir.x,max(dir.y,0.)*.35+.012,dir.z)));}
vec3 fogApply(vec3 col,vec3 wp){
 vec3 v=wp-uCam;float d=length(v);vec3 dir=v/max(d,1e-3);
 float f=1.-exp(-d*uFogD*exp(-max(wp.y,0.)*.006));
 return mix(col,fogCol(dir),clamp(f,0.,1.));
}
vec3 shade(vec3 alb,vec3 n,vec3 v,float wrap,float ao,float rough,float f0){
 float ndl=dot(n,uSunDir);
 float dif=max((ndl+wrap)/(1.+wrap),0.);
 vec3 amb=mix(uAmbGnd,uAmbSky,clamp(n.y*.5+.5,0.,1.))*ao;
 vec3 col=alb*(uSunCol*dif+amb);
 if(f0>0.){
  float a=max(rough*rough,.002);vec3 h=normalize(v+uSunDir);
  float sp=pow(max(dot(n,h),0.),2./a-2.)*(1./(3.14*a));
  float fr=f0+(1.-f0)*pow(1.-max(dot(n,v),0.),5.);
  col+=uSunCol*min(sp,40.)*fr*max(ndl,0.)*.9;
  vec3 r=reflect(-v,n);
  vec3 env=skyBase(normalize(vec3(r.x,abs(r.y),r.z)));
  if(r.y<0.)env*=.25;
  col+=env*fr*(1.-rough*.85)*ao;
 }
 return col;
}
`;
  const FS_VS = `#version 300 es
out vec2 vUv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;

  G.SH = {
    // ---------- sky ----------
    sky: [HEAD + `out vec2 vN;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2)*2.-1.;vN=p;gl_Position=vec4(p,1.,1.);}`,
      HEAD + LIB + `in vec2 vN;uniform mat4 uInvVP;out vec4 o;
void main(){
 vec4 w=uInvVP*vec4(vN,1.,1.);vec3 d=normalize(w.xyz/w.w);
 vec3 c=skyBase(d);
 float mu=dot(d,uSunDir);
 // sun disc with limb darkening
 float disc=smoothstep(.99982,.99992,mu);
 c+=uSunCol*disc*14.;
 if(d.y>0.){
  vec2 uv=d.xz/(d.y+.09)*1.1+vec2(uTime*.003,uTime*.001);
  float n=fbm(uv*1.3);
  float n2=fbm(uv*1.3+uSunDir.xz*.06);
  float cov=smoothstep(.62-uCloud*.25,.88-uCloud*.2,n);
  float det=fbm3(uv*7.);
  cov*=smoothstep(.15,.6,det*.7+cov*.6);
  // wispy streaks near horizon
  float streak=smoothstep(.55,.85,fbm(vec2(uv.x*.5,uv.y*3.)))*(1.-smoothstep(.0,.25,d.y))*.6;
  cov=max(cov,streak*uCloud);
  float fade=smoothstep(0.,.08,d.y);
  float lit=clamp(.55+(n-n2)*6.,0.,1.4);
  float mus=max(mu,0.);
  vec3 dark=mix(uZen*.55+uHor*.35,uHor*.6,.3);
  vec3 bright=uSunCol*.28+uGlow*.55+uHor*.45;
  vec3 cc=mix(dark,bright,lit);
  cc+=uGlow*pow(mus,6.)*(1.-cov)*1.8+uSunCol*pow(mus,40.)*.25;
  c=mix(c,cc,cov*fade*.92);
 }
 o=vec4(c,1.);
}`],
    // ---------- terrain ----------
    terrain: [HEAD + `in vec3 aPos,aNor,aCol;uniform mat4 uVP;out vec3 vWp,vN,vC;
void main(){vWp=aPos;vN=aNor;vC=aCol;gl_Position=uVP*vec4(aPos,1.);}`,
      HEAD + LIB + `in vec3 vWp,vN,vC;out vec4 o;
void main(){
 if(uClip>.5&&vWp.y<-.03)discard;
 vec3 n=normalize(vN);
 float d1=fbm3(vWp.xz*.07),d2=vnoise(vWp.xz*.8),d3=vnoise(vWp.xz*5.);
 vec3 alb=vC*(.72+.5*d1)*(.86+.28*d2)*(.9+.2*d3);
 float dry=smoothstep(.55,.72,fbm3(vWp.xz*.015+7.));
 alb=mix(alb,alb*vec3(1.25,1.08,.72),dry*smoothstep(.4,1.2,vWp.y)*smoothstep(25.,5.,vWp.y));
 float wet=1.-smoothstep(-.02,.3,vWp.y);
 alb*=1.-.45*wet;
 vec3 v=normalize(uCam-vWp);
 vec3 col=shade(alb,n,v,.12,1.,.7,wet*.05);
 o=vec4(fogApply(col,vWp),1.);
}`],
    // ---------- instanced vegetation ----------
    veg: [HEAD + `in vec3 aPos,aNor,aCol;in vec4 iA,iB;uniform mat4 uVP;uniform float uWind,uKind;out vec3 vWp,vN,vC;
void main(){
 float s=iA.w,c=cos(iB.x),sn=sin(iB.x);
 vec3 p=aPos*s;p.xz=vec2(c*p.x-sn*p.z,sn*p.x+c*p.z);
 vec3 n=aNor;n.xz=vec2(c*n.x-sn*n.z,sn*n.x+c*n.z);
 float h=aPos.y;
 float w=sin(uTime*1.2+iB.z*30.+iA.x*.07)*.6+sin(uTime*2.7+iB.z*13.)*.3;
 float k=uKind>.5?.09:.006;
 p.x+=w*h*h*k*s*uWind;p.z+=w*h*h*k*.7*s*uWind;
 vWp=p+iA.xyz;vN=n;vC=aCol*(.78+.44*iB.y);
 gl_Position=uVP*vec4(vWp,1.);}`,
      HEAD + LIB + `in vec3 vWp,vN,vC;uniform float uKind;out vec4 o;
void main(){
 if(uClip>.5&&vWp.y<-.03)discard;
 vec3 n=normalize(vN);vec3 v=normalize(uCam-vWp);
 vec3 alb=vC*(.8+.4*vnoise(vWp.xz*1.7+vWp.y*2.3));
 vec3 col=shade(alb,n,v,uKind>.5?.6:.2,1.,.9,0.);
 float back=pow(max(dot(-v,uSunDir),0.),5.);
 col+=alb*uSunCol*back*(uKind>.5?1.4:.45)*(.4+.6*vnoise(vWp.xy*5.+vWp.z));
 o=vec4(fogApply(col,vWp),1.);
}`],
    // ---------- generic lit (static, rig, float) ----------
    lit: [HEAD + `in vec3 aPos,aNor,aCol;in vec2 aUv;in float aMat;uniform mat4 uVP,uModel;out vec3 vWp,vN,vC,vLp;out vec2 vUv;flat out int vM;
void main(){vec4 w=uModel*vec4(aPos,1.);vWp=w.xyz;vLp=aPos;vN=mat3(uModel)*aNor;vC=aCol;vUv=aUv;vM=int(aMat+.5);gl_Position=uVP*w;}`,
      HEAD + LIB + `in vec3 vWp,vN,vC,vLp;in vec2 vUv;flat in int vM;uniform float uFog,uNight,uFill;out vec4 o;
void main(){
 if(uClip>.5&&vWp.y<-.03)discard;
 vec3 n=normalize(vN);
 vec3 v=normalize(uCam-vWp);
 vec3 alb=vC;float rough=.85,f0=0.,wrap=.1;vec3 em=vec3(0);
 if(vM==1){ // weathered wood, grain along uv.x
  float g=vnoise(vec2(vUv.x*3.,vUv.y*60.))*.5+vnoise(vec2(vUv.x*14.,vUv.y*200.))*.25+sin(vUv.y*260.+vnoise(vUv*vec2(4.,30.))*7.)*.06;
  alb*=.68+.62*g;alb*=mix(.55,1.,smoothstep(-.1,.35,vWp.y));
  alb=mix(alb,vec3(.03,.05,.02),(1.-smoothstep(-.3,.25,vWp.y))*.6);
  rough=.9;wrap=.15;
 }else if(vM==2){ // rock
  vec3 q=vWp*1.6;
  float r=fbm(q.xz+q.y*.7)*.65+vnoise(q.xy*3.+q.z)*.35;
  alb*=.55+.75*r;
  float lich=smoothstep(.62,.78,vnoise(vWp.xz*2.2+vWp.y*1.7))*smoothstep(.2,.6,n.y);
  alb=mix(alb,vec3(.16,.17,.07),lich*.7);
  float wet=1.-smoothstep(-.05,.35,vWp.y);
  alb*=1.-.5*wet;rough=.75-wet*.4;f0=.03*wet+.01;
 }else if(vM==3){rough=.3;f0=.55;wrap=0.;} // metal
 else if(vM==4){ // skin
  wrap=.45;rough=.5;f0=.028;
  alb*=.95+.1*vnoise(vLp.xy*800.);
 }else if(vM==5){ // fabric
  alb*=.85+.25*vnoise(vUv*vec2(160.,90.));wrap=.25;rough=.75;f0=.03;
 }else if(vM==6){rough=.28;f0=.05;} // gloss paint / plastic
 else if(vM==7){rough=.4;f0=.04;em=alb*.9;} // fluorescent tip
 else if(vM==8){alb*=.8+.4*vnoise(vUv*vec2(500.,120.));rough=.9;wrap=.2;} // cork/eva
 else if(vM==9){em=alb*uNight*3.;alb*=.2;rough=.2;f0=.04;} // window glow
 else if(vM==10){rough=.55;f0=.04;wrap=.5;} // lily pad
 else if(vM==12){alb*=.86+.1*sin((vLp.x+vLp.y)*900.)+.25*vnoise(vLp.xy*18.+vLp.z*7.);rough=.95;wrap=.25;}
 else if(vM==13){float nn=vnoise(vLp.xy*7.+vLp.z*4.)+vnoise(vLp.yz*15.)*.4;float l=abs(fract(nn*6.)-.5);alb=mix(alb*.72,alb,smoothstep(.02,.06,l));rough=.7;f0=.03;wrap=.3;}
 else if(vM==14){float nn=vnoise(vLp.xy*22.+vLp.z*9.);alb=mix(alb,alb*vec3(.45,.6,.55),step(.55,nn));alb=mix(alb,alb*1.6,step(.78,vnoise(vLp.yz*30.)));rough=.9;wrap=.3;}
 else if(vM==15){alb*=.92+.1*vnoise(vUv*vec2(90.,140.))+.05*sin(vUv.y*900.);rough=.82;f0=.025;wrap=.38;}
 else if(vM==11){alb*=.88+.22*vnoise(vLp.xy*1400.+vLp.z*900.);rough=.42;f0=.05;wrap=.22;} // glove
 vec3 col=shade(alb,n,v,wrap,1.,rough,f0)+em;
 if(vM==4){
  float back=pow(max(dot(-v,uSunDir),0.),2.5);
  float rim=pow(1.-max(dot(n,v),0.),2.);
  col+=alb*vec3(1.,.5,.35)*uSunCol*(back*rim*.55+back*.04);
  col+=alb*vec3(.2,.05,.03)*max(-dot(n,uSunDir),0.)*.18*length(uSunCol);
 }
 if(uFill>0.){float fl=max(dot(n,v),0.);col+=alb*(uAmbSky*1.6+vec3(.5,.45,.4))*uFill*(.35+.65*fl)+uSunCol*pow(1.-fl,3.)*.25*uFill;}
 if(vM==11||vM==5||vM==15){float ndv=1.-max(dot(n,v),0.);col+=uSunCol*pow(ndv,3.)*pow(max(dot(-v,uSunDir),0.),2.)*.1+uAmbSky*pow(ndv,3.)*.06;}
 if(uFog>.5)col=fogApply(col,vWp);
 o=vec4(col,1.);
}`],
    // ---------- water ----------
    water: [HEAD + `in vec3 aPos;uniform mat4 uVP;uniform float uSwell;out vec3 vWp;out vec2 vSl;
void main(){vec3 p=aPos;float fade=1.-smoothstep(600.,2400.,length(p.xz-uCam.xz));
 float a1=p.x*.11+uTime*1.05,a2=p.z*.17-uTime*1.3+1.7,a3=(p.x+p.z)*.27+uTime*1.9;
 p.y=uSwell*fade*(.55*sin(a1)+.3*sin(a2)+.15*sin(a3));
 vSl=uSwell*fade*vec2(.55*.11*cos(a1)+.15*.27*cos(a3),.3*.17*cos(a2)+.15*.27*cos(a3));
 vWp=p;gl_Position=uVP*vec4(p,1.);}`,
      HEAD + LIB + `in vec3 vWp;in vec2 vSl;uniform sampler2D uRefl,uRefr,uDep,uNrm;uniform vec2 uRes;uniform float uNear,uFar,uRain,uClar,uWaveK;uniform vec3 uDeep,uAbs;uniform vec2 uFlow;
uniform vec4 uRip[16];out vec4 o;
float lin(float d){float z=d*2.-1.;return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
void main(){
 vec2 sc=gl_FragCoord.xy/uRes;
 vec3 V=uCam-vWp;float dist=length(V);V/=dist;
 vec2 p=vWp.xz;
 vec2 fl=-uFlow*uTime;
 vec3 n1=texture(uNrm,(p+fl)*.031+uTime*vec2(.011,.007)).xyz*2.-1.;
 vec3 n2=texture(uNrm,(p+fl*1.2)*.083+uTime*vec2(-.019,.013)).xyz*2.-1.;
 vec3 n3=texture(uNrm,(p+fl*1.4)*.23+uTime*vec2(.027,-.031)).xyz*2.-1.;
 vec3 n4=texture(uNrm,(p+fl*.8)*.0071+uTime*vec2(.002,-.003)).xyz*2.-1.;
 vec2 g=n1.xy*.45+n2.xy*.45+n3.xy*.45+n4.xy*.35;
 // ripples
 for(int i=0;i<16;i++){vec4 r=uRip[i];if(r.w<=0.)continue;vec2 dd=p-r.xy;float rr=length(dd);
  float ph=rr-r.z;float env=exp(-ph*ph*6.)*r.w;g+=dd/max(rr,1e-3)*sin(ph*18.)*env*1.6;}
 float calm=mix(.16,.07,smoothstep(20.,400.,dist))*uWaveK;
 vec3 N=normalize(vec3(g.x*calm-vSl.x,1.,g.y*calm-vSl.y));
 float cosT=max(dot(N,V),0.);
 float F=.02+.98*pow(1.-cosT,5.);
 F=min(F*1.05,1.);
 vec2 off=N.xz*.9/(1.+dist*.06);
 vec3 refl=texture(uRefl,sc+off*vec2(.06,.08)).rgb;
 float dW=lin(gl_FragCoord.z);
 float dS=lin(texture(uDep,sc).r);
 vec2 ruv=sc+N.xz*.025*clamp((dS-dW)*.5,0.,1.);
 float dS2=lin(texture(uDep,ruv).r);
 if(dS2<dW)ruv=sc,dS2=dS;
 float thick=max(dS2-dW,0.);
 vec3 refr=texture(uRefr,ruv).rgb;
 float path=thick*(1.+ (1.-cosT)*1.5);
 vec3 absorb=exp(-uAbs*path*1.3);
 vec3 deep=uDeep*(uAmbSky*2.+uSunCol*.25);
 vec3 under=mix(deep,refr*absorb,exp(-path*uClar));
 vec3 Hh=normalize(V+uSunDir);float nh=max(dot(N,Hh),0.);
 float spec=pow(nh,900.)*28.+pow(nh,140.)*.9+pow(nh,20.)*.03;
 spec*=mix(1.,.35,smoothstep(.1,.5,uSunDir.y));
 // fog for transmitted part
 float fd=1.-exp(-dist*uFogD);
 under=mix(under,fogCol(-V),fd);
 vec3 col=mix(under,refl,F)+uSunCol*spec*(1.-fd*.8)*step(0.,uSunDir.y);
 float edge=smoothstep(0.,.12,thick);
 col=mix(refr,col,edge);
 o=vec4(col,1.);
}`],
    // ---------- line ribbon ----------
    line: [HEAD + `in vec3 aPos;in vec2 aUv;uniform mat4 uVP;out vec3 vWp;out float vA;void main(){vWp=aPos;vA=aUv.x;gl_Position=uVP*vec4(aPos,1.);}`,
      HEAD + `in vec3 vWp;in float vA;uniform vec3 uLineCol;out vec4 o;void main(){
 vec3 d=normalize(vWp-uCam);float g=pow(max(dot(d,uSunDir),0.),10.);
 vec3 c=uLineCol*(uAmbSky*1.6+uSunCol*.35)+uSunCol*g*1.8;o=vec4(c,vA);}`],
    // ---------- particles (splash) ----------
    pts: [HEAD + `in vec3 aPos;in vec2 aUv;uniform mat4 uVP;uniform float uScale;out float vA;out vec3 vWp;
void main(){vWp=aPos;vec4 c=uVP*vec4(aPos,1.);gl_Position=c;gl_PointSize=clamp(aUv.x*uScale/c.w,1.,64.);vA=aUv.y;}`,
      HEAD + `in float vA;in vec3 vWp;out vec4 o;void main(){vec2 q=gl_PointCoord*2.-1.;float r=dot(q,q);if(r>1.)discard;
 vec3 c=(uAmbSky*1.3+uSunCol*.5+uHor*.4);o=vec4(c,vA*(1.-r));}`],
    // ---------- fish ----------
    fish: [HEAD + `in vec3 aPos,aNor;in vec2 aUv;in float aMat;uniform mat4 uVP,uModel;uniform float uPhase,uAmp;out vec3 vWp,vN;out vec2 vUv;flat out int vM;
void main(){
 vec3 p=aPos;float x=p.x;
 float w=sin(uPhase-x*5.)*uAmp*smoothstep(.12,1.,x)*(.35+x);
 float dw=cos(uPhase-x*5.)*-5.*uAmp*smoothstep(.12,1.,x)*(.35+x);
 p.z+=w;
 vec3 n=normalize(vec3(aNor.x-dw*aNor.z,aNor.y,aNor.z));
 vec4 wp=uModel*vec4(p,1.);vWp=wp.xyz;vN=mat3(uModel)*n;vUv=aUv;vM=int(aMat+.5);gl_Position=uVP*wp;}`,
      HEAD + LIB + `in vec3 vWp,vN;in vec2 vUv;flat in int vM;uniform sampler2D uTex;uniform vec3 uFin;uniform float uSheen,uWet;out vec4 o;
void main(){
 if(uClip>.5&&vWp.y<-.03)discard;
 vec3 n=normalize(vN);
 vec3 v=normalize(uCam-vWp);
 vec3 alb;float rough=.32,f0=uSheen,wrap=.2;
 if(vM==1){
  float rays=.9+.1*sin(vUv.y*200.);
  alb=uFin*.75*rays*(.85+.3*vnoise(vUv*40.));
  rough=.5;f0=.03;wrap=.6;
 }else if(vM==2){alb=vec3(.005);rough=.08;f0=.08;}
 else if(vM==3){alb=vec3(.55,.38,.1);rough=.2;f0=.1;}
 else{alb=pow(texture(uTex,vUv).rgb,vec3(2.2));
  float sc=sin(vUv.x*420.+sin(vUv.y*300.)*1.5)*sin(vUv.y*260.);
  f0*=1.+.25*sc;}
 vec3 col=shade(alb,n,v,wrap,1.,rough,f0);
 float back=pow(max(dot(-v,uSunDir),0.),3.);
 if(vM==1)col+=alb*uSunCol*back*.6;
 col+=uSunCol*pow(1.-max(dot(n,v),0.),3.)*back*.25*uWet;
 o=vec4(fogApply(col,vWp),1.);
}`],
    // ---------- post ----------
    down: [FS_VS, `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uSrc;uniform vec2 uTx;uniform float uFirst,uThr;out vec4 o;
void main(){vec3 c=texture(uSrc,vUv+uTx*vec2(-1,-1)).rgb+texture(uSrc,vUv+uTx*vec2(1,-1)).rgb+texture(uSrc,vUv+uTx*vec2(-1,1)).rgb+texture(uSrc,vUv+uTx*vec2(1,1)).rgb;c*=.25;
 if(uFirst>.5){c=min(c,vec3(24.));float l=max(c.r,max(c.g,c.b));float k=max(l-uThr,0.);k=k*k/(k+.8);c*=k/max(l,1e-4);}
 o=vec4(c,1.);}`],
    up: [FS_VS, `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uSrc;uniform vec2 uTx;out vec4 o;
void main(){vec3 c=texture(uSrc,vUv).rgb*4.;
 c+=(texture(uSrc,vUv+uTx*vec2(-1,0)).rgb+texture(uSrc,vUv+uTx*vec2(1,0)).rgb+texture(uSrc,vUv+uTx*vec2(0,-1)).rgb+texture(uSrc,vUv+uTx*vec2(0,1)).rgb)*2.;
 c+=texture(uSrc,vUv+uTx*vec2(-1,-1)).rgb+texture(uSrc,vUv+uTx*vec2(1,-1)).rgb+texture(uSrc,vUv+uTx*vec2(-1,1)).rgb+texture(uSrc,vUv+uTx*vec2(1,1)).rgb;
 o=vec4(c/16.,1.);}`],
    comp: [FS_VS, `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uScene,uBloom;uniform vec2 uSun;uniform float uSunVis,uExpo,uBloomK,uTime,uAspect,uFlare,uHdr;uniform vec3 uFlareCol;out vec4 o;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
 vec3 c=texture(uScene,vUv).rgb*uHdr;
 vec3 b=texture(uBloom,vUv).rgb*uHdr;
 c+=b*uBloomK;
 if(uSunVis>0.){
  float lum=dot(texture(uBloom,clamp(uSun,0.,1.)).rgb*uHdr,vec3(.3,.5,.2));
  float k=uSunVis*smoothstep(.4,3.5,lum)*uFlare;
  vec2 dir=vec2(.5)-uSun;vec3 fl=vec3(0);
  float T[6]=float[6](.32,.58,.83,1.18,1.42,1.85);
  float R[6]=float[6](.025,.06,.018,.095,.045,.14);
  vec3 C[6]=vec3[6](vec3(.9,.6,.3),vec3(.3,.6,.9),vec3(1.,.8,.4),vec3(.4,.9,.6),vec3(.9,.4,.6),vec3(.5,.6,1.));
  for(int i=0;i<6;i++){vec2 gp=uSun+dir*T[i];vec2 dd=(vUv-gp)*vec2(uAspect,1.);float l=length(dd);
   float g=smoothstep(R[i],R[i]*.55,l)*(.6+.4*smoothstep(R[i]*.4,R[i],l));fl+=C[i]*g*.06;}
  vec2 hd=(vUv-.5)*vec2(uAspect,1.);float hr=length(hd);
  vec2 hv=(uSun-.5)*vec2(uAspect,1.);
  fl+=vec3(.6,.75,1.)*exp(-pow((hr-.42)*14.,2.))*.05*smoothstep(.6,0.,length(hv-hd*.0));
  vec2 sd=(vUv-uSun)*vec2(uAspect,1.);
  fl+=uFlareCol*exp(-abs(sd.y)*260.)*exp(-abs(sd.x)*2.6)*.5;
  fl+=uFlareCol*exp(-length(sd)*6.)*.35;
  float ang=atan(sd.y,sd.x);
  fl+=uFlareCol*pow(abs(cos(ang*3.)),40.)*exp(-length(sd)*14.)*.6;
  c+=fl*k;
 }
 c*=uExpo;
 c=aces(c);
 c=pow(c,vec3(1./2.2));
 vec2 q=vUv-.5;c*=1.-dot(q,q)*.6;
 c+=(h(vUv*vec2(1931.,1117.)+fract(uTime))-.5)*(1.6/255.);
 o=vec4(c,1.);
}`]
  };
})(window.G);
