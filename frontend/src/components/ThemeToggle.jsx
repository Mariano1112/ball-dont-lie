import { useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  const toggleTheme = () => {
    setDark(!dark);

    // THE IMPORTANT LINE → adds/removes "dark" on <html>
    document.documentElement.classList.toggle("dark");
  };

  return (
    <button onClick={toggleTheme} style={{ margin: "20px" }}>
      {dark ? "Switch to Light" : "Switch to Dark"}
    </button>
  );
}

