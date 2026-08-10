import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { createZip, ZipEntryInput } from "@/lib/zip";

// ─── Identifiants ───
const LOGIN = "mariage";
const PASSWORD = "lavande2026";

// ─── Cloudinary ───
const CLOUD_NAME = "dxvypw2kn";
const UPLOAD_PRESET = "mariage";
const TAG = "mariage";
// Tag a ajouter sur Cloudinary aux photos fournies par la photographe.
// Uploadez-les avec les deux tags ("mariage" + "photographe") ; si le tag
// "mariage" est oublie, elles apparaissent quand meme (les listes sont fusionnees).
const PRO_TAG = "photographe";
const listUrl = (kind: MediaType, tag: string) =>
  `https://res.cloudinary.com/${CLOUD_NAME}/${kind}/list/${tag}.json`;
const GRID_CLASS = "pg-photo-grid";
const FONT = "'EB Garamond', serif";
const BG = "#F6ECE3";
const COLOR = "#41611D";
const BTN_BG = "#41611D";

// ─── Config ───
const PER_PAGE_OPTIONS = [12, 24, 48];

// Telechargement groupe : nom de base des archives et taille max de chacune.
// Le ZIP est assemble dans le navigateur, donc on decoupe une grosse selection
// en plusieurs fichiers plutot que de saturer la memoire d'un telephone.
const ZIP_BASENAME = "photos-mariage";
const MAX_ZIP_BYTES = 400 * 1024 * 1024;

type GridSize = "large" | "medium" | "small";
const GRID_SIZES: { key: GridSize; label: string }[] = [
  { key: "large", label: "Grande" },
  { key: "medium", label: "Moyenne" },
  { key: "small", label: "Vignettes" },
];

// ─── Filtres ───
type PhotoFilter = "all" | "guests" | "pro";
const FILTERS: { key: PhotoFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "guests", label: "Invités" },
  { key: "pro", label: "📷 Photographe" },
];

// ─────────────────────────────────────────────────────────────────
// ─── COORDONNEES DE LA PHOTOGRAPHE — A REMPLIR ───
// Laissez une valeur vide ("") pour masquer la ligne correspondante.
// ─────────────────────────────────────────────────────────────────
const PHOTOGRAPHER = {
  name: "Aline Ruzé",
  // Sa propre formulation, reprise de alineruze.fr.
  role: "Photographe reportage, lifestyle et studio",
  // Lien vers la galerie Jingoo qu'elle nous a transmise (bouton principal)
  jingooUrl: "https://www.jingoo.com/client/key/686455/f35a3c1b/",
  jingooLabel: "Voir la galerie complète en haute définition",
  // Contact — laissez "" pour ne pas afficher.
  // Email et telephone repris de la page contact de son site professionnel.
  email: "contact@alineruze.fr",
  phone: "+33 6 76 36 00 53",
  website: "https://www.alineruze.fr/",
  instagram: "", // ex. "@son_compte" ou une URL complete
  // Texte libre affiche sous les coordonnees
  blurb:
    "Toutes les photos de cette sélection sont les siennes. " +
    "Sa galerie complète est disponible en haute définition juste en dessous, " +
    "et vous pouvez découvrir le reste de son travail sur son site.",
  printsNote:
    "Tirages, albums et agrandissements peuvent être commandés directement auprès d'elle.",
};

// Normalise "@compte" ou "instagram.com/compte" en URL cliquable.
function instagramUrl(handle: string): string {
  if (/^https?:\/\//.test(handle)) return handle;
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}

function externalUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

// ─── Types ───
type MediaType = "image" | "video";

interface CloudinaryResource {
  public_id: string;
  version: number;
  format: string;
  width: number;
  height: number;
  type: string;
  created_at: string;
  media: MediaType;
  isPro: boolean;
}

type CloudinaryRawResource = Omit<CloudinaryResource, "media" | "isPro">;

interface CloudinaryListResponse {
  resources: CloudinaryRawResource[];
  updated_at?: string;
}

declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (
        config: Record<string, unknown>,
        callback: (error: unknown, result: { event: string }) => void
      ) => { open: () => void };
    };
  }
}

// ─── Helpers ───
const LOCAL_STORAGE_KEY = "photo_gallery_auth";

function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LOCAL_STORAGE_KEY) === "ok";
}

function setAuthenticated(): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, "ok");
}

function imageUrl(publicId: string, width: number): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,w_${width},q_auto,f_auto/${publicId}`;
}

function videoThumbUrl(publicId: string, width: number): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/c_fill,w_${width},q_auto,f_jpg,so_1/${publicId}.jpg`;
}

function videoUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/q_auto/${publicId}`;
}

function downloadUrl(publicId: string, format: string, media: MediaType): string {
  const type = media === "video" ? "video" : "image";
  return `https://res.cloudinary.com/${CLOUD_NAME}/${type}/upload/fl_attachment/${publicId}.${format}`;
}

// Fichier d'origine, sans `fl_attachment` : sert a recuperer les octets en
// fetch() pour les mettre dans le ZIP (Cloudinary autorise le CORS dessus).
function originalUrl(publicId: string, format: string, media: MediaType): string {
  const type = media === "video" ? "video" : "image";
  return `https://res.cloudinary.com/${CLOUD_NAME}/${type}/upload/${publicId}.${format}`;
}

// Declenche l'enregistrement d'un Blob sous le nom voulu.
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoquer trop tot interromprait l'enregistrement d'une grosse archive.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Nom lisible derive du public_id (retire le dossier et nettoie le nom de fichier)
function displayName(publicId: string): string {
  return publicId.split("/").pop() || publicId;
}

