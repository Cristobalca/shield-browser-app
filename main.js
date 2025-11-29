// ========== IMPORTACIONES ==========

// Importar módulos necesarios de Electron
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Configurar ruta de navegadores de Playwright para builds empaquetados
function resolvePlaywrightBrowsersPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'playwright-browsers');
    }

    const devPath = path.join(__dirname, 'playwright-browsers');
    if (fs.existsSync(devPath)) {
        return devPath;
    }

    return null;
}

const playwrightBrowsersPath = resolvePlaywrightBrowsersPath();
if (playwrightBrowsersPath) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightBrowsersPath;
    console.log('[MAIN] Playwright browsers path:', playwrightBrowsersPath);
} else {
    console.warn('[MAIN] No se encontró carpeta playwright-browsers. Se usará la ruta por defecto de Playwright.');
}

// ✅ CORRECCIÓN: Importar playwright-extra y stealth plugin
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// ✅ Aplicar el plugin stealth a chromium
chromium.use(StealthPlugin());

// Importar módulos propios
const proxyManager = require('./proxy-manager.js');
const fingerprintEngine = require('./fingerprint-engine.js');

// Directorio de perfil persistente para que el navegador no corra en modo incógnito
const PROFILE_DIR_NAME = 'shield-browser-profile';
const DUCKDUCKGO_HOME = 'https://duckduckgo.com/';
const duckDuckGoHandledPages = new WeakSet();


// ========== VARIABLES GLOBALES ==========

// Variable para mantener una referencia a la ventana principal
let mainWindow;

// Variables para controlar la sesión del navegador
let browserInstance = null;
let contextoNavegacion = null;

// Contador de sesiones completadas en el día
let contadorSesionesDiarias = 0;

// Variable para almacenar el nodo actualmente en uso
let nodoActual = null;

function getBrowserProfileDir() {
    const basePath = app.getPath('userData');
    return path.join(basePath, PROFILE_DIR_NAME);
}

