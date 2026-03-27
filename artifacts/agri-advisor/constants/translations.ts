// constants/translations.ts

export type TranslationKeys = {
  // Greetings
  goodMorning: string;
  goodAfternoon: string;
  goodEvening: string;

  // Home screen
  askTitle: string;
  askSubtitle: string;
  quickQueries: string;
  aboutAgriAdvisor: string;
  aboutTitle: string;
  aboutDesc: string;
  viewAgentPipeline: string;

  // Quick Queries
  rainForecast: string;
  wheatMandi: string;
  pestAlerts: string;
  pmKisan: string;
  irrigation: string;
  fertilizerDosage: string;

  // Tab labels
  tabHome: string;
  tabAskAI: string;
  tabWeather: string;
  tabMarket: string;
  tabAgents: string;

  // Chat screen
  chatHeaderSubtitle: string;
  chatEmptyTitle: string;
  chatEmptyDesc: string;
  suggestionRain: string;
  suggestionWheat: string;
  suggestionPest: string;
  suggestionPmKisan: string;
  suggestionSoybean: string;
  suggestionFertilizer: string;
  voiceInputHint: string;
  webHint: string;
  voiceRecording: string;
  voiceTranscribing: string;
  voiceCancel: string;
  chatErrorMessage: string;
  inputPlaceholder: string;
};

