import { useEffect, useRef } from "react";
import Script from "next/script";
import { useRouter } from "next/router";

// ─────────────────────────────────────────────────────────────────
// ─── MATOMO — A REMPLIR ───
// MATOMO_URL : l'adresse de l'instance, terminee par "/".
// MATOMO_SITE_ID : l'identifiant du site tel qu'il apparait dans Matomo
// (Administration → Sites web → Gerer, colonne « ID »).
// Tant que l'identifiant est vide, rien n'est charge : pas de script, pas de
// requete, aucune trace. C'est aussi ce qui evite de mesurer localhost.
// ─────────────────────────────────────────────────────────────────
const MATOMO_URL = "https://matomo.albia.lhib.io/";
const MATOMO_SITE_ID = "4";

// Le site n'est mesure qu'en production : en developpement, chaque
// rechargement gonflerait les statistiques.
const ENABLED =
  MATOMO_SITE_ID !== "" && process.env.NODE_ENV === "production";

declare global {
  interface Window {
    _paq?: unknown[][];
  }
}

// Les QR codes menent a la galerie avec les identifiants dans l'URL
// (?login=…&pwd=…). Les envoyer a Matomo les inscrirait en clair dans les
// statistiques, consultables par toute personne ayant acces a l'instance :
// on les retire avant de declarer la page.
const SENSITIVE_PARAMS = ["login", "pwd"];

function trackedUrl(href: string): string {
  try {
    const url = new URL(href, window.location.origin);
    SENSITIVE_PARAMS.forEach((p) => url.searchParams.delete(p));
    return url.toString();
  } catch {
    return href;
  }
}

export default function Matomo() {
  const router = useRouter();
  // URL de la page precedente, pour renseigner le referrer d'une navigation
  // interne : sans elle, Matomo attribue chaque page a la source d'origine.
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!ENABLED) return;
    previousUrl.current = trackedUrl(window.location.href);

    const handleRouteChange = () => {
      const url = trackedUrl(window.location.href);
      const _paq = (window._paq = window._paq || []);
      if (previousUrl.current) _paq.push(["setReferrerUrl", previousUrl.current]);
      _paq.push(["setCustomUrl", url]);
      // Le titre est pose par next/head au rendu : on laisse passer un tick
      // pour ne pas enregistrer celui de la page qu'on vient de quitter.
      _paq.push(["setDocumentTitle", document.title]);
      _paq.push(["trackPageView"]);
      _paq.push(["enableLinkTracking"]);
      previousUrl.current = url;
    };

    const onComplete = () => setTimeout(handleRouteChange, 0);
    router.events.on("routeChangeComplete", onComplete);
    return () => router.events.off("routeChangeComplete", onComplete);
  }, [router.events]);

  if (!ENABLED) return null;

  return (
    <Script id="matomo" strategy="afterInteractive">
      {`
        var _paq = window._paq = window._paq || [];
        // Mesure sans cookie et avec IP anonymisee : pas d'identifiant depose
        // sur l'appareil des invites, donc pas de banniere de consentement a
        // leur imposer. Le comptage des visiteurs uniques est approche, ce qui
        // suffit largement ici.
        _paq.push(['disableCookies']);
        _paq.push(['setDoNotTrack', true]);
        _paq.push(['setCustomUrl', (function() {
          try {
            var u = new URL(location.href);
            ${JSON.stringify(SENSITIVE_PARAMS)}.forEach(function(p) { u.searchParams.delete(p); });
            return u.toString();
          } catch (e) { return location.href; }
        })()]);
        _paq.push(['trackPageView']);
        _paq.push(['enableLinkTracking']);
        (function() {
          var u = ${JSON.stringify(MATOMO_URL)};
          _paq.push(['setTrackerUrl', u + 'matomo.php']);
          _paq.push(['setSiteId', ${JSON.stringify(MATOMO_SITE_ID)}]);
          var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
          g.async = true; g.src = u + 'matomo.js'; s.parentNode.insertBefore(g, s);
        })();
      `}
    </Script>
  );
}
