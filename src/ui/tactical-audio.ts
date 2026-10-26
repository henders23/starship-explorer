import { useSound } from './sound.js'

/** Short layered Web Audio cues. Pure presentation; does not touch mission RNG or saves. */
export type TacticalCue = 'select'|'move'|'fire'|'plasma'|'heavy'|'impact'|'shield'|'miss'|'reload'|'heal'|'interact'|'alarm'|'turn'
let context: AudioContext | null = null
function ctx():AudioContext|null {
 if(typeof window==='undefined'||!('AudioContext' in window))return null
 try {
   if(!context)context=new AudioContext()
   if(context.state==='suspended')void context.resume().catch(()=>{})
   return context
 }catch{return null}
}
function tone(c:AudioContext,at:number,freq:number,to:number,duration:number,level:number,wave:OscillatorType='sine') {
 const oscillator=c.createOscillator(),amp=c.createGain()
 oscillator.type=wave;oscillator.frequency.setValueAtTime(Math.max(15,freq),at)
 oscillator.frequency.exponentialRampToValueAtTime(Math.max(15,to),at+duration)
 amp.gain.setValueAtTime(.0001,at);amp.gain.exponentialRampToValueAtTime(Math.max(.001,level),at+.008)
 amp.gain.exponentialRampToValueAtTime(.0001,at+duration)
 oscillator.connect(amp).connect(c.destination);oscillator.start(at);oscillator.stop(at+duration+.015)
}
function noise(c:AudioContext,at:number,duration:number,level:number,cutoff=3600) {
 const frame=Math.max(1,Math.ceil(c.sampleRate*duration)),buffer=c.createBuffer(1,frame,c.sampleRate),data=buffer.getChannelData(0)
 for(let i=0;i<frame;i++)data[i]=Math.random()*2-1
 const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain()
 source.buffer=buffer;filter.type='lowpass';filter.frequency.value=cutoff
 gain.gain.setValueAtTime(Math.max(.001,level),at)
 gain.gain.exponentialRampToValueAtTime(.0001,at+duration)
 source.connect(filter).connect(gain).connect(c.destination);source.start(at);source.stop(at+duration)
}
export function playTacticalCue(cue:TacticalCue):void {
 if(useSound.getState().muted)return
 const c=ctx();if(!c)return
 const now=c.currentTime+.005
 switch(cue){
 case 'fire': noise(c,now,.095,.15,4800);tone(c,now,145,58,.18,.23,'triangle');tone(c,now+.07,450,80,.16,.065,'sawtooth');break
 case 'heavy': noise(c,now,.18,.22,3300);tone(c,now,105,34,.32,.26,'sawtooth');tone(c,now+.11,195,55,.25,.065,'triangle');break
 case 'plasma': tone(c,now,640,112,.24,.15,'sawtooth');tone(c,now,120,41,.24,.19,'triangle');noise(c,now+.035,.16,.055,4200);break
 case 'impact': noise(c,now,.13,.095,2300);tone(c,now,290,72,.23,.135,'triangle');break
 case 'shield': tone(c,now,780,120,.31,.12,'sine');tone(c,now+.045,1180,320,.2,.06,'triangle');break
 case 'miss':noise(c,now,.16,.045,1600);tone(c,now,420,190,.21,.04,'sine');break
 case 'move':noise(c,now,.07,.018,900);tone(c,now,145,96,.07,.029,'triangle');tone(c,now+.13,146,100,.055,.027,'triangle');break
 case 'reload':noise(c,now,.046,.045,2900);tone(c,now,620,260,.09,.06,'square');tone(c,now+.19,480,120,.075,.054,'square');break
 case 'heal':tone(c,now,420,620,.26,.052);tone(c,now+.14,510,780,.27,.047);break
 case 'alarm':tone(c,now,610,410,.22,.09,'square');tone(c,now+.24,610,410,.23,.085,'square');break
 case 'turn':tone(c,now,140,100,.18,.09,'triangle');tone(c,now+.13,450,245,.14,.05,'sine');break
 case 'interact':tone(c,now,340,580,.13,.065);noise(c,now,.055,.022,2800);break
 case 'select':tone(c,now,480,690,.065,.036,'sine');break
 }
}
export function cueForTacticalOrder(action:{type:string},unit?:{role:string;weapon?:string}):TacticalCue {
 if(action.type==='shoot')return unit?.weapon==='plasma'?'plasma':unit?.role==='heavy'?'heavy':'fire'
 if(action.type==='move')return 'move'
 if(action.type==='reload')return 'reload'
 if(action.type==='heal')return 'heal'
 if(action.type==='end-turn')return 'turn'
 if(action.type==='aim'||action.type==='overwatch')return 'select'
 return 'interact'
}
