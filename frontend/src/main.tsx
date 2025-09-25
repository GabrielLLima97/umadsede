import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import App from "./App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import Pedidos from "./pages/Pedidos"; // não usado
import ClientOrder from "./pages/ClientOrder";
import MyOrders from "./pages/MyOrders";
import Toasts from "./components/Toasts";
import Cozinha from "./pages/Cozinha";
import TV from "./pages/TV";
import Status from "./pages/Status";
import ItemsAdmin from "./pages/ItemsAdmin";
import PaymentsAdmin from "./pages/PaymentsAdmin";
import AdminShell from "./components/admin/AdminShell";
import AdminVendas from "./pages/AdminVendas";
import AdminEstoque from "./pages/AdminEstoque";
import AdminRelatorio from "./pages/AdminRelatorio";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
        <Toasts />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
