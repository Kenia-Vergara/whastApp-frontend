// Configuración de autenticación
export const AUTH_CONFIG = {
  // Tiempo de expiración del token (en segundos)
  TOKEN_EXPIRY: 60 * 60, // 1 hora
  
  // Intervalo para verificar el token (en milisegundos)
  TOKEN_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutos
  
  // Endpoints de la API
  ENDPOINTS: {
    LOGIN: '/api/auth/login',
    VALIDATE: '/api/auth/validate',
    ME: '/api/auth/me'
  },
  
  // Mensajes de error
  MESSAGES: {
    TOKEN_EXPIRED: 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.',
    NO_TOKEN: 'No hay token de autenticación',
    UNAUTHORIZED: 'No autorizado'
  }
};
