import { initPlasmicLoader } from "@plasmicapp/loader-nextjs";
import { registerComponent } from "@plasmicapp/host";
import LodgingCards from "./components/LodgingCards";
import PhotoGallery from "./components/PhotoGallery";

registerComponent(LodgingCards, {
  name: "LodgingCards",
  importPath: "./components/LodgingCards",
  props: {},
});

registerComponent(PhotoGallery, {
  name: "PhotoGallery",
  importPath: "./components/PhotoGallery",
  props: {},
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
  props: {},
});