// Cle de selection : une image et une video peuvent partager le meme public_id.
function photoKey(p: { media: MediaType; public_id: string }): string {
  return `${p.media}:${p.public_id}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Reactions & Commentaires ───
const REACTION_EMOJIS = ["❤️", "🎉", "😍", "👏", "😂"];

interface CommentItem {
  name: string;
  text: string;
  ts: number;
}

interface PhotoMeta {
  reactions: Record<string, number>;
  comments: number;
}

function reactionStorageKey(id: string): string {
  return `pg_react_${id}`;
}

function getMyReactions(id: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(reactionStorageKey(id)) || "[]");
  } catch {
    return [];
  }
}

function setMyReactions(id: string, arr: string[]): void {
  localStorage.setItem(reactionStorageKey(id), JSON.stringify(arr));
}

// Barre de reactions emoji affichee sous la photo en plein ecran.
function ReactionBar({ publicId }: { publicId: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<string[]>([]);

  useEffect(() => {
    setMine(getMyReactions(publicId));
    let active = true;
    fetch(`/api/reactions?id=${encodeURIComponent(publicId)}`)
      .then((r) => r.json())
      .then((d) => { if (active) setCounts(d.reactions || {}); })
      .catch(() => {});
    return () => { active = false; };
  }, [publicId]);

  const toggle = (emoji: string) => {
    const has = mine.includes(emoji);
    const delta = has ? -1 : 1;
    const nextMine = has ? mine.filter((e) => e !== emoji) : [...mine, emoji];
    setMine(nextMine);
    setMyReactions(publicId, nextMine);
    setCounts((c) => ({ ...c, [emoji]: Math.max(0, (Number(c[emoji]) || 0) + delta) }));
    fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: publicId, emoji, delta }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.reactions) setCounts(d.reactions); })
      .catch(() => {});
  };

  return (
    <div style={s.reactionBar}>
      {REACTION_EMOJIS.map((emoji) => {
        const active = mine.includes(emoji);
        const n = Number(counts[emoji]) || 0;
        return (
          <button
            key={emoji}
            onClick={(e) => { e.stopPropagation(); toggle(emoji); }}
            style={{ ...s.reactionBtn, ...(active ? s.reactionBtnActive : {}) }}
            aria-pressed={active}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span>
            {n > 0 && <span style={s.reactionCount}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Panneau de commentaires (liste + formulaire) affiche sous la photo en plein ecran.
function CommentsPanel({
  publicId,
  visible,
  onClose,
  onCount,
}: {
  publicId: string;
  visible: boolean;
  onClose: () => void;
  onCount: (n: number) => void;
}) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setName(localStorage.getItem("pg_comment_name") || "");
  }, []);

  // Charge les commentaires des le montage (meme si la feuille est fermee),
  // pour pouvoir afficher le compteur sur le bouton.
  useEffect(() => {
    let active = true;
    setLoaded(false);
    fetch(`/api/comments?id=${encodeURIComponent(publicId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const c: CommentItem[] = d.comments || [];
        setComments(c);
        setLoaded(true);
        onCount(c.length);
      })
      .catch(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [publicId, onCount]);

  const submit = () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const cleanName = name.trim().slice(0, 40);
    localStorage.setItem("pg_comment_name", cleanName);
    fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: publicId, name: cleanName, text: t }),
    })
      .then((r) => r.json())
      .then((d) => {
        const c: CommentItem[] = d.comments || [];
        setComments(c);
        setText("");
        onCount(c.length);
      })
      .catch(() => {})
      .finally(() => setSending(false));
  };

  if (!visible) return null;

  return (
    <>
      <div style={s.lbSheetBackdrop} onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div style={s.lbSheet} onClick={(e) => e.stopPropagation()}>
        <div style={s.lbSheetHeader}>
          <span style={s.lbSheetTitle}>
            Commentaires{comments.length > 0 ? ` (${comments.length})` : ""}
          </span>
          <button style={s.lbSheetClose} onClick={onClose} aria-label="Fermer">&#10005;</button>
        </div>
        <div style={s.commentsList}>
          {loaded && comments.length === 0 && (
            <div style={s.commentsEmpty}>Soyez le premier à laisser un mot ✍️</div>
          )}
          {comments.map((c, i) => (
            <div key={i} style={s.commentItem}>
              <span style={s.commentName}>{c.name}</span>
              <span style={s.commentText}>{c.text}</span>
            </div>
          ))}
        </div>
        <div style={s.commentForm}>
          <input
            style={s.commentNameInput}
            placeholder="Prénom"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            style={s.commentTextInput}
            placeholder="Votre message…"
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
          <button
            style={{ ...s.commentSend, opacity: sending || !text.trim() ? 0.5 : 1 }}
            onClick={submit}
            disabled={sending || !text.trim()}
          >
            Envoyer
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Login Screen ───
function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login === LOGIN && password === PASSWORD) {
      setAuthenticated();
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div style={s.loginOverlay}>
      <form onSubmit={handleSubmit} style={s.loginForm}>
        <h2 style={s.loginTitle}>Galerie Photos</h2>
        <p style={s.loginSubtitle}>Entrez vos identifiants pour acceder aux photos</p>
        <input
          type="text"
          placeholder="Identifiant"
          value={login}
          onChange={(e) => { setLogin(e.target.value); setError(false); }}
          style={s.input}
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          style={s.input}
          autoComplete="current-password"
        />
        {error && <p style={s.error}>Identifiants incorrects</p>}
        <button type="submit" style={s.btn}>Acceder</button>
      </form>
    </div>
  );
}

