import { useEffect, useRef, useState } from 'react'
import type { TacticalUnit } from '../engine/tactical/mission.js'
import { enemyAppearance, gunName } from './tactical-identity.js'

/** Deliberately opt-in: a small 3D asset proving ground, not a new tactical HUD.
 * The live game remains the authoritative, accessible SVG/2D view.
 */
export function TacticalModelInspector({unit,onClose}:{unit:TacticalUnit;onClose:()=>void}) {
 const mount=useRef<HTMLDivElement>(null)
 const close=useRef<HTMLButtonElement>(null)
 const [error,setError]=useState(false)
 useEffect(()=>{close.current?.focus()},[])
 useEffect(()=>{
  const host=mount.current
  if(!host)return
  let active=true,frame=0,cleanup=()=>{}
  void import('three').then(THREE=>{
   if(!active)return
   let renderer:import('three').WebGLRenderer
   try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'})
   } catch {
    setError(true);return
   }
   const scene=new THREE.Scene()
   const camera=new THREE.PerspectiveCamera(37,1,0.1,60)
   camera.position.set(3.9,2.9,5.4)
   camera.lookAt(0,1.05,0)
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))
   renderer.setSize(280,280,false)
   renderer.toneMapping=THREE.ACESFilmicToneMapping
   renderer.toneMappingExposure=1.1
   renderer.shadowMap.enabled=true
   renderer.shadowMap.type=THREE.PCFSoftShadowMap
   renderer.domElement.setAttribute('aria-hidden','true')
   renderer.domElement.style.width='100%'
   renderer.domElement.style.height='100%'
   host.appendChild(renderer.domElement)
   scene.add(new THREE.HemisphereLight(0x9cb7ce,0x161e29,2.15))
   const key=new THREE.DirectionalLight(0xffdfb3,3.1)
   key.position.set(-3,7,5);key.castShadow=true
   key.shadow.mapSize.set(512,512);scene.add(key)
   const rim=new THREE.PointLight(0x73c9f3,10,8)
   rim.position.set(3,3,-2);scene.add(rim)
   const material=(color:number,metalness=.6,roughness=.42)=>new THREE.MeshStandardMaterial({color,metalness,roughness})
   const armour=material(unit.side==='hostile'?0x343e46:0x657581,.75,.45)
   const undersuit=material(0x171f29,.2,.88)
   const visor=material(unit.side==='hostile'?0xa74736:0x74c6d2,.6,.16)
   const barrel=material(0x1c262e,.88,.3)
   const trim=material(unit.side==='hostile'?0x98735b:0xb8b9ac,.72,.34)
   const figure=new THREE.Group()
   scene.add(figure)
   const mesh=(geo:import('three').BufferGeometry,mat:import('three').Material,at:[number,number,number],parent:import('three').Object3D=figure)=>{
    const o=new THREE.Mesh(geo,mat);o.position.set(...at);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o
   }
   const block=(w:number,h:number,d:number,at:[number,number,number],mat=armour,parent:import('three').Object3D=figure)=>
    mesh(new THREE.BoxGeometry(w,h,d),mat,at,parent)
   const ball=(rad:number,at:[number,number,number],mat=armour,parent:import('three').Object3D=figure)=>
    mesh(new THREE.SphereGeometry(rad,16,12),mat,at,parent)
   const limb=(ax:number,ay:number,az:number,bx:number,by:number,bz:number,rad:number,mat=undersuit,parent:import('three').Object3D=figure)=>{
    const a=new THREE.Vector3(ax,ay,az),b=new THREE.Vector3(bx,by,bz)
    const o=mesh(new THREE.CylinderGeometry(rad*.85,rad,a.distanceTo(b),12),mat,[(ax+bx)/2,(ay+by)/2,(az+bz)/2],parent)
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize())
    return o
   }
   const floor=mesh(new THREE.CylinderGeometry(1.45,1.58,.09,36),material(0x1b2b36,.65,.77),[0,-.08,0])
   floor.receiveShadow=true
   mesh(new THREE.TorusGeometry(1.17,.013,8,64),trim,[0,.01,0]).rotation.x=Math.PI/2
   const hostile=unit.side==='hostile'
   const kind=hostile?enemyAppearance(unit).kind:'custodian'
   if(hostile&&kind==='scout'){
     // Gemini's concentric gyro drone, rebuilt as a self-contained scout without third-party meshes.
     figure.position.y=.46
     const hover=new THREE.Group();hover.position.y=1.04;figure.add(hover)
     ball(.27,[0,0,0],visor,hover)
     for(const [r,axis] of [[.44,0],[.55,1],[.63,2]] as const) {
       const ring=mesh(new THREE.TorusGeometry(r,.038,10,40),axis===1?trim:armour,[0,0,0],hover)
       if(axis===0)ring.rotation.x=Math.PI/2
       if(axis===1)ring.rotation.y=Math.PI/3
       if(axis===2)ring.rotation.z=Math.PI/4
     }
     for(const x of [-.38,.38]){block(.18,.25,.48,[x,-.16,.1],armour,hover);ball(.065,[x,-.16,.39],visor,hover)}
   } else if(hostile&&kind==='sentinel'){
     // Stationary heavy tripod recognisable at small sizes.
     const turret=new THREE.Group();turret.position.y=1.24;figure.add(turret)
     block(.9,.52,.72,[0,0,0],armour,turret)
     block(.65,.11,.12,[0,.04,.41],visor,turret)
     for(const x of [-.26,.26]){
       limb(x,1.18,-.08,x*1.9,.15,x*.7,.11,trim)
       block(.16,.18,.95,[x,.04,.54],barrel,turret)
     }
     ball(.29,[0,.82,0],undersuit)
   } else {
     const heavy=hostile&&kind==='enforcer',scale=heavy?1.12:1
     figure.scale.setScalar(scale)
     const torso=mesh(new THREE.CapsuleGeometry(.39,.5,5,12),undersuit,[0,1.25,0])
     torso.scale.z=.73
     block(heavy?.86:.65,.47,.24,[0,1.4,.13])
     block(.36,.13,.27,[0,1.48,.26],visor)
     const head=ball(.26,[0,1.92,0],armour)
     head.scale.set(1,.94,1.05)
     block(.39,.093,.08,[0,1.92,.255],visor)
     // Visor plate follows the helmet's front axis.
     for(const side of [-1,1]){
       ball(heavy?.26:.19,[side*.47,1.65,0],trim)
       limb(side*.45,1.55,0,side*.55,1.13,.18,.13,undersuit)
       limb(side*.55,1.13,.18,side*.32,1.05,.48,.095,armour)
       ball(.115,[side*.32,1.05,.48],trim)
       limb(side*.2,.94,0,side*.25,.46,.08,.17,armour)
       limb(side*.25,.46,.08,side*.26,.12,.2,.12,undersuit)
       block(.27,.13,.4,[side*.26,.09,.31],armour)
     }
     const weapon=new THREE.Group();weapon.position.set(0,1.08,.57);figure.add(weapon)
     block(heavy?.23:.13,.15,heavy?1.15:.85,[0,0,.3],barrel,weapon)
     mesh(new THREE.CylinderGeometry(.043,.052,.48,14),trim,[0,.015,.98],weapon).rotation.x=Math.PI/2
     block(.12,.04,.3,[0,.13,.29],visor,weapon)
     block(.09,.22,.1,[0,-.17,.06],undersuit,weapon)
     block(.16,.085,.16,[0,.16,.10],armour,weapon)
     if(heavy){
       for(const x of [-.13,.13])block(.18,.23,.48,[x,1.24,.14],trim)
     }
   }
   const clock=new THREE.Clock()
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)')
   const render=()=>{
      if(!active)return
      const dt=clock.getDelta()
      if(!reduced.matches)figure.rotation.y+=Math.min(dt,.06)*.39
      renderer.render(scene,camera)
      frame=window.requestAnimationFrame(render)
   }
   render()
   cleanup=()=>{
     window.cancelAnimationFrame(frame)
     scene.traverse(node=>{
       if(node instanceof THREE.Mesh){
         node.geometry.dispose()
         const mats=Array.isArray(node.material)?node.material:[node.material]
         mats.forEach(m=>m.dispose())
       }
     })
     renderer.dispose()
     renderer.domElement.remove()
   }
  }).catch(()=>{if(active)setError(true)})
  return ()=>{active=false;cleanup()}
 },[unit.id,unit.side,unit.role,unit.weapon])
 return <div className="exp-modal-backdrop tac-inspect-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="exp-modal tac-inspect" role="dialog" aria-modal="true" aria-label="3D combat figure inspection" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();onClose()}}}>
      <span className="exp-eyebrow">Lodestar tactical / three-dimensional figure</span>
      <h2>{unit.name}</h2>
      <p>{unit.side==='hostile'?enemyAppearance(unit).name:gunName(unit)}</p>
      <div ref={mount} className="tac-inspect-canvas" aria-label={'3D reference figure for '+unit.name} role="img"/>
      {error&&<p role="status">3D preview is unavailable on this device. Combat still works in the normal map.</p>}
      <p className="tac-inspect-note">Procedural reference model. The battlefield keeps its existing animated characters; this viewer does not affect combat or the save.</p>
      <button ref={close} className="exp-button" onClick={onClose}>Return to mission</button>
    </section>
 </div>
}
