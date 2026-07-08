import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Pipeline from './pages/Pipeline';
import History from './pages/History';
import GlobalNavbar from './components/GlobalNavbar';
import GlobalFooter from './components/GlobalFooter';

// Wrapper that hides navbar/footer on full-screen routes
function Layout() {
  const location = useLocation();
  const hideChrome = location.pathname === '/app' || location.pathname === '/login';

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {!hideChrome && <GlobalNavbar />}
      <div className="flex-1 flex flex-col relative z-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<><Home /><Login /></>} />

          {/* Protected */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <Pipeline />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!hideChrome && <GlobalFooter />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout />
      </Router>
    </AuthProvider>
  );
}

export default App;
