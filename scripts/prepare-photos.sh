#!/usr/bin/env bash
#
# Prepare (et, en option, envoie) les photos de la photographe vers Cloudinary.
#
# Pourquoi ce script : Cloudinary plafonne les images a 10 Mo sur le plan
# gratuit, or les fichiers d'Aline Ruze montent a 33 Mo (8192x5464). On reduit
# donc chaque photo avant l'envoi. 2560 px sur le plus grand cote reste
# largement au-dessus de ce que le site affiche (1600 px max) et suffit pour
# un tirage 20x30 ; la vraie haute definition reste chez la photographe, ce qui
# est precisement l'objet du lien vers sa galerie.
#
# Le tag applique est UNIQUEMENT "photographe", pas "mariage" : l'endpoint
# public list/{tag}.json est plafonne a 1000 ressources et le tag "mariage" en
# compte deja ~320. La galerie fusionne les deux listes, donc la vue "Toutes"
# reste complete.
#
# Usage :
#   ./scripts/prepare-photos.sh ~/Downloads/c6498033
#   ./scripts/prepare-photos.sh ~/Downloads/c6498033 --upload
#
# Sans --upload : aucune donnee ne quitte la machine, on ne fait que fabriquer
# les fichiers reduits pour que vous puissiez les verifier.
#
# Le script est reprenable : relance-le apres une interruption, il saute les
# photos deja converties et deja envoyees.

set -euo pipefail

# ─── Reglages (surchargeables par variable d'environnement) ───
CLOUD_NAME="${CLOUD_NAME:-dxvypw2kn}"
UPLOAD_PRESET="${UPLOAD_PRESET:-mariage}"
UPLOAD_TAGS="${UPLOAD_TAGS:-photographe}"

MAX_EDGE="${MAX_EDGE:-2560}"      # px sur le plus grand cote
QUALITY="${QUALITY:-86}"          # qualite JPEG cible
MAX_BYTES="${MAX_BYTES:-9MB}"     # plafond dur, sous la limite Cloudinary de 10 Mo
JOBS="${JOBS:-6}"                 # conversions en parallele

# Un 8192x5464 decompresse occupe ~358 Mo en Q16. Avec la limite ImageMagick
# par defaut (256 Mio), chaque conversion deborde sur /tmp : disque sature et
# traitement tres lent. On donne de la RAM a ImageMagick et on plafonne le
# debordement disque pour qu'un cas pathologique echoue franchement plutot que
# de remplir la partition.
export MAGICK_MEMORY_LIMIT="${MAGICK_MEMORY_LIMIT:-1GiB}"
export MAGICK_MAP_LIMIT="${MAGICK_MAP_LIMIT:-2GiB}"
export MAGICK_DISK_LIMIT="${MAGICK_DISK_LIMIT:-512MiB}"
export MAGICK_THREAD_LIMIT=1      # le parallelisme est gere par xargs

# ─── Arguments ───
SRC=""
OUT=""
DO_UPLOAD=0
for arg in "$@"; do
  case "$arg" in
    --upload) DO_UPLOAD=1 ;;
    -*) echo "Option inconnue : $arg" >&2; exit 1 ;;
    *) if [ -z "$SRC" ]; then SRC="$arg"; elif [ -z "$OUT" ]; then OUT="$arg"; fi ;;
  esac
done

if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "Usage : $0 <dossier-source> [dossier-sortie] [--upload]" >&2
  exit 1
fi
SRC="${SRC%/}"
OUT="${OUT:-$SRC/_web}"
UPLOADED_LOG="$OUT/.uploaded"

for c in convert identify curl; do
  command -v "$c" >/dev/null || { echo "$c est introuvable." >&2; exit 1; }
done

mkdir -p "$OUT"
touch "$UPLOADED_LOG"