function resetBrowserProfileDir() {
    const dir = getBrowserProfileDir();
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function cleanBrowserProfileDir() {
    const dir = getBrowserProfileDir();
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

async function ensureDuckDuckGo(page) {
    if (!page || duckDuckGoHandledPages.has(page)) {
        return;
    }

    duckDuckGoHandledPages.add(page);

    try {
        const currentUrl = page.url();
        if (!currentUrl || currentUrl === 'about:blank' || currentUrl.startsWith('chrome://')) {
            await page.goto(DUCKDUCKGO_HOME, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
        }
    } catch (error) {
        console.error('[MAIN] Error forzando DuckDuckGo en pestaña:', error.message);
    }
}

function obtenerEstadoDesdeUbicacion(ubicacion) {
    if (!ubicacion) {
        return null;
    }
    const match = ubicacion.match(/-(\w{2})$/);
    return match ? match[1].toUpperCase() : null;
}


// ========== FUNCIÓN PARA CREAR LA VENTANA PRINCIPAL ==========

/**
 * Función para crear la ventana principal de la aplicación
 */
function createWindow() {
    // Crear una nueva instancia de BrowserWindow con las configuraciones especificadas
    mainWindow = new BrowserWindow({
        width: 1200,              // Ancho de la ventana en píxeles
        height: 800,              // Alto de la ventana en píxeles
        minWidth: 1000,           // Ancho mínimo de la ventana
        minHeight: 700,           // Alto mínimo de la ventana
        title: 'Shield Browser',     // Título de la ventana
        show: false,              // No mostrar la ventana inmediatamente para evitar parpadeos
        webPreferences: {
            nodeIntegration: false, // Desactivar integración de Node.js por seguridad
            contextIsolation: true, // Habilitar aislamiento de contexto
            preload: path.join(__dirname, 'preload.js') // Ruta al script de precarga
        }
    });

    // Cargar el archivo HTML principal
    mainWindow.loadFile('Index.html');

    // DevTools desactivado para producción
    // mainWindow.webContents.openDevTools();

    // Mostrar la ventana cuando esté lista, evitando el parpadeo visual
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Liberar la referencia de la ventana cuando se cierre
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}


// ========== MANEJADORES IPC ==========

/**
 * Manejador para iniciar una nueva sesión de testing
 */
ipcMain.handle('iniciar-sesion', async (event, { modo, ubicacion }) => {
    console.log('[MAIN] Solicitud de iniciar sesión recibida:', { modo, ubicacion });

    try {
        // Verificar si ya hay una sesión activa
        if (browserInstance !== null) {
            console.warn('[MAIN] Ya hay una sesión activa');
            return {
                exito: false,
                mensaje: 'Ya hay una sesión activa. Por favor, finaliza la sesión actual primero.'
            };
        }

        // Variable para almacenar el nodo proxy (si aplica)
        let nodo = null;
        let fingerprint = null;

        // Procesar según el modo seleccionado
        if (modo === 'geo') {
            console.log(`[MAIN] Modo geo-restringido. Buscando nodo para: ${ubicacion}`);

            // Obtener el siguiente nodo disponible para la ubicación
            nodo = await proxyManager.obtenerSiguienteNodo(ubicacion);

            if (!nodo) {
                const estadoSeleccionado = obtenerEstadoDesdeUbicacion(ubicacion);
                const disponibilidad = await proxyManager.contarDisponiblesPorEstado(estadoSeleccionado);
                const mensaje = disponibilidad.total === 0
                    ? `No hay proxies registrados para ${estadoSeleccionado}. Carga proxies de ese estado.`
                    : `Los proxies disponibles para ${estadoSeleccionado} se agotaron. Importa nuevos proxies.`;

                console.warn('[MAIN] No hay proxies disponibles para la ubicación:', ubicacion);

                return {
                    exito: false,
                    mensaje
                };
            } else {
                console.log('[MAIN] Nodo obtenido:', nodo);
                nodoActual = nodo;

                // Incrementar sesiones inmediatamente al abrir navegador con este proxy
                await proxyManager.incrementarSesiones(nodo.id);
                console.log('[MAIN] Sesiones incrementadas para proxy:', nodo.id);
            }

            // Generar fingerprint geo-localizado
            fingerprint = fingerprintEngine.generarFingerprintGeo(ubicacion);

            console.log('[MAIN] Fingerprint geo-localizado generado:', fingerprint);

        } else if (modo === 'local') {
            console.log('[MAIN] ════════════════════════════════════════════');
            console.log('[MAIN] 🔧 Modo local. Generando fingerprint basado en IP...');
            console.log('[MAIN] ════════════════════════════════════════════');

            // Generar fingerprint local (sin nodo proxy) - AHORA ES ASÍNCRONO
            fingerprint = await fingerprintEngine.generarFingerprintLocal();

            console.log('[MAIN] ════════════════════════════════════════════');
            console.log('[MAIN] 📊 FINGERPRINT GENERADO:');
            console.log('[MAIN] ════════════════════════════════════════════');
            console.log('[MAIN] Tipo de fingerprint:', typeof fingerprint);
            console.log('[MAIN] Tiene geolocation?:', fingerprint ? !!fingerprint.geolocation : 'fingerprint es null/undefined');
            console.log('[MAIN] 📍 TIMEZONE:', fingerprint.timezone);
            console.log('[MAIN] 🌍 Geolocation:', fingerprint.geolocation);
            console.log('[MAIN] 👤 User-Agent:', fingerprint.userAgent.substring(0, 50) + '...');
            console.log('[MAIN] 🏙️ Ciudad:', fingerprint.ciudad);
            console.log('[MAIN] 🎯 Modo:', fingerprint.modo);
            console.log('[MAIN] ════════════════════════════════════════════');

        } else {
            console.error('[MAIN] Modo inválido:', modo);
            return {
                exito: false,
                mensaje: `Modo inválido: ${modo}`
            };
        }

        // Validar que el fingerprint se generó correctamente
        if (!fingerprint || !fingerprint.geolocation) {
            console.error('[MAIN] Error: Fingerprint no generado correctamente:', fingerprint);
            return {
                exito: false,
                mensaje: 'Error al generar el fingerprint'
            };
        }

        console.log('[MAIN] ════════════════════════════════════════════');
        console.log('[MAIN] 🎯 CONFIGURACIÓN DEL CONTEXTO DEL NAVEGADOR');
        console.log('[MAIN] ════════════════════════════════════════════');

        // Configuración del contexto del navegador
        const contextOptions = {
            // Timezone
            timezoneId: fingerprint.timezone,

            // Geolocalización
            geolocation: {
                latitude: fingerprint.geolocation.latitude,
                longitude: fingerprint.geolocation.longitude
            },
            permissions: ['geolocation'],

            // Idioma y locale
            locale: fingerprint.locale[0],

            // User-Agent
            userAgent: fingerprint.userAgent,

            // Viewport (tamaño de la ventana del navegador)
            viewport: {
                width: fingerprint.viewport.ancho,
                height: fingerprint.viewport.alto
            },

            // Configuraciones adicionales para parecer más humano
            hasTouch: (fingerprint.maxTouchPoints || 0) > 0,
            isMobile: false,
            deviceScaleFactor: fingerprint.deviceScaleFactor || 1,
            colorScheme: 'light',
            reducedMotion: 'no-preference',
            forcedColors: 'none',

            // ✅ Headers HTTP adicionales del fingerprint
            extraHTTPHeaders: fingerprint.extraHTTPHeaders || {}
        };

        console.log('[MAIN] 📍 timezoneId configurado:', contextOptions.timezoneId);
        console.log('[MAIN] 🌍 geolocation configurado:', contextOptions.geolocation);
        console.log('[MAIN] 🗣️ locale configurado:', contextOptions.locale);
        console.log('[MAIN] ════════════════════════════════════════════');

        // Si hay un nodo proxy, añadirlo a la configuración
        if (nodo) {
            // ✅ Usar getProxyForPlaywright para formato correcto
            contextOptions.proxy = proxyManager.getProxyForPlaywright(nodo);

            console.log('[MAIN] Configuración de proxy añadida:');
            console.log('[MAIN]   Proxy:', `${nodo.ip}:${nodo.puerto}`);
            console.log('[MAIN]   Usuario:', nodo.usuario);
            console.log('[MAIN]   Ubicación:', nodo.ubicacion);
        } else {
            console.log('[MAIN] Sin proxy - Conexión directa');
        }

        console.log('[MAIN] Lanzando navegador Chromium (perfil persistente)...');
        if (nodo) {
            console.log('[MAIN] NOTA: Puede tardar 10-30 segundos en conectar con el proxy');
        }

        const chromeArgs = [
            // Anti-detección básica
            '--disable-blink-features=AutomationControlled',

            // WebGL y GPU - habilitar para mejor compatibilidad
            '--enable-webgl',
            '--enable-webgl2',
            '--enable-accelerated-2d-canvas',
            '--enable-gpu-rasterization',
            '--ignore-gpu-blocklist',

            // Certificados y seguridad
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',

            // Estabilidad
            '--disable-dev-shm-usage',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-breakpad',
            '--disable-component-extensions-with-background-pages',
            '--disable-component-update',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-hang-monitor',
            '--disable-ipc-flooding-protection',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-renderer-backgrounding',
            '--disable-sync',
            '--disable-translate',
            '--metrics-recording-only',
            '--no-first-run',
            '--safebrowsing-disable-auto-update',

            // Configuración de ventana y user agent
            `--window-size=${fingerprint.viewport.ancho},${fingerprint.viewport.alto}`,
            `--user-agent=${fingerprint.userAgent}`,

            // Homepage
            `--homepage=${DUCKDUCKGO_HOME}`
        ];

        const userDataDir = resetBrowserProfileDir();
        console.log('[MAIN] Perfil del navegador listo en:', userDataDir);

        contextoNavegacion = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            args: chromeArgs,
            ...contextOptions
        });
        browserInstance = contextoNavegacion;

        console.log('[MAIN] Contexto persistente creado exitosamente (sin modo incógnito)');

        const paginasExistentes = contextoNavegacion.pages();
        let pagina = paginasExistentes[0];

        if (!pagina) {
            pagina = await contextoNavegacion.newPage();
        }

        // Cerrar pestañas sobrantes que crea Chromium por defecto
        for (let i = 1; i < paginasExistentes.length; i++) {
            try {
                await paginasExistentes[i].close();
            } catch (cerrarError) {
                console.warn('[MAIN] No se pudo cerrar pestaña inicial extra:', cerrarError.message);
            }
        }

        // Inyectar script para ocultar webdriver y mejorar fingerprint
        await pagina.addInitScript((fingerprintData) => {
            // Ocultar navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Simular plugins de Chrome
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5].map((i) => ({
                    0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                    description: 'Portable Document Format',
                    filename: 'internal-pdf-viewer',
                    length: 1,
                    name: 'Chrome PDF Plugin'
                }))
            });

            // Idiomas y locale coherentes
            Object.defineProperty(navigator, 'languages', {
                get: () => fingerprintData.languages
            });

            Object.defineProperty(navigator, 'language', {
                get: () => fingerprintData.language
            });

            Object.defineProperty(navigator, 'platform', {
                get: () => fingerprintData.platform
            });

            Object.defineProperty(navigator, 'vendor', {
                get: () => fingerprintData.vendor
            });

            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => fingerprintData.hardwareConcurrency
            });

            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => fingerprintData.deviceMemory
            });

            Object.defineProperty(navigator, 'maxTouchPoints', {
                get: () => fingerprintData.maxTouchPoints
            });

            Object.defineProperty(window, 'devicePixelRatio', {
                get: () => fingerprintData.deviceScaleFactor
            });

            // Ocultar automation flags
            delete navigator.__proto__.webdriver;

            // Simular chrome runtime
            window.chrome = {
                runtime: {},
                loadTimes: function () { },
                csi: function () { },
                app: {}
            };

            // Modificar permissions API
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // ✅ Inyectar WebGL vendor y renderer desde el fingerprint
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                if (parameter === 37445) {
                    return fingerprintData.webglVendor; // UNMASKED_VENDOR_WEBGL
                }
                if (parameter === 37446) {
                    return fingerprintData.webglRenderer; // UNMASKED_RENDERER_WEBGL
                }
                return getParameter.call(this, parameter);
            };

            // ✅ Inyectar Canvas fingerprint noise consistente
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function (type) {
                const context = this.getContext('2d');
                if (context) {
                    // Agregar ruido imperceptible pero consistente basado en el hash
                    const imageData = context.getImageData(0, 0, this.width, this.height);
                    const noise = fingerprintData.canvasNoise;

                    for (let i = 0; i < imageData.data.length; i += 4) {
                        // Modificar ligeramente el RGB basado en el ruido
                        imageData.data[i] = Math.min(255, imageData.data[i] + Math.floor(noise * 3));
                        imageData.data[i + 1] = Math.min(255, imageData.data[i + 1] + Math.floor(noise * 2));
                        imageData.data[i + 2] = Math.min(255, imageData.data[i + 2] + Math.floor(noise * 1));
                    }

                    context.putImageData(imageData, 0, 0);
                }
                return originalToDataURL.apply(this, arguments);
            };

            // Agregar movimiento de mouse aleatorio "humano"
            const moveMouseRandomly = () => {
                const event = new MouseEvent('mousemove', {
                    clientX: Math.random() * window.innerWidth,
                    clientY: Math.random() * window.innerHeight,
                    bubbles: true
                });
                document.dispatchEvent(event);
            };

            // Mover mouse aleatoriamente cada 2-5 segundos
            setInterval(moveMouseRandomly, 2000 + Math.random() * 3000);

            // Simular scrolling aleatorio
            const scrollRandomly = () => {
                if (Math.random() > 0.7) {
                    window.scrollBy({
                        top: (Math.random() - 0.5) * 100,
                        behavior: 'smooth'
                    });
                }
            };

            setInterval(scrollRandomly, 5000 + Math.random() * 5000);
        }, {
            webglVendor: fingerprint.webglVendor,
            webglRenderer: fingerprint.webglRenderer,
            canvasNoise: fingerprint.canvasFingerprintData.noise,
            languages: fingerprint.locale,
            language: fingerprint.locale[0],
            platform: fingerprint.platform,
            vendor: fingerprint.vendor,
            hardwareConcurrency: fingerprint.hardwareConcurrency || 8,
            deviceMemory: fingerprint.deviceMemory || 8,
            maxTouchPoints: fingerprint.maxTouchPoints || 0,
            deviceScaleFactor: fingerprint.deviceScaleFactor || 1
        });

        // Agregar listeners para detectar problemas de red
        pagina.on('requestfailed', request => {
            console.error('[MAIN] ❌ Request falló:', request.url());
            console.error('[MAIN] Razón:', request.failure().errorText);
        });

        pagina.on('response', response => {
            if (response.status() === 407) {
                console.error('[MAIN] ❌ Error 407: Proxy requiere autenticación');
            } else if (!response.ok()) {
                console.warn('[MAIN] ⚠ Response:', response.status(), response.url());
            }
        });

        console.log('[MAIN] Página lista. Forzando DuckDuckGo como pestaña principal...');

        await ensureDuckDuckGo(pagina);
        await pagina.waitForTimeout(300);

        console.log('[MAIN] ✓ DuckDuckGo cargado como motor de búsqueda inicial (sin pestañas extra)');

        contextoNavegacion.on('page', (page) => {
            if (page === pagina) {
                return;
            }
            ensureDuckDuckGo(page);
        });
        console.log('[MAIN] El navegador está configurado con:');
        console.log('[MAIN]   - Fingerprint:', fingerprint.ciudad);
        console.log('[MAIN]   - Timezone:', fingerprint.timezone);
        console.log('[MAIN]   - Geolocation:', `${fingerprint.geolocation.latitude}, ${fingerprint.geolocation.longitude}`);
        if (nodo) {
            console.log('[MAIN]   - Proxy:', `${nodo.ip}:${nodo.puerto} (${nodo.ubicacion})`);
        }

        console.log('[MAIN] Sesión iniciada exitosamente');

        return {
            exito: true,
            mensaje: `Sesión iniciada en modo ${modo}${nodo ? ' con proxy ' + nodo.ip : ''}`,
            nodo: nodo ? {
                id: nodo.id,
                ip: nodo.ip,
                puerto: nodo.puerto,
                stateCode: nodo.stateCode,
                poliza: nodo.poliza || '0',
                poliza_updated_at: nodo.poliza_updated_at || null
            } : null
        };

    } catch (error) {
        // ✅ CAPTURAR CUALQUIER ERROR CON LOGGING DETALLADO
        console.error('[MAIN] ❌ Error en iniciar-sesion:', error);
        console.error('[MAIN] Stack trace:', error.stack);

        // ✅ Limpiar recursos si hubo error (con manejo seguro)
        if (browserInstance) {
            try {
                await browserInstance.close();
                console.log('[MAIN] Navegador persistente cerrado tras error');
            } catch (closeError) {
                console.error('[MAIN] Error al cerrar navegador:', closeError.message);
            }
            browserInstance = null;
        }

        contextoNavegacion = null;
        cleanBrowserProfileDir();

        nodoActual = null;

        return {
            exito: false,
            mensaje: `Error al iniciar sesión: ${error.message}`
        };
    }
});