const translations: Record<string, TranslationKeys> = {
  en: {
    goodMorning: "Good Morning",
    goodAfternoon: "Good Afternoon",
    goodEvening: "Good Evening",
    askTitle: "Ask AgriAdvisor AI",
    askSubtitle: "Weather, market prices, pest control...",
    quickQueries: "Quick Queries",
    aboutAgriAdvisor: "About AgriAdvisor",
    aboutTitle: "LangGraph 6-Agent Pipeline",
    aboutDesc:
      "Every query flows through 6 specialized AI agents — Guardrails, Intent, Web Search, Weather, Market, and Synthesis — powered by open-source LLMs for cost-efficient, accurate agricultural advice.",
    viewAgentPipeline: "View Agent Pipeline",
    rainForecast: "Rain forecast\nthis week",
    wheatMandi: "Wheat mandi\nprice today",
    pestAlerts: "Pest alerts\nnear me",
    pmKisan: "PM-KISAN\neligibility",
    irrigation: "Irrigation\nschedule",
    fertilizerDosage: "Fertilizer\ndosage",
    tabHome: "Home",
    tabAskAI: "Ask AI",
    tabWeather: "Weather",
    tabMarket: "Market",
    tabAgents: "AI Agents",
    chatHeaderSubtitle: "6-Agent AI Pipeline",
    chatEmptyTitle: "Ask AgriAdvisor AI",
    chatEmptyDesc:
      "Get instant answers about weather, crop prices, pest control, government schemes, and more.",
    suggestionRain: "Rain this week in Punjab?",
    suggestionWheat: "Wheat mandi price today",
    suggestionPest: "Pest alert for cotton",
    suggestionPmKisan: "PM-KISAN eligibility",
    suggestionSoybean: "Soybean price in MP",
    suggestionFertilizer: "Fertilizer dosage for rice",
    voiceInputHint: "🎙 Voice input",
    webHint: "Press Enter to send · Shift+Enter for new line",
    voiceRecording: "Recording… tap mic to stop",
    voiceTranscribing: "Transcribing…",
    voiceCancel: "Cancel",
    chatErrorMessage:
      "Sorry, something went wrong processing your query. Please try again.",
    inputPlaceholder: "Ask about weather, crops, prices…",
  },

  hi: {
    goodMorning: "सुप्रभात",
    goodAfternoon: "नमस्ते",
    goodEvening: "शुभ संध्या",
    askTitle: "AgriAdvisor AI से पूछें",
    askSubtitle: "मौसम, बाज़ार भाव, कीट नियंत्रण...",
    quickQueries: "त्वरित प्रश्न",
    aboutAgriAdvisor: "AgriAdvisor के बारे में",
    aboutTitle: "LangGraph 6-एजेंट पाइपलाइन",
    aboutDesc:
      "हर प्रश्न 6 विशेष AI एजेंटों से होकर गुज़रता है — गार्डरेल्स, इंटेंट, वेब सर्च, मौसम, बाज़ार और सिंथेसिस — ओपन-सोर्स LLMs द्वारा संचालित।",
    viewAgentPipeline: "एजेंट पाइपलाइन देखें",
    rainForecast: "इस हफ्ते\nबारिश का अनुमान",
    wheatMandi: "गेहूं मंडी\nआज का भाव",
    pestAlerts: "नज़दीकी\nकीट अलर्ट",
    pmKisan: "PM-KISAN\nपात्रता",
    irrigation: "सिंचाई\nशेड्यूल",
    fertilizerDosage: "उर्वरक\nमात्रा",
    tabHome: "होम",
    tabAskAI: "AI से पूछें",
    tabWeather: "मौसम",
    tabMarket: "बाज़ार",
    tabAgents: "AI एजेंट",
    chatHeaderSubtitle: "6-एजेंट AI पाइपलाइन",
    chatEmptyTitle: "AgriAdvisor AI से पूछें",
    chatEmptyDesc:
      "मौसम, फसल भाव, कीट नियंत्रण, सरकारी योजनाओं और अधिक के बारे में तुरंत उत्तर पाएं।",
    suggestionRain: "पंजाब में इस हफ्ते बारिश?",
    suggestionWheat: "आज गेहूं का मंडी भाव",
    suggestionPest: "कपास के लिए कीट अलर्ट",
    suggestionPmKisan: "PM-KISAN पात्रता",
    suggestionSoybean: "MP में सोयाबीन का भाव",
    suggestionFertilizer: "धान के लिए उर्वरक मात्रा",
    voiceInputHint: "🎙 वॉइस इनपुट",
    webHint: "भेजने के लिए Enter दबाएं · नई लाइन के लिए Shift+Enter",
    voiceRecording: "रिकॉर्डिंग… रोकने के लिए माइक दबाएं",
    voiceTranscribing: "ट्रांसक्राइब हो रहा है…",
    voiceCancel: "रद्द करें",
    chatErrorMessage:
      "क्षमा करें, आपकी क्वेरी प्रोसेस करने में त्रुटि हुई। कृपया पुनः प्रयास करें।",
    inputPlaceholder: "मौसम, फसल, भाव के बारे में पूछें…",
  },

  mr: {
    goodMorning: "शुभ प्रभात",
    goodAfternoon: "नमस्कार",
    goodEvening: "शुभ संध्या",
    askTitle: "AgriAdvisor AI ला विचारा",
    askSubtitle: "हवामान, बाजार भाव, कीड नियंत्रण...",
    quickQueries: "त्वरित प्रश्न",
    aboutAgriAdvisor: "AgriAdvisor बद्दल",
    aboutTitle: "LangGraph 6-एजंट पाइपलाइन",
    aboutDesc:
      "प्रत्येक प्रश्न 6 विशेष AI एजंटांमधून जातो — गार्डरेल्स, इंटेंट, वेब सर्च, हवामान, बाजार आणि सिंथेसिस — ओपन-सोर्स LLMs द्वारे चालवले जाते.",
    viewAgentPipeline: "एजंट पाइपलाइन पहा",
    rainForecast: "या आठवड्यात\nपावसाचा अंदाज",
    wheatMandi: "गहू मंडी\nआजचा भाव",
    pestAlerts: "जवळील\nकीड अलर्ट",
    pmKisan: "PM-KISAN\nपात्रता",
    irrigation: "सिंचन\nवेळापत्रक",
    fertilizerDosage: "खत\nमात्रा",
    tabHome: "होम",
    tabAskAI: "AI ला विचारा",
    tabWeather: "हवामान",
    tabMarket: "बाजार",
    tabAgents: "AI एजंट",
    chatHeaderSubtitle: "6-एजंट AI पाइपलाइन",
    chatEmptyTitle: "AgriAdvisor AI ला विचारा",
    chatEmptyDesc:
      "हवामान, पीक भाव, कीड नियंत्रण, सरकारी योजना आणि अधिकबद्दल त्वरित उत्तरे मिळवा.",
    suggestionRain: "पंजाबमध्ये या आठवड्यात पाऊस?",
    suggestionWheat: "आज गहू मंडी भाव",
    suggestionPest: "कापसासाठी कीड अलर्ट",
    suggestionPmKisan: "PM-KISAN पात्रता",
    suggestionSoybean: "MP मध्ये सोयाबीन भाव",
    suggestionFertilizer: "भाताासाठी खत मात्रा",
    voiceInputHint: "🎙 व्हॉइस इनपुट",
    webHint: "पाठवण्यासाठी Enter दाबा · नवीन ओळीसाठी Shift+Enter",
    voiceRecording: "रेकॉर्डिंग… थांबवण्यासाठी माइक दाबा",
    voiceTranscribing: "ट्रान्सक्राइब होत आहे…",
    voiceCancel: "रद्द करा",
    chatErrorMessage:
      "क्षमस्व, तुमची क्वेरी प्रक्रिया करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.",
    inputPlaceholder: "हवामान, पीक, भावाबद्दल विचारा…",
  },

  bn: {
    goodMorning: "শুভ সকাল",
    goodAfternoon: "শুভ অপরাহ্ন",
    goodEvening: "শুভ সন্ধ্যা",
    askTitle: "AgriAdvisor AI-কে জিজ্ঞেস করুন",
    askSubtitle: "আবহাওয়া, বাজার মূল্য, কীটপতঙ্গ নিয়ন্ত্রণ...",
    quickQueries: "দ্রুত প্রশ্ন",
    aboutAgriAdvisor: "AgriAdvisor সম্পর্কে",
    aboutTitle: "LangGraph ৬-এজেন্ট পাইপলাইন",
    aboutDesc:
      "প্রতিটি প্রশ্ন ৬টি বিশেষ AI এজেন্টের মধ্য দিয়ে যায় — গার্ডরেলস, ইন্টেন্ট, ওয়েব সার্চ, আবহাওয়া, বাজার এবং সিন্থেসিস।",
    viewAgentPipeline: "এজেন্ট পাইপলাইন দেখুন",
    rainForecast: "এই সপ্তাহে\nবৃষ্টির পূর্বাভাস",
    wheatMandi: "গম মান্ডি\nআজকের দাম",
    pestAlerts: "কাছাকাছি\nকীটপতঙ্গ সতর্কতা",
    pmKisan: "PM-KISAN\nযোগ্যতা",
    irrigation: "সেচ\nসময়সূচি",
    fertilizerDosage: "সার\nমাত্রা",
    tabHome: "হোম",
    tabAskAI: "AI জিজ্ঞেস",
    tabWeather: "আবহাওয়া",
    tabMarket: "বাজার",
    tabAgents: "AI এজেন্ট",
    chatHeaderSubtitle: "৬-এজেন্ট AI পাইপলাইন",
    chatEmptyTitle: "AgriAdvisor AI-কে জিজ্ঞেস করুন",
    chatEmptyDesc:
      "আবহাওয়া, ফসলের দাম, কীটপতঙ্গ নিয়ন্ত্রণ, সরকারি প্রকল্প সম্পর্কে তাৎক্ষণিক উত্তর পান।",
    suggestionRain: "পাঞ্জাবে এই সপ্তাহে বৃষ্টি?",
    suggestionWheat: "আজ গমের মান্ডি দাম",
    suggestionPest: "তুলার জন্য কীটপতঙ্গ সতর্কতা",
    suggestionPmKisan: "PM-KISAN যোগ্যতা",
    suggestionSoybean: "MP-তে সয়াবিনের দাম",
    suggestionFertilizer: "ধানের জন্য সারের মাত্রা",
    voiceInputHint: "🎙 ভয়েস ইনপুট",
    webHint: "পাঠাতে Enter চাপুন · নতুন লাইনের জন্য Shift+Enter",
    voiceRecording: "রেকর্ডিং… থামাতে মাইক চাপুন",
    voiceTranscribing: "ট্রান্সক্রাইব হচ্ছে…",
    voiceCancel: "বাতিল করুন",
    chatErrorMessage:
      "দুঃখিত, আপনার প্রশ্ন প্রক্রিয়া করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
    inputPlaceholder: "আবহাওয়া, ফসল, দাম সম্পর্কে জিজ্ঞেস করুন…",
  },

  te: {
    goodMorning: "శుభోదయం",
    goodAfternoon: "శుభ మధ్యాహ్నం",
    goodEvening: "శుభ సాయంత్రం",
    askTitle: "AgriAdvisor AI ని అడగండి",
    askSubtitle: "వాతావరణం, మార్కెట్ ధరలు, తెగులు నియంత్రణ...",
    quickQueries: "త్వరిత ప్రశ్నలు",
    aboutAgriAdvisor: "AgriAdvisor గురించి",
    aboutTitle: "LangGraph 6-ఏజెంట్ పైప్‌లైన్",
    aboutDesc:
      "ప్రతి ప్రశ్న 6 ప్రత్యేక AI ఏజెంట్ల గుండా వెళుతుంది — గార్డ్‌రెయిల్స్, ఇంటెంట్, వెబ్ సెర్చ్, వాతావరణం, మార్కెట్ మరియు సింథసిస్.",
    viewAgentPipeline: "ఏజెంట్ పైప్‌లైన్ చూడండి",
    rainForecast: "ఈ వారం\nవర్షం అంచనా",
    wheatMandi: "గోధుమ మండి\nఈరోజు ధర",
    pestAlerts: "సమీపంలో\nతెగులు హెచ్చరికలు",
    pmKisan: "PM-KISAN\nఅర్హత",
    irrigation: "నీటిపారుదల\nషెడ్యూల్",
    fertilizerDosage: "ఎరువు\nమోతాదు",
    tabHome: "హోమ్",
    tabAskAI: "AI అడగండి",
    tabWeather: "వాతావరణం",
    tabMarket: "మార్కెట్",
    tabAgents: "AI ఏజెంట్లు",
    chatHeaderSubtitle: "6-ఏజెంట్ AI పైప్‌లైన్",
    chatEmptyTitle: "AgriAdvisor AI ని అడగండి",
    chatEmptyDesc:
      "వాతావరణం, పంట ధరలు, తెగులు నియంత్రణ, ప్రభుత్వ పథకాలు మరియు మరిన్నింటి గురించి తక్షణ సమాధానాలు పొందండి.",
    suggestionRain: "పంజాబ్‌లో ఈ వారం వర్షం?",
    suggestionWheat: "ఈరోజు గోధుమ మండి ధర",
    suggestionPest: "పత్తికి తెగులు హెచ్చరిక",
    suggestionPmKisan: "PM-KISAN అర్హత",
    suggestionSoybean: "MP లో సోయాబీన్ ధర",
    suggestionFertilizer: "వరికి ఎరువు మోతాదు",
    voiceInputHint: "🎙 వాయిస్ ఇన్‌పుట్",
    webHint: "పంపించడానికి Enter నొక్కండి · కొత్త లైన్‌కు Shift+Enter",
    voiceRecording: "రికార్డింగ్… ఆపడానికి మైక్ నొక్కండి",
    voiceTranscribing: "ట్రాన్స్‌క్రైబ్ అవుతోంది…",
    voiceCancel: "రద్దు చేయండి",
    chatErrorMessage:
      "క్షమించండి, మీ ప్రశ్న ప్రాసెస్ చేయడంలో లోపం వచ్చింది. దయచేసి మళ్ళీ ప్రయత్నించండి.",
    inputPlaceholder: "వాతావరణం, పంటలు, ధరల గురించి అడగండి…",
  },

  ta: {
    goodMorning: "காலை வணக்கம்",
    goodAfternoon: "மதிய வணக்கம்",
    goodEvening: "மாலை வணக்கம்",
    askTitle: "AgriAdvisor AI-ஐ கேளுங்கள்",
    askSubtitle: "வானிலை, சந்தை விலை, பூச்சி கட்டுப்பாடு...",
    quickQueries: "விரைவு கேள்விகள்",
    aboutAgriAdvisor: "AgriAdvisor பற்றி",
    aboutTitle: "LangGraph 6-முகவர் பைப்லைன்",
    aboutDesc:
      "ஒவ்வொரு கேள்வியும் 6 சிறப்பு AI முகவர்கள் வழியாக செல்கிறது — கார்டுரெயில்ஸ், இன்டென்ட், வெப் சர்ச், வானிலை, சந்தை மற்றும் சிந்தசிஸ்.",
    viewAgentPipeline: "முகவர் பைப்லைன் பார்க்க",
    rainForecast: "இந்த வாரம்\nமழை முன்னறிவிப்பு",
    wheatMandi: "கோதுமை மண்டி\nஇன்றைய விலை",
    pestAlerts: "அருகில்\nபூச்சி எச்சரிக்கைகள்",
    pmKisan: "PM-KISAN\nதகுதி",
    irrigation: "நீர்ப்பாசன\nஅட்டவணை",
    fertilizerDosage: "உரம்\nஅளவு",
    tabHome: "முகப்பு",
    tabAskAI: "AI கேளுங்கள்",
    tabWeather: "வானிலை",
    tabMarket: "சந்தை",
    tabAgents: "AI முகவர்கள்",
    chatHeaderSubtitle: "6-முகவர் AI பைப்லைன்",
    chatEmptyTitle: "AgriAdvisor AI-ஐ கேளுங்கள்",
    chatEmptyDesc:
      "வானிலை, பயிர் விலை, பூச்சி கட்டுப்பாடு, அரசு திட்டங்கள் மற்றும் பலவற்றைப் பற்றி உடனடி பதில்கள் பெறுங்கள்.",
    suggestionRain: "பஞ்சாபில் இந்த வாரம் மழை?",
    suggestionWheat: "இன்று கோதுமை மண்டி விலை",
    suggestionPest: "பருத்திக்கு பூச்சி எச்சரிக்கை",
    suggestionPmKisan: "PM-KISAN தகுதி",
    suggestionSoybean: "MP-ல் சோயாபீன் விலை",
    suggestionFertilizer: "நெல்லுக்கு உர அளவு",
    voiceInputHint: "🎙 குரல் உள்ளீடு",
    webHint: "அனுப்ப Enter அழுத்தவும் · புதிய வரிக்கு Shift+Enter",
    voiceRecording: "பதிவு செய்கிறது… நிறுத்த மைக் அழுத்தவும்",
    voiceTranscribing: "டிரான்ஸ்கிரைப் ஆகிறது…",
    voiceCancel: "ரத்து செய்",
    chatErrorMessage:
      "மன்னிக்கவும், உங்கள் கேள்வியை செயலாக்குவதில் பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.",
    inputPlaceholder: "வானிலை, பயிர்கள், விலை பற்றி கேளுங்கள்…",
  },

  gu: {
    goodMorning: "સુપ્રભાત",
    goodAfternoon: "શુભ બપોર",
    goodEvening: "શુભ સાંજ",
    askTitle: "AgriAdvisor AI ને પૂછો",
    askSubtitle: "હવામાન, બજાર ભાવ, જીવાત નિયંત્રણ...",
    quickQueries: "ઝડપી પ્રશ્નો",
    aboutAgriAdvisor: "AgriAdvisor વિશે",
    aboutTitle: "LangGraph 6-એજન્ટ પાઇપલાઇન",
    aboutDesc:
      "દરેક પ્રશ્ન 6 વિશેષ AI એજન્ટો દ્વારા પ્રવાહિત થાય છે — ગાર્ડરેઇલ્સ, ઇન્ટેન્ટ, વેબ સર્ચ, હવામાન, બજાર અને સિન્થેસિસ.",
    viewAgentPipeline: "એજન્ટ પાઇપલાઇન જુઓ",
    rainForecast: "આ અઠવાડિયે\nવરસાદની આગાહી",
    wheatMandi: "ઘઉં મંડી\nઆજનો ભાવ",
    pestAlerts: "નજીકમાં\nજીવાત ચેતવણી",
    pmKisan: "PM-KISAN\nપાત્રતા",
    irrigation: "સિંચાઈ\nસમયપત્રક",
    fertilizerDosage: "ખાતર\nમાત્રા",
    tabHome: "હોમ",
    tabAskAI: "AI પૂછો",
    tabWeather: "હવામાન",
    tabMarket: "બજાર",
    tabAgents: "AI એજન્ટ",
    chatHeaderSubtitle: "6-એજન્ટ AI પાઇપલાઇન",
    chatEmptyTitle: "AgriAdvisor AI ને પૂછો",
    chatEmptyDesc:
      "હવામાન, પાક ભાવ, જીવાત નિયંત્રણ, સરકારી યોજનાઓ અને વધુ વિશે તાત્કાલિક જવાબ મેળવો.",
    suggestionRain: "પંજાબમાં આ અઠવાડિયે વરસાદ?",
    suggestionWheat: "આજ ઘઉં મંડી ભાવ",
    suggestionPest: "કપાસ માટે જીવાત ચેતવણી",
    suggestionPmKisan: "PM-KISAN પાત્રતા",
    suggestionSoybean: "MP માં સોયાબીન ભાવ",
    suggestionFertilizer: "ડાંગર માટે ખાતર માત્રા",
    voiceInputHint: "🎙 વૉઇસ ઇનપુટ",
    webHint: "મોકલવા Enter દબાવો · નવી લીટી માટે Shift+Enter",
    voiceRecording: "રેકોર્ડ થઈ રહ્યું છે… રોકવા માટે માઇક દબાવો",
    voiceTranscribing: "ટ્રાન્સ્ક્રાઇબ થઈ રહ્યું છે…",
    voiceCancel: "રદ કરો",
    chatErrorMessage:
      "માફ કરો, તમારી ક્વેરી પ્રક્રિયા કરવામાં ભૂલ થઈ. કૃપા કરીને ફરી પ્રયાસ કરો.",
    inputPlaceholder: "હવામાન, પાક, ભાવ વિશે પૂછો…",
  },

  kn: {
    goodMorning: "ಶುಭೋದಯ",
    goodAfternoon: "ಶುಭ ಮಧ್ಯಾಹ್ನ",
    goodEvening: "ಶುಭ ಸಂಜೆ",
    askTitle: "AgriAdvisor AI ಅನ್ನು ಕೇಳಿ",
    askSubtitle: "ಹವಾಮಾನ, ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು, ಕೀಟ ನಿಯಂತ್ರಣ...",
    quickQueries: "ತ್ವರಿತ ಪ್ರಶ್ನೆಗಳು",
    aboutAgriAdvisor: "AgriAdvisor ಬಗ್ಗೆ",
    aboutTitle: "LangGraph 6-ಏಜೆಂಟ್ ಪೈಪ್‌ಲೈನ್",
    aboutDesc:
      "ಪ್ರತಿ ಪ್ರಶ್ನೆ 6 ವಿಶೇಷ AI ಏಜೆಂಟ್‌ಗಳ ಮೂಲಕ ಹರಿಯುತ್ತದೆ — ಗಾರ್ಡ್‌ರೇಲ್ಸ್, ಇಂಟೆಂಟ್, ವೆಬ್ ಸರ್ಚ್, ಹವಾಮಾನ, ಮಾರುಕಟ್ಟೆ ಮತ್ತು ಸಿಂಥೆಸಿಸ್.",
    viewAgentPipeline: "ಏಜೆಂಟ್ ಪೈಪ್‌ಲೈನ್ ನೋಡಿ",
    rainForecast: "ಈ ವಾರ\nಮಳೆ ಮುನ್ಸೂಚನೆ",
    wheatMandi: "ಗೋಧಿ ಮಂಡಿ\nಇಂದಿನ ಬೆಲೆ",
    pestAlerts: "ಹತ್ತಿರದ\nಕೀಟ ಎಚ್ಚರಿಕೆ",
    pmKisan: "PM-KISAN\nಅರ್ಹತೆ",
    irrigation: "ನೀರಾವರಿ\nವೇಳಾಪಟ್ಟಿ",
    fertilizerDosage: "ಗೊಬ್ಬರ\nಪ್ರಮಾಣ",
    tabHome: "ಹೋಮ್",
    tabAskAI: "AI ಕೇಳಿ",
    tabWeather: "ಹವಾಮಾನ",
    tabMarket: "ಮಾರುಕಟ್ಟೆ",
    tabAgents: "AI ಏಜೆಂಟ್‌ಗಳು",
    chatHeaderSubtitle: "6-ಏಜೆಂಟ್ AI ಪೈಪ್‌ಲೈನ್",
    chatEmptyTitle: "AgriAdvisor AI ಅನ್ನು ಕೇಳಿ",
    chatEmptyDesc:
      "ಹವಾಮಾನ, ಬೆಳೆ ಬೆಲೆಗಳು, ಕೀಟ ನಿಯಂತ್ರಣ, ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು ಮತ್ತು ಇನ್ನಷ್ಟು ಬಗ್ಗೆ ತ್ವರಿತ ಉತ್ತರಗಳನ್ನು ಪಡೆಯಿರಿ.",
    suggestionRain: "ಪಂಜಾಬ್‌ನಲ್ಲಿ ಈ ವಾರ ಮಳೆ?",
    suggestionWheat: "ಇಂದು ಗೋಧಿ ಮಂಡಿ ಬೆಲೆ",
    suggestionPest: "ಹತ್ತಿಗೆ ಕೀಟ ಎಚ್ಚರಿಕೆ",
    suggestionPmKisan: "PM-KISAN ಅರ್ಹತೆ",
    suggestionSoybean: "MP ನಲ್ಲಿ ಸೋಯಾಬೀನ್ ಬೆಲೆ",
    suggestionFertilizer: "ಭತ್ತಕ್ಕೆ ಗೊಬ್ಬರ ಪ್ರಮಾಣ",
    voiceInputHint: "🎙 ಧ್ವನಿ ಇನ್‌ಪುಟ್",
    webHint: "ಕಳುಹಿಸಲು Enter ಒತ್ತಿ · ಹೊಸ ಸಾಲಿಗೆ Shift+Enter",
    voiceRecording: "ರೆಕಾರ್ಡ್ ಆಗುತ್ತಿದೆ… ನಿಲ್ಲಿಸಲು ಮೈಕ್ ಒತ್ತಿ",
    voiceTranscribing: "ಟ್ರಾನ್ಸ್‌ಕ್ರೈಬ್ ಆಗುತ್ತಿದೆ…",
    voiceCancel: "ರದ್ದು ಮಾಡಿ",
    chatErrorMessage:
      "ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಪ್ರಕ್ರಿಯೆಗೊಳಿಸುವಲ್ಲಿ ದೋಷ ಉಂಟಾಯಿತು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    inputPlaceholder: "ಹವಾಮಾನ, ಬೆಳೆಗಳು, ಬೆಲೆಗಳ ಬಗ್ಗೆ ಕೇಳಿ…",
  },

  ml: {
    goodMorning: "സുപ്രഭാതം",
    goodAfternoon: "ശുഭ ഉച്ചയ്ക്ക്",
    goodEvening: "ശുഭ സന്ധ്യ",
    askTitle: "AgriAdvisor AI-നോട് ചോദിക്കൂ",
    askSubtitle: "കാലാവസ്ഥ, വിപണി വില, കീട നിയന്ത്രണം...",
    quickQueries: "പെട്ടെന്നുള്ള ചോദ്യങ്ങൾ",
    aboutAgriAdvisor: "AgriAdvisor-നെ കുറിച്ച്",
    aboutTitle: "LangGraph 6-ഏജൻ്റ് പൈപ്പ്‌ലൈൻ",
    aboutDesc:
      "ഓരോ ചോദ്യവും 6 പ്രത്യേക AI ഏജൻ്റുകളിലൂടെ കടന്നുപോകുന്നു — ഗാർഡ്‌റെയിൽസ്, ഇൻ്റൻ്റ്, വെബ് സെർച്ച്, കാലാവസ്ഥ, വിപണി, സിന്തസിസ്.",
    viewAgentPipeline: "ഏജൻ്റ് പൈപ്പ്‌ലൈൻ കാണുക",
    rainForecast: "ഈ ആഴ്ച\nമഴ പ്രവചനം",
    wheatMandi: "ഗോതമ്പ് മണ്ടി\nഇന്നത്തെ വില",
    pestAlerts: "അടുത്ത്\nകീട മുന്നറിയിപ്പ്",
    pmKisan: "PM-KISAN\nയോഗ്യത",
    irrigation: "ജലസേചന\nഷെഡ്യൂൾ",
    fertilizerDosage: "വളം\nഅളവ്",
    tabHome: "ഹോം",
    tabAskAI: "AI ചോദിക്കൂ",
    tabWeather: "കാലാവസ്ഥ",
    tabMarket: "വിപണി",
    tabAgents: "AI ഏജൻ്റുകൾ",
    chatHeaderSubtitle: "6-ഏജൻ്റ് AI പൈപ്പ്‌ലൈൻ",
    chatEmptyTitle: "AgriAdvisor AI-നോട് ചോദിക്കൂ",
    chatEmptyDesc:
      "കാലാവസ്ഥ, വിള വില, കീട നിയന്ത്രണം, സർക്കാർ പദ്ധതികൾ തുടങ്ങിയവയെ കുറിച്ച് ഉടനടി ഉത്തരങ്ങൾ നേടൂ.",
    suggestionRain: "പഞ്ചാബിൽ ഈ ആഴ്ച മഴ?",
    suggestionWheat: "ഇന്ന് ഗോതമ്പ് മണ്ടി വില",
    suggestionPest: "പരുത്തിക്ക് കീട മുന്നറിയിപ്പ്",
    suggestionPmKisan: "PM-KISAN യോഗ്യത",
    suggestionSoybean: "MP-ൽ സോയാബീൻ വില",
    suggestionFertilizer: "നെല്ലിന് വളം അളവ്",
    voiceInputHint: "🎙 വോയ്‌സ് ഇൻപുട്ട്",
    webHint: "അയയ്ക്കാൻ Enter അമർത്തുക · പുതിയ വരിക്ക് Shift+Enter",
    voiceRecording: "റെക്കോർഡ് ആകുന്നു… നിർത്താൻ മൈക്ക് അമർത്തുക",
    voiceTranscribing: "ട്രാൻസ്ക്രൈബ് ആകുന്നു…",
    voiceCancel: "റദ്ദാക്കുക",
    chatErrorMessage:
      "ക്ഷമിക്കണം, നിങ്ങളുടെ ചോദ്യം പ്രോസസ്സ് ചെയ്യുന്നതിൽ പിഴവ് സംഭവിച്ചു. വീണ്ടും ശ്രമിക്കൂ.",
    inputPlaceholder: "കാലാവസ്ഥ, വിളകൾ, വില എന്നിവയെ കുറിച്ച് ചോദിക്കൂ…",
  },

  pa: {
    goodMorning: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ",
    goodAfternoon: "ਸ਼ੁਭ ਦੁਪਹਿਰ",
    goodEvening: "ਸ਼ੁਭ ਸ਼ਾਮ",
    askTitle: "AgriAdvisor AI ਤੋਂ ਪੁੱਛੋ",
    askSubtitle: "ਮੌਸਮ, ਮੰਡੀ ਭਾਅ, ਕੀੜੇ ਨਿਯੰਤਰਣ...",
    quickQueries: "ਤੁਰੰਤ ਸਵਾਲ",
    aboutAgriAdvisor: "AgriAdvisor ਬਾਰੇ",
    aboutTitle: "LangGraph 6-ਏਜੰਟ ਪਾਈਪਲਾਈਨ",
    aboutDesc:
      "ਹਰ ਸਵਾਲ 6 ਵਿਸ਼ੇਸ਼ AI ਏਜੰਟਾਂ ਤੋਂ ਲੰਘਦਾ ਹੈ — ਗਾਰਡਰੇਲਜ਼, ਇੰਟੈਂਟ, ਵੈੱਬ ਸਰਚ, ਮੌਸਮ, ਮੰਡੀ ਅਤੇ ਸਿੰਥੇਸਿਸ।",
    viewAgentPipeline: "ਏਜੰਟ ਪਾਈਪਲਾਈਨ ਦੇਖੋ",
    rainForecast: "ਇਸ ਹਫ਼ਤੇ\nਬਾਰਿਸ਼ ਦਾ ਅੰਦਾਜ਼ਾ",
    wheatMandi: "ਕਣਕ ਮੰਡੀ\nਅੱਜ ਦਾ ਭਾਅ",
    pestAlerts: "ਨੇੜੇ\nਕੀੜੇ ਅਲਰਟ",
    pmKisan: "PM-KISAN\nਯੋਗਤਾ",
    irrigation: "ਸਿੰਚਾਈ\nਸਮਾਂ-ਸਾਰਣੀ",
    fertilizerDosage: "ਖਾਦ\nਮਾਤਰਾ",
    tabHome: "ਹੋਮ",
    tabAskAI: "AI ਪੁੱਛੋ",
    tabWeather: "ਮੌਸਮ",
    tabMarket: "ਮੰਡੀ",
    tabAgents: "AI ਏਜੰਟ",
    chatHeaderSubtitle: "6-ਏਜੰਟ AI ਪਾਈਪਲਾਈਨ",
    chatEmptyTitle: "AgriAdvisor AI ਤੋਂ ਪੁੱਛੋ",
    chatEmptyDesc:
      "ਮੌਸਮ, ਫਸਲ ਭਾਅ, ਕੀੜੇ ਨਿਯੰਤਰਣ, ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ ਅਤੇ ਹੋਰ ਬਾਰੇ ਤੁਰੰਤ ਜਵਾਬ ਪਾਓ।",
    suggestionRain: "ਪੰਜਾਬ ਵਿੱਚ ਇਸ ਹਫ਼ਤੇ ਬਾਰਿਸ਼?",
    suggestionWheat: "ਅੱਜ ਕਣਕ ਮੰਡੀ ਭਾਅ",
    suggestionPest: "ਕਪਾਹ ਲਈ ਕੀੜੇ ਅਲਰਟ",
    suggestionPmKisan: "PM-KISAN ਯੋਗਤਾ",
    suggestionSoybean: "MP ਵਿੱਚ ਸੋਇਆਬੀਨ ਭਾਅ",
    suggestionFertilizer: "ਝੋਨੇ ਲਈ ਖਾਦ ਮਾਤਰਾ",
    voiceInputHint: "🎙 ਵੌਇਸ ਇਨਪੁਟ",
    webHint: "ਭੇਜਣ ਲਈ Enter ਦਬਾਓ · ਨਵੀਂ ਲਾਈਨ ਲਈ Shift+Enter",
    voiceRecording: "ਰਿਕਾਰਡ ਹੋ ਰਿਹਾ ਹੈ… ਰੋਕਣ ਲਈ ਮਾਈਕ ਦਬਾਓ",
    voiceTranscribing: "ਟ੍ਰਾਂਸਕ੍ਰਾਈਬ ਹੋ ਰਿਹਾ ਹੈ…",
    voiceCancel: "ਰੱਦ ਕਰੋ",
    chatErrorMessage:
      "ਮਾਫ਼ ਕਰਨਾ, ਤੁਹਾਡੀ ਕਿਊਰੀ ਪ੍ਰੋਸੈਸ ਕਰਨ ਵਿੱਚ ਗਲਤੀ ਹੋਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    inputPlaceholder: "ਮੌਸਮ, ਫਸਲਾਂ, ਭਾਅ ਬਾਰੇ ਪੁੱਛੋ…",
  },

  or: {
    goodMorning: "ଶୁଭ ସକାଳ",
    goodAfternoon: "ଶୁଭ ଅପରାହ୍ନ",
    goodEvening: "ଶୁଭ ସନ୍ଧ୍ୟା",
    askTitle: "AgriAdvisor AI କୁ ପଚାରନ୍ତୁ",
    askSubtitle: "ପାଣିପାଗ, ବଜାର ମୂଲ୍ୟ, କୀଟ ନିୟନ୍ତ୍ରଣ...",
    quickQueries: "ଶୀଘ୍ର ପ୍ରଶ୍ନ",
    aboutAgriAdvisor: "AgriAdvisor ବିଷୟରେ",
    aboutTitle: "LangGraph 6-ଏଜେଣ୍ଟ ପାଇପଲାଇନ",
    aboutDesc:
      "ପ୍ରତ୍ୟେକ ପ୍ରଶ୍ନ 6 ବିଶେଷ AI ଏଜେଣ୍ଟ ମାଧ୍ୟମରେ ଯାଏ — ଗାର୍ଡରେଲ୍ସ, ଇଣ୍ଟେଣ୍ଟ, ୱେବ ସର୍ଚ୍ଚ, ପାଣିପାଗ, ବଜାର ଏବଂ ସିନ୍ଥେସିସ।",
    viewAgentPipeline: "ଏଜେଣ୍ଟ ପାଇପଲାଇନ ଦେଖନ୍ତୁ",
    rainForecast: "ଏହି ସପ୍ତାହ\nବର୍ଷା ପୂର୍ବାନୁମାନ",
    wheatMandi: "ଗହମ ମଣ୍ଡି\nଆଜିର ମୂଲ୍ୟ",
    pestAlerts: "ନିକଟ\nକୀଟ ସତର୍କତା",
    pmKisan: "PM-KISAN\nଯୋଗ୍ୟତା",
    irrigation: "ଜଳସେଚନ\nସୂଚୀ",
    fertilizerDosage: "ସାର\nମାତ୍ରା",
    tabHome: "ହୋମ",
    tabAskAI: "AI ପଚାରନ୍ତୁ",
    tabWeather: "ପାଣିପାଗ",
    tabMarket: "ବଜାର",
    tabAgents: "AI ଏଜେଣ୍ଟ",
    chatHeaderSubtitle: "6-ଏଜେଣ୍ଟ AI ପାଇପଲାଇନ",
    chatEmptyTitle: "AgriAdvisor AI କୁ ପଚାରନ୍ତୁ",
    chatEmptyDesc:
      "ପାଣିପାଗ, ଫସଲ ମୂଲ୍ୟ, କୀଟ ନିୟନ୍ତ୍ରଣ, ସରକାରୀ ଯୋଜନା ଏବଂ ଅଧିକ ବିଷୟରେ ତୁରନ୍ତ ଉତ୍ତର ପାଆନ୍ତୁ।",
    suggestionRain: "ପଞ୍ଜାବରେ ଏହି ସପ୍ତାହ ବର୍ଷା?",
    suggestionWheat: "ଆଜି ଗହମ ମଣ୍ଡି ମୂଲ୍ୟ",
    suggestionPest: "କପା ପାଇଁ କୀଟ ସତର୍କତା",
    suggestionPmKisan: "PM-KISAN ଯୋଗ୍ୟତା",
    suggestionSoybean: "MP ରେ ସୋୟାବିନ ମୂଲ୍ୟ",
    suggestionFertilizer: "ଧାନ ପାଇଁ ସାର ମାତ୍ରା",
    voiceInputHint: "🎙 ଭଏସ ଇନପୁଟ",
    webHint: "ପଠାଇବାକୁ Enter ଦବାନ୍ତୁ · ନୂଆ ଧାଡ଼ି ପାଇଁ Shift+Enter",
    voiceRecording: "ରେକର୍ଡ ହେଉଛି… ବନ୍ଦ କରିବାକୁ ମାଇକ ଦବାନ୍ତୁ",
    voiceTranscribing: "ଟ୍ରାନ୍ସକ୍ରାଇବ ହେଉଛି…",
    voiceCancel: "ବାତିଲ କରନ୍ତୁ",
    chatErrorMessage:
      "କ୍ଷମା କରନ୍ତୁ, ଆପଣଙ୍କ ପ୍ରଶ୍ନ ପ୍ରକ୍ରିୟା କରିବାରେ ତ୍ରୁଟି ଘଟିଛି। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
    inputPlaceholder: "ପାଣିପାଗ, ଫସଲ, ମୂଲ୍ୟ ବିଷୟରେ ପଚାରନ୍ତୁ…",
  },

  ur: {
    goodMorning: "صبح بخیر",
    goodAfternoon: "دوپہر بخیر",
    goodEvening: "شام بخیر",
    askTitle: "AgriAdvisor AI سے پوچھیں",
    askSubtitle: "موسم، منڈی بھاؤ، کیڑوں کا کنٹرول...",
    quickQueries: "فوری سوالات",
    aboutAgriAdvisor: "AgriAdvisor کے بارے میں",
    aboutTitle: "LangGraph 6-ایجنٹ پائپ لائن",
    aboutDesc:
      "ہر سوال 6 خصوصی AI ایجنٹوں سے گزرتا ہے — گارڈریلز، انٹینٹ، ویب سرچ، موسم، مارکیٹ اور سنتھیسس۔",
    viewAgentPipeline: "ایجنٹ پائپ لائن دیکھیں",
    rainForecast: "اس ہفتے\nبارش کی پیش گوئی",
    wheatMandi: "گندم منڈی\nآج کا بھاؤ",
    pestAlerts: "قریبی\nکیڑوں کی وارننگ",
    pmKisan: "PM-KISAN\nاہلیت",
    irrigation: "آبپاشی\nشیڈول",
    fertilizerDosage: "کھاد\nمقدار",
    tabHome: "ہوم",
    tabAskAI: "AI سے پوچھیں",
    tabWeather: "موسم",
    tabMarket: "منڈی",
    tabAgents: "AI ایجنٹ",
    chatHeaderSubtitle: "6-ایجنٹ AI پائپ لائن",
    chatEmptyTitle: "AgriAdvisor AI سے پوچھیں",
    chatEmptyDesc:
      "موسم، فصل بھاؤ، کیڑوں کا کنٹرول، سرکاری اسکیمیں اور مزید کے بارے میں فوری جوابات پائیں۔",
    suggestionRain: "پنجاب میں اس ہفتے بارش؟",
    suggestionWheat: "آج گندم منڈی بھاؤ",
    suggestionPest: "کپاس کے لیے کیڑے کی وارننگ",
    suggestionPmKisan: "PM-KISAN اہلیت",
    suggestionSoybean: "MP میں سویابین بھاؤ",
    suggestionFertilizer: "چاول کے لیے کھاد کی مقدار",
    voiceInputHint: "🎙 وائس ان پٹ",
    webHint: "بھیجنے کے لیے Enter دبائیں · نئی لائن کے لیے Shift+Enter",
    voiceRecording: "ریکارڈ ہو رہا ہے… روکنے کے لیے مائیک دبائیں",
    voiceTranscribing: "ٹرانسکرائب ہو رہا ہے…",
    voiceCancel: "منسوخ کریں",
    chatErrorMessage:
      "معافی کریں، آپ کا سوال پروسیس کرنے میں غلطی ہوئی۔ براہ کرم دوبارہ کوشش کریں۔",
    inputPlaceholder: "موسم، فصلوں، بھاؤ کے بارے میں پوچھیں…",
  },
};

/**
 * Returns the translation object for a given language code.
 * Falls back to English if the code is not found.
 */
export function getTranslations(languageCode: string): TranslationKeys {
  return translations[languageCode] ?? translations["en"];
}
