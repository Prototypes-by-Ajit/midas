import type { SelectOption } from "@/types/dashboard";

/** Regional settings on the settings page. Values are persisted verbatim into the `userPreferences` localStorage blob. */

export const LANGUAGES: SelectOption[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];

export const TIME_FORMATS: SelectOption[] = [
  { value: "12h", label: "12-hour" },
  { value: "24h", label: "24-hour" },
];

export const DATE_FORMATS: SelectOption[] = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];
