/**
 * MÓDULO: FINGERPRINT ENGINE
 * 
 * Este módulo se encarga de generar fingerprints (huellas digitales) completos y realistas
 * para las sesiones de testing de ciberseguridad.
 * 
 * Un fingerprint es un conjunto de datos que identifican de forma única a un navegador/dispositivo,
 * incluyendo: user-agent, resolución de pantalla, zona horaria, idioma, plugins, WebGL, Canvas, etc.
 * 
 * Responsabilidades:
 * - Generar fingerprints geo-localizados (congruentes con una ubicación específica)
 * - Generar fingerprints locales genéricos
 * - Mantener coherencia entre todos los datos del fingerprint
 * - Simular dispositivos y navegadores realistas
 */

// ========== DATOS DE CIUDADES DE ESTADOS UNIDOS ==========

/**
 * Constante con datos de ciudades de EE.UU. cercanas a Nueva York
 * Cada ciudad incluye timezone, coordenadas reales y resoluciones comunes
 */
const CIUDADES_USA = {
    'New-York-NY': {
        timezone: 'America/New_York',
        latitud: 40.7128,
        longitud: -74.0060,
        resoluciones: ['1920x1080', '2560x1440', '1366x768', '1680x1050', '1440x900']
    },
    'Boston-MA': {
        timezone: 'America/New_York',
        latitud: 42.3601,
        longitud: -71.0589,
        resoluciones: ['1920x1080', '2560x1440', '1680x1050', '1440x900', '1366x768']
    },
    'Philadelphia-PA': {
        timezone: 'America/New_York',
        latitud: 39.9526,
        longitud: -75.1652,
        resoluciones: ['1920x1080', '1366x768', '1680x1050', '2560x1440', '1440x900']
    },
    'Baltimore-MD': {
        timezone: 'America/New_York',
        latitud: 39.2904,
        longitud: -76.6122,
        resoluciones: ['1920x1080', '1366x768', '1440x900', '1680x1050', '2560x1440']
    },
    'Washington-DC': {
        timezone: 'America/New_York',
        latitud: 38.9072,
        longitud: -77.0369,
        resoluciones: ['1920x1080', '2560x1440', '1680x1050', '1366x768', '3840x2160']
    },
    'Newark-NJ': {
        timezone: 'America/New_York',
        latitud: 40.7357,
        longitud: -74.1724,
        resoluciones: ['1920x1080', '1366x768', '1680x1050', '1440x900', '2560x1440']
    },
    'Hartford-CT': {
        timezone: 'America/New_York',
        latitud: 41.7658,
        longitud: -72.6734,
        resoluciones: ['1920x1080', '1366x768', '1440x900', '1680x1050', '2560x1440']
    },
    'Providence-RI': {
        timezone: 'America/New_York',
        latitud: 41.8240,
        longitud: -71.4128,
        resoluciones: ['1920x1080', '1680x1050', '1366x768', '1440x900', '2560x1440']
    },
    'Albany-NY': {
        timezone: 'America/New_York',
        latitud: 42.6526,
        longitud: -73.7562,
        resoluciones: ['1920x1080', '1366x768', '1680x1050', '1440x900', '2560x1440']
    },
    'Pittsburgh-PA': {
        timezone: 'America/New_York',
        latitud: 40.4406,
        longitud: -79.9959,
        resoluciones: ['1920x1080', '1366x768', '1440x900', '1680x1050', '2560x1440']
    },
    'Buffalo-NY': {
        timezone: 'America/New_York',
        latitud: 42.8864,
        longitud: -78.8784,
        resoluciones: ['1920x1080', '1366x768', '1680x1050', '1440x900', '2560x1440']
    },
    'Miami-FL': {
        timezone: 'America/New_York',
        latitud: 25.7617,
        longitud: -80.1918,
        resoluciones: ['1920x1080', '2560x1440', '1366x768', '1680x1050', '3840x2160']
    }
};

/**
 * Perfiles de sistema operativo soportados. Cada perfil contiene
 * user agents, datos de hardware y ajustes coherentes.
 */
