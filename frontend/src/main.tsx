import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import App from "./App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Toasts from "./components/Toasts";

const ClientOrder = lazy(() => import("./pages/ClientOrder"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const Cozinha = lazy(() => import("./pages/Cozinha"));
const TV = lazy(() => import("./pages/TV"));
const Status = lazy(() => import("./pages/Status"));
const AdminShell = lazy(() => import("./components/admin/AdminShell"));
const ItemsAdmin = lazy(() => import("./pages/ItemsAdmin"));
const PaymentsAdmin = lazy(() => import("./pages/PaymentsAdmin"));
const AdminVendas = lazy(() => import("./pages/AdminVendas"));
const AdminEstoque = lazy(() => import("./pages/AdminEstoque"));
const AdminDashboard = lazy(() => import("./pages/AdminRelatorio"));
const AdminConfig = lazy(() => import("./pages/AdminConfig"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));

const queryClient = new QueryClient();

function RouteLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-cream text-sm font-semibold text-slate-500">
      Carregando interface…
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route element={<App />}>
              <Route path="/" element={<Navigate to="/cliente" />} />
              <Route path="/pedidos" element={<ClientOrder />} />
              <Route path="/cliente" element={<ClientOrder />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/cozinha" element={<Navigate to="/admin/cozinha" replace />} />
              <Route path="/tv" element={<Navigate to="/admin/tv" replace />} />
              <Route path="/status/:id" element={<Status />} />
              <Route path="/cliente/pedidos" element={<MyOrders />} />
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="vendas" element={<AdminVendas />} />
                <Route path="cozinha" element={<Cozinha />} />
                <Route path="tv" element={<TV />} />
                <Route path="itens" element={<ItemsAdmin />} />
                <Route path="estoque" element={<AdminEstoque />} />
                <Route path="pagamentos" element={<PaymentsAdmin />} />
                <Route path="config" element={<AdminConfig />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
        <Toasts />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
