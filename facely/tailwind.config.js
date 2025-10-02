/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0F0F0F",
        ink: "#111111",
        ink2: "#1A1A1A",
        mist: "#F8F8F8",
        glass: "#FFFFFF22",
        line: "#FFFFFF33",
        accent: "#5DD62C",
      },
      borderRadius: {
        xl: "1rem",
        xxl: "1.5rem",
        glass: "1.25rem",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(0,0,0,0.08)",
        glass:
          "inset 0 1px 0 rgba(255,255,255,0.25), 0 10px 30px rgba(0,0,0,0.15)",
      },
      fontFamily: {
        poppins: ["Poppins-SemiBold"], // maps to the expo-font key you registered
      },
    },
  },
  plugins: [],
};
