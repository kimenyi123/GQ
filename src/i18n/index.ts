import en from "./en.json";
import fr from "./fr.json";
import rw from "./rw.json";
import sw from "./sw.json";

export const locales = ["rw", "en", "fr", "sw"] as const;
export type Locale = (typeof locales)[number];

const dictionaries: Record<Locale, typeof en> = {
  rw,
  en,
  fr,
  sw,
};

export function getDict(lang: string = "rw") {
  return dictionaries[isLocale(lang) ? lang : "rw"];
}

export function isLocale(lang: string): lang is Locale {
  return locales.includes(lang as Locale);
}
