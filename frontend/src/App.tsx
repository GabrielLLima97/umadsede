import { Outlet, Link, useLocation } from "react-router-dom";
export default function App(){
  const loc = useLocation();
  const isWide = loc.pathname.startsWith("/cozinha") || loc.pathname.startsWith("/tv");
  const isClient = loc.pathname.startsWith("/cliente");
  const isStatus = loc.pathname.startsWith("/status");
  const isAdmin = loc.pathname.startsWith("/admin");

  if (isAdmin) {
    return <Outlet />;
  }

  return (
    <div className={isWide || isClient ? "w-full p-0" : "max-w-6xl mx-auto p-4"}>
      {!isClient && (
        <header className={`flex items-center ${isStatus?"justify-center":"justify-between"} p-4`}>
          <img src="/logo.png" alt="UMADSEDE" className={isStatus?"h-20":"h-14"} />
        </header>
      )}
      <Outlet />
      {!isClient && (
        <footer className="mt-8">
          <img src="/linhas.png" alt="decoração" className="w-full max-w-6xl mx-auto select-none pointer-events-none" />
        </footer>
      )}
    </div>
  );
}
