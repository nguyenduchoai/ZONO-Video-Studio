import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RemoteAuthGate } from "./components/CloudRemotePanel";
import { ToastProvider } from "./components/ui";
import { ReelWeaverStudio } from "./pages/ReelWeaverStudio";
import { VideoFlow } from "./pages/VideoFlow";
import { Dna } from "./pages/Dna";
import { Settings } from "./pages/Settings";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <RemoteAuthGate>
      <Layout>{children}</Layout>
    </RemoteAuthGate>
  );
}

export function App() {
  return (
    <ToastProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<ReelWeaverStudio />} />
          <Route path="/studio" element={<ReelWeaverStudio />} />
          <Route path="/reelweaver" element={<ReelWeaverStudio />} />
          <Route path="/video-flow" element={<VideoFlow />} />
          <Route path="/dna" element={<Dna />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </ToastProvider>
  );
}
