/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#000000",      // top gradient base
        base2: "#0B0B0B",     // bottom gradient
        ink: "#121212",       // glass card base
        mist: "#FFFFFF",      // plain white text
        sub: "rgba(160,160,160,0.80)", // dimmed text
        glass: "#FFFFFF22",   // reflective streaks
        line: "#2D2D2D",      // ghost outlines
        track: "#2A2A2A",     // inactive progress
        accent: "#B4F34D",    // neon lime
      },
      borderRadius: {
        xl: "2rem",           // 32 px card radius
        pill: "1.75rem",      // 28 px button radius
        glass: "1.25rem",
      },
      boxShadow: {
        soft: "0 2px 15px rgba(180,243,77,0.25)", // accent glow
        card: "0 18px 30px rgba(0,0,0,0.35)",     // glass card depth
      },
      fontFamily: {
        poppins: ["Poppins-SemiBold", "Poppins-Regular"],
      },
    },
  },
  plugins: [],
};
