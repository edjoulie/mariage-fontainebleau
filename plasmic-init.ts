import { initPlasmicLoader } from "@plasmicapp/loader-nextjs";
import { registerComponent, CodeComponentMeta } from "@plasmicapp/host";
import LodgingCards from "./components/LodgingCards";
import PhotoGallery, { PhotoGalleryProps } from "./components/PhotoGallery";

registerComponent(LodgingCards, {
  name: "LodgingCards",
  importPath: "./components/LodgingCards",
  props: {},
});

const photoGalleryProps: CodeComponentMeta<PhotoGalleryProps>["props"] = {
  title: {
    type: "string",
    defaultValue: "Nos Photos",
    description: "Titre affiché en haut de la galerie",
  },
  defaultFilter: {
    type: "choice",
    multiSelect: false,
    options: [
      { value: "all", label: "Toutes les photos" },
      { value: "guests", label: "Photos des invités" },
      { value: "pro", label: "Photos de la photographe" },
    ],
    defaultValue: "all",
    description: "Filtre sélectionné à l'ouverture de la page",
  },
  showFilters: {
    type: "boolean",
    defaultValue: true,
    description: "Afficher les puces Toutes / Invités / Photographe",
  },
  showPhotographerCard: {
    type: "boolean",
    defaultValue: false,
    description: "Afficher le bloc coordonnées + lien vers la galerie Jingoo",
  },
  showUpload: {
    type: "boolean",
    defaultValue: true,
    description: "Afficher le bouton « + Ajouter mes photos »",
  },
  photographerPageUrl: {
    type: "string",
    defaultValue: "/photographe",
    description:
      "Lien vers la page dédiée à la photographe (masqué si la carte est déjà affichée)",
  },
};

registerComponent(PhotoGallery, {
  name: "PhotoGallery",
  importPath: "./components/PhotoGallery",
  props: photoGalleryProps,
});

export const PLASMIC = initPlasmicLoader({
  projects: [
    {
      id: "vCmzLAMRhRePe4YS3ZvdcA",
      token: "nHmRuLYHZYw28cjAAPMnbBNn1ZZK9qb0KVd2Dk0PcWF8saw562Cj6X3iPb6I6LMDIVbkZfV3xEQpxwWdTg",
    },
  ],
  preview: false,
});

// Register components on the loader for the published site
PLASMIC.registerComponent(LodgingCards, {
  name: "LodgingCards",
  props: {},
});

PLASMIC.registerComponent(PhotoGallery, {
  name: "PhotoGallery",
  props: photoGalleryProps,
});
