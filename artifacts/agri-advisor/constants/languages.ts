// constants/languages.ts

export type Language = {
  code: string;
  name: string;
  nativeName: string;
  whisperCode: string;
};

export const LANGUAGES: Language[] = [
  { code: "en", name: "English",   nativeName: "English",    whisperCode: "en" },
  { code: "hi", name: "Hindi",     nativeName: "हिंदी",      whisperCode: "hi" },
  { code: "bn", name: "Bengali",   nativeName: "বাংলা",      whisperCode: "bn" },
  { code: "te", name: "Telugu",    nativeName: "తెలుగు",     whisperCode: "te" },
  { code: "mr", name: "Marathi",   nativeName: "मराठी",      whisperCode: "mr" },
  { code: "ta", name: "Tamil",     nativeName: "தமிழ்",      whisperCode: "ta" },
  { code: "gu", name: "Gujarati",  nativeName: "ગુજરાતી",   whisperCode: "gu" },
  { code: "kn", name: "Kannada",   nativeName: "ಕನ್ನಡ",      whisperCode: "kn" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം",     whisperCode: "ml" },
  { code: "pa", name: "Punjabi",   nativeName: "ਪੰਜਾਬੀ",    whisperCode: "pa" },
  { code: "or", name: "Odia",      nativeName: "ଓଡ଼ିଆ",      whisperCode: "or" },
  { code: "ur", name: "Urdu",      nativeName: "اردو",       whisperCode: "ur" },
];

export const DEFAULT_LANGUAGE: Language = LANGUAGES[0];
