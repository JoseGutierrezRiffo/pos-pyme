import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { BusinessSelector } from './BusinessSelector';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Layout principal del admin: sidebar fijo a la izquierda + contenido a la derecha.
 */
export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 min-w-0 lg:ml-0">
        {/* Top bar con BusinessSelector y NotificationBell */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
          <BusinessSelector />
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
