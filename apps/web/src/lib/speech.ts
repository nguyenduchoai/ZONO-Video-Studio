import { useEffect, useRef, useState } from "react";

/** Vietnamese voice input (Web Speech API — Chrome/Edge/Safari). Calls onFinal with each finished phrase. */
export function useSpeech(onFinal: (text: string) => void) {
  const Rec: any = typeof window !== "undefined" ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : null;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const rec = useRef<any>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;
  useEffect(() => () => rec.current?.abort?.(), []);
  const start = () => {
    if (!Rec || listening) return;
    const r = new Rec();
    r.lang = "vi-VN";
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e: any) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) cb.current(t.trim());
        else live += t;
      }
      setInterim(live);
    };
    r.onend = () => { setListening(false); setInterim(""); };
    r.onerror = () => { setListening(false); setInterim(""); };
    rec.current = r;
    r.start();
    setListening(true);
  };
  const stop = () => rec.current?.stop?.();
  return { supported: !!Rec, listening, interim, start, stop, toggle: () => (listening ? stop() : start()) };
}
