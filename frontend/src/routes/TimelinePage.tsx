import { Navigate } from 'react-router-dom';

export default function TimelinePage() {
  return <Navigate to="/explore?kind=month" replace />;
}
