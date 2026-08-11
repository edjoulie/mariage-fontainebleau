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
// Le type `string` est explicite : sans lui, TypeScript reduit la constante a
// son littéral et refuse de la comparer a "" plus bas.
const MATOMO_URL = "https://matomo.albia.lhib.io/";
const MATOMO_SITE_ID: string = "4";

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

    const track = () => {
      const url = trackedUrl(window.location.href);
      const _paq = (window._paq = window._paq || []);
      if (previousUrl.current) _paq.push(["setReferrerUrl", previousUrl.current]);
      _paq.push(["setCustomUrl", url]);
      _paq.push(["setDocumentTitle", document.title]);
      _paq.push(["trackPageView"]);
      _paq.push(["enableLinkTracking"]);
      previousUrl.current = url;
    };

    // next/head pose le titre apres le rendu, plusieurs ticks apres l'evenement
    // de navigation : declarer la page tout de suite enregistrait le titre de
    // celle qu'on venait de quitter. On attend donc qu'il change, sans depasser
    // une seconde — deux pages peuvent porter le meme titre.
    const onComplete = () => {
      const before = document.title;
      const started = Date.now();
      const waitForTitle = () => {
        if (document.title !== before || Date.now() - started > 1000) track();
        else setTimeout(waitForTitle, 50);
      };
      setTimeout(waitForTitle, 50);
    };

    router.events.on("routeChangeComplete", onComplete);
    return () => router.events.off("routeChangeComplete", onComplete);
  }, [router.events]);

  if (!ENABLED) return null;

  return (
    <Script id="matomo" strategy="afterInteractive">
      {`
        var _paq = window._paq = window._paq || [];
        (function() {
          var u = ${JSON.stringify(MATOMO_URL)};
          // Le site est declare avant la premiere mesure. Le snippet officiel
          // pousse 'trackPageView' d'abord et 'setSiteId' ensuite ; l'ordre
          // inverse ne coute rien et evite qu'une requete parte sans idsite,
          // ce que le serveur rejetterait en 400.
          _paq.push(['setTrackerUrl', u + 'matomo.php']);
          _paq.push(['setSiteId', ${JSON.stringify(MATOMO_SITE_ID)}]);
          // Mesure sans cookie et avec IP anonymisee : pas d'identifiant depose
          // sur l'appareil des invites, donc pas de banniere de consentement a
          // leur imposer. Le comptage des visiteurs uniques est approche, ce qui
          // suffit largement ici.
          _paq.push(['disableCookies']);
          // Le signal Do Not Track n'est volontairement pas honore : Firefox
          // l'active par defaut en protection stricte, et une part inconnue
          // des invites serait invisible, ce qui viderait le chiffre de sens.
          // La mesure restant sans cookie et sans donnee personnelle, il n'y a
          // rien a refuser.
          _paq.push(['setCustomUrl', (function() {
            try {
              var p = new URL(location.href);
              ${JSON.stringify(SENSITIVE_PARAMS)}.forEach(function(k) { p.searchParams.delete(k); });
              return p.toString();
            } catch (e) { return location.href; }
          })()]);
          _paq.push(['trackPageView']);
          _paq.push(['enableLinkTracking']);
          var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
          g.async = true; g.src = u + 'matomo.js'; s.parentNode.insertBefore(g, s);
        })();
      `}
    </Script>
  );
}
