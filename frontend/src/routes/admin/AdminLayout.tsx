import { NavLink, Outlet } from 'react-router-dom';
import Protected from '../Protected';
import { useAuth } from '../../services/auth';
import { ForbiddenPage } from '../RouteStates';

function ProtectedAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading, capabilities } = useAuth();
  if (loading)
    return (
      <div className="p-6 text-muted" role="status" aria-live="polite">
        Loading admin area…
      </div>
    );
  if (!user) return <Protected>{children}</Protected>;
  if (!capabilities.includes('admin:access')) return <ForbiddenPage />;
  return <>{children}</>;
}

export default function AdminLayout() {
  return (
    <ProtectedAdmin>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <nav
          aria-label="Admin navigation"
          className="flex flex-wrap gap-2 border-b border-border pb-4"
        >
          <NavLink
            className={({ isActive }) =>
              `nav-link rounded-md px-3 py-2 ${isActive ? 'bg-surface-muted font-semibold text-ink' : ''}`
            }
            to="/admin/dashboard"
          >
            Dashboard
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `nav-link rounded-md px-3 py-2 ${isActive ? 'bg-surface-muted font-semibold text-ink' : ''}`
            }
            to="/admin/events"
          >
            Events
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `nav-link rounded-md px-3 py-2 ${isActive ? 'bg-surface-muted font-semibold text-ink' : ''}`
            }
            to="/admin/users"
          >
            Users
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `nav-link rounded-md px-3 py-2 ${isActive ? 'bg-surface-muted font-semibold text-ink' : ''}`
            }
            to="/admin/periods"
          >
            Periods
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `nav-link rounded-md px-3 py-2 ${isActive ? 'bg-surface-muted font-semibold text-ink' : ''}`
            }
            to="/admin/metadata"
          >
            Metadata
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `nav-link rounded-md px-3 py-2 ${isActive ? 'bg-surface-muted font-semibold text-ink' : ''}`
            }
            to="/admin/labels"
          >
            Labels
          </NavLink>
        </nav>
        <Outlet />
      </div>
    </ProtectedAdmin>
  );
}