# ─── Inventaire ───
mapfile -d '' FILES < <(
  find "$SRC" -maxdepth 1 -type f \
    \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \
       -o -iname '*.heic' -o -iname '*.heif' -o -iname '*.tif' -o -iname '*.tiff' \) \
    -print0 | sort -z
)
TOTAL=${#FILES[@]}
[ "$TOTAL" -eq 0 ] && { echo "Aucune image trouvee dans $SRC" >&2; exit 1; }

# Estimation grossiere de la place necessaire : ~1,6 Mo par photo en sortie.
NEED_MB=$(( TOTAL * 16 / 10 ))
FREE_MB=$(df -Pm "$OUT" | awk 'NR==2 {print $4}')
if [ "$FREE_MB" -lt "$NEED_MB" ]; then
  echo "⚠ Espace disque insuffisant : ~${NEED_MB} Mo necessaires, ${FREE_MB} Mo libres." >&2
  echo "  Liberez de la place, ou passez un dossier de sortie sur un autre disque." >&2
  exit 1
fi

echo "→ $TOTAL image(s) dans $SRC"
echo "→ Reduction a ${MAX_EDGE}px max, qualite $QUALITY, plafond $MAX_BYTES, $JOBS en parallele"
echo "→ Sortie : $OUT (~${NEED_MB} Mo estimes, ${FREE_MB} Mo libres)"
echo

# ─── Etape 1 : redimensionnement ───
shrink() {
  local src="$1" out_dir="$2" max_edge="$3" quality="$4" max_bytes="$5"
  local base dest tmp
  base="$(basename "${src%.*}")"
  dest="$out_dir/$base.jpg"
  # Reprise : on saute ce qui existe deja.
  [ -s "$dest" ] && return 0
  # Ecriture via un fichier temporaire : une interruption en plein milieu ne
  # laisse pas un JPEG tronque que la reprise prendrait pour un fichier valide.
  tmp="$dest.part"
  # -define jpeg:size AVANT le fichier d'entree : libjpeg decompresse alors
  # directement a l'echelle 1/2, 1/4 ou 1/8, au lieu de materialiser les 8192px
  # d'origine puis de les reduire. C'est ce qui evite le debordement disque et
  # divise le temps de traitement.
  # -auto-orient avant -strip : on applique la rotation EXIF puis on jette les
  # metadonnees, sinon les photos verticales se retrouvent couchees.
  if convert \
      -define "jpeg:size=${max_edge}x${max_edge}" \
      "$src" \
      -auto-orient \
      -resize "${max_edge}x${max_edge}>" \
      -strip \
      -interlace Plane \
      -sampling-factor 4:2:0 \
      -quality "$quality" \
      -define "jpeg:extent=$max_bytes" \
      "$tmp" 2>/dev/null; then
    mv -f "$tmp" "$dest"
  else
    rm -f "$tmp"
    echo "  ✗ echec conversion : $(basename "$src")" >&2
  fi
}
export -f shrink

already=$(find "$OUT" -maxdepth 1 -name '*.jpg' -type f | wc -l)
[ "$already" -gt 0 ] && echo "  ($already deja converties, elles seront sautees)"

# On passe la liste par un fichier temporaire plutot que par un tuyau : quand
# tout est deja converti, les enfants xargs rendent la main instantanement,
# xargs ferme son entree avant que printf ait fini d'ecrire, et printf meurt
# d'un SIGPIPE que « set -o pipefail » transforme en echec du script entier.
LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT
printf '%s\0' "${FILES[@]}" > "$LIST"
xargs -0 -P "$JOBS" -I{} bash -c \
    'shrink "$1" "$2" "$3" "$4" "$5"' _ {} "$OUT" "$MAX_EDGE" "$QUALITY" "$MAX_BYTES" \
    < "$LIST"

# ─── Bilan ───
done_n=$(find "$OUT" -maxdepth 1 -name '*.jpg' -type f | wc -l)
after=$(du -sh "$OUT" | cut -f1)
# Le maximum est calcule en une passe par awk plutot qu'avec « sort | head -1 » :
# head ferme le tuyau des la premiere ligne, sort meurt d'un SIGPIPE sur le reste,
# et « set -o pipefail » tue le script. Invisible a 10 fichiers, systematique a 765.
biggest=$(find "$OUT" -maxdepth 1 -name '*.jpg' -type f -printf '%s %p\n' \
  | awk 'NR == 1 || $1 > max { max = $1; line = $0 } END { print line }')
echo
echo "✓ $done_n/$TOTAL converties — $after au total"
echo "  Plus gros fichier : $(numfmt --to=iec "${biggest%% *}") ($(basename "${biggest#* }"))"

over=$(find "$OUT" -maxdepth 1 -name '*.jpg' -type f -size +10M | wc -l)
if [ "$over" -gt 0 ]; then
  echo "  ⚠ $over fichier(s) depassent encore 10 Mo — baissez MAX_EDGE ou QUALITY." >&2
  exit 1
fi

# ─── Etape 2 : envoi (optionnel) ───
if [ "$DO_UPLOAD" -eq 0 ]; then
  cat <<EOF

Rien n'a ete envoye. Verifiez quelques fichiers dans :
  $OUT
puis relancez la meme commande avec --upload.
EOF
  exit 0
fi

echo
echo "→ Envoi vers Cloudinary « $CLOUD_NAME », preset « $UPLOAD_PRESET », tags « $UPLOAD_TAGS »"
n=0; sent=0; skipped=0; fail=0
for f in "$OUT"/*.jpg; do
  n=$((n + 1))
  name="$(basename "$f")"
  if grep -qxF "$name" "$UPLOADED_LOG"; then
    skipped=$((skipped + 1))
    continue
  fi
  # On impose le public_id : sans lui, un upload non signe recoit un identifiant
  # aleatoire (« svd06vgy0tqail3aiwdm »), ce qui afficherait du charabia en
  # legende et ferait perdre la numerotation de la photographe, qui est l'ordre
  # de la journee. La galerie s'appuie dessus pour trier la vue « Photographe ».
  resp=$(curl -sS --retry 3 --retry-delay 2 \
    -X POST "https://api.cloudinary.com/v1_1/$CLOUD_NAME/image/upload" \
    -F "file=@$f" \
    -F "upload_preset=$UPLOAD_PRESET" \
    -F "public_id=${name%.jpg}" \
    -F "tags=$UPLOAD_TAGS" 2>&1) || true
  if [[ "$resp" == *'"public_id"'* ]]; then
    echo "$name" >> "$UPLOADED_LOG"
    sent=$((sent + 1))
    printf '  [%d/%d] ✓ %s\n' "$n" "$done_n" "$name"
  else
    fail=$((fail + 1))
    printf '  [%d/%d] ✗ %s → %s\n' "$n" "$done_n" "$name" "$resp" >&2
    # Un echec de preset ou de quota se repeterait 700 fois : on s'arrete.
    if [ "$fail" -ge 3 ]; then
      echo >&2
      echo "⚠ 3 echecs — arret. Corrigez la cause puis relancez : les $sent photos" >&2
      echo "  deja envoyees seront sautees." >&2
      exit 1
    fi
  fi
done

echo
echo "✓ $sent envoyee(s), $skipped deja presente(s), $fail echec(s)."
echo "  Elles apparaissent dans la galerie sous le filtre « Photographe »."
