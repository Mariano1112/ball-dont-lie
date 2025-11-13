import { BrowserRouter, Routes, Route } from "react-router-dom";
import Portal from "./pages/Portal.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Portal />} />
      </Routes>
    </BrowserRouter>
  );
}