const OS_PROFILES = {
    mac: {
        id: 'mac',
        etiqueta: 'macOS Sonoma',
        platform: 'MacIntel',
        vendor: 'Google Inc.',
        osVersion: 'Mac OS X 14.5',
        deviceScaleFactor: 2,
        maxTouchPoints: 0,
        hardwareConcurrency: [8, 10, 12, 24],
        deviceMemory: [8, 16],
        userAgents: [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        ],
        webglVendor: 'Apple Inc.',
        webglRenderers: [
            'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, OpenGL ES 3.0)',
            'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, OpenGL ES 3.0)',
            'ANGLE (Apple, ANGLE Metal Renderer: Apple M3, OpenGL ES 3.0)',
            'Apple M2 Ultra'
        ],
        audioMode: 'noise',
        fontsMode: 'emulate'
    },
    windows: {
        id: 'windows',
        etiqueta: 'Windows 11',
        platform: 'Win32',
        vendor: 'Google Inc.',
        osVersion: 'Windows NT 10.0; Win64; x64',
        deviceScaleFactor: 1.25,
        maxTouchPoints: 0,
        hardwareConcurrency: [8, 12, 16],
        deviceMemory: [8, 16],
        userAgents: [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        ],
        webglVendor: 'Google Inc. (Intel)',
        webglRenderers: [
            'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
            'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
            'ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)'
        ],
        audioMode: 'noise',
        fontsMode: 'emulate'
    }
};

const DEFAULT_OS_PROFILE = (process.env.FINGERPRINT_OS || process.env.FP_OS || 'mac').toLowerCase();

// Mapas de referencia para idiomas según timezone
const TIMEZONE_LOCALE_MAP = {
    'America/Santo_Domingo': { locales: ['es-DO', 'es'], acceptLanguage: 'es-DO,es;q=0.9,en-US;q=0.7' },
    'America/Mexico_City': { locales: ['es-MX', 'es'], acceptLanguage: 'es-MX,es;q=0.9,en-US;q=0.7' },
    'America/Bogota': { locales: ['es-CO', 'es'], acceptLanguage: 'es-CO,es;q=0.9,en-US;q=0.7' },
    'America/Lima': { locales: ['es-PE', 'es'], acceptLanguage: 'es-PE,es;q=0.9,en-US;q=0.7' },
    'America/Caracas': { locales: ['es-VE', 'es'], acceptLanguage: 'es-VE,es;q=0.9,en-US;q=0.7' },
    'America/Santiago': { locales: ['es-CL', 'es'], acceptLanguage: 'es-CL,es;q=0.9,en-US;q=0.7' }
};

const REGION_LOCALE_FALLBACK = {
    America: { locales: ['en-US', 'en'], acceptLanguage: 'en-US,en;q=0.9' },
    Europe: { locales: ['en-GB', 'en'], acceptLanguage: 'en-GB,en;q=0.9' },
    Asia: { locales: ['en-GB', 'en'], acceptLanguage: 'en-GB,en;q=0.9' },
    Africa: { locales: ['en-GB', 'en'], acceptLanguage: 'en-GB,en;q=0.9' }
};

function seleccionarPerfilOS(preferencia) {
    if (preferencia && OS_PROFILES[preferencia]) {
        return OS_PROFILES[preferencia];
    }

    if (OS_PROFILES[DEFAULT_OS_PROFILE]) {
        return OS_PROFILES[DEFAULT_OS_PROFILE];
    }

    const claves = Object.keys(OS_PROFILES);
    const claveAleatoria = claves[Math.floor(Math.random() * claves.length)];
    return OS_PROFILES[claveAleatoria];
}

/**
 * Obtiene el locale configurado en el sistema operativo del usuario
 * @returns {{locales: string[], acceptLanguage: string}|null}
 */
function obtenerLocaleDelSistema() {
    try {
        const intlOptions = new Intl.DateTimeFormat().resolvedOptions();
        if (!intlOptions || !intlOptions.locale) {
            return null;
        }

        let locale = intlOptions.locale.replace('_', '-');
        locale = locale.split('-u-')[0];

        const partes = locale.split('-');
        const idioma = partes[0];
        const region = partes[1] ? partes[1].toUpperCase() : idioma.toUpperCase();
        const localeNormalizado = `${idioma}-${region}`;

        return {
            locales: [localeNormalizado, idioma],
            acceptLanguage: `${localeNormalizado},${idioma};q=0.9,en-US;q=0.7`
        };
    } catch (error) {
        console.warn('[FINGERPRINT-ENGINE] No se pudo obtener el locale del sistema:', error.message);
        return null;
    }
}