/**
 * Manejador para finalizar la sesión actual
 */
ipcMain.handle('finalizar-sesion', async (event, { resultado, polizasCreadas }) => {
    console.log('[MAIN] Solicitud de finalizar sesión recibida. Resultado:', resultado, 'Pólizas:', polizasCreadas);

    try {
        // Verificar si hay una sesión activa
        if (!browserInstance) {
            console.warn('[MAIN] No hay sesión activa para finalizar');
            return {
                exito: false,
                mensaje: 'No hay sesión activa para finalizar'
            };
        }

        // Guardar pólizas si se proporcionaron y hay un nodo activo
        let alertaPolizas = null;
        if (nodoActual && polizasCreadas && polizasCreadas > 0) {
            const resultadoPoliza = await proxyManager.sumarPoliza(nodoActual.id, polizasCreadas);
            console.log('[MAIN] Pólizas sumadas:', resultadoPoliza);

            // Verificar si hay alerta de exceso de pólizas
            if (resultadoPoliza.exito) {
                const verificacion = await proxyManager.verificarAlertaPolizas(nodoActual.id);
                if (verificacion.alerta) {
                    alertaPolizas = verificacion;
                }
            }
        }

        // Cerrar el navegador
        console.log('[MAIN] Cerrando navegador...');
        await browserInstance.close();
        console.log('[MAIN] Navegador cerrado exitosamente');
        cleanBrowserProfileDir();

        // Limpiar las variables globales
        browserInstance = null;
        contextoNavegacion = null;
        nodoActual = null;

        return {
            exito: true,
            mensaje: 'Navegador cerrado correctamente',
            alertaPolizas
        };

    } catch (error) {
        console.error('[MAIN] Error al finalizar sesión:', error);

        // Limpiar de todas formas
        browserInstance = null;
        contextoNavegacion = null;
        nodoActual = null;

        return {
            exito: false,
            mensaje: `Error al cerrar navegador: ${error.message}`
        };
    }
});


