import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Identifiants ───
const LOGIN = "mariage";
const PASSWORD = "lavande2026";

// ─── Cloudinary ───
const CLOUD_NAME = "dxvypw2kn";
const UPLOAD_PRESET = "mariage";
const TAG = "mariage";
const IMAGE_LIST_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/list/${TAG}.json`;
const VIDEO_LIST_URL = `https://res.cloudinary.com/${CLOUD_NAME}/video/list/${TAG}.json`;
const GRID_CLASS = "pg-photo-grid";
const FONT = "'EB Garamond', serif";
const BG = "#F6ECE3";
const COLOR = "#41611D";
const BTN_BG = "#41611D";

// ─── Config ───
const PER_PAGE_OPTIONS = [12, 24, 48];

type GridSize = "large" | "medium" | "small";
const GRID_SIZES: { key: GridSize; label: string }[] = [
  { key: "large", label: "Grande" },
  { key: "medium", label: "Moyenne" },
  { key: "small", label: "Vignettes" },
];

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
}

interface CloudinaryListResponse {
  resources: CloudinaryResource[];
  updated_at: string;
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

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext]);

  // Swipe support
  const touchStart = useRef(0);

  return (
    <div
      style={s.lbOverlay}
      onClick={onClose}
      onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchStart.current;
        if (dx > 60) onPrev();
        else if (dx < -60) onNext();
      }}
    >
      {/* Close */}
      <button style={s.lbClose} onClick={onClose}>&#10005;</button>

      {/* Counter */}
      <div style={s.lbCounter}>{index + 1} / {photos.length}</div>

      {/* Prev */}
      <button
        style={{ ...s.lbArrow, left: 8 }}
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
      >
        &#8249;
      </button>

      {/* Media */}
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
          alt=""
          style={s.lbImage}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Next */}
      <button
        style={{ ...s.lbArrow, right: 8 }}
        onClick={(e) => { e.stopPropagation(); onNext(); }}
      >
        &#8250;
      </button>

      {/* Download */}
      <a
        href={downloadUrl(photo.public_id, photo.format, photo.media)}
        style={s.lbDownload}
        onClick={(e) => e.stopPropagation()}
      >
        Telecharger
      </a>
    </div>
  );
}

// ─── Gallery ───
function Gallery() {
  const [photos, setPhotos] = useState<CloudinaryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0]);
  const [page, setPage] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [gridSize, setGridSize] = useState<GridSize>("large");
  const scriptLoaded = useRef(false);

  const totalPages = Math.ceil(photos.length / perPage);
  const pagePhotos = photos.slice(page * perPage, (page + 1) * perPage);

  const fetchPhotos = useCallback(async () => {
    try {
      const ts = Date.now();
      const [imgRes, vidRes] = await Promise.all([
        fetch(`${IMAGE_LIST_URL}?${ts}`).then(r => r.ok ? r.json() : { resources: [] }),
        fetch(`${VIDEO_LIST_URL}?${ts}`).then(r => r.ok ? r.json() : { resources: [] }),
      ]);
      const images: CloudinaryResource[] = (imgRes.resources || []).map(
        (r: Omit<CloudinaryResource, "media">) => ({ ...r, media: "image" as const })
      );
      const videos: CloudinaryResource[] = (vidRes.resources || []).map(
        (r: Omit<CloudinaryResource, "media">) => ({ ...r, media: "video" as const })
      );
      const all = [...images, ...videos].sort(
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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadSelected = () => {
    const toDownload = photos.filter((p) => selected.has(p.public_id));
    toDownload.forEach((p, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = downloadUrl(p.public_id, p.format, p.media);
        a.download = "";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 500);
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>Nos Photos</h2>
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
                onClick={downloadSelected}
                style={{ ...s.btn, opacity: selected.size === 0 ? 0.5 : 1 }}
                disabled={selected.size === 0}
              >
                Telecharger ({selected.size})
              </button>
            </>
          )}
          <button onClick={openUploadWidget} style={s.btn}>
            + Ajouter mes photos
          </button>
        </div>
      </div>

      {/* Per page selector */}
      <div style={s.toolbar}>
        <span style={{ color: COLOR, fontFamily: FONT, fontSize: 14 }}>
          {photos.length} photo{photos.length !== 1 ? "s" : ""}
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

      {!loading && photos.length === 0 && (
        <p style={s.emptyText}>Aucune photo pour le moment. Soyez le premier a en ajouter !</p>
      )}

      {/* Grid */}
      <div className={`${GRID_CLASS} pg-${gridSize}`} style={s.grid}>
        {pagePhotos.map((photo, i) => {
          const globalIndex = page * perPage + i;
          const isSelected = selected.has(photo.public_id);
          return (
            <div
              key={photo.public_id}
              className="pg-thumb"
              style={{ ...s.gridItem, position: "relative", cursor: "pointer" }}
              onClick={() => {
                if (selectMode) toggleSelect(photo.public_id);
                else setLightboxIndex(globalIndex);
              }}
            >
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
                alt=""
                loading="lazy"
                style={{
                  ...s.image,
                  opacity: selectMode && !isSelected ? 0.6 : 1,
                }}
              />
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
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => (i! > 0 ? i! - 1 : photos.length - 1))}
          onNext={() => setLightboxIndex((i) => (i! < photos.length - 1 ? i! + 1 : 0))}
        />
      )}
    </div>
  );
}

// ─── Main Component ───
export default function PhotoGallery() {
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

  return <Gallery />;
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
    background: "rgba(0,0,0,0.92)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  lbImage: {
    maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 4,
  },
  lbClose: {
    position: "absolute", top: 16, right: 16, zIndex: 10,
    background: "none", border: "none", color: "#fff",
    fontSize: 28, cursor: "pointer", fontFamily: FONT,
  },
  lbCounter: {
    position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
    color: "rgba(255,255,255,0.7)", fontSize: 15, fontFamily: FONT,
  },
  lbArrow: {
    position: "absolute", top: "50%", transform: "translateY(-50%)", zIndex: 10,
    background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
    fontSize: 40, width: 48, height: 48, borderRadius: 24,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  lbDownload: {
    position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
    padding: "10px 24px", fontSize: 15, fontFamily: FONT,
    color: "#fff", background: BTN_BG, borderRadius: 8,
    textDecoration: "none", cursor: "pointer",
  },
};
