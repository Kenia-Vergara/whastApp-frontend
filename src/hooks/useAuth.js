import { useState, useEffect, useCallback } from 'react';
import { AUTH_CONFIG } from '../config/auth.config.js';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5111";

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const validateToken = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}${AUTH_CONFIG.ENDPOINTS.VALIDATE}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        console.log('Token expirado o inválido');
        return false;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUser(data.user);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error validando token:', error);
      return false;
    }
  }, []);

  // Verificar estado de autenticación
  const checkAuthStatus = useCallback(async () => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (!token || !userData) {
      setIsAuthenticated(false);
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      const isValid = await validateToken(token);

      if (isValid) {
        setUser(parsedUser);
        setIsAuthenticated(true);
      } else {
        //limpiar localStorage
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setIsAuthenticated(false);
        setUser(null);
        console.log('Sesión expirada, redirigiendo al login');
      }
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [validateToken]);

  // Iniciar sesión
  const login = useCallback((loginData) => {
    const userData = {
      username: loginData.username,
      role: loginData.role,
    };

    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", loginData.token);

    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  // Cerrar sesión
  const logout = useCallback(() => {
    setIsLoading(true);
    setIsAuthenticated(false);
    setUser(null);

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setTimeout(() => {
      setIsLoading(false);
    }, 100);
  }, []);

  // Verificar token periódicamente
  useEffect(() => {
    checkAuthStatus();

    // Verificar token según el intervalo configurado
    const interval = setInterval(() => {
      if (isAuthenticated) {
        const token = localStorage.getItem("token");
        if (token) {
          validateToken(token).then(isValid => {
            if (!isValid) {
              console.log('Token expirado durante verificación periódica');
              logout();
            }
          });
        }
      }
    }, AUTH_CONFIG.TOKEN_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [checkAuthStatus, isAuthenticated, validateToken, logout]);

  return {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout,
    checkAuthStatus
  };
};
