/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Environment (near-true black, not navy/purple-tinted)
        bg: "#050505",
        surface: "#0A0A0A",
        surface2: "#111113",
        border: "#1E1E22",

        // Information
        text: "#F2F2F4",
        muted: "#87878F",

        // Signal / meaning accents — used for activity, severity, and status,
        // never as the base environment.
        cyan: "#00E5FF",      // system/live signal, primary interaction
        emerald: "#00E5FF",   // alias kept for existing primary-interaction usages
        blue: "#3B82FF",      // correlation / relationships / data flow
        violet: "#8B5CF6",    // guidance & analysis context
        mint: "#20E3A2",      // resolved / healthy
        green: "#20E3A2",
        magenta: "#FF3D9A",   // critical severity
        orange: "#FF8A00",    // high severity / warning
        yellow: "#FFD43B",    // medium severity

        crit: "#FF3D9A",
        high: "#FF8A00",
        med: "#FFD43B",
        low: "#6E7480",
      },
      fontFamily: {
        sans: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Fira Code", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "4px",
        md: "6px",
      },
    },
  },
  plugins: [],
}
