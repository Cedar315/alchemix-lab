import React from "react";

type GlassKind = "coupe" | "highball" | "rocks";

/** Shared monochrome glass drawings; names select a silhouette, never a photo. */
export default function CocktailLineArt({ name, kind, className = "" }: { name: string; kind?: GlassKind; className?: string }) {
  const shape = kind ?? (/马天尼|玛格丽特|大都会|黛[吉基]|martini|margarita|cosmopolitan|daiquiri|gimlet|吉姆雷/i.test(name) ? "coupe" : /古典|内格罗尼|威士忌酸|old fashioned|negroni|whiskey sour/i.test(name) ? "rocks" : "highball");
  return <svg role="img" aria-label={`${name}，酒杯线描`} className={`cocktail-line-art ${className}`} viewBox="0 0 120 140" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    {shape === "coupe" ? <><path d="M28 39h64L60 78 28 39Zm32 39v38m-18 0h36M36 49h48"/><path d="m69 43 20-23"/><circle cx="80" cy="30" r="5"/></> : shape === "rocks" ? <><path d="m30 48 5 65h50l5-65H30Zm4 25h52"/><rect x="44" y="63" width="22" height="22" rx="2" transform="rotate(-16 55 74)"/><path d="M73 47c-3-18 20-18 17 0m-14-2c0-11 12-11 11 0"/></> : <><path d="m37 30 5 87h36l5-87H37Zm3 33h40m-10-4 8-43 13-5"/><path d="m48 73 14-3 3 16-14 3Zm9 23 13-3 3 14"/><circle cx="39" cy="44" r="12"/><path d="M39 36v16m-8-8h16"/></>}
    <path d="M24 124h72" strokeOpacity=".2"/>
  </svg>;
}
