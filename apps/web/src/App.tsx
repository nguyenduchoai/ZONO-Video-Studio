import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AssistantPanel } from "./components/AssistantPanel";
import { RemoteAuthGate } from "./components/CloudRemotePanel";
import { ToastProvider } from "./components/ui";
import { Overview } from "./pages/Overview";
import { Brain } from "./pages/Brain";
import { Dna } from "./pages/Dna";
import { Plan } from "./pages/Plan";
import { Agents } from "./pages/Agents";
import { Content } from "./pages/Content";
import { Publish } from "./pages/Publish";
import { Chat } from "./pages/Chat";
import { SalesFlow } from "./pages/SalesFlow";
import { Reports } from "./pages/Reports";
import { Approvals } from "./pages/Approvals";
import { Knowledge } from "./pages/Knowledge";
import { Jev } from "./pages/Jev";
import { Settings } from "./pages/Settings";
import { Skills } from "./pages/Skills";
import { VideoFlow } from "./pages/VideoFlow";
import { Connections } from "./pages/Connections";
import { Mcp, McpNewKey } from "./pages/Mcp";
import { ZaloFollowUp } from "./pages/ZaloFollowUp";
import { Orchestra } from "./pages/Orchestra";
import { Logs } from "./pages/Logs";
import { Channels } from "./pages/Channels";
import { Scout } from "./pages/Scout";
import { Nurture } from "./pages/Nurture";
import { Autopilot } from "./pages/Autopilot";
import { Muse } from "./pages/Muse";
import { UsersQuota } from "./pages/UsersQuota";

/** Redirect keeping the query string (e.g. ?type=…, ?p=…). */
function Keep({ to }: { to: string }) {
  const loc = useLocation();
  return <Navigate to={`${to}${loc.search}`} replace />;
}
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
          <Route path="/" element={<Overview />} />
          <Route path="/muse" element={<Muse />} />
          <Route path="/users-quota" element={<UsersQuota />} />
          <Route path="/brain" element={<Brain />} />
          <Route path="/dna" element={<Dna />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/autopilot" element={<Autopilot />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/content" element={<Content />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/nurture" element={<Nurture />} />
          <Route path="/scout" element={<Scout />} />
          <Route path="/research" element={<Navigate to="/scout" replace />} />
          {/* Integrations, MCP & Logs */}
          <Route path="/connections" element={<Connections />} />
          <Route path="/ads/integrations" element={<Connections />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/ads/logs" element={<Logs />} />
          <Route path="/mcp" element={<Mcp />} />
          <Route path="/ads/ai-gateway" element={<Mcp />} />
          <Route path="/ads/ai-gateway/new" element={<McpNewKey />} />
          {/* Paid Ads removed — redirect any old bookmarks to Overview */}
          <Route path="/ads/*" element={<Navigate to="/" replace />} />
          <Route path="/ads" element={<Navigate to="/" replace />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/sales-flow" element={<SalesFlow />} />
          <Route path="/zalo" element={<ZaloFollowUp />} />
          <Route path="/orchestra" element={<Orchestra />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/jev" element={<Jev />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/video-flow" element={<VideoFlow />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Shell>
    </ToastProvider>
  );
}
