// Interceptor para manejar respuestas de API
export const createApiInterceptor = (onTokenExpired) => {
  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      
      // respuesta es 401 (Unauthorized)
      if (response.status === 401) {
        console.log('Token expirado detectado por interceptor');
        onTokenExpired();
        return response;
      }
      
      return response;
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.log('Token expirado detectado por error de red');
        onTokenExpired();
      }
      throw error;
    }
  };
};

// Función para restaurar el fetch original
export const restoreOriginalFetch = () => {
  if (window._originalFetch) {
    window.fetch = window._originalFetch;
  }
};
