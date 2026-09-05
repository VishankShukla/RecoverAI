/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF9F6",
        ink: "#1B2321",
        ledger: {
          line: "#DEDCD3",
          panel: "#F2F0E9",
        },
        teal: {
          DEFAULT: "#0F6B5C",
          dark: "#0A4C41",
          light: "#DCEBE7",
        },
        rust: {
          DEFAULT: "#B5651D",
          light: "#F3E3D3",
        },
        slate: {
          DEFAULT: "#5B6B67",
        },
      },
      fontFamily: {
        serif: ["'Fraunces'", "Georgia", "serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
