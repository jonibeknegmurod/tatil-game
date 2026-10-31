# 🧭 Ta’til Quest

**Ilova:** https://jonibeknegmurod.github.io/tatil-game/

Ta’tilni sarguzasht o‘yini kabi boshqaradigan PWA: missiyalar, XP va darajalar, nishonlar, streak, kalendar, xarajatlar va kundalik.
Baza — o‘zingizning **Google Sheets** jadvalingiz. Server kerak emas.

Kodda hech qanday shaxsiy ro‘yxat yo‘q: missiyalar va yo‘nalishlar faqat jadvalda yashaydi — ilovada yoki jadvalning o‘zida qo‘shiladi, tahrirlanadi, o‘chiriladi.

- **Ilova:** GitHub Pages’da (shu repo) — telefonga o‘rnatiladi, internetsiz ham ochiladi
- **Ma’lumot:** Google Sheets ← Apps Script API (kalit bilan himoyalangan)
- **Sinxron:** har 15 soniyada va ilovaga qaytganda; oflayn belgilar navbatda turadi va internet qaytganda yuboriladi
- **XLSX:** Natija → XLSX yuklab olish

Repoda hech qanday maxfiy ma’lumot yo‘q: havola va kalit faqat sizning qurilmangiz brauzerida saqlanadi.

## O‘rnatish (≈5 daqiqa, bir marta)

### 1. Google jadval + Apps Script
1. **sheets.new** → faylni `Ta’til Quest` deb nomlang.
2. **Kengaytmalar → Apps Script**.
3. `Code.gs` ichini tozalab, [`apps-script/Code.gs`](apps-script/Code.gs) kodini joylang → 💾.
4. Funksiyalardan **`setup`** ni tanlab ▶ bosing → ruxsat bering (*Advanced → Go to … (unsafe) → Allow* — bu o‘zingizning skriptingiz).
5. Pastdagi **Execution log**’da `API kaliti: …` chiqadi — nusxalab oling.

### 2. API’ni joylashtirish
1. **Deploy → New deployment** → ⚙️ **Web app**.
2. *Execute as*: **Me** · *Who has access*: **Anyone** (kalit bo‘lmasa hech kim ma’lumot ololmaydi).
3. **Deploy** → `https://script.google.com/macros/s/…/exec` havolasini nusxalang.

### 3. Ilovani ulash
1. Ilova havolasini oching → **havola** va **API kaliti**ni kiriting → **Ulash**.
2. Telefon uchun: ilovada **Natija → Boshqa qurilma uchun havola** → o‘zingizga (Telegram “Saqlangan xabarlar”) yuboring → telefonda oching.
3. O‘rnatish: Android Chrome ⋮ → **Ilovani o‘rnatish**; iPhone Safari **Ulashish → Bosh ekranga qo‘shish**.

## Foydali
- **Kodni yangilash** (`Code.gs` o‘zgarganda): Apps Script’da kodni almashtiring → **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. Havola va kalit o‘zgarmaydi, ma’lumot saqlanadi.
- Sanalar, ism, byudjet — jadvaldagi `Sozlamalar` varag‘ida.
- Jadvalni qo‘lda tahrirlasangiz, qurilmalar o‘zi yangilanadi.
- Kalit begona qo‘lga tushsa: Apps Script’da `kalitniYangilash` ni ishga tushiring va qurilmalarni qayta ulang.
- `Code.gs` ni o‘zgartirsangiz: Deploy → Manage deployments → ✏️ → Version: **New version** (havola o‘zgarmaydi).

## Varaqlar
| Varaq | Nima saqlanadi |
|---|---|
| Missiyalar | maqsadlar: yo‘nalish, holat, XP, turi, reja sanalari, yakunlangan sana, izoh |
| Kategoriyalar | yo‘nalishlar: nomi, belgi (emoji), rang, standart XP, tartib — ilovada “🗂️ Yo‘nalishlar” orqali ham tahrirlanadi |
| Qadamlar | missiya qismlari va bajarilgan sanasi |
| Faollik | qaysi missiya ustida qaysi kuni ishlangani |
| Xarajatlar | tranzaksiyalar (so‘m) |
| Kundalik | har kun kayfiyat va “nimalar bo‘ldi” |
| Sozlamalar | ism, nom, sanalar, byudjet |
| Hisobot | holat va yo‘nalishlar kesimida formulalar |
