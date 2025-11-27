import ThemeToggle from "./components/ThemeToggle";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage/HomePage";
import GamePage from "./pages/GamePage/GamePage";

export default function App() {
  return (
    <>
      {/* Theme button always visible */}
      <ThemeToggle />

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game/:id" element={<GamePage />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

