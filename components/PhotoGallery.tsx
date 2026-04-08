import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Identifiants ───
const LOGIN = "mariage";
const PASSWORD = "lavande2026";

// ─── Cloudinary ───
const CLOUD_NAME = "dxvypw2kn";
const UPLOAD_PRESET = "mariage";
const TAG = "mariage";
const LIST_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/list/${TAG}.json`;
const GRID_CLASS = "pg-photo-grid";

// ─── Types ───
interface CloudinaryResource {
  public_id: string;
  version: number;
  format: string;
  width: number;
  height: number;
  type: string;
  created_at: string;
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
    <div style={styles.loginOverlay}>
      <form onSubmit={handleSubmit} style={styles.loginForm}>
        <h2 style={styles.loginTitle}>Galerie Photos</h2>
        <p style={styles.loginSubtitle}>Entrez vos identifiants pour accéder aux photos</p>
        <input
          type="text"
          placeholder="Identifiant"
          value={login}
          onChange={(e) => { setLogin(e.target.value); setError(false); }}
          style={styles.input}
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          style={styles.input}
          autoComplete="current-password"
        />
        {error && <p style={styles.error}>Identifiants incorrects</p>}
        <button type="submit" style={styles.submitBtn}>Accéder</button>
      </form>
    </div>
  );
}

// ─── Gallery ───
function Gallery() {
  const [photos, setPhotos] = useState<CloudinaryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const scriptLoaded = useRef(false);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`${LIST_URL}?${Date.now()}`);
      if (!res.ok) {
        setPhotos([]);
        return;
      }
      const data: CloudinaryListResponse = await res.json();
      const sorted = [...data.resources].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setPhotos(sorted);
    } catch {
      // silently fail — will retry in 30s
    } finally {
      setLoading(false);
    }
  }, []);

  // Inject responsive grid CSS
  useEffect(() => {
    if (document.getElementById("pg-grid-style")) return;
    const style = document.createElement("style");
    style.id = "pg-grid-style";
    style.textContent = `
      .${GRID_CLASS} { grid-template-columns: repeat(2, 1fr); }
      @media (min-width: 640px) { .${GRID_CLASS} { grid-template-columns: repeat(3, 1fr); } }
    `;
    document.head.appendChild(style);
  }, []);

  // Load Cloudinary widget script
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

  // Fetch photos + auto-refresh every 30s
  useEffect(() => {
    fetchPhotos();
    const interval = setInterval(fetchPhotos, 30_000);
    return () => clearInterval(interval);
  }, [fetchPhotos]);

  const openUploadWidget = () => {
    if (!window.cloudinary) {
      alert("Le widget de téléchargement n'est pas encore chargé. Réessayez dans quelques secondes.");
      return;
    }
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUD_NAME,
        uploadPreset: UPLOAD_PRESET,
        tags: [TAG],
        sources: ["local", "camera"],
        multiple: true,
        resourceType: "image",
        language: "fr",
        text: {
          fr: {
            or: "ou",
            menu: { files: "Mes fichiers", camera: "Appareil photo" },
          },
        },
      },
      (_error: unknown, result: { event: string }) => {
        if (result.event === "close" || result.event === "success") {
          // Refresh after upload
          setTimeout(fetchPhotos, 1500);
        }
      }
    );
    widget.open();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Nos Photos</h2>
        <button onClick={openUploadWidget} style={styles.uploadBtn}>
          + Ajouter mes photos
        </button>
      </div>

      {loading && <p style={styles.loadingText}>Chargement…</p>}

      {!loading && photos.length === 0 && (
        <p style={styles.emptyText}>
          Aucune photo pour le moment. Soyez le premier à en ajouter !
        </p>
      )}

      <div className={GRID_CLASS} style={styles.grid}>
        {photos.map((photo) => (
          <a
            key={photo.public_id}
            href={imageUrl(photo.public_id, 1600)}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.gridItem}
          >
            <img
              src={imageUrl(photo.public_id, 600)}
              alt=""
              loading="lazy"
              style={styles.image}
            />
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───
export default function PhotoGallery() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  return <Gallery />;
}

// ─── Inline styles (no Tailwind dependency) ───
const styles: Record<string, React.CSSProperties> = {
  // Login
  loginOverlay: {
    minHeight: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    padding: 16,
  },
  loginForm: {
    width: "100%",
    maxWidth: 360,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 600,
    textAlign: "center",
    margin: 0,
    color: "#1a1a1a",
  },
  loginSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    margin: 0,
    marginBottom: 8,
  },
  input: {
    padding: "12px 14px",
    fontSize: 16,
    border: "1px solid #ddd",
    borderRadius: 8,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
    margin: 0,
    textAlign: "center",
  },
  submitBtn: {
    padding: "12px 0",
    fontSize: 16,
    fontWeight: 500,
    color: "#fff",
    background: "#1a1a1a",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  // Gallery
  container: {
    width: "100%",
    maxWidth: 960,
    margin: "0 auto",
    padding: "24px 16px",
    background: "#fff",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
    color: "#1a1a1a",
  },
  uploadBtn: {
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 500,
    color: "#fff",
    background: "#1a1a1a",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  loadingText: {
    textAlign: "center",
    color: "#999",
    fontSize: 14,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontSize: 14,
    padding: "40px 0",
  },
  grid: {
    display: "grid",
    gap: 8,
  },
  gridItem: {
    display: "block",
    overflow: "hidden",
    borderRadius: 8,
    aspectRatio: "1",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
};

