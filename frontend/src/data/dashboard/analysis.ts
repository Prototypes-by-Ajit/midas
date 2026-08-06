import type { SampleImage } from "@/types/dashboard";

/** Preloaded lesion images offered on the analysis page so patients can try the model without their own photo. */
export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 1,
    name: "Benign Mole",
    url: "/benign_mole_sample.jpg",
    description: "Example of a benign nevus",
  },
  {
    id: 2,
    name: "Melanoma Sample",
    url: "/melanoma_sample.jpg",
    description: "Suspicious lesion example",
  },
  {
    id: 3,
    name: "Basal Cell",
    url: "/basal_cell_sample.jpg",
    description: "Basal cell carcinoma sample",
  },
];
