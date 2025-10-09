import React from "react";

// 🧩 Composant prêt à enregistrer comme Code Component dans Plasmic
// - Affiche des cartes cliquables avec nom, type, distance, ville et bouton "Voir"
// - Liens externes s'ouvrent dans un nouvel onglet
// - Mise en page responsive, style sobre et élégant (Tailwind)
//
// 👉 Utilisation dans Plasmic
// 1) Enregistrer ce composant (registerComponent) dans votre fichier d'init Plasmic
// 2) Déposer le composant sur la page "Dormir" (ou autre)
// 3) Optionnel : masquer le titre principal depuis les props

export default function LodgingCards() {
  const items: Array<{
    name: string;
    type: string;
    distanceKm: number;
    city: string;
    url: string;
  }> = [
    { name: "Etoile deuria", type: "Gîte", distanceKm: 2, city: "Reillanne", url: "etoile-deuria.com/reservations" },
    { name: "Vacances en Luberon", type: "Gîte", distanceKm: 2, city: "Reillanne", url: "https://www.vacances-en-luberon.com/" },
    { name: "Lou Pradaou", type: "Gîte", distanceKm: 2, city: "Reillanne", url: "https://www.louparadouluberon.com/" },
    { name: "L'olivier rêveur", type: "Gîte", distanceKm: 2, city: "Reillanne", url: "https://www.lolivierreveur.fr/" },
    { name: "Le petit lavoir", type: "Airbnb", distanceKm: 2, city: "Reillanne", url: "https://www.airbnb.fr/rooms/3608469?source_impression_id=p3_1753194983_P37q8ZsL8mIGlwT3" },
    { name: "Studio Cosy à la campagne", type: "Airbnb", distanceKm: 5, city: "Montjustin", url: "https://www.airbnb.fr/rooms/1459518226416940532?check_in=2025-07-28&check_out=2025-07-31&search_mode=regular_search&source_impression_id=p3_1752830856_P3l7v7zjPPSfV3Zs&previous_page_section_name=1000&federated_search_id=4607bb1a-ac16-422d-91f9-f93f1e95e0e2" },
    { name: "Maison la Romane", type: "Airbnb", distanceKm: 7, city: "Céreste", url: "https://www.airbnb.fr/rooms/1454928927489361156?location=C%C3%A9reste&search_mode=regular_search&adults=1&check_in=2025-07-31&check_out=2025-08-05&children=0&infants=0&pets=0&source_impression_id=p3_1752998324_P3b2n3NdvRAaU37o&previous_page_section_name=1001&federated_search_id=000e481c-7841-45fc-b0da-dc7368036f24" },
    { name: "La Ch'tite maison", type: "B&B", distanceKm: 7, city: "Céreste", url: "https://www.booking.com/hotel/fr/la-ch-tite-maison.fr.html?label=gen173nr-1BCAsoTUIRbGEtY2gtdGl0ZS1tYWlzb25IM1gEaE2IAQGYAQ24ARjIAQ_YAQHoAQGIAgGoAgS4Apm-w8MGwAIB0gIkNGE3OTBiODQtYzQwOS00YmRkLWE1MTUtNzE5ZjdjODEzZDMx2AIF4AIB&sid=7a9e25b7f5f6fd2450a342f995e317f1&dist=0&group_adults=2&group_children=0&keep_landing=1&no_rooms=1&sb_price_type=total&type=total&" },
    { name: "L'Aiguebelle", type: "Hôtel", distanceKm: 7, city: "Cereste", url: "www.hotel-aiguebelle.com/" },
    { name: "Mas Labaou", type: "Gite", distanceKm: 7, city: "Cereste", url: "www.maslabaou.com" },
    { name: "La Maison d'Emma", type: "B&B", distanceKm: 7, city: "Cereste", url: "www.maison-emma.com" },
    { name: "Domaine Grand Lubeon VTF", type: "", distanceKm: 8, city: "Cereste", url: "https://www.vtf-vacances.com/fr_FR/summer/village-vacances/alpes-de-haute-provence/cereste/le-domaine-du-grand-luberon" },
    { name: "Lumières en Luberon", type: "Gîte", distanceKm: 8, city: "Cereste", url: "https://giteslumiereenluberon.com/" },
    { name: "La Lave", type: "Gîte", distanceKm: 10, city: "Vachères", url: "www.lalave.com/" },
    { name: "Les Basses Combes", type: "Gîte", distanceKm: 11, city: "Vachères", url: "www.bassescombes.com" },
    { name: "Domaine la Bastidonne", type: "Gite", distanceKm: 11, city: "Cereste", url: "www.bastidonne.fr" },
    { name: "Vach'Air", type: "Gîte", distanceKm: 12, city: "Vachères", url: "http://urlr.me/hRvGm" },
    { name: "Le Moulin Brun", type: "B&B", distanceKm: 13, city: "Aubenas les Alpes", url: "www.lureluberon.com" },
    { name: "Les Escoffiers", type: "B&B", distanceKm: 13, city: "Aubenas les Alpes", url: "www.chez--habitant.com" },
    { name: "La Grande Bouisse", type: "Gîte", distanceKm: 13, city: "Cereste", url: "www.grandebouisse.com/" },
    { name: "Sud Sud Est", type: "B&B", distanceKm: 14, city: "Aubenas les Alpes", url: "www.sud-sudest.com" },
    { name: "Hameau de Pichovet", type: "Gîte", distanceKm: 14, city: "Vacheres", url: "www.gites-de-charme-luberon.com/index.html" },
    { name: "Le Pigeonnier", type: "Gîte", distanceKm: 17, city: "Viens", url: "33615020967" },
    { name: "Bonaventure", type: "Gîte", distanceKm: 17, city: "Viens", url: "https://www.airbnb.fr/rooms/668110734897561610?guests=1&adults=1&s=67&unique_share_id=01e02542-55e2-466f-afdb-ba74266fdf7b" },
    { name: "Bergerie du Luberon", type: "B&B", distanceKm: 17, city: "Viens", url: "https://www.booking.com/hotel/fr/detentc-en-luberon-viens.html?b.c=%2Fhotel%2Ff*%2Fdetente-en-lubaron-viens.html8aid=2265928" },
    { name: "Les Douces", type: "Gîte", distanceKm: 20, city: "Viens", url: "www.lesdouces.com/fr" },
    { name: "La Villa du Tilleul", type: "Gîte", distanceKm: 21, city: "Oppedette", url: "http://location-provence-oppedette.com/" },
    { name: "Bastide de Fondeluygnes", type: "Gîte", distanceKm: 21, city: "Viens", url: "https://www.airbnb.fr/rooms/181096302location=Saint%20Martin%20de%20Castillon&s=PEIzMNYO" },
    { name: "La Grange des Davids", type: "Gite", distanceKm: 23, city: "Oppedette", url: "www.la-grange-des-davids.com" },
    { name: "Le Domaine St Quentin", type: "B&B", distanceKm: 24, city: "Oppedette", url: "www.domainedesaintquentin.fr/" },
  ];

  const normalizeUrl = (u: string) => {
    // Si c'est un tel nu, transformer en tel:
    if (/^\+?\d[\d\s.-]*$/.test(u)) return `tel:${u.replace(/\s+/g, "")}`;
    // Préfixer http si manquant
    if (!/^https?:\/\//i.test(u)) return `https://${u}`;
    return u;
  };

  // Buckets par distance pour un rendu "par sections"
  const buckets: Array<{ title: string; filter: (d: number) => boolean }>= [
    { title: "À 2 km – Reillanne", filter: (d) => d <= 2 },
    { title: "5–8 km", filter: (d) => d > 2 && d <= 8 },
    { title: "10–14 km", filter: (d) => d > 8 && d <= 14 },
    { title: "17–20 km", filter: (d) => d > 14 && d <= 20 },
    { title: "21–24 km", filter: (d) => d > 20 && d <= 24 },
  ];

  const Card: React.FC<{ it: (typeof items)[number] }> = ({ it }) => (
    <a
      href={normalizeUrl(it.url)}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold leading-snug">{it.name}</h3>
          <p className="mt-1 text-sm text-gray-600">{it.city}</p>
        </div>
        <span className="shrink-0 rounded-full border px-3 py-1 text-xs text-gray-700 bg-gray-50">
          {it.distanceKm} km
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {it.type && (
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-100">
            {it.type}
          </span>
        )}
        <span className="text-xs text-gray-400">•</span>
        <span className="text-xs text-gray-600 truncate">{normalizeUrl(it.url).replace(/^https?:\/\//, "")}</span>
      </div>
      <div className="mt-4">
        <button className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 text-sm font-medium text-gray-800 group-hover:bg-gray-100">
          Voir
        </button>
      </div>
    </a>
  );

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h2 className="text-2xl font-bold">Dormir — autour de Reillanne</h2>
        <p className="text-gray-600">Sélection d’hébergements à proximité (liens cliquables).</p>
      </header>

      {buckets.map((b) => {
        const list = items.filter((i) => b.filter(i.distanceKm)).sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name));
        if (!list.length) return null;
        return (
          <div key={b.title} className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">{b.title}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((it) => (
                <Card key={`${it.name}-${it.city}`} it={it} />
              ))}
            </div>
          </div>
        );
      })}

      <footer className="mt-10 text-xs text-gray-500">
        Les disponibilités et tarifs dépendent des plateformes indiquées.
      </footer>
    </section>
  );
}
