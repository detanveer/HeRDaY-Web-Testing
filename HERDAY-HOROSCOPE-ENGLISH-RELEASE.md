# HerDay English horoscope connection — 2026-10-16

Deploy this complete folder as the existing Web Testing app. CNAME remains web.appherday.com.

Horoscope selection and details use English only. Language buttons are hidden. Selected sign reads current Asia/Karachi content through the read-only Supabase RPC herday_get_daily_horoscope_v2. No Gemini, OpenAI, provider or admin calls are made from the frontend. Missing category prose is omitted rather than invented. Existing artwork, navigation and #FFF8FA background are preserved.

Backend prerequisites confirmed by user: English publisher SQL installed; english-only-v1 Worker ready, progress 12/12, AI calls 0.

Validation: JavaScript behavioral tests passed with mocked RPC responses (cache, rollover, safe rendering, null categories and English selection). User confirmed the deployed English horoscope displays correctly. This later release preserves that horoscope implementation. Test all 12 signs, absence of language buttons, live reading/lucky values, back navigation and bottom navigation.

Other sections and their existing language controls are outside this horoscope release. Existing saved translations are preserved in the backend.
