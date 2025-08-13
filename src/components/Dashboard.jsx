import { useState, useEffect, useRef } from 'react';
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {

  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrStatus, setQrStatus] = useState('waiting');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [tokenExpired, setTokenExpired] = useState(false);
  
  // Referencias para los timers
  const countdownRef = useRef(null);
  const statusIntervalRef = useRef(null);

  // Función para verificar si el error es de token expirado
  const isTokenExpiredError = (errorMessage) => {
    return errorMessage.includes('token') || 
           errorMessage.includes('unauthorized') || 
           errorMessage.includes('401') ||
           errorMessage.includes('jwt');
  };

  // Función para obtener el estado del QR
  const getQRStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No hay token de autenticación');
        setTokenExpired(true);
        return;
      }

      const response = await fetch('http://localhost:5111/api/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 401) {
        setTokenExpired(true);
        setError('Token expirado. Por favor, inicie sesión nuevamente.');
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setQrStatus(data.qrStatus?.status || 'waiting');
        setTokenExpired(false);
      }
    } catch (err) {
      console.error('Error al obtener estado:', err);
      if (isTokenExpiredError(err.message)) {
        setTokenExpired(true);
      }
    }
  };

  // Función para obtener el QR
  const getQRCode = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No hay token de autenticación');
        setTokenExpired(true);
        return;
      }

      const response = await fetch('http://localhost:5111/api/qr-code', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 401) {
        setTokenExpired(true);
        setError('Token expirado. Por favor, inicie sesión nuevamente.');
        stopCountdown();
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setQrData(data);
        setQrStatus('active');
        setTokenExpired(false);
        // Iniciar el contador en tiempo real
        startCountdown(data.timeRemaining);
      } else {
        // Si no hay QR disponible, intentar solicitar uno nuevo
        if (data.status === 'waiting' || data.message?.includes('no disponible')) {
          console.log('QR no disponible, solicitando uno nuevo...');
          setQrStatus('waiting');
          // Esperar un poco y solicitar nuevo QR
          setTimeout(() => {
            requestNewQR();
          }, 2000);
        } else {
          setError(data.message || 'Error al obtener el QR');
          setQrStatus(data.status || 'error');
        }
        stopCountdown();
      }
    } catch (err) {
      if (isTokenExpiredError(err.message)) {
        setTokenExpired(true);
        setError('Token expirado. Por favor, inicie sesión nuevamente.');
      } else {
        setError('Error de conexión al obtener el QR');
      }
      console.error('Error completo:', err);
      stopCountdown();
    } finally {
      setLoading(false);
    }
  };

  // Función para solicitar un nuevo QR
  const requestNewQR = async () => {
    setLoading(true);
    setError('');
    setQrStatus('waiting');
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No hay token de autenticación');
        setTokenExpired(true);
        return;
      }

      console.log('Solicitando nuevo QR...');
      
      const response = await fetch('http://localhost:5111/api/qr-request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 401) {
        setTokenExpired(true);
        setError('Token expirado. Por favor, inicie sesión nuevamente.');
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setError('');
        console.log('Nuevo QR solicitado exitosamente, esperando generación...');
        // Esperar un poco más para que se genere el QR
        setTimeout(() => {
          getQRCode();
        }, 8000);
      } else {
        console.log('Error al solicitar nuevo QR:', data.message);
        setError(data.message || 'Error al solicitar nuevo QR');
        // Si no se puede solicitar, intentar obtener el QR existente
        setTimeout(() => {
          getQRCode();
        }, 5000);
      }
    } catch (err) {
      if (isTokenExpiredError(err.message)) {
        setTokenExpired(true);
        setError('Token expirado. Por favor, inicie sesión nuevamente.');
      } else {
        setError('Error de conexión al solicitar nuevo QR');
      }
      console.error('Error completo:', err);
      // Intentar obtener QR existente en caso de error
      setTimeout(() => {
        getQRCode();
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  // Función para iniciar el contador en tiempo real
  const startCountdown = (initialTime) => {
    // Limpiar contador anterior si existe
    stopCountdown();
    
    setTimeRemaining(initialTime);
    
    countdownRef.current = setInterval(() => {
      setTimeRemaining(prevTime => {
        if (prevTime <= 1) {
          // El QR ha expirado
          stopCountdown();
          setQrStatus('expired');
          setQrData(null);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  // Función para detener el contador
  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setTimeRemaining(0);
  };

  // Función para formatear el tiempo en formato MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Función para regresar al login
  const handleReturnToLogin = () => {
    stopCountdown();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  };

  // Obtener estado y QR al cargar el componente
  useEffect(() => {
    getQRStatus();
    getQRCode();
    
    // Actualizar estado cada 30 segundos
    statusIntervalRef.current = setInterval(() => {
      getQRStatus();
      if (qrStatus === 'active' && !countdownRef.current) {
        // Si el estado es activo pero no hay contador, obtener QR
        getQRCode();
      }
    }, 30000);
    
    // Cleanup al desmontar el componente
    return () => {
      stopCountdown();
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [qrStatus]);

  const handleLogout = () => {
    stopCountdown();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  };

  // Función para renderizar el contenido del QR según el estado
  const renderQRContent = () => {
    if (loading) {
      return (
        <div className="loading">
          <div className="spinner"></div>
          <p>Obteniendo QR...</p>
        </div>
      );
    }

    if (tokenExpired) {
      return (
        <div className="token-expired">
          <div className="status-icon">🔒</div>
          <h3>Token Expirado</h3>
          <p>Su sesión ha expirado. Por favor, inicie sesión nuevamente.</p>
          <button onClick={handleReturnToLogin} className="return-login-button">
            Regresar al Login
          </button>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-message">
          {error}
          {isTokenExpiredError(error) && (
            <button onClick={handleReturnToLogin} className="return-login-button">
              Regresar al Login
            </button>
          )}
        </div>
      );
    }

    if (qrStatus === 'connected') {
      return (
        <div className="connected-status">
          <div className="status-icon">✅</div>
          <h3>WhatsApp Conectado</h3>
          <p>Tu WhatsApp ya está conectado. No se necesita código QR.</p>
        </div>
      );
    }

    if (qrData && !qrData.isExpired && qrStatus === 'active') {
      return (
        <div className="qr-container">
          <img 
            src={qrData.qrCode} 
            alt="QR Code WhatsApp" 
            className="qr-image"
          />
          <div className="qr-info">
            <div className="time-remaining">
              <span className="time-label">Tiempo restante:</span>
              <span className="time-value">{formatTime(timeRemaining)}</span>
            </div>
            <p><strong>Expira:</strong> {new Date(qrData.expiresAt).toLocaleTimeString()}</p>
            <p><strong>Generado:</strong> {new Date(qrData.createdAt).toLocaleTimeString()}</p>
            
            
          </div>
        </div>
      );
    }

    if (qrStatus === 'expired' || qrStatus === 'waiting') {
      return (
        <div className="no-qr">
          <div className="status-icon">⏳</div>
          <h3>
            {qrStatus === 'expired' ? 'QR Expirado' : 'Generando Nuevo QR'}
          </h3>
          <p>
            {qrStatus === 'expired' 
              ? 'El QR ha expirado. Se generará uno nuevo automáticamente.'
              : 'Estamos generando un nuevo código QR. Esto puede tomar unos segundos...'
            }
          </p>
          
          {qrStatus === 'waiting' && (
            <div className="waiting-info">
              <div className="spinner small"></div>
              <p className="waiting-text">Generando QR...</p>
            </div>
          )}
          
          <div className="action-buttons">
            <button onClick={requestNewQR} className="refresh-button">
              🔄 Solicitar Nuevo QR
            </button>
            <button onClick={getQRCode} className="check-qr-button">
              🔍 Verificar QR
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="no-qr">
        <div className="status-icon">❓</div>
        <h3>Estado Desconocido</h3>
        <p>No se pudo determinar el estado del QR.</p>
        <button onClick={getQRCode} className="refresh-button">
          Intentar Obtener QR
        </button>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>WhatsApp - Service</h1>
        </div>
        <div className="header-right">
          <h2>{user.username}</h2>
          <button 
            onClick={getQRCode} 
            className="qr-button"
            disabled={loading || tokenExpired}
          >
            {loading ? 'Actualizando...' : '🔄 QR'}
          </button>
          <button onClick={handleLogout} className="logout-button">
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Body - QR Code */}
      <main className="dashboard-main">
        <div className="qr-section">
          <h2>Código QR de WhatsApp</h2>
          
          {renderQRContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
