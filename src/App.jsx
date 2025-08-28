import { useEffect } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import { useAuth } from "./hooks/useAuth";
import { createApiInterceptor, restoreOriginalFetch } from "./utils/apiInterceptor";
import "./App.css";

function App() {
  const { isAuthenticated, user, isLoading, login, logout } = useAuth();
  useEffect(() => {
    createApiInterceptor(logout);
    return () => {
      restoreOriginalFetch();
    };
  }, [logout]);

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
        }}
      >
        Cargando...
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Dashboard user={user} onLogout={logout} />;
  }

  return <Login onLoginSuccess={login} />;
}

export default App;
