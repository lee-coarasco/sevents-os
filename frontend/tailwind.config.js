/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#F5B800",
          dim: "#C49200",
          soft: "#FFF7E0",
        },
      },
      fontFamily: {
        brand: ["Syne", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "page": "linear-gradient(135deg, #F7F6F2 0%, #F2F1EC 100%)",
      },
    },
  },
  plugins: [],
};
