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
const AdminRelatorio = lazy(() => import("./pages/AdminRelatorio"));

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
              <Route path="/cozinha" element={<Cozinha />} />
              <Route path="/tv" element={<TV />} />
              <Route path="/status/:id" element={<Status />} />
              <Route path="/cliente/pedidos" element={<MyOrders />} />
              <Route path="/admin" element={<AdminShell />}>
                <Route path="itens" element={<ItemsAdmin />} />
                <Route path="pagamentos" element={<PaymentsAdmin />} />
                <Route path="vendas" element={<AdminVendas />} />
                <Route path="estoque" element={<AdminEstoque />} />
                <Route path="relatorio" element={<AdminRelatorio />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
        <Toasts />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
