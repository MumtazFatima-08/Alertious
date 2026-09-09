import { Routes, Route } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Overview from "./pages/Overview";
import Incidents from "./pages/Incidents";
import Events from "./pages/Events";
import Investigate from "./pages/Investigate";
import Rules from "./pages/Rules";
import Simulator from "./pages/Simulator";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/events" element={<Events />} />
        <Route path="/investigate" element={<Investigate />} />
        <Route path="/investigate/:incidentId" element={<Investigate />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