/**
 * Construye un perfil de idioma coherente según timezone o configuración del sistema
 * @param {Object} opciones
 * @param {string} opciones.timezone - Timezone detectado
 * @param {boolean} [opciones.preferirSistema=false] - Usa el locale del sistema si está disponible
 * @param {string} [opciones.forzarLocale] - Locale fijo a utilizar
 * @returns {{locales: string[], acceptLanguage: string}}
 */
function construirPerfilIdioma({ timezone, preferirSistema = false, forzarLocale } = {}) {
    if (forzarLocale) {
        const idioma = forzarLocale;
        const base = idioma.split('-')[0];
        return {
            locales: [idioma, base],
            acceptLanguage: `${idioma},${base};q=0.9`
        };
    }

    if (preferirSistema) {
        const perfilSistema = obtenerLocaleDelSistema();
        if (perfilSistema) {
            return perfilSistema;
        }
    }

    if (timezone && TIMEZONE_LOCALE_MAP[timezone]) {
        return TIMEZONE_LOCALE_MAP[timezone];
    }

    if (timezone) {
        const region = timezone.split('/')[0];
        if (REGION_LOCALE_FALLBACK[region]) {
            return REGION_LOCALE_FALLBACK[region];
        }
    }

    return REGION_LOCALE_FALLBACK.America;
}

/**
 * Deduce el vendor de navigator según el user-agent
 * @param {string} userAgent
 * @returns {string}
 */
function obtenerVendorDesdeUserAgent(userAgent) {
    if (!userAgent) {
        return 'Google Inc.';
    }

    if (userAgent.includes('Firefox')) {
        return 'Mozilla';
    }

    if (userAgent.includes('Edg/')) {
        return 'Google Inc.';
    }

    return 'Google Inc.';
}


// ========== FUNCIONES AUXILIARES ==========

/**
 * Genera un número aleatorio entre min y max (incluidos)
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number} - Número aleatorio
 */
