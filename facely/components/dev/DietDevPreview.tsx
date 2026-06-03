import React from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LockKeyhole } from "lucide-react-native";

type Protocol = {
  title: string;
  targets: string[];
  image: ImageSourcePropType;
};

const FONT = "DINNextRounded-Regular";

const targetText = (targets: string[]) => `Targets ${targets.join(" \u2022 ")}`;

const protocols: Protocol[] = [
  {
    title: "Vitamin D3 + K2",
    targets: ["cheekbone width", "bone mass"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/vitamin-d3-k2.jpg"),
  },
  {
    title: "Avocado",
    targets: ["cheekbone width", "bone mass", "facial leanness"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/avocado-slices.jpg"),
  },
  {
    title: "Zinc Supplement",
    targets: ["cheekbone width", "bone mass", "IGF-1"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/zinc-supplement.jpg"),
  },
  {
    title: "Bone Broth",
    targets: ["cheekbone width", "bone mass"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/bone-broth.jpg"),
  },
  {
    title: "Unsalted Cheese",
    targets: ["cheekbone width", "bone mass"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/unsalted-cheese.jpg"),
  },
  {
    title: "Beef Liver",
    targets: ["cheekbone width", "bone mass"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/beef-liver.jpg"),
  },
  {
    title: "Egg Yolks",
    targets: ["cheekbone width", "bone mass"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/egg-yolks.jpg"),
  },
  {
    title: "Raw Kefir",
    targets: ["cheekbone width", "bone mass"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/raw-kefir.jpg"),
  },
  {
    title: "Ashwagandha",
    targets: ["cheekbone width", "bone mass", "testosterone"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/ashwagandha.jpg"),
  },
  {
    title: "Almond Magnesium",
    targets: ["cheekbone width", "bone mass"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/magnesium-almonds.jpg"),
  },
  {
    title: "Raisins",
    targets: ["cheekbone width", "bone mass"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/boron-raisins.jpg"),
  },
  {
    title: "Oysters",
    targets: ["cheekbone width", "bone mass", "testosterone"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/oysters.jpg"),
  },
  {
    title: "Chia Seeds",
    targets: ["cheekbone width", "bone mass"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/chia-seeds.jpg"),
  },
  {
    title: "Whole Eggs",
    targets: ["testosterone", "IGF-1"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/whole-eggs.jpg"),
  },
  {
    title: "Beef",
    targets: ["testosterone", "IGF-1"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/beef-steak.jpg"),
  },
  {
    title: "Pure Olive Oil",
    targets: ["testosterone"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/pure-olive-oil.jpg"),
  },
  {
    title: "Whole Milk + Raw Honey",
    targets: ["IGF-1"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/whole-milk-raw-honey.jpg"),
  },
  {
    title: "Animal-First Protein",
    targets: ["IGF-1"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/animal-first-protein.jpg"),
  },
  {
    title: "Chicken Thighs",
    targets: ["IGF-1"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/chicken-thighs.jpg"),
  },
  {
    title: "Greek Yogurt",
    targets: ["IGF-1"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/greek-yogurt.jpg"),
  },
  {
    title: "ZMA Stack",
    targets: ["IGF-1"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/zma-stack.jpg"),
  },
  {
    title: "Pumpkin Seeds",
    targets: ["IGF-1"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/pumpkin-seeds.jpg"),
  },
  {
    title: "Oil-Based Cleanser",
    targets: ["skin health"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/oil-based-cleanser.jpg"),
  },
  {
    title: "Carrot",
    targets: ["skin health"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/carrot.jpg"),
  },
  {
    title: "Raw Ginger",
    targets: ["skin health"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/raw-ginger.jpg"),
  },
  {
    title: "Orange Juice",
    targets: ["skin health"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/orange-juice.jpg"),
  },
  {
    title: "Vitamin C",
    targets: ["facial leanness"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/vitamin-c.jpg"),
  },
  {
    title: "Green Tea",
    targets: ["facial leanness"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/green-tea.jpg"),
  },
  {
    title: "Potassium Loading",
    targets: ["facial leanness"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/potassium-loading.jpg"),
  },
  {
    title: "Banana",
    targets: ["facial leanness"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/banana.jpg"),
  },
  {
    title: "Sweet Potato",
    targets: ["facial leanness"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/sweet-potato.jpg"),
  },
  {
    title: "Omega-3s",
    targets: ["facial leanness"],
    image: require("../../assets/ASSETS-FOR-DIET/icons/omega-3-capsules.jpg"),
  },
];

export default function DietDevPreview() {
  return (
    <View style={styles.previewFrame}>
      <View style={styles.backdropShapeOne} />
      <View style={styles.backdropShapeTwo} />
      <View style={styles.backdropShapeThree} />

      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Protocol plan</Text>

        <View style={styles.list}>
          {protocols.map((protocol, index) => {
            const isLast = index === protocols.length - 1;
            return (
              <View key={protocol.title} style={[styles.row, !isLast && styles.rowBorder]}>
                <View style={styles.imageShell}>
                  <Image source={protocol.image} style={styles.image} resizeMode="cover" fadeDuration={0} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title}>{protocol.title}</Text>
                  <Text style={styles.subtitle}>{targetText(protocol.targets)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.ctaDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View your personalized protocol plan"
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <View style={styles.lockWrap}>
            <LockKeyhole color="#252525" size={18} strokeWidth={3} />
          </View>
          <Text style={styles.ctaText}>View your personalized protocol plan</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewFrame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    backgroundColor: "#18583F",
    paddingHorizontal: 16,
    paddingTop: 34,
    paddingBottom: 24,
  },
  backdropShapeOne: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "#9BB1E0",
    opacity: 0.72,
    top: -72,
    left: -86,
  },
  backdropShapeTwo: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#F0D2EB",
    opacity: 0.92,
    top: -92,
    right: -88,
  },
  backdropShapeThree: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: "#F2845F",
    opacity: 0.68,
    top: 42,
    right: 28,
  },
  panel: {
    borderRadius: 42,
    backgroundColor: "#FFFFFF",
    paddingTop: 50,
    paddingHorizontal: 28,
    paddingBottom: 24,
    shadowColor: "#0F1A21",
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  eyebrow: {
    fontFamily: FONT,
    fontSize: 24,
    lineHeight: 30,
    color: "#A4A4A9",
    marginBottom: 26,
  },
  list: {
    width: "100%",
  },
  row: {
    minHeight: 126,
    flexDirection: "row",
    alignItems: "center",
    gap: 26,
    paddingVertical: 17,
  },
  rowBorder: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#E9E9EC",
  },
  imageShell: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#F3F3F4",
    borderWidth: 1,
    borderColor: "#E3E3E5",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: FONT,
    fontSize: 27,
    lineHeight: 34,
    color: "#242426",
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: 21,
    lineHeight: 27,
    color: "#A1A1A6",
    marginTop: 2,
  },
  ctaDivider: {
    height: 1.5,
    backgroundColor: "#E9E9EC",
    marginTop: 14,
  },
  cta: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 24,
  },
  ctaPressed: {
    opacity: 0.72,
  },
  lockWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 25,
    lineHeight: 31,
    color: "#252525",
  },
});
