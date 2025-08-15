import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './Dashboard.css';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL;

const Dashboard = ({ user, onLogout }) => {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    hasActiveQR: false,
    isConnected: false,
    qrInfo: null,
    actions: null
  });
  
  // Referencias para los timers y socket
  const countdownRef = useRef(null);
  const socketRef = useRef(null);
  const lastQRUpdateRef = useRef(null);

  // Función para conectar al WebSocket
  const connectWebSocket = useCallback(() => {
    try {
      socketRef.current = io(API_BASE_URL, {
        transports: ['websocket', 'polling'],
        auth: {
          token: localStorage.getItem('token')
        }
      });

      socketRef.current.on('connect', () => {
        console.log('✅ WebSocket conectado');
        if (user?.userId) {
          socketRef.current.emit('join-user', user.userId);
        }
        socketRef.current.emit('get-initial-status');
      });

      socketRef.current.on('disconnect', () => {
        console.log('❌ WebSocket desconectado');
      });

      // Evento principal para actualizaciones de estado
      socketRef.current.on('qr-status-update', (data) => {
        console.log(' Estado actualizado:', data);
        handleStatusUpdate(data);
      });

      // Evento para QR actualizado
      socketRef.current.on('qr-updated', (data) => {
        console.log('🆕 QR actualizado:', data);
        if (data.qrInfo) {
          handleQRUpdate(data.qrInfo);
        }
      });

      socketRef.current.on('error', (error) => {
        console.error('❌ Error WebSocket:', error);
        setError('Error de conexión en tiempo real');
      });

    } catch (error) {
      console.error('❌ Error al conectar WebSocket:', error);
      setError('Error al conectar con el servidor');
    }
  }, [user?.userId]);

  // Función centralizada para manejar actualizaciones de estado
  const handleStatusUpdate = useCallback((data) => {
    setConnectionStatus({
      hasActiveQR: data.hasActiveQR,
      isConnected: data.isConnected,
      qrInfo: data.qrInfo || null,
      actions: data.actions || null
    });
    
    setTokenExpired(false);
    setError('');
    
    if (data.hasActiveQR && data.qrInfo) {
      handleQRUpdate(data.qrInfo);
    } else {
      // No hay QR activo
      setQrData(null);
      stopCountdown();
      setTimeRemaining(0);
    }
  }, []);

  // Función centralizada para manejar actualizaciones del QR
  const handleQRUpdate = useCallback((qrInfo) => {
    if (!qrInfo || !qrInfo.image) return;
    
    // Evitar actualizaciones duplicadas
    if (lastQRUpdateRef.current === qrInfo.image) {
      console.log(' QR ya actualizado, saltando...');
      return;
    }
    
    console.log('🆕 Actualizando QR con nueva información');
    
    const newQRData = {
      qrCode: qrInfo.image,
      expiresAt: qrInfo.expiresAt,
      createdAt: qrInfo.createdAt
    };
    
    setQrData(newQRData);
    lastQRUpdateRef.current = qrInfo.image;
    
    // Calcular tiempo restante basado en expiresAt
    if (qrInfo.expiresAt) {
      const now = Date.now();
      const expiresAt = new Date(qrInfo.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      
      console.log(`⏰ Tiempo restante calculado: ${remaining}s`);
      setTimeRemaining(remaining);
      
      if (remaining > 0) {
        startCountdown(remaining);
      } else {
        stopCountdown();
        setQrData(null);
      }
    }
  }, []);

  // Función para desconectar WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // Función mejorada para hacer llamadas a la API
  const apiCall = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      setTokenExpired(true);
      setError('No hay token de autenticación');
      throw new Error('No token available');
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (response.status === 401) {
      setTokenExpired(true);
      setError('Token expirado. Por favor, inicie sesión nuevamente.');
      throw new Error('Token expired');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Error en la respuesta del servidor');
    }

    return data;
  }, []);

  // Función para obtener el QR
  const getQRCode = useCallback(async () => {
    if (loading) return;
    
    console.log('🔍 Obteniendo QR...');
    setLoading(true);
    setError('');
    
    try {
      const data = await apiCall('/api/qr-code');
      console.log('🔍 Respuesta QR:', data);
      
      if (data.qrInfo) {
        handleQRUpdate(data.qrInfo);
      } else {
        setError('No se pudo obtener el código QR');
      }
    } catch (err) {
      console.error('❌ Error al obtener QR:', err);
      if (!tokenExpired) {
        setError(`Error al obtener QR: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall, tokenExpired, loading, handleQRUpdate]);

  // Función para solicitar un nuevo QR
  const requestNewQR = useCallback(async () => {
    if (loading) return;
    
    console.log('🆕 Solicitando nuevo QR...');
    setLoading(true);
    setError('');
    
    try {
      await apiCall('/api/qr-request', { method: 'POST' });
      console.log('🆕 Nuevo QR solicitado, esperando actualización...');
      
      // El WebSocket debería enviar la actualización
      // Si no llega en 3 segundos, intentar obtener manualmente
      setTimeout(() => {
        if (!qrData?.qrCode) {
          console.log('⏰ Timeout, obteniendo QR manualmente...');
          getQRCode();
        }
      }, 3000);
      
    } catch (err) {
      console.error('❌ Error al solicitar QR:', err);
      if (!tokenExpired) {
        setError(`Error al solicitar QR: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall, tokenExpired, loading, getQRCode, qrData]);

  // Función para expirar manualmente el QR
  const expireQR = useCallback(async () => {
    if (loading) return;
    
    try {
      await apiCall('/api/qr-expire', { method: 'POST' });
      console.log(' QR expirado manualmente');
      
      setQrData(null);
      stopCountdown();
      setTimeRemaining(0);
      lastQRUpdateRef.current = null;
      
    } catch (err) {
      console.error('❌ Error al expirar QR:', err);
      if (!tokenExpired) {
        setError(`Error al expirar QR: ${err.message}`);
      }
    }
  }, [apiCall, tokenExpired, loading]);

  // Función mejorada para iniciar el contador
  const startCountdown = useCallback((initialTime) => {
    stopCountdown();
    
    if (initialTime <= 0) {
      console.log('⏰ Tiempo inicial inválido, no iniciando contador');
      return;
    }
    
    console.log(`⏰ Iniciando contador con ${initialTime}s`);
    setTimeRemaining(initialTime);
    
    countdownRef.current = setInterval(() => {
      setTimeRemaining(prevTime => {
        const newTime = prevTime - 1;
        console.log(`⏰ Contador: ${newTime}s`);
        
        if (newTime <= 0) {
          console.log('⏰ Contador terminado');
          stopCountdown();
          setQrData(null);
          lastQRUpdateRef.current = null;
          return 0;
        }
        return newTime;
      });
    }, 1000);
  }, []);

  // Función para detener el contador
  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      console.log('⏰ Deteniendo contador');
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Función para formatear tiempo
  const formatTime = useCallback((seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    
    let className = 'time-normal';
    if (seconds <= 10) className = 'time-critical';
    else if (seconds <= 30) className = 'time-warning';
    
    return { timeString, className };
  }, []);

  // Función para obtener el porcentaje de tiempo
  const getTimePercentage = useCallback((seconds, total = 60) => {
    return Math.max(0, Math.min(100, (seconds / total) * 100));
  }, []);

  // Función para regresar al login
  const handleReturnToLogin = useCallback(() => {
    stopCountdown();
    disconnectWebSocket();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  }, [stopCountdown, disconnectWebSocket, onLogout]);

  // Función simplificada para renderizar el contenido
  const renderContent = () => {
    // 1. Loading state
    if (loading) {
      return (
        <div className="loading">
          <div className="spinner"></div>
          <p>Procesando...</p>
        </div>
      );
    }

    // 2. Token expired
    if (tokenExpired) {
      return (
        <div className="token-expired">
          <div className="status-icon">🔒</div>
          <h3>Sesión Expirada</h3>
          <p>Su sesión ha expirado. Por favor, inicie sesión nuevamente.</p>
          <button onClick={handleReturnToLogin} className="return-login-button">
            Volver a Iniciar Sesión
          </button>
        </div>
      );
    }

    // 3. WhatsApp conectado
    if (connectionStatus.isConnected) {
      return (
        <div className="connected-status">
          <div className="status-icon">✅</div>
          <h3>WhatsApp Conectado</h3>
          <p>Tu cuenta de WhatsApp está conectada y funcionando correctamente.</p>
          <div className="connected-actions">
            <button onClick={getQRCode} className="refresh-button">
              🔄 Actualizar Estado
            </button>
          </div>
        </div>
      );
    }

    // 4. QR disponible
    if (qrData?.qrCode) {
      const { timeString, className } = formatTime(timeRemaining);
      const percentage = getTimePercentage(timeRemaining);
      
      return (
        <div className="qr-container">
          <div className="qr-image-wrapper">
            <img 
              src={qrData.qrCode} 
              alt="Código QR de WhatsApp" 
              className="qr-image"
              onError={(e) => {
                console.error('❌ Error cargando QR:', e);
                setError('Error al cargar la imagen del QR');
              }}
            />
            <div className="qr-overlay">
              <div className={`time-remaining-overlay ${className}`}>
                {timeString}
              </div>
            </div>
          </div>
          
          <div className="qr-info">
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <div className={`time-display ${className}`}>
                <span className="time-label">Tiempo restante:</span>
                <span className="time-value">{timeString}</span>
              </div>
            </div>
            
            <div className="qr-details">
              <div className="detail-item">
                <span className="detail-label">Expira a las:</span>
                <span className="detail-value">
                  {new Date(qrData.expiresAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Generado a las:</span>
                <span className="detail-value">
                  {new Date(qrData.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
            
            <div className="qr-actions">
              <button 
                onClick={expireQR} 
                className="expire-button"
                disabled={loading}
              >
                🔥 Expirar Qr
              </button>
              <button 
                onClick={getQRCode} 
                className="refresh-button"
                disabled={loading}
              >
                🔄 Actualizar
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 5. Error state
    if (error) {
      return (
        <div className="error-message">
          <div className="status-icon">⚠️</div>
          <h3>Error</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={() => setError('')} className="dismiss-error-button">
              Descartar
            </button>
            <button onClick={getQRCode} className="retry-button">
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    // 6. Estado por defecto: no hay QR
    return (
      <div className="no-qr">
        <div className="status-icon">📱</div>
        <h3>Código QR no disponible</h3>
        <p>Genera un nuevo código QR para conectar tu WhatsApp.</p>
        
        <div className="action-buttons">
          <button 
            onClick={requestNewQR} 
            className="generate-button" 
            disabled={loading}
          >
            {loading ? 'Generando...' : '🔄 Generar Código QR'}
          </button>
          <button 
            onClick={getQRCode} 
            className="check-status-button" 
            disabled={loading}
          >
            🔍 Verificar Estado
          </button>
        </div>
      </div>
    );
  };

  // Efecto principal para inicialización
  useEffect(() => {
    connectWebSocket();
    
    // Obtener QR inicial después de un delay
    const timer = setTimeout(() => {
      getQRCode();
    }, 1000);
    
    return () => {
      clearTimeout(timer);
      stopCountdown();
      disconnectWebSocket();
    };
  }, []);

  // Efecto para reconectar si cambia el usuario
  useEffect(() => {
    if (user?.userId && socketRef.current?.connected) {
      socketRef.current.emit('join-user', user.userId);
    }
  }, [user?.userId]);

  const handleLogout = useCallback(() => {
    stopCountdown();
    disconnectWebSocket();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  }, [stopCountdown, disconnectWebSocket, onLogout]);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="brand">
            <h1>📱 WhatsApp Service</h1>
            <span className="version">Dashboard v3.0 - Lógica Mejorada</span>
          </div>
          <div className="connection-status">
            <span className="status-label">Estado:</span>
            {connectionStatus.isConnected ? (
              <span className="status connected">✅ Conectado</span>
            ) : connectionStatus.hasActiveQR ? (
              <span className="status qr-active">🔄 QR Activo</span>
            ) : (
              <span className="status disconnected">❌ Desconectado</span>
            )}
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <div className="user-details">
              <span className="username">{user.username}</span>
              <span className="role">({user.role})</span>
            </div>
            <div className="user-avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            🚪 Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="dashboard-main">
        <div className="qr-section">
          <div className="section-header">
            <h2>🔐 Autenticación WhatsApp</h2>
            <p className="section-description">
              Escanea el código QR con la cámara de tu teléfono desde la aplicación de WhatsApp
            </p>
            <div className="websocket-status">
              <span className="status-indicator">
                {socketRef.current?.connected ? '🟢' : '🔴'} WebSocket: 
                {socketRef.current?.connected ? ' Conectado' : ' Desconectado'}
              </span>
            </div>
          </div>
          
          <div className="qr-content">
            {renderContent()}
          </div>
        </div>

        {/* Información adicional */}
        <div className="info-section">
          <h3>📋 Instrucciones</h3>
          <ol className="instructions-list">
            <li>Abre WhatsApp en tu teléfono</li>
            <li>Ve a Configuración → Dispositivos vinculados</li>
            <li>Toca "Vincular un dispositivo"</li>
            <li>Escanea el código QR mostrado arriba</li>
          </ol>
          
          <div className="websocket-info">
            <h4>🔄 Conexión en Tiempo Real</h4>
            <p>Este dashboard usa WebSocket para actualizaciones automáticas. 
            Los cambios se reflejan instantáneamente.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        <div className="footer-info">
          <span>Última actualización: {new Date().toLocaleTimeString()}</span>
          <span>Tiempo restante: {formatTime(timeRemaining).timeString}</span>
          <span>WebSocket: {socketRef.current?.connected ? '🟢 Activo' : '🔴 Inactivo'}</span>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;