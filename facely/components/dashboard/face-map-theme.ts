// Illustrative values only. Keep example states separate from the vector geometry.
export const FACE_MAP = {
  background: "#F8F7F2",
  surface: "#FFFFFF",
  ink: "#2D3430",
  muted: "#6D746C",
  soft: "#EEEEE7",
  font: "SFProRounded-Regular",
  medium: "SFProRounded-Semibold",
  bold: "SFProRounded-Bold",
  states: {
    well: { label: "Doing well", ink: "#3E6225", fill: "#B8E978", shade: "#92CB51", surface: "#EDF7DF" },
    improving: { label: "Improving", ink: "#23667A", fill: "#86D7EB", shade: "#55B9D2", surface: "#E2F4F8" },
    attention: { label: "Needs attention", ink: "#805918", fill: "#F5CA66", shade: "#DBAA45", surface: "#FFF2D6" },
  },
} as const;

export type FaceStatus = keyof typeof FACE_MAP.states;
export type FaceArea = "forehead" | "eyes" | "nose" | "cheeks" | "jaw" | "chin";

export const FACE_AREAS: { id: FaceArea; name: string; status: FaceStatus; description: string; side: "left" | "right"; top: number }[] = [
  { id: "forehead", name: "Forehead", status: "well", description: "Looking balanced in this example. A little consistency goes a long way.", side: "left", top: 87 },
  { id: "eyes", name: "Eye area", status: "improving", description: "Moving in a positive direction in this example. Small changes add up.", side: "right", top: 134 },
  { id: "nose", name: "Nose", status: "well", description: "A settled area in this example. Keep your attention on the areas that need it most.", side: "right", top: 209 },
  { id: "cheeks", name: "Cheeks", status: "attention", description: "Your main focus in this example. Give this area a little more attention.", side: "left", top: 196 },
  { id: "jaw", name: "Jawline", status: "improving", description: "Showing progress in this example. Keep building on the small steps.", side: "right", top: 288 },
  { id: "chin", name: "Chin", status: "well", description: "Doing well in this example. Progress also means noticing what is already going well.", side: "left", top: 293 },
];

export const EXAMPLE_FACE_STATES = Object.fromEntries(FACE_AREAS.map(area => [area.id, area.status])) as Record<FaceArea, FaceStatus>;

