// Ecriture d'un fichier ZIP directement dans le navigateur, sans dependance.
//
// Methode "store" (aucune compression) : les JPEG, PNG et MP4 sont deja
// compresses, deflate ne gagnerait que quelques pourcents pour un cout CPU
// important sur mobile. Le ZIP sert ici a regrouper, pas a reduire.
//
// Les donnees de chaque fichier restent des Blob (stockage gere par le
// navigateur, souvent sur disque) : on ne garde jamais plus d'un fichier
// decode en memoire, et le Blob final est assemble par reference.

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Date et heure au format MS-DOS attendu par le format ZIP (precision : 2 s).
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export interface ZipEntryInput {
  /** Nom du fichier dans l'archive (les doublons sont suffixes automatiquement). */
  name: string;
  blob: Blob;
  /** Date de modification inscrite dans l'archive. */
  date?: Date;
}

interface StagedEntry {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const EOCD_SIZE = 22;
// Marqueur "nom de fichier encode en UTF-8" (bit 11 du champ flags).
const FLAG_UTF8 = 0x0800;
// Au-dela, il faudrait l'extension ZIP64 : on refuse plutot que de produire
// une archive silencieusement corrompue. L'appelant decoupe en plusieurs parts.
export const ZIP32_MAX_BYTES = 0xffffffff;

function localHeader(e: StagedEntry): Uint8Array {
  const buf = new ArrayBuffer(LOCAL_HEADER_SIZE + e.nameBytes.length);
  const v = new DataView(buf);
  v.setUint32(0, 0x04034b50, true); // signature
  v.setUint16(4, 20, true); // version minimale
  v.setUint16(6, FLAG_UTF8, true);
  v.setUint16(8, 0, true); // methode : store
  v.setUint16(10, e.time, true);
  v.setUint16(12, e.date, true);
  v.setUint32(14, e.crc, true);
  v.setUint32(18, e.size, true); // taille compressee
  v.setUint32(22, e.size, true); // taille reelle
  v.setUint16(26, e.nameBytes.length, true);
  v.setUint16(28, 0, true); // champ "extra"
  new Uint8Array(buf).set(e.nameBytes, LOCAL_HEADER_SIZE);
  return new Uint8Array(buf);
}

function centralDirectory(entries: StagedEntry[]): Uint8Array {
  const size = entries.reduce(
    (n, e) => n + CENTRAL_HEADER_SIZE + e.nameBytes.length,
    0
  );
  const buf = new ArrayBuffer(size + EOCD_SIZE);
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);

  let at = 0;
  for (const e of entries) {
    v.setUint32(at, 0x02014b50, true); // signature
    v.setUint16(at + 4, 20, true); // version d'ecriture
    v.setUint16(at + 6, 20, true); // version minimale
    v.setUint16(at + 8, FLAG_UTF8, true);
    v.setUint16(at + 10, 0, true); // methode : store
    v.setUint16(at + 12, e.time, true);
    v.setUint16(at + 14, e.date, true);
    v.setUint32(at + 16, e.crc, true);
    v.setUint32(at + 20, e.size, true);
    v.setUint32(at + 24, e.size, true);
    v.setUint16(at + 28, e.nameBytes.length, true);
    v.setUint16(at + 30, 0, true); // extra
    v.setUint16(at + 32, 0, true); // commentaire
    v.setUint16(at + 34, 0, true); // numero de disque
    v.setUint16(at + 36, 0, true); // attributs internes
    v.setUint32(at + 38, 0, true); // attributs externes
    v.setUint32(at + 42, e.offset, true);
    bytes.set(e.nameBytes, at + CENTRAL_HEADER_SIZE);
    at += CENTRAL_HEADER_SIZE + e.nameBytes.length;
  }

  const cdOffset = entries.length
    ? entries[entries.length - 1].offset +
      LOCAL_HEADER_SIZE +
      entries[entries.length - 1].nameBytes.length +
      entries[entries.length - 1].size
    : 0;

  v.setUint32(at, 0x06054b50, true); // signature "end of central directory"
  v.setUint16(at + 4, 0, true); // numero de disque
  v.setUint16(at + 6, 0, true); // disque du repertoire central
  v.setUint16(at + 8, entries.length, true);
  v.setUint16(at + 10, entries.length, true);
  v.setUint32(at + 12, size, true);
  v.setUint32(at + 16, cdOffset, true);
  v.setUint16(at + 20, 0, true); // commentaire d'archive

  return bytes;
}

/**
 * Assemble les fichiers fournis en une archive ZIP.
 * `onProgress` est appele apres chaque fichier ajoute (calcul du CRC).
 */
export async function createZip(
  inputs: ZipEntryInput[],
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const staged: StagedEntry[] = [];
  const usedNames = new Set<string>();
  let offset = 0;

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const name = uniqueName(input.name, usedNames);
    const bytes = new Uint8Array(await input.blob.arrayBuffer());
    const { time, date } = dosDateTime(input.date ?? new Date());
    const entry: StagedEntry = {
      nameBytes: encoder.encode(name),
      crc: crc32(bytes),
      size: input.blob.size,
      offset,
      time,
      date,
    };
    staged.push(entry);
    const header = localHeader(entry);
    parts.push(header);
    // On repousse le Blob d'origine plutot que `bytes` : le tableau decode est
    // libere des la fin de l'iteration.
    parts.push(input.blob);
    offset += header.length + entry.size;
    onProgress?.(i + 1, inputs.length);
  }

  parts.push(centralDirectory(staged));
  return new Blob(parts, { type: "application/zip" });
}

/** Evite deux fichiers de meme nom dans l'archive ("photo.jpg", "photo (2).jpg"). */
function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  let candidate = `${base} (${n})${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base} (${n})${ext}`;
  }
  used.add(candidate);
  return candidate;
}
