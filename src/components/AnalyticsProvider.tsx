import { useEffect } from "react";

export function AnalyticsProvider() {
  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      try {
        const res = await fetch("/api/analytics-ids");
        if (!res.ok) return;
        const data = await res.json();

        if (cancelled) return;

        if (data.ymId) {
          injectYandexMetrika(data.ymId);
        }
        if (data.gaId) {
          injectGoogleAnalytics(data.gaId);
        }
      } catch {}
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

function injectYandexMetrika(id: string) {
  const numId = parseInt(id, 10);
  if (isNaN(numId) || document.getElementById("ym-script")) return;

  window.__ymId = numId;

  const script = document.createElement("script");
  script.id = "ym-script";
  script.textContent = `
    (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
    (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    ym(${numId}, "init", {
      clickmap:true,
      trackLinks:true,
      accurateTrackBounce:true,
      webvisor:true
    });
  `;
  document.head.appendChild(script);

  const noscript = document.createElement("noscript");
  const img = document.createElement("img");
  img.src = `https://mc.yandex.ru/watch/${numId}`;
  img.style.cssText = "position:absolute;left:-9999px";
  img.alt = "";
  noscript.appendChild(img);
  document.body.appendChild(noscript);
}

function injectGoogleAnalytics(id: string) {
  if (!id.startsWith("G-") && !id.startsWith("UA-") && !id.startsWith("GT-")) return;
  if (document.getElementById("ga-script")) return;

  window.__gaId = id;

  const gtagScript = document.createElement("script");
  gtagScript.id = "ga-script";
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(gtagScript);

  const inlineScript = document.createElement("script");
  inlineScript.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${id}');
  `;
  document.head.appendChild(inlineScript);
}
