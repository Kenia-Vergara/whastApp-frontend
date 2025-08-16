import { useState, useEffect, useRef, useCallback } from 'react';
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  // Estados principales
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
  const [socketConnected, setSocketConnected] = useState(false);

  // Referencias
  const countdownRef = useRef(null);
  const socketRef = useRef(null);
  const lastQRUpdateRef = useRef(null);
  const mountedRef = useRef(true);

  // URL base simulada (reemplaza con tu URL real)
  const API_BASE_URL = 'https://api.tudominio.com';

  // Función simulada de WebSocket (reemplaza con socket.io real)
  const connectWebSocket = useCallback(() => {
    try {
      console.log('🔌 Conectando WebSocket...');
      
      // Simulación de conexión WebSocket
      const connectSocket = () => {
        setSocketConnected(true);
        console.log('✅ WebSocket conectado');
        
        if (user?.userId) {
          console.log('👤 Uniéndose a canal de usuario:', user.userId);
        }
        
        // Simular obtención de estado inicial
        setTimeout(() => {
          handleStatusUpdate({
            hasActiveQR: false,
            isConnected: false,
            qrInfo: null,
            actions: null
          });
        }, 1000);
      };

      // Simular delay de conexión
      setTimeout(connectSocket, 500);

      // Simular reconexión en caso de desconexión
      const reconnectInterval = setInterval(() => {
        if (!socketRef.current && mountedRef.current) {
          console.log('🔄 Reintentando conexión WebSocket...');
          connectSocket();
        }
      }, 10000);

      socketRef.current = {
        connected: true,
        disconnect: () => {
          clearInterval(reconnectInterval);
          setSocketConnected(false);
          socketRef.current = null;
          console.log('❌ WebSocket desconectado');
        },
        emit: (event, data) => {
          console.log('📤 Emitiendo:', event, data);
        }
      };

    } catch (error) {
      console.error('❌ Error al conectar WebSocket:', error);
      setError('Error al conectar con el servidor');
      setSocketConnected(false);
    }
  }, [user?.userId]);

  // Función para desconectar WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (socketRef.current && typeof socketRef.current.disconnect === 'function') {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocketConnected(false);
  }, []);

  // Manejar actualizaciones de estado
  const handleStatusUpdate = useCallback((data) => {
    if (!mountedRef.current) return;

    console.log('📊 Actualizando estado:', data);
    
    setConnectionStatus({
      hasActiveQR: data.hasActiveQR || false,
      isConnected: data.isConnected || false,
      qrInfo: data.qrInfo || null,
      actions: data.actions || null
    });
    
    setTokenExpired(false);
    setError('');
    
    if (data.hasActiveQR && data.qrInfo) {
      handleQRUpdate(data.qrInfo);
    } else {
      setQrData(null);
      stopCountdown();
      setTimeRemaining(0);
    }
  }, []);

  // Manejar actualizaciones del QR
  const handleQRUpdate = useCallback((qrInfo) => {
    if (!mountedRef.current || !qrInfo || !qrInfo.image) return;
    
    // Evitar actualizaciones duplicadas
    if (lastQRUpdateRef.current === qrInfo.image) {
      console.log('⏭️ QR ya actualizado, saltando...');
      return;
    }
    
    console.log('🆕 Actualizando QR con nueva información');
    
    const newQRData = {
      qrCode: qrInfo.image,
      expiresAt: qrInfo.expiresAt || Date.now() + 60000, // Default 1 minuto
      createdAt: qrInfo.createdAt || Date.now()
    };
    
    setQrData(newQRData);
    lastQRUpdateRef.current = qrInfo.image;
    
    // Calcular tiempo restante
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

  // Función mejorada para llamadas a API
  const apiCall = useCallback(async (url, options = {}) => {
    const token = user?.token || 'mock-token';
    
    if (!token) {
      setTokenExpired(true);
      setError('No hay token de autenticación');
      throw new Error('No token available');
    }

    try {
      console.log('🌐 API Call:', url, options.method || 'GET');
      
      // Simular llamada a API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simular respuestas según el endpoint
      if (url.includes('/api/qr-code')) {
        return {
          success: true,
          hasActiveQR: true,
          qrInfo: {
            image: generateMockQR(),
            expiresAt: Date.now() + 60000,
            createdAt: Date.now()
          }
        };
      } else if (url.includes('/api/qr-request')) {
        return {
          success: true,
          message: 'QR solicitado correctamente'
        };
      } else if (url.includes('/api/qr-expire')) {
        return {
          success: true,
          message: 'QR expirado correctamente'
        };
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error en API:', error);
      throw error;
    }
  }, [user]);

  // Generar QR simulado
  const generateMockQR = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    
    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 200, 200);
    
    // Patrón simple de QR
    ctx.fillStyle = '#000000';
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20; j++) {
        if (Math.random() > 0.5) {
          ctx.fillRect(i * 10, j * 10, 10, 10);
        }
      }
    }
    
    return canvas.toDataURL();
  };

  // Obtener código QR
  const getQRCode = useCallback(async () => {
    if (loading || !mountedRef.current) return;
    
    console.log('🔍 Obteniendo QR...');
    setLoading(true);
    setError('');
    
    try {
      const data = await apiCall('/api/qr-code');
      console.log('🔍 Respuesta QR:', data);
      
      if (data.success && mountedRef.current) {
        handleQRUpdate(data.qrInfo);
      } else if (mountedRef.current) {
        setError('No se pudo obtener el código QR');
      }
    } catch (err) {
      console.error('❌ Error al obtener QR:', err);
      if (!tokenExpired && mountedRef.current) {
        setError(`Error al obtener QR: ${err.message}`);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiCall, tokenExpired, loading, handleQRUpdate]);

  // Solicitar nuevo QR
  const requestNewQR = useCallback(async () => {
    if (loading || !mountedRef.current) return;
    
    console.log('🆕 Solicitando nuevo QR...');
    setLoading(true);
    setError('');
    
    // Limpiar estado anterior
    setQrData(null);
    stopCountdown();
    setTimeRemaining(0);
    lastQRUpdateRef.current = null;
    
    try {
      await apiCall('/api/qr-request', { method: 'POST' });
      console.log('🆕 Nuevo QR solicitado, esperando actualización...');
      
      // Simular recepción de QR después de un delay
      setTimeout(() => {
        if (!qrData?.qrCode && mountedRef.current) {
          console.log('⏰ Timeout, obteniendo QR manualmente...');
          getQRCode();
        }
      }, 2000);
      
    } catch (err) {
      console.error('❌ Error al solicitar QR:', err);
      if (!tokenExpired && mountedRef.current) {
        setError(`Error al solicitar QR: ${err.message}`);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiCall, tokenExpired, loading, getQRCode, qrData]);

  // Expirar QR manualmente
  const expireQR = useCallback(async () => {
    if (loading || !mountedRef.current) return;
    
    try {
      await apiCall('/api/qr-expire', { method: 'POST' });
      console.log('💥 QR expirado manualmente');
      
      if (mountedRef.current) {
        setQrData(null);
        stopCountdown();
        setTimeRemaining(0);
        lastQRUpdateRef.current = null;
      }
      
    } catch (err) {
      console.error('❌ Error al expirar QR:', err);
      if (!tokenExpired && mountedRef.current) {
        setError(`Error al expirar QR: ${err.message}`);
      }
    }
  }, [apiCall, tokenExpired, loading]);

  // Iniciar contador
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
        
        if (newTime <= 0) {
          console.log('⏰ Contador terminado');
          stopCountdown();
          if (mountedRef.current) {
            setQrData(null);
            lastQRUpdateRef.current = null;
          }
          return 0;
        }
        return newTime;
      });
    }, 1000);
  }, []);

  // Detener contador
  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      console.log('⏰ Deteniendo contador');
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Formatear tiempo
  const formatTime = useCallback((seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    
    let className = 'time-normal';
    if (seconds <= 10) className = 'time-critical';
    else if (seconds <= 30) className = 'time-warning';
    
    return { timeString, className };
  }, []);

  // Obtener porcentaje de tiempo
  const getTimePercentage = useCallback((seconds, total = 60) => {
    return Math.max(0, Math.min(100, (seconds / total) * 100));
  }, []);

  // Manejar logout
  const handleLogout = useCallback(() => {
    mountedRef.current = false;
    stopCountdown();
    disconnectWebSocket();
    onLogout();
  }, [stopCountdown, disconnectWebSocket, onLogout]);

  // Skeleton de carga
  const renderLoadingSkeleton = () => (
    <div className="qr-skeleton">
      <div className="skeleton-content">
        <div className="skeleton-qr-image">
          <div className="skeleton-qr-placeholder">
            <div className="loading-dots">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
            <p>Generando código QR...</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Renderizar contenido principal
  const renderContent = () => {
    if (loading) {
      return renderLoadingSkeleton();
    }

    if (tokenExpired) {
      return (
        <div className="status-card token-expired">
          <div className="status-icon">🔒</div>
          <h3>Sesión Expirada</h3>
          <p>Su sesión ha expirado. Por favor, inicie sesión nuevamente.</p>
          <button onClick={handleLogout} className="btn btn-primary">
            Volver a Iniciar Sesión
          </button>
        </div>
      );
    }

    if (connectionStatus.isConnected) {
      return (
        <div className="status-card connected">
          <div className="status-icon">✅</div>
          <h3>WhatsApp Conectado</h3>
          <p>Tu cuenta de WhatsApp está conectada y funcionando correctamente.</p>
          <div className="actions">
            <button onClick={getQRCode} className="btn btn-secondary">
              🔄 Actualizar Estado
            </button>
          </div>
        </div>
      );
    }

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
              onError={() => setError('Error al cargar la imagen del QR')}
            />
            <div className="qr-overlay">
              <div className={`time-overlay ${className}`}>
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
                />
              </div>
              <div className={`time-display ${className}`}>
                <span>Tiempo restante: {timeString}</span>
              </div>
            </div>
            
            <div className="qr-details">
              <div className="detail-row">
                <span>Expira:</span>
                <span>{new Date(qrData.expiresAt).toLocaleTimeString()}</span>
              </div>
              <div className="detail-row">
                <span>Generado:</span>
                <span>{new Date(qrData.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>
            
            <div className="actions">
              <button 
                onClick={expireQR} 
                className="btn btn-danger"
                disabled={loading}
              >
                🔥 Expirar QR
              </button>
              <button 
                onClick={getQRCode} 
                className="btn btn-secondary"
                disabled={loading}
              >
                🔄 Actualizar
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="status-card error">
          <div className="status-icon">⚠️</div>
          <h3>Error</h3>
          <p>{error}</p>
          <div className="actions">
            <button onClick={() => setError('')} className="btn btn-secondary">
              Descartar
            </button>
            <button onClick={getQRCode} className="btn btn-primary">
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="status-card no-qr">
        <div className="status-icon">📱</div>
        <h3>Código QR no disponible</h3>
        <p>Genera un nuevo código QR para conectar tu WhatsApp.</p>
        
        <div className="actions">
          <button 
            onClick={requestNewQR} 
            className="btn btn-primary" 
            disabled={loading}
          >
            {loading ? 'Generando...' : '🔄 Generar Código QR'}
          </button>
          <button 
            onClick={getQRCode} 
            className="btn btn-secondary" 
            disabled={loading}
          >
            🔍 Verificar Estado
          </button>
        </div>
      </div>
    );
  };

  // Effect principal
  useEffect(() => {
    mountedRef.current = true;
    connectWebSocket();
    
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        requestNewQR();
      }
    }, 1000);
    
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      stopCountdown();
      disconnectWebSocket();
    };
  }, []);

  // Effect para reconexión de usuario
  useEffect(() => {
    if (user?.userId && socketRef.current?.connected) {
      socketRef.current.emit('join-user', user.userId);
    }
  }, [user?.userId]);

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="brand">
            <h1>📱 WhatsApp Service</h1>
            <span className="version">Dashboard v3.1 - Corregido</span>
          </div>
          <div className="connection-indicator">
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
            <span className="username">{user?.username || 'Usuario'}</span>
            <span className="role">({user?.role || 'user'})</span>
          </div>
          <button onClick={handleLogout} className="btn btn-logout">
            🚪 Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="main-content">
        <div className="qr-section">
          <div className="section-header">
            <h2>🔐 Autenticación WhatsApp</h2>
            <p>Escanea el código QR con la cámara de tu teléfono desde WhatsApp</p>
            <div className="websocket-indicator">
              <span className={socketConnected ? 'connected' : 'disconnected'}>
                {socketConnected ? '🟢' : '🔴'} WebSocket: {socketConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
          
          <div className="content-area">
            {renderContent()}
          </div>
        </div>

        <div className="info-section">
          <h3>📋 Instrucciones</h3>
          <ol className="instructions">
            <li>Abre WhatsApp en tu teléfono</li>
            <li>Ve a Configuración → Dispositivos vinculados</li>
            <li>Toca "Vincular un dispositivo"</li>
            <li>Escanea el código QR mostrado</li>
          </ol>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-info">
          <span>Actualizado: {new Date().toLocaleTimeString()}</span>
          <span>Tiempo: {formatTime(timeRemaining).timeString}</span>
          <span>WS: {socketConnected ? '🟢' : '🔴'}</span>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;