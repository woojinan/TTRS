/* Original synthesized effects and a quiet looping accompaniment. */
class GameAudio {
  constructor() { this.context=null; this.timer=null; this.step=0; this.lastMove=-Infinity; }
  unlock() {
    try {
      const Audio=window.AudioContext||window.webkitAudioContext; if(!Audio)return;
      if(!this.context) { this.context=new Audio(); this.sfx=this.context.createGain(); this.music=this.context.createGain(); this.sfx.connect(this.context.destination); this.music.connect(this.context.destination); }
      if(this.context.state==="suspended")this.context.resume().catch(()=>{});
    } catch(_) { /* Continue playing if the device has no audio support. */ }
  }
  configure(prefs) {
    this.prefs=prefs; if(!this.context)return;
    this.sfx.gain.setValueAtTime(prefs.muted?0:prefs.sfx/100*.22,this.context.currentTime);
    this.music.gain.setValueAtTime(prefs.muted?0:prefs.music/100*.12,this.context.currentTime);
  }
  tone(hz,duration,delay=0,kind="sine",channel=this.sfx,volume=.5) {
    if(!this.context||this.context.state!=="running"||!channel)return;
    const t=this.context.currentTime+delay,osc=this.context.createOscillator(),envelope=this.context.createGain();
    osc.type=kind; osc.frequency.setValueAtTime(hz,t); envelope.gain.setValueAtTime(0,t);
    envelope.gain.linearRampToValueAtTime(volume,t+.006); envelope.gain.exponentialRampToValueAtTime(.001,t+duration);
    osc.connect(envelope); envelope.connect(channel); osc.start(t); osc.stop(t+duration+.02);
    osc.onended=()=>{osc.disconnect();envelope.disconnect();};
  }
  play(name,combo=0) {
    if(!this.context||this.prefs?.muted)return;
    if(name==="move") { if(this.context.currentTime-this.lastMove<.045)return; this.lastMove=this.context.currentTime; this.tone(170,.035,0,"triangle"); }
    else if(name==="rotate")this.tone(340,.06,0,"triangle");
    else if(name==="hold") { this.tone(330,.09); this.tone(440,.1,.055); }
    else if(name==="drop") { this.tone(95,.12,0,"triangle",this.sfx,.9); this.tone(190,.07); }
    else if(name==="lock")this.tone(130,.08,0,"triangle");
    else if(name==="count")this.tone(440,.09);
    else if(name==="go")this.tone(880,.2);
    else if(name==="clear"||name==="special") {
      const shift=Math.pow(2,Math.min(combo,12)/12);
      (name==="special"?[440,554,659,880]:[330,440,554]).forEach((f,i)=>this.tone(f*shift,.17,i*.045,"triangle"));
    } else if(name==="win")[440,554,659,880].forEach((f,i)=>this.tone(f,.3,i*.1));
    else if(name==="lose")[330,247,165].forEach((f,i)=>this.tone(f,.25,i*.11,"triangle"));
  }
  startMusic() {
    this.stopMusic(); this.step=0; const notes=[220,0,330,440,0,330,277,0,196,0,294,392,0,294,247,0];
    this.timer=setInterval(()=>{const n=notes[this.step++%notes.length];if(n&&this.prefs&&!this.prefs.muted&&this.prefs.music>0)this.tone(n,.28,0,"sine",this.music,.4);},250);
  }
  stopMusic() { clearInterval(this.timer); this.timer=null; }
}
