/**
 * PRELOAD SCRIPT
 * 
 * Este script actúa como un puente seguro entre el proceso principal (main) y el renderer.
 * Utiliza el contextBridge de Electron para exponer de forma segura funcionalidades
 * del proceso principal al renderer, sin comprometer la seguridad de la aplicación.
 * 
 * El preload se ejecuta antes de cargar el código del renderer y tiene acceso a
 * las APIs de Node.js y Electron, mientras que el renderer no (por seguridad).
 */

// Importar módulos necesarios de Electron
const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exponer API segura al renderer a través de window.api
 * 
 * contextBridge.exposeInMainWorld crea un objeto global en el contexto del renderer
 * que puede ser accedido mediante window.api desde el código JavaScript del frontend.
 * 
 * Esto permite comunicación segura entre el renderer y el main process sin exponer
 * directamente las APIs de Node.js o Electron al código del renderer.
 */
contextBridge.exposeInMainWorld('api', {

    /**
     * Inicia una nueva sesión de testing
     * 
     * @param {string} modo - Modo de validación: 'geo' o 'local'
     * @param {string} ubicacion - Ubicación seleccionada (solo para modo 'geo')
     * @returns {Promise} - Promesa que se resuelve con la respuesta del main process
     */
    iniciarSesion: (modo, ubicacion) => {
        console.log('[PRELOAD] Enviando orden iniciar-sesion:', { modo, ubicacion });
        return ipcRenderer.invoke('iniciar-sesion', { modo, ubicacion });
    },

    /**
     * Finaliza una sesión de testing
     * 
     * @param {string} resultado - Resultado de la sesión: 'completada' o 'cancelada'
     * @param {number} polizasCreadas - Número de pólizas creadas durante la sesión
     * @returns {Promise} - Promesa que se resuelve con la respuesta del main process
     */
    finalizarSesion: (resultado, polizasCreadas = 0) => {
        console.log('[PRELOAD] Enviando orden finalizar-sesion:', resultado, 'polizas:', polizasCreadas);
        return ipcRenderer.invoke('finalizar-sesion', { resultado, polizasCreadas });
    },

    seleccionarArchivoDeProxies: () => {
        console.log('[PRELOAD] Abriendo selector de archivo de proxies');
        return ipcRenderer.invoke('proxies:seleccionar-archivo');
    },

    importarProxiesDesdeArchivo: (rutaArchivo, stateCode) => {
        console.log('[PRELOAD] Importando proxies:', { rutaArchivo, stateCode });
        return ipcRenderer.invoke('proxies:importar', { rutaArchivo, stateCode });
    },

    obtenerResumenProxies: () => {
        console.log('[PRELOAD] Consultando resumen de proxies');
        return ipcRenderer.invoke('proxies:resumen');
    },
    listarProxies: (stateCode) => {
        console.log('[PRELOAD] Solicitando lista de proxies para estado:', stateCode);
        return ipcRenderer.invoke('proxies:listar', { stateCode });
    },

    actualizarPoliza: (proxyId, poliza) => {
        console.log('[PRELOAD] Actualizando póliza para proxy:', proxyId);
        return ipcRenderer.invoke('proxies:actualizar-poliza', { proxyId, poliza });
    },

    sumarPoliza: (proxyId, cantidad) => {
        console.log('[PRELOAD] Sumando póliza para proxy:', proxyId, '+', cantidad);
        return ipcRenderer.invoke('proxies:sumar-poliza', { proxyId, cantidad });
    },

    toggleProxyDisabled: (proxyId) => {
        console.log('[PRELOAD] Toggle deshabilitado para proxy:', proxyId);
        return ipcRenderer.invoke('proxies:toggle-disabled', { proxyId });
    },

    /**
     * Registra un callback para escuchar actualizaciones del contador de sesiones
     * 
     * @param {Function} callback - Función que se ejecutará cuando se reciba la actualización
     *                              Recibe como parámetro el nuevo valor del contador
     * 
     * Esta función permite al renderer recibir notificaciones en tiempo real desde el main process
     * cuando el contador de sesiones cambia.
     */
    onUpdateCounter: (callback) => {
        // Escuchar el evento 'update-counter' desde el main process
        ipcRenderer.on('update-counter', (event, nuevoValor) => {
            console.log('[PRELOAD] Evento update-counter recibido:', nuevoValor);
            // Ejecutar el callback pasando solo el valor (sin exponer el objeto event completo)
            callback(nuevoValor);
        });
    }

});

console.log('[PRELOAD] Preload listo. Funciones: iniciarSesion, finalizarSesion, seleccionarArchivoDeProxies, importarProxiesDesdeArchivo, obtenerResumenProxies, onUpdateCounter');
