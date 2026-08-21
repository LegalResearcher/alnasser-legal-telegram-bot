import { useEffect, useState } from "react";

export default function Home() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/telegram/health")
      .then(response => response.json())
      .then((data: { configured?: boolean }) => {
        if (active) setConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (active) setConfigured(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const statusLabel = configured === null ? "جارٍ التحقق من حالة الخدمة" : configured ? "الخدمة جاهزة" : "في انتظار الإعدادات السرية";

  return (
    <div dir="rtl" className="min-h-screen bg-stone-50 text-stone-900">
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <section className="w-full rounded-3xl border border-stone-200 bg-white p-8 shadow-sm sm:p-12">
          <p className="mb-4 text-sm font-semibold tracking-wide text-emerald-700">خدمة تيليغرام</p>
          <h1 className="text-3xl font-bold leading-tight text-stone-950 sm:text-4xl">المكتبة القانونية</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
            بوت عربي لتصفح المصادر القانونية والبحث فيها عبر محادثة بسيطة ومنظمة.
          </p>
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-emerald-50 p-5">
              <h2 className="font-semibold text-emerald-950">واجهة عربية تفاعلية</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900">تصفح، بحث، مساعدة، وعرض تفاصيل كل مصدر.</p>
            </div>
            <div className="rounded-2xl bg-stone-100 p-5">
              <h2 className="font-semibold text-stone-950">نقطة استقبال آمنة</h2>
              <p className="mt-2 text-sm leading-6 text-stone-700">يتم قبول رسائل تيليغرام فقط عند تطابق رمز التحقق السري.</p>
            </div>
          </div>
          <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold text-stone-800">حالة البوت</span>
              <span className={configured ? "rounded-full bg-emerald-100 px-3 py-1 text-emerald-800" : "rounded-full bg-amber-100 px-3 py-1 text-amber-900"}>
                {statusLabel}
              </span>
            </div>
            <p className="mt-4 text-stone-600">مسار Webhook:</p>
            <code dir="ltr" className="mt-2 block overflow-x-auto rounded-lg bg-stone-950 px-3 py-2 text-left text-xs text-stone-100">
              /api/telegram/webhook
            </code>
          </div>
          <p className="mt-6 text-sm text-stone-500">تُستخدم هذه الصفحة للتعريف بالخدمة فقط؛ إدارة المصادر تتم من قاعدة البيانات.</p>
        </section>
      </main>
    </div>
  );
}