// ─── Lightbox ───
function Lightbox({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  photos: CloudinaryResource[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const photo = photos[index];
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);

  // Reinitialise la vue commentaires quand on change de photo.
  useEffect(() => {
    setShowComments(false);
    setCommentCount(null);
  }, [photo.public_id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "Escape") {
        if (showComments) setShowComments(false);
        else onClose();
        return;
      }
      if (typing || showComments) return; // pas de navigation en tapant / feuille ouverte
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext, showComments]);

  // Swipe support
  const touchStart = useRef(0);

  // Rendu via un portail sur <body> : indispensable car un ancetre Plasmic
  // possede un `transform`, ce qui "capturerait" notre position:fixed et
  // empecherait l'overlay de couvrir tout l'ecran.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={s.lbOverlay}
      onClick={onClose}
      onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (showComments) return;
        const dx = e.changedTouches[0].clientX - touchStart.current;
        if (dx > 60) onPrev();
        else if (dx < -60) onNext();
      }}
    >
      {/* Media plein ecran + fleches */}
      <div style={s.lbStage}>
        <button
          style={{ ...s.lbArrow, left: 8 }}
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
        >
          &#8249;
        </button>

        {photo.media === "video" ? (
          <video
            src={videoUrl(photo.public_id)}
            controls
            autoPlay
            playsInline
            style={s.lbImage}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            src={imageUrl(photo.public_id, 1600)}
            alt={displayName(photo.public_id)}
            style={s.lbImage}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        <button
          style={{ ...s.lbArrow, right: 8 }}
          onClick={(e) => { e.stopPropagation(); onNext(); }}
        >
          &#8250;
        </button>
      </div>

      {/* Barre haute : compteur + nom + fermer (superposee a l'image) */}
      <div style={s.lbTopBar} onClick={(e) => e.stopPropagation()}>
        <div style={s.lbTopInfo}>
          {index + 1} / {photos.length}
          <span style={{ opacity: 0.75 }}> — {displayName(photo.public_id)}</span>
        </div>
        <button style={s.lbClose} onClick={onClose} aria-label="Fermer">&#10005;</button>
      </div>

      {/* Barre basse : reactions + commentaires + telechargement */}
      <div style={s.lbBottomBar} onClick={(e) => e.stopPropagation()}>
        <ReactionBar key={`r-${photo.public_id}`} publicId={photo.public_id} />
        <div style={s.lbBottomActions}>
          <button style={s.lbActionBtn} onClick={() => setShowComments(true)}>
            &#128172; Commentaires{commentCount ? ` (${commentCount})` : ""}
          </button>
          <a
            href={downloadUrl(photo.public_id, photo.format, photo.media)}
            style={s.lbActionBtn}
          >
            &#11015; Telecharger
          </a>
        </div>
      </div>

      {/* Feuille commentaires (a la demande, montee en continu pour le compteur) */}
      <CommentsPanel
        key={`c-${photo.public_id}`}
        publicId={photo.public_id}
        visible={showComments}
        onClose={() => setShowComments(false)}
        onCount={setCommentCount}
      />
    </div>,
    document.body
  );
}

