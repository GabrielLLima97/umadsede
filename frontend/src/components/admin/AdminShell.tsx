import { Outlet } from "react-router-dom";

export default function AdminShell(){
  return (
    <div className="w-full min-h-screen bg-cream">
      <main className="p-6 min-h-screen">
        <Outlet />
        <footer className="mt-8">
          <img src="/linhas.png" alt="decoração" className="w-full select-none pointer-events-none" />
        </footer>
      </main>
    </div>
  );
}