function randomEntre(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Selecciona un elemento aleatorio de un array
 * @param {Array} array - Array del cual seleccionar
 * @returns {*} - Elemento aleatorio del array
 */
function elementoAleatorio(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Añade ruido aleatorio a un número
 * @param {number} valor - Valor original
 * @param {number} rango - Rango de ruido (±)
 * @returns {number} - Valor con ruido añadido
 */
function añadirRuido(valor, rango) {
    const ruido = (Math.random() * 2 - 1) * rango;
    return valor + ruido;
}


/**
 * Genera un valor de ruido consistente basado en una semilla
 * Siempre devuelve el mismo valor para la misma semilla
 * 
 * @param {string} semilla - Cadena usada como semilla (ej: IP, ubicación, timestamp)
 * @returns {number} - Valor de ruido entre 0 y 1
 */
function generarRuidoConsistente(semilla) {
    // Algoritmo simple de hash para convertir string a número consistente
    let hash = 0;
    for (let i = 0; i < semilla.length; i++) {
        const char = semilla.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir a entero de 32 bits
    }

    // Normalizar a valor entre 0 y 1
    return Math.abs(hash % 10000) / 10000;
}


/**
 * Genera un hash de canvas consistente basado en una semilla
 * 
 * @param {string} semilla - Semilla para generar el hash
 * @returns {string} - Hash hexadecimal de 64 caracteres
 */
function generarCanvasHash(semilla) {
    const ruido = generarRuidoConsistente(semilla);
    const base = (ruido * 0xFFFFFFFFFFFFFFFF).toString(16);

    // Asegurar que tenga 64 caracteres
    return (base + base + base + base).substring(0, 64);
}


/**
 * Selecciona un vendor de WebGL coherente con el User-Agent
 * 
 * @param {string} userAgent - User-Agent del navegador
 * @param {string} semilla - Semilla para consistencia
 * @returns {string} - Vendor de WebGL
 */
function seleccionarWebGLVendor(userAgent, semilla) {
    const ruido = generarRuidoConsistente(semilla);

    if (userAgent.includes('Chrome') || userAgent.includes('Edge')) {
        return 'Google Inc. (Intel)';
    } else if (userAgent.includes('Firefox')) {
        return 'Mozilla';
    } else if (userAgent.includes('Safari')) {
        return 'WebKit';
    }

    return 'Google Inc. (Intel)';
}


/**
 * Genera un renderer de WebGL realista
 * 
 * @param {string} userAgent - User-Agent del navegador
 * @param {string} semilla - Semilla para consistencia
 * @returns {string} - Renderer de WebGL
 */
function generarWebGLRenderer(userAgent, semilla) {
    const ruido = generarRuidoConsistente(semilla);

    // Renderizadores comunes de Intel
    const renderersIntel = [
        'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (Intel, Intel(R) HD Graphics 4600 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'Intel(R) UHD Graphics 620',
        'Intel(R) Iris(R) Xe Graphics'
    ];

    // Renderizadores de NVIDIA
    const renderersNvidia = [
        'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'NVIDIA GeForce GTX 1660 Ti'
    ];

    // Renderizadores de AMD
    const renderersAMD = [
        'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'AMD Radeon RX 6600'
    ];

    // Selección basada en ruido
    if (ruido < 0.6) {
        // 60% Intel (más común)
        return renderersIntel[Math.floor(ruido * 10) % renderersIntel.length];
    } else if (ruido < 0.85) {
        // 25% NVIDIA
        return renderersNvidia[Math.floor(ruido * 10) % renderersNvidia.length];
    } else {
        // 15% AMD
        return renderersAMD[Math.floor(ruido * 10) % renderersAMD.length];
    }
}


// ========== FUNCIONES PRINCIPALES ==========

/**
 * Genera un fingerprint completo geo-localizado para una ciudad específica
 * 
 * @param {string} ubicacion - Nombre de la ciudad (ej: 'Miami-FL', 'New-York-NY')
 * @returns {Object} - Objeto con todos los datos del fingerprint
 */
function generarFingerprintGeo(ubicacion) {
    console.log(`[FINGERPRINT-ENGINE] Generando fingerprint geo-localizado para: ${ubicacion}`);

    // 1. Buscar los datos de la ciudad en el objeto CIUDADES_USA
    const datosCiudad = CIUDADES_USA[ubicacion];

    // Si no existe la ciudad, usar New York como predeterminada
    if (!datosCiudad) {
        console.warn(`[FINGERPRINT-ENGINE] Ciudad '${ubicacion}' no encontrada. Usando New-York-NY por defecto.`);
        return generarFingerprintGeo('New-York-NY');
    }

    // 2. Seleccionar un perfil de sistema operativo coherente
    const osProfile = seleccionarPerfilOS();
    const userAgent = elementoAleatorio(osProfile.userAgents);
    const vendor = osProfile.vendor;
    const platform = osProfile.platform;
    const deviceScaleFactor = osProfile.deviceScaleFactor;
    const hardwareConcurrency = elementoAleatorio(osProfile.hardwareConcurrency);
    const deviceMemory = elementoAleatorio(osProfile.deviceMemory);
    const maxTouchPoints = osProfile.maxTouchPoints;
    const perfilIdioma = construirPerfilIdioma({ timezone: datosCiudad.timezone, forzarLocale: platform === 'MacIntel' ? 'en-US' : 'en-US' });

    // 3. Seleccionar una resolución aleatoria de las disponibles para esta ciudad
    const resolucionStr = elementoAleatorio(datosCiudad.resoluciones);
    const [ancho, alto] = resolucionStr.split('x').map(Number);

    // 4. Calcular el viewport (área visible menos barras del navegador)
    const viewport = {
        ancho: ancho - randomEntre(15, 25),  // Restar ancho de scrollbar
        alto: alto - randomEntre(90, 120)     // Restar barras de navegador y sistema
    };

    // 5. Añadir ruido aleatorio a las coordenadas (±0.03 grados)
    const latitudConRuido = añadirRuido(datosCiudad.latitud, 0.03);
    const longitudConRuido = añadirRuido(datosCiudad.longitud, 0.03);

    // 6. Generar semilla consistente para fingerprinting avanzado
    const semilla = `${ubicacion}-${datosCiudad.latitud}-${datosCiudad.longitud}`;

    // 7. Construir el objeto fingerprint completo
    const fingerprint = {
        // Ubicación geográfica
        geolocation: {
            latitude: latitudConRuido,
            longitude: longitudConRuido
        },

        // Zona horaria
        timezone: datosCiudad.timezone,

        // Idioma y locale coherente
        locale: perfilIdioma.locales,
        navigatorLanguage: perfilIdioma.locales[0],
        acceptLanguage: perfilIdioma.acceptLanguage,

        // User-Agent del navegador
        userAgent: userAgent,

        // Resolución de pantalla
        resolucion: {
            ancho: ancho,
            alto: alto
        },

        // Viewport (área visible del navegador)
        viewport: viewport,
        deviceScaleFactor,

        // ✅ NUEVO: Permisos del navegador
        permissions: ['geolocation'],

        vendor,
        platform,
        hardwareConcurrency,
        deviceMemory,
        maxTouchPoints,

        // ✅ NUEVO: Headers HTTP adicionales
        extraHTTPHeaders: {
            'Accept-Language': perfilIdioma.acceptLanguage
        },

        // ✅ NUEVO: Canvas Fingerprint Data
        canvasFingerprintData: {
            hash: generarCanvasHash(semilla),
            noise: generarRuidoConsistente(semilla)
        },

        // ✅ NUEVO: WebGL Fingerprinting
        webglVendor: osProfile.webglVendor || seleccionarWebGLVendor(userAgent, semilla),
        webglRenderer: elementoAleatorio(osProfile.webglRenderers) || generarWebGLRenderer(userAgent, semilla),

        // Metadata
        ciudad: ubicacion,
        timestamp: Date.now(),
        modo: 'geo-localizado',
        osProfile: osProfile.id,
        audioMode: osProfile.audioMode,
        fontsMode: osProfile.fontsMode
    };

    console.log('[FINGERPRINT-ENGINE] Fingerprint geo-localizado generado exitosamente');
    return fingerprint;
}


/**
 * Obtiene el timezone real del usuario basado en su IP pública
 * Usa el servicio ipapi.co para obtener la geolocalización
 * 
 * @returns {Promise<string>} - Timezone en formato IANA (ej: 'America/Santo_Domingo')
 */
/**
 * Obtiene el timezone real del usuario basado en su IP pública
 * Usa múltiples servicios de geolocalización como fallback
 * 
 * @returns {Promise<string>} - Timezone en formato IANA (ej: 'America/Santo_Domingo')
 */
async function obtenerTimezoneDesdeIP() {
    console.log('[FINGERPRINT-ENGINE] 🌍 Detectando timezone desde IP pública...');

    const https = require('https');

    // Intentar con ip-api.com (sin límite estricto, más confiable)
    try {
        const timezone = await new Promise((resolve, reject) => {
            const request = https.get('https://ipapi.co/timezone/', {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    const timezone = data.trim();
                    console.log(`[FINGERPRINT-ENGINE] ✅ Timezone detectado (ipapi.co): ${timezone}`);

                    if (timezone && timezone.length > 0 && !timezone.includes('error') && !timezone.includes('<')) {
                        resolve(timezone);
                    } else {
                        reject(new Error('Timezone inválido'));
                    }
                });
            });

            request.on('error', (err) => {
                console.error('[FINGERPRINT-ENGINE] ❌ Error con ipapi.co:', err.message);
                reject(err);
            });

            request.on('timeout', () => {
                console.error('[FINGERPRINT-ENGINE] ❌ Timeout con ipapi.co');
                request.destroy();
                reject(new Error('Timeout'));
            });
        });

        return timezone;
    } catch (error) {
        console.warn('[FINGERPRINT-ENGINE] ⚠ Primer método falló, intentando método alternativo...');
    }

    // Método alternativo 2: worldtimeapi.org
    try {
        const timezone = await new Promise((resolve, reject) => {
            const request = https.get('https://worldtimeapi.org/api/ip', {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        const timezone = response.timezone;
                        console.log(`[FINGERPRINT-ENGINE] ✅ Timezone detectado (worldtimeapi): ${timezone}`);

                        if (timezone && timezone.length > 0) {
                            resolve(timezone);
                        } else {
                            reject(new Error('Timezone inválido'));
                        }
                    } catch (parseError) {
                        reject(parseError);
                    }
                });
            });

            request.on('error', (err) => {
                console.error('[FINGERPRINT-ENGINE] ❌ Error con worldtimeapi:', err.message);
                reject(err);
            });

            request.on('timeout', () => {
                console.error('[FINGERPRINT-ENGINE] ❌ Timeout con worldtimeapi');
                request.destroy();
                reject(new Error('Timeout'));
            });
        });

        return timezone;
    } catch (error) {
        console.warn('[FINGERPRINT-ENGINE] ⚠ Segundo método falló, usando detección por navegador...');
    }

    // Método 3: Usar Intl.DateTimeFormat del sistema (más confiable)
    try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.log(`[FINGERPRINT-ENGINE] ✅ Timezone detectado desde sistema (Intl): ${timezone}`);

        if (timezone && timezone.length > 0) {
            return timezone;
        }
    } catch (error) {
        console.error('[FINGERPRINT-ENGINE] ❌ Error con Intl.DateTimeFormat:', error.message);
    }

    // Fallback final
    console.warn('[FINGERPRINT-ENGINE] ⚠ Usando fallback: America/New_York');
    return 'America/New_York';
}