// ─── Carte photographe ───
// Bloc de mise en avant : coordonnees + lien vers sa galerie Jingoo.
function PhotographerCard() {
  const p = PHOTOGRAPHER;
  const contacts: { href: string; label: string }[] = [];
  if (p.website) contacts.push({ href: externalUrl(p.website), label: "Son site" });
  if (p.instagram) contacts.push({ href: instagramUrl(p.instagram), label: "Instagram" });
  if (p.email) contacts.push({ href: `mailto:${p.email}`, label: p.email });
  if (p.phone) contacts.push({ href: `tel:${p.phone.replace(/\s/g, "")}`, label: p.phone });

  return (
    <div style={s.proCard}>
      <div style={s.proCardHead}>
        <span style={s.proCardRole}>{p.role}</span>
        <h3 style={s.proCardName}>{p.name}</h3>
      </div>

      {p.blurb && <p style={s.proCardText}>{p.blurb}</p>}

      {p.jingooUrl && (
        <a
          href={externalUrl(p.jingooUrl)}
          target="_blank"
          rel="noopener noreferrer"
          style={s.proCardCta}
        >
          {p.jingooLabel || "Voir sa galerie"} &#8599;
        </a>
      )}

      {contacts.length > 0 && (
        <div style={s.proCardLinks}>
          {contacts.map((c) => (
            <a
              key={c.href}
              href={c.href}
              target={c.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              style={s.proCardLink}
            >
              {c.label}
            </a>
          ))}
        </div>
      )}

      {p.printsNote && <p style={s.proCardNote}>{p.printsNote}</p>}
    </div>
  );
}

// ─── Gallery ───
function Gallery({
  title,
  defaultFilter,
  showFilters,
  showPhotographerCard,
  showUpload,
  photographerPageUrl,
}: Required<PhotoGalleryProps>) {
  const [photos, setPhotos] = useState<CloudinaryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0]);
  const [page, setPage] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [gridSize, setGridSize] = useState<GridSize>("large");
  const [meta, setMeta] = useState<Record<string, PhotoMeta>>({});
  const [filter, setFilter] = useState<PhotoFilter>(defaultFilter);
  const [downloading, setDownloading] = useState<
    { done: number; total: number; label: string } | null
  >(null);
  const scriptLoaded = useRef(false);
  const cancelDownload = useRef(false);

  const proCount = photos.filter((p) => p.isPro).length;
  const counts: Record<PhotoFilter, number> = {
    all: photos.length,
    guests: photos.length - proCount,
    pro: proCount,
  };

  const filteredPhotos = useMemo(() => {
    if (filter === "all") return photos;
    const subset = photos.filter((p) => (filter === "pro" ? p.isPro : !p.isPro));
    if (filter !== "pro") return subset;
    // Les photos de la photographe sont numerotees dans l'ordre de la journee
    // ("…-100", "…-101"…). Comme elles sont toutes envoyees en une fois, leur
    // date d'upload ne distingue rien : on trie sur ce numero pour retrouver
    // le deroule du mariage. Le tri numerique evite que "-99" passe apres "-100".
    return [...subset].sort((a, b) =>
      a.public_id.localeCompare(b.public_id, "fr", { numeric: true })
    );
  }, [photos, filter]);

  // La carte de la photographe s'affiche aussi des qu'on filtre sur ses photos :
  // c'est a ce moment qu'on veut ses coordonnees et le lien vers sa galerie
  // haute definition, sans avoir a passer par la page dediee.
  const photographerCardVisible = showPhotographerCard || filter === "pro";

  const totalPages = Math.ceil(filteredPhotos.length / perPage);
  const pagePhotos = filteredPhotos.slice(page * perPage, (page + 1) * perPage);
  const pageIdsKey = pagePhotos.map((p) => p.public_id).join(",");

  // Revient a la premiere page quand on change de filtre.
  useEffect(() => { setPage(0); }, [filter]);

  // Resume reactions/commentaires pour les vignettes de la page courante.
  const fetchMeta = useCallback(() => {
    const ids = pageIdsKey ? pageIdsKey.split(",") : [];
    if (ids.length === 0) return;
    fetch("/api/photo-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.meta) setMeta((m) => ({ ...m, ...d.meta })); })
      .catch(() => {});
  }, [pageIdsKey]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const fetchPhotos = useCallback(async () => {
    try {
      const ts = Date.now();
      // Une liste Cloudinary par (type de media x tag). Le tag "photographe"
      // peut ne pas exister encore : on tolere l'echec liste par liste.
      const fetchList = (kind: MediaType, tag: string): Promise<CloudinaryListResponse> =>
        fetch(`${listUrl(kind, tag)}?${ts}`)
          .then((r) => (r.ok ? r.json() : { resources: [] }))
          .catch(() => ({ resources: [] }));

      const [imgRes, vidRes, proImgRes, proVidRes] = await Promise.all([
        fetchList("image", TAG),
        fetchList("video", TAG),
        fetchList("image", PRO_TAG),
        fetchList("video", PRO_TAG),
      ]);

      const proIds: Record<MediaType, Set<string>> = {
        image: new Set((proImgRes.resources || []).map((r) => r.public_id)),
        video: new Set((proVidRes.resources || []).map((r) => r.public_id)),
      };

      // Fusion des listes "mariage" et "photographe" (une photo pro peut
      // porter les deux tags), dedoublonnee par type + public_id.
      const byKey = new Map<string, CloudinaryResource>();
      const collect = (resources: CloudinaryRawResource[] | undefined, media: MediaType) => {
        (resources || []).forEach((r) => {
          const key = `${media}:${r.public_id}`;
          if (byKey.has(key)) return;
          byKey.set(key, { ...r, media, isPro: proIds[media].has(r.public_id) });
        });
      };
      collect(imgRes.resources, "image");
      collect(proImgRes.resources, "image");
      collect(vidRes.resources, "video");
      collect(proVidRes.resources, "video");

      const all = Array.from(byKey.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setPhotos(all);
    } catch {
      // retry in 30s
    } finally {
      setLoading(false);
    }
  }, []);

  // Inject CSS + Font
  useEffect(() => {
    if (!document.getElementById("pg-styles")) {
      const style = document.createElement("style");
      style.id = "pg-styles";
      style.textContent = `
        .${GRID_CLASS}.pg-large { grid-template-columns: repeat(2, 1fr); }
        .${GRID_CLASS}.pg-medium { grid-template-columns: repeat(3, 1fr); }
        .${GRID_CLASS}.pg-small { grid-template-columns: repeat(4, 1fr); }
        @media (min-width: 640px) {
          .${GRID_CLASS}.pg-large { grid-template-columns: repeat(3, 1fr); }
          .${GRID_CLASS}.pg-medium { grid-template-columns: repeat(4, 1fr); }
          .${GRID_CLASS}.pg-small { grid-template-columns: repeat(6, 1fr); }
        }
        .pg-thumb:hover { opacity: 0.85; }
        .pg-page-btn:hover { background: ${BTN_BG} !important; color: #fff !important; }
      `;
      document.head.appendChild(style);
    }
    if (!document.getElementById("pg-font-link")) {
      const link = document.createElement("link");
      link.id = "pg-font-link";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  // Load Cloudinary widget
  useEffect(() => {
    if (scriptLoaded.current) return;
    if (document.querySelector('script[src*="upload-widget.cloudinary.com"]')) {
      scriptLoaded.current = true;
      return;
    }
    const script = document.createElement("script");
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.async = true;
    script.onload = () => { scriptLoaded.current = true; };
    document.body.appendChild(script);
  }, []);

  // Fetch + auto-refresh
  useEffect(() => {
    fetchPhotos();
    const interval = setInterval(fetchPhotos, 30_000);
    return () => clearInterval(interval);
  }, [fetchPhotos]);

  const openUploadWidget = () => {
    if (!window.cloudinary) {
      alert("Le widget n'est pas encore charge. Reessayez dans quelques secondes.");
      return;
    }
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUD_NAME,
        uploadPreset: UPLOAD_PRESET,
        tags: [TAG],
        sources: ["local", "camera"],
        multiple: true,
        resourceType: "auto",
        language: "fr",
      },
      (_error: unknown, result: { event: string }) => {
        if (result.event === "close" || result.event === "success") {
          setTimeout(fetchPhotos, 1500);
        }
      }
    );
    widget.open();
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // "Tout selectionner" porte sur le filtre courant (toutes les pages),
  // "Cette page" sur les seules vignettes affichees.
  const allFilteredSelected =
    filteredPhotos.length > 0 && filteredPhotos.every((p) => selected.has(photoKey(p)));
  const pageSelected =
    pagePhotos.length > 0 && pagePhotos.every((p) => selected.has(photoKey(p)));

  const setSelection = (subset: CloudinaryResource[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      subset.forEach((p) => (on ? next.add(photoKey(p)) : next.delete(photoKey(p))));
      return next;
    });
  };

  // Telechargement groupe : une (ou plusieurs) archives ZIP assemblees dans le
  // navigateur. Au-dela de MAX_ZIP_BYTES on coupe en plusieurs fichiers, pour
  // ne pas faire exploser la memoire des telephones sur une grosse selection.
  const downloadSelectedZip = async () => {
    if (downloading) return;
    // On repart de `photos` : la selection survit a un changement de filtre.
    const toDownload = photos.filter((p) => selected.has(photoKey(p)));
    if (toDownload.length === 0) return;

    cancelDownload.current = false;
    setDownloading({ done: 0, total: toDownload.length, label: "Preparation..." });

    let batch: ZipEntryInput[] = [];
    let batchBytes = 0;
    let partsSaved = 0;
    let failed = 0;

    const flush = async (isLast: boolean) => {
      if (batch.length === 0) return;
      setDownloading((d) => (d ? { ...d, label: "Creation de l'archive..." } : d));
      const zip = await createZip(batch);
      const name =
        partsSaved === 0 && isLast ? `${ZIP_BASENAME}.zip` : `${ZIP_BASENAME}-${partsSaved + 1}.zip`;
      saveBlob(zip, name);
      partsSaved += 1;
      batch = [];
      batchBytes = 0;
      // Laisse le navigateur enregistrer l'archive avant d'enchainer.
      if (!isLast) await sleep(1200);
    };

    for (let i = 0; i < toDownload.length; i++) {
      if (cancelDownload.current) break;
      const p = toDownload[i];
      setDownloading({
        done: i,
        total: toDownload.length,
        label: `Telechargement ${i + 1}/${toDownload.length}`,
      });
      try {
        const res = await fetch(originalUrl(p.public_id, p.format, p.media));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        // On ferme l'archive courante avant d'ajouter un fichier qui la ferait
        // deborder (sauf si elle est vide : un fichier enorme part seul).
        if (batch.length > 0 && batchBytes + blob.size > MAX_ZIP_BYTES) {
          await flush(false);
          if (cancelDownload.current) break;
        }
        batch.push({
          name: `${displayName(p.public_id)}.${p.format}`,
          blob,
          date: new Date(p.created_at),
        });
        batchBytes += blob.size;
      } catch {
        failed += 1;
      }
      setDownloading({
        done: i + 1,
        total: toDownload.length,
        label: `Telechargement ${i + 1}/${toDownload.length}`,
      });
    }

    if (!cancelDownload.current) await flush(true);
    setDownloading(null);

    if (failed > 0) {
      alert(
        `${failed} fichier(s) n'ont pas pu etre recuperes et ne sont pas dans l'archive.`
      );
    }
  };

  // Repli : un fichier a la fois, sans archive (utile si le ZIP echoue,
  // par exemple sur un vieux navigateur mobile).
  const downloadSelectedOneByOne = async () => {
    if (downloading) return;
    const toDownload = photos.filter((p) => selected.has(photoKey(p)));
    if (toDownload.length === 0) return;
    if (
      toDownload.length > 25 &&
      !window.confirm(
        `Telecharger ${toDownload.length} fichiers un par un ?\n` +
          "Votre navigateur va demander l'autorisation des telechargements multiples, " +
          "et cela peut prendre quelques minutes."
      )
    ) {
      return;
    }

    cancelDownload.current = false;
    for (let i = 0; i < toDownload.length; i++) {
      if (cancelDownload.current) break;
      const p = toDownload[i];
      const a = document.createElement("a");
      a.href = downloadUrl(p.public_id, p.format, p.media);
      a.download = `${displayName(p.public_id)}.${p.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloading({
        done: i + 1,
        total: toDownload.length,
        label: `Fichier ${i + 1}/${toDownload.length}`,
      });
      if (i < toDownload.length - 1) await sleep(400);
    }
    setDownloading(null);
  };

  const exitSelectMode = () => {
    cancelDownload.current = true;
    setSelectMode(false);
    setSelected(new Set());
  };

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>{title}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!selectMode && (
            <button onClick={() => setSelectMode(true)} style={s.btnOutline}>
              Selectionner
            </button>
          )}
          {selectMode && (
            <>
              <button onClick={exitSelectMode} style={s.btnOutline}>Annuler</button>
              <button
                onClick={() => setSelection(filteredPhotos, !allFilteredSelected)}
                style={s.btnOutline}
                disabled={filteredPhotos.length === 0}
              >
                {allFilteredSelected
                  ? "Tout deselectionner"
                  : `Tout selectionner (${filteredPhotos.length})`}
              </button>
              {totalPages > 1 && (
                <button
                  onClick={() => setSelection(pagePhotos, !pageSelected)}
                  style={s.btnOutline}
                >
                  {pageSelected ? "Deselectionner la page" : "Cette page"}
                </button>
              )}
              <button
                onClick={downloadSelectedZip}
                style={{ ...s.btn, opacity: selected.size === 0 || downloading ? 0.5 : 1 }}
                disabled={selected.size === 0 || !!downloading}
              >
                {downloading
                  ? downloading.label
                  : `Telecharger en ZIP (${selected.size})`}
              </button>
              {downloading ? (
                <button
                  onClick={() => { cancelDownload.current = true; }}
                  style={s.btnOutline}
                >
                  Arreter
                </button>
              ) : (
                selected.size > 0 && (
                  <button onClick={downloadSelectedOneByOne} style={s.linkBtn}>
                    ou un par un
                  </button>
                )
              )}
            </>
          )}
          {showUpload && (
            <button onClick={openUploadWidget} style={s.btn}>
              + Ajouter mes photos
            </button>
          )}
        </div>
      </div>

      {/* Progression du telechargement groupe */}
      {downloading && (
        <div style={s.progressWrap}>
          <div style={s.progressTrack}>
            <div
              style={{
                ...s.progressFill,
                width: `${Math.round((downloading.done / Math.max(1, downloading.total)) * 100)}%`,
              }}
            />
          </div>
          <span style={s.progressText}>
            {downloading.label} — gardez cette page ouverte
          </span>
        </div>
      )}

      {/* Carte photographe : page dediee, ou des qu'on filtre sur ses photos */}
      {photographerCardVisible && <PhotographerCard />}

      {/* Filtre par tag : toutes / invites / photographe */}
      {showFilters && (
        <div style={s.filterBar}>
          <div style={s.filterChips}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  ...s.filterChip,
                  background: filter === f.key ? BTN_BG : "transparent",
                  color: filter === f.key ? "#fff" : COLOR,
                }}
                aria-pressed={filter === f.key}
              >
                {f.label}
                {!loading && <span style={s.filterChipCount}>{counts[f.key]}</span>}
              </button>
            ))}
          </div>
          {!photographerCardVisible && photographerPageUrl && (
            <a href={photographerPageUrl} style={s.proLink}>
              À propos de la photographe + lien vers les photos haute définition &#8250;
            </a>
          )}
        </div>
      )}

      {/* Per page selector */}
      <div style={s.toolbar}>
        <span style={{ color: COLOR, fontFamily: FONT, fontSize: 14 }}>
          {filteredPhotos.length} photo{filteredPhotos.length !== 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: COLOR, fontFamily: FONT, fontSize: 14 }}>Taille :</span>
            {GRID_SIZES.map((sz) => (
              <button
                key={sz.key}
                onClick={() => setGridSize(sz.key)}
                style={{
                  ...s.chipBtn,
                  background: gridSize === sz.key ? BTN_BG : "transparent",
                  color: gridSize === sz.key ? "#fff" : COLOR,
                }}
              >
                {sz.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: COLOR, fontFamily: FONT, fontSize: 14 }}>Par page :</span>
            {PER_PAGE_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => { setPerPage(n); setPage(0); }}
                style={{
                  ...s.chipBtn,
                  background: perPage === n ? BTN_BG : "transparent",
                  color: perPage === n ? "#fff" : COLOR,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p style={s.loadingText}>Chargement...</p>}

      {!loading && filteredPhotos.length === 0 && (
        <p style={s.emptyText}>
          {photos.length === 0
            ? "Aucune photo pour le moment. Soyez le premier a en ajouter !"
            : filter === "pro"
            ? "Les photos de la photographe arrivent bientôt."
            : "Aucune photo dans cette sélection."}
        </p>
      )}

      {/* Grid */}
      <div className={`${GRID_CLASS} pg-${gridSize}`} style={s.grid}>
        {pagePhotos.map((photo, i) => {
          const globalIndex = page * perPage + i;
          const key = photoKey(photo);
          const isSelected = selected.has(key);
          const pm = meta[photo.public_id];
          const reactTotal = pm
            ? Object.values(pm.reactions || {}).reduce((a, b) => a + (Number(b) || 0), 0)
            : 0;
          return (
            <div
              key={key}
              className="pg-thumb"
              style={{ ...s.gridItem, position: "relative", cursor: "pointer" }}
              onClick={() => {
                if (selectMode) toggleSelect(key);
                else setLightboxIndex(globalIndex);
              }}
            >
              {!selectMode && (reactTotal > 0 || (pm && pm.comments > 0)) && (
                <div style={s.metaBadge}>
                  {reactTotal > 0 && <span>&#10084;&#65039; {reactTotal}</span>}
                  {pm && pm.comments > 0 && <span>&#128172; {pm.comments}</span>}
                </div>
              )}
              {!selectMode && photo.isPro && filter === "all" && (
                <div style={s.proBadge} title="Photo de la photographe">&#128247;</div>
              )}
              {selectMode && (
                <div style={{
                  ...s.checkbox,
                  background: isSelected ? BTN_BG : "rgba(255,255,255,0.8)",
                  borderColor: isSelected ? BTN_BG : "#999",
                }}>
                  {isSelected && <span style={{ color: "#fff", fontSize: 14, lineHeight: 1 }}>&#10003;</span>}
                </div>
              )}
              {photo.media === "video" && (
                <div style={s.playBadge}>&#9654;</div>
              )}
              <img
                src={
                  photo.media === "video"
                    ? videoThumbUrl(photo.public_id, gridSize === "small" ? 300 : gridSize === "medium" ? 400 : 600)
                    : imageUrl(photo.public_id, gridSize === "small" ? 300 : gridSize === "medium" ? 400 : 600)
                }
                alt={displayName(photo.public_id)}
                loading="lazy"
                style={{
                  ...s.image,
                  opacity: selectMode && !isSelected ? 0.6 : 1,
                }}
              />
              <div style={s.caption}>{displayName(photo.public_id)}</div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          <button
            className="pg-page-btn"
            style={{ ...s.pageBtn, opacity: page === 0 ? 0.4 : 1 }}
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            &#8249; Precedent
          </button>
          <span style={{ color: COLOR, fontFamily: FONT, fontSize: 15 }}>
            {page + 1} / {totalPages}
          </span>
          <button
            className="pg-page-btn"
            style={{ ...s.pageBtn, opacity: page >= totalPages - 1 ? 0.4 : 1 }}
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant &#8250;
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && filteredPhotos.length > 0 && (
        <Lightbox
          photos={filteredPhotos}
          index={Math.min(lightboxIndex, filteredPhotos.length - 1)}
          onClose={() => { setLightboxIndex(null); fetchMeta(); }}
          onPrev={() => setLightboxIndex((i) => (i! > 0 ? i! - 1 : filteredPhotos.length - 1))}
          onNext={() => setLightboxIndex((i) => (i! < filteredPhotos.length - 1 ? i! + 1 : 0))}
        />
      )}
    </div>
  );
}

// ─── Main Component ───
export interface PhotoGalleryProps {
  /** Titre affiche en haut de la galerie. */
  title?: string;
  /** Filtre selectionne a l'ouverture ("all" | "guests" | "pro"). */
  defaultFilter?: PhotoFilter;
  /** Affiche les puces de filtre Toutes / Invites / Photographe. */
  showFilters?: boolean;
  /** Affiche le bloc coordonnees + lien Jingoo de la photographe. */
  showPhotographerCard?: boolean;
  /** Affiche le bouton "+ Ajouter mes photos". */
  showUpload?: boolean;
  /** Lien vers la page dediee a la photographe (masque si la carte est deja affichee). */
  photographerPageUrl?: string;
}

export default function PhotoGallery({
  title = "Nos Photos",
  defaultFilter = "all",
  showFilters = true,
  showPhotographerCard = false,
  showUpload = true,
  photographerPageUrl = "/photographe",
}: PhotoGalleryProps) {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // Auto-login via URL params
    if (!isAuthenticated()) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("login") === LOGIN && params.get("pwd") === PASSWORD) {
        setAuthenticated();
        setAuthed(true);
        return;
      }
    }
    setAuthed(isAuthenticated());
  }, []);

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  return (
    <Gallery
      title={title}
      defaultFilter={defaultFilter}
      showFilters={showFilters}
      showPhotographerCard={showPhotographerCard}
      showUpload={showUpload}
      photographerPageUrl={photographerPageUrl}
    />
  );
}

// ─── Styles ───
const s: Record<string, React.CSSProperties> = {
  // Login
  loginOverlay: {
    minHeight: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: BG,
    padding: 16,
    fontFamily: FONT,
  },
  loginForm: {
    width: "100%",
    maxWidth: 360,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  loginTitle: {
    fontSize: 28, fontWeight: 600, textAlign: "center", margin: 0,
    color: COLOR, fontFamily: FONT,
  },
  loginSubtitle: {
    fontSize: 15, color: COLOR, textAlign: "center", margin: 0, marginBottom: 8,
    fontFamily: FONT, opacity: 0.75,
  },
  input: {
    padding: "12px 14px", fontSize: 16, border: "1px solid #c5b9ad", borderRadius: 8,
    outline: "none", width: "100%", boxSizing: "border-box",
    fontFamily: FONT, color: COLOR, background: "#fff",
  },
  error: {
    color: "#dc2626", fontSize: 14, margin: 0, textAlign: "center", fontFamily: FONT,
  },

  // Shared buttons
  btn: {
    padding: "10px 20px", fontSize: 15, fontWeight: 500,
    color: "#fff", background: BTN_BG, border: "none", borderRadius: 8,
    cursor: "pointer", whiteSpace: "nowrap", fontFamily: FONT,
  },
  btnOutline: {
    padding: "10px 20px", fontSize: 15, fontWeight: 500,
    color: COLOR, background: "transparent", border: `1px solid ${COLOR}`, borderRadius: 8,
    cursor: "pointer", whiteSpace: "nowrap", fontFamily: FONT,
  },
  linkBtn: {
    padding: "10px 4px", fontSize: 14, color: COLOR, background: "none",
    border: "none", cursor: "pointer", fontFamily: FONT, opacity: 0.75,
    textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap",
  },

  // Progression du telechargement groupe
  progressWrap: {
    display: "flex", flexDirection: "column", gap: 6, marginBottom: 16,
  },
  progressTrack: {
    height: 6, borderRadius: 3, overflow: "hidden",
    background: "rgba(65,97,29,0.18)",
  },
  progressFill: {
    height: "100%", background: BTN_BG, transition: "width 0.2s",
  },
  progressText: {
    fontSize: 13, color: COLOR, fontFamily: FONT, opacity: 0.8,
  },

  // Gallery
  container: {
    width: "100%", maxWidth: 960, margin: "0 auto", padding: "24px 16px",
    background: BG, fontFamily: FONT,
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", gap: 12, marginBottom: 16,
  },
  title: {
    fontSize: 26, fontWeight: 600, margin: 0, color: COLOR, fontFamily: FONT,
  },
  toolbar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16, flexWrap: "wrap", gap: 8,
  },
  chipBtn: {
    padding: "4px 12px", fontSize: 14, fontFamily: FONT,
    border: `1px solid ${COLOR}`, borderRadius: 20, cursor: "pointer",
    background: "transparent", color: COLOR,
  },

  // Barre de filtres (Toutes / Invites / Photographe)
  filterBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", gap: 10, marginBottom: 14,
    paddingBottom: 12, borderBottom: "1px solid rgba(65,97,29,0.18)",
  },
  filterChips: {
    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
  },
  filterChip: {
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "7px 16px", fontSize: 15, fontFamily: FONT,
    border: `1px solid ${COLOR}`, borderRadius: 22, cursor: "pointer",
    background: "transparent", color: COLOR, lineHeight: 1.2,
  },
  filterChipCount: {
    fontSize: 12, opacity: 0.7, fontVariantNumeric: "tabular-nums",
  },
  proLink: {
    color: COLOR, fontFamily: FONT, fontSize: 14,
    textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap",
  },

  // Carte photographe
  proCard: {
    marginBottom: 20, padding: "20px 22px", borderRadius: 12,
    background: "#fff", border: "1px solid rgba(65,97,29,0.22)",
    fontFamily: FONT, color: COLOR,
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12,
  },
  proCardHead: {
    display: "flex", flexDirection: "column", gap: 2,
  },
  proCardRole: {
    fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.65,
  },
  proCardName: {
    margin: 0, fontSize: 24, fontWeight: 600, fontFamily: FONT, color: COLOR,
  },
  proCardText: {
    margin: 0, fontSize: 15, lineHeight: 1.55, opacity: 0.9, maxWidth: 620,
  },
  proCardCta: {
    display: "inline-block", padding: "10px 20px", borderRadius: 8,
    background: BTN_BG, color: "#fff", textDecoration: "none",
    fontSize: 15, fontWeight: 500, fontFamily: FONT,
  },
  proCardLinks: {
    display: "flex", gap: 16, flexWrap: "wrap",
  },
  proCardLink: {
    color: COLOR, fontSize: 14, fontFamily: FONT,
    textDecoration: "underline", textUnderlineOffset: 3,
  },
  proCardNote: {
    margin: 0, fontSize: 13, lineHeight: 1.5, opacity: 0.7,
    fontStyle: "italic", maxWidth: 620,
  },
  proBadge: {
    position: "absolute", top: 6, left: 6, zIndex: 2,
    width: 24, height: 24, borderRadius: 12,
    background: "rgba(0,0,0,0.5)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, pointerEvents: "none",
  },
  loadingText: {
    textAlign: "center", color: COLOR, fontSize: 15, fontFamily: FONT, opacity: 0.6,
  },
  emptyText: {
    textAlign: "center", color: COLOR, fontSize: 15, padding: "40px 0",
    fontFamily: FONT, opacity: 0.6,
  },
  grid: {
    display: "grid", gap: 8,
  },
  gridItem: {
    display: "block", overflow: "hidden", borderRadius: 8, aspectRatio: "1",
  },
  image: {
    width: "100%", height: "100%", objectFit: "cover", display: "block",
    transition: "opacity 0.2s",
  },
  caption: {
    position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 1,
    padding: "16px 8px 6px", color: "#fff", fontFamily: FONT, fontSize: 12,
    lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden",
    textOverflow: "ellipsis", pointerEvents: "none",
    background: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0))",
  },
  playBadge: {
    position: "absolute", bottom: 8, right: 8, zIndex: 2,
    width: 32, height: 32, borderRadius: 16,
    background: "rgba(0,0,0,0.55)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, pointerEvents: "none",
  },
  checkbox: {
    position: "absolute", top: 8, left: 8, zIndex: 2,
    width: 26, height: 26, borderRadius: 6, border: "2px solid #999",
    display: "flex", alignItems: "center", justifyContent: "center",
  },

  // Pagination
  pagination: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 16, marginTop: 24,
  },
  pageBtn: {
    padding: "8px 16px", fontSize: 15, fontFamily: FONT,
    color: COLOR, background: "transparent", border: `1px solid ${COLOR}`,
    borderRadius: 8, cursor: "pointer",
  },

  // Lightbox
  lbOverlay: {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.98)",
  },
  // L'image occupe tout l'ecran ; les barres se superposent dans les marges.
  lbStage: {
    position: "absolute", inset: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "52px 8px 104px",
  },
  lbImage: {
    maxWidth: "96vw", maxHeight: "100%", objectFit: "contain", borderRadius: 4,
  },
  lbArrow: {
    position: "absolute", top: "50%", transform: "translateY(-50%)", zIndex: 12,
    background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
    fontSize: 40, width: 48, height: 48, borderRadius: 24,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  // Barre haute (compteur + nom + fermer), superposee a l'image.
  lbTopBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 13,
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "10px 14px", fontFamily: FONT,
    background: "linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0))",
  },
  lbTopInfo: {
    flex: 1, minWidth: 0, color: "rgba(255,255,255,0.92)", fontSize: 14,
    fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  lbClose: {
    flexShrink: 0, background: "none", border: "none", color: "#fff",
    fontSize: 26, lineHeight: 1, cursor: "pointer", fontFamily: FONT, padding: "2px 6px",
  },
  // Barre basse (reactions + actions), superposee a l'image.
  lbBottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 13,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
    padding: "22px 14px 22px", fontFamily: FONT,
    background: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0))",
  },
  lbBottomActions: {
    display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap",
  },
  lbActionBtn: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 18px", borderRadius: 22, border: "none",
    background: "rgba(255,255,255,0.18)", color: "#fff",
    cursor: "pointer", fontFamily: FONT, fontSize: 14,
    textDecoration: "none", whiteSpace: "nowrap",
  },
  // Feuille commentaires
  lbSheetBackdrop: {
    position: "absolute", inset: 0, zIndex: 15, background: "rgba(0,0,0,0.4)",
  },
  lbSheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20,
    maxHeight: "72vh", display: "flex", flexDirection: "column", gap: 10,
    padding: "12px 16px 18px", fontFamily: FONT,
    background: "rgba(18,18,18,0.98)",
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
  },
  lbSheetHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  lbSheetTitle: {
    color: "#fff", fontSize: 16, fontWeight: 600, fontFamily: FONT,
  },
  lbSheetClose: {
    background: "none", border: "none", color: "#fff",
    fontSize: 22, lineHeight: 1, cursor: "pointer", padding: "2px 6px",
  },

  // Reactions
  reactionBar: {
    display: "flex", gap: 6, flexWrap: "wrap",
  },
  reactionBtn: {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "6px 10px", borderRadius: 20,
    background: "rgba(255,255,255,0.12)", border: "1px solid transparent",
    color: "#fff", cursor: "pointer", fontFamily: FONT, fontSize: 14,
  },
  reactionBtnActive: {
    background: "rgba(255,255,255,0.28)", borderColor: "rgba(255,255,255,0.7)",
  },
  reactionCount: {
    fontSize: 13, color: "#fff",
  },

  // Commentaires
  commentsWrap: {
    display: "flex", flexDirection: "column", gap: 8,
  },
  commentsList: {
    flex: 1, minHeight: 40, maxHeight: "52vh", overflowY: "auto",
    display: "flex", flexDirection: "column", gap: 6,
  },
  commentsEmpty: {
    color: "rgba(255,255,255,0.6)", fontSize: 14, fontStyle: "italic",
  },
  commentItem: {
    fontSize: 14, color: "#fff", lineHeight: 1.4,
  },
  commentName: {
    fontWeight: 600, marginRight: 6, color: "#fff",
  },
  commentText: {
    color: "rgba(255,255,255,0.92)", wordBreak: "break-word",
  },
  commentForm: {
    display: "flex", gap: 6, flexWrap: "wrap",
  },
  commentNameInput: {
    flex: "0 0 90px", minWidth: 0, padding: "8px 10px", borderRadius: 8,
    border: "none", fontFamily: FONT, fontSize: 14,
  },
  commentTextInput: {
    flex: 1, minWidth: 120, padding: "8px 10px", borderRadius: 8,
    border: "none", fontFamily: FONT, fontSize: 14,
  },
  commentSend: {
    padding: "8px 16px", borderRadius: 8, border: "none",
    background: BTN_BG, color: "#fff", cursor: "pointer",
    fontFamily: FONT, fontSize: 14, whiteSpace: "nowrap",
  },

  // Badge resume sur la vignette
  metaBadge: {
    position: "absolute", top: 6, right: 6, zIndex: 2,
    display: "flex", gap: 6, alignItems: "center",
    padding: "3px 7px", borderRadius: 12,
    background: "rgba(0,0,0,0.55)", color: "#fff",
    fontSize: 11, fontFamily: FONT, pointerEvents: "none", lineHeight: 1.2,
  },
};
