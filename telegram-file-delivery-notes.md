# مرجع تسليم الملفات عبر تيليغرام

المصدر الرسمي: https://core.telegram.org/bots/api#senddocument

- يستخدم Bot API طلبات HTTPS لإرسال الرسائل والملفات.
- يتطلب رفع ملف فعلي إلى Telegram استخدام طلب `multipart/form-data`، وليس طلب JSON عاديًا.
- ستُرسل الملفات المطلوبة إلى محادثة المستخدم التي اختار الملف منها فقط، ولا يُستخدم أي إرسال جماعي أو نشر في القنوات.

المصدر: Telegram Bot API — https://core.telegram.org/bots/api#senddocument