ipcMain.handle('proxies:seleccionar-archivo', async () => {
    const ventana = BrowserWindow.getFocusedWindow() || mainWindow;

    const resultado = await dialog.showOpenDialog(ventana, {
        title: 'Selecciona archivo de proxies',
        buttonLabel: 'Importar',
        filters: [{ name: 'Texto', extensions: ['txt'] }],
        properties: ['openFile']
    });

    if (resultado.canceled || !resultado.filePaths.length) {
        return null;
    }

    return resultado.filePaths[0];
});

ipcMain.handle('proxies:importar', async (event, { rutaArchivo, stateCode }) => {
    console.log('[MAIN] Importando proxies desde archivo:', rutaArchivo, 'estado:', stateCode);
    return await proxyManager.importarProxiesDesdeArchivo(rutaArchivo, stateCode);
});

ipcMain.handle('proxies:resumen', async () => {
    try {
        const resumen = await proxyManager.obtenerResumenEstados();
        return { exito: true, resumen };
    } catch (error) {
        console.error('[MAIN] Error al obtener resumen de proxies:', error);
        return { exito: false, mensaje: error.message };
    }
});

ipcMain.handle('proxies:listar', async (event, { stateCode } = {}) => {
    try {
        const lista = await proxyManager.obtenerProxiesPorEstado(stateCode);
        return { exito: true, proxies: lista };
    } catch (error) {
        console.error('[MAIN] Error al listar proxies:', error);
        return { exito: false, mensaje: error.message };
    }
});