/**
 * Genera un fingerprint local basado en el timezone real del usuario (detectado por IP)
 * No usa ciudad aleatoria, sino que detecta la ubicación real del usuario
 * 
 * @returns {Promise<Object>} - Objeto con todos los datos del fingerprint
 */
async function generarFingerprintLocal() {
    console.log('[FINGERPRINT-ENGINE] 🔧 Generando fingerprint local basado en IP real...');

    try {
        // 1. Obtener el timezone real basado en la IP del usuario
        console.log('[FINGERPRINT-ENGINE] Paso 1: Obteniendo timezone desde IP...');
        const timezoneReal = await obtenerTimezoneDesdeIP();

        console.log(`[FINGERPRINT-ENGINE] ✅ Timezone obtenido: "${timezoneReal}"`);
        console.log(`[FINGERPRINT-ENGINE] Tipo de timezone: ${typeof timezoneReal}`);

        // 2. Seleccionar un perfil de sistema operativo coherente
        const osProfile = seleccionarPerfilOS();
        const userAgent = elementoAleatorio(osProfile.userAgents);
        const vendor = osProfile.vendor;
        const platform = osProfile.platform;
        const perfilIdioma = construirPerfilIdioma({ timezone: timezoneReal, preferirSistema: true });
        const deviceScaleFactor = osProfile.deviceScaleFactor;
        const hardwareConcurrency = elementoAleatorio(osProfile.hardwareConcurrency);
        const deviceMemory = elementoAleatorio(osProfile.deviceMemory);
        const maxTouchPoints = osProfile.maxTouchPoints;

        // 3. Usar resolución común
        const resoluciones = ['1920x1080', '2560x1440', '1366x768', '1680x1050', '1440x900'];
        const resolucionStr = elementoAleatorio(resoluciones);
        const [ancho, alto] = resolucionStr.split('x').map(Number);

        // 4. Calcular el viewport
        const viewport = {
            ancho: ancho - randomEntre(15, 25),
            alto: alto - randomEntre(90, 120)
        };

        // 5. Para modo local, usar coordenadas genéricas (Nueva York como referencia)
        // Nota: No exponemos la ubicación real del usuario por privacidad
        const latitudGenerica = 40.7128 + (Math.random() - 0.5) * 0.1;
        const longitudGenerica = -74.0060 + (Math.random() - 0.5) * 0.1;

        // 6. Generar semilla consistente
        const semilla = `local-${timezoneReal}-${Date.now()}`;

        // 7. Construir el objeto fingerprint
        const fingerprint = {
            // Ubicación genérica (no revelamos la IP real)
            geolocation: {
                latitude: latitudGenerica,
                longitude: longitudGenerica
            },

            // Timezone real del usuario
            timezone: timezoneReal,

            // Idiomas y locale coherentes con el sistema/timezone
            locale: perfilIdioma.locales,
            navigatorLanguage: perfilIdioma.locales[0],
            acceptLanguage: perfilIdioma.acceptLanguage,

            // User-Agent del navegador
            userAgent: userAgent,
            vendor,
            platform,

            // Resolución de pantalla
            resolucion: {
                ancho: ancho,
                alto: alto
            },

            // Viewport
            viewport: viewport,
            deviceScaleFactor,

            // Permisos del navegador
            permissions: ['geolocation'],

            // Headers HTTP adicionales
            extraHTTPHeaders: {
                'Accept-Language': perfilIdioma.acceptLanguage
            },

            // Canvas Fingerprint Data
            canvasFingerprintData: {
                hash: generarCanvasHash(semilla),
                noise: generarRuidoConsistente(semilla)
            },

            // WebGL Fingerprinting
            webglVendor: osProfile.webglVendor || seleccionarWebGLVendor(userAgent, semilla),
            webglRenderer: elementoAleatorio(osProfile.webglRenderers) || generarWebGLRenderer(userAgent, semilla),

            // Metadata
            ciudad: 'Local (IP-based)',
            timestamp: Date.now(),
            modo: 'local-ip-based',
            osProfile: osProfile.id,
            hardwareConcurrency,
            deviceMemory,
            maxTouchPoints,
            audioMode: osProfile.audioMode,
            fontsMode: osProfile.fontsMode
        };

        console.log('[FINGERPRINT-ENGINE] ✅ Fingerprint local (IP-based) generado exitosamente');
        console.log(`[FINGERPRINT-ENGINE] 📍 Timezone final en fingerprint: "${fingerprint.timezone}"`);

        return fingerprint;

    } catch (error) {
        console.error('[FINGERPRINT-ENGINE] Error al generar fingerprint local:', error);

        // Fallback: generar con timezone por defecto
        console.log('[FINGERPRINT-ENGINE] Usando fallback con timezone America/New_York');

        const osProfile = seleccionarPerfilOS('windows');
        const userAgent = elementoAleatorio(osProfile.userAgents);
        const vendor = osProfile.vendor;
        const platform = osProfile.platform;
        const hardwareConcurrency = elementoAleatorio(osProfile.hardwareConcurrency);
        const deviceMemory = elementoAleatorio(osProfile.deviceMemory);
        const maxTouchPoints = osProfile.maxTouchPoints;
        const deviceScaleFactor = osProfile.deviceScaleFactor;
        const perfilIdioma = construirPerfilIdioma({ timezone: 'America/New_York' });
        const resolucionStr = '1920x1080';
        const [ancho, alto] = resolucionStr.split('x').map(Number);
        const viewport = {
            ancho: ancho - 20,
            alto: alto - 100
        };
        const semilla = `fallback-${Date.now()}`;

        return {
            geolocation: {
                latitude: 40.7128,
                longitude: -74.0060
            },
            timezone: 'America/New_York',
            locale: perfilIdioma.locales,
            navigatorLanguage: perfilIdioma.locales[0],
            acceptLanguage: perfilIdioma.acceptLanguage,
            userAgent: userAgent,
            vendor,
            platform,
            resolucion: { ancho, alto },
            viewport: viewport,
            deviceScaleFactor,
            permissions: ['geolocation'],
            extraHTTPHeaders: { 'Accept-Language': perfilIdioma.acceptLanguage },
            canvasFingerprintData: {
                hash: generarCanvasHash(semilla),
                noise: generarRuidoConsistente(semilla)
            },
            webglVendor: osProfile.webglVendor || seleccionarWebGLVendor(userAgent, semilla),
            webglRenderer: elementoAleatorio(osProfile.webglRenderers) || generarWebGLRenderer(userAgent, semilla),
            ciudad: 'Local (Fallback)',
            timestamp: Date.now(),
            modo: 'local-fallback',
            osProfile: osProfile.id,
            hardwareConcurrency,
            deviceMemory,
            maxTouchPoints,
            audioMode: osProfile.audioMode,
            fontsMode: osProfile.fontsMode
        };
    }
}


// ========== EXPORTAR MÓDULO ==========

module.exports = {
    // Funciones principales
    generarFingerprintGeo,
    generarFingerprintLocal
};