ipcMain.handle('proxies:actualizar-poliza', async (event, { proxyId, poliza }) => {
    try {
        const resultado = await proxyManager.actualizarPoliza(proxyId, poliza);
        return resultado;
    } catch (error) {
        console.error('[MAIN] Error al actualizar póliza:', error);
        return { exito: false, mensaje: error.message };
    }
});

ipcMain.handle('proxies:toggle-disabled', async (event, { proxyId }) => {
    try {
        const resultado = await proxyManager.toggleDisabled(proxyId);
        return resultado;
    } catch (error) {
        console.error('[MAIN] Error al cambiar estado del proxy:', error);
        return { exito: false, mensaje: error.message };
    }
});

ipcMain.handle('proxies:sumar-poliza', async (event, { proxyId, cantidad }) => {
    try {
        const resultado = await proxyManager.sumarPoliza(proxyId, cantidad);
        return resultado;
    } catch (error) {
        console.error('[MAIN] Error al sumar póliza:', error);
        return { exito: false, mensaje: error.message };
    }
});


// ========== EVENTOS DE LA APLICACIÓN ==========

// Evento que se dispara cuando Electron ha terminado de inicializarse
app.whenReady().then(() => {
    console.log('[MAIN] Aplicación iniciada');
    createWindow();

    // En macOS, es común recrear la ventana cuando se hace clic en el icono del dock
    // y no hay otras ventanas abiertas
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Salir de la aplicación cuando todas las ventanas estén cerradas
// Excepto en macOS, donde es común que las aplicaciones permanezcan activas
// hasta que el usuario las cierre explícitamente con Cmd + Q
app.on('window-all-closed', async () => {
    // Cerrar el navegador si está abierto antes de salir
    if (browserInstance) {
        console.log('[MAIN] Cerrando navegador antes de salir...');
        await browserInstance.close();
        cleanBrowserProfileDir();
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

console.log('[MAIN] Main process cargado exitosamente');
