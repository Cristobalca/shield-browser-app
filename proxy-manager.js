/**
 * MÓDULO: PROXY MANAGER (sql.js)
 *
 * Persistimos los proxies en una base de datos local usando sql.js (SQLite en WebAssembly).
 * No requiere compilación nativa.
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { app } = require('electron');

// Usar userData de Electron para almacenar datos persistentes (funciona en asar)
function getDataDir() {
    try {
        return path.join(app.getPath('userData'), 'data');
    } catch (e) {
        // Fallback para desarrollo
        return path.join(__dirname, 'data');
    }
}

let DATA_DIR = null;
let DB_PATH = null;

function ensureDataDir() {
    if (!DATA_DIR) {
        DATA_DIR = getDataDir();
        DB_PATH = path.join(DATA_DIR, 'proxies.db');
    }
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

let SQL;
let db;

async function initDB() {
    // Asegurar que el directorio de datos exista
    ensureDataDir();

    if (!SQL) {
        SQL = await initSqlJs();
    }
    if (!db) {
        if (fs.existsSync(DB_PATH)) {
            const filebuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(filebuffer);
            // Migrar columnas si no existen
            migrateSchema();
        } else {
            db = new SQL.Database();
            db.run(`
CREATE TABLE proxies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    puerto INTEGER NOT NULL,
    usuario TEXT NOT NULL,
    password TEXT NOT NULL,
    ubicacion TEXT NOT NULL,
    state_code TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'disponible',
    sesionesCompletadas INTEGER NOT NULL DEFAULT 0,
    poliza TEXT DEFAULT '',
    poliza_updated_at TEXT DEFAULT '',
    disabled INTEGER NOT NULL DEFAULT 0,
    UNIQUE(ip, puerto, usuario, password)
);
            `);
            saveDB();
        }
    }
    return db;
}

function migrateSchema() {
    // Comprobar si la columna poliza existe
    const tableInfo = db.exec("PRAGMA table_info(proxies)");
    const columns = tableInfo.length ? tableInfo[0].values.map(row => row[1]) : [];

    if (!columns.includes('poliza')) {
        db.run("ALTER TABLE proxies ADD COLUMN poliza TEXT DEFAULT ''");
    }
    if (!columns.includes('poliza_updated_at')) {
        db.run("ALTER TABLE proxies ADD COLUMN poliza_updated_at TEXT DEFAULT ''");
    }
    if (!columns.includes('disabled')) {
        db.run("ALTER TABLE proxies ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0");
    }

    // Migrar constraint UNIQUE para incluir password (necesario para proxies IPRoyal)
    // SQLite no permite ALTER de constraints, así que recreamos la tabla si es necesario
    try {
        // Verificar si la constraint actual incluye password
        const indexInfo = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='proxies'");
        if (indexInfo.length > 0 && indexInfo[0].values.length > 0) {
            const createSql = indexInfo[0].values[0][0];
            // Si la constraint no incluye password, recrear tabla
            if (createSql && createSql.includes('UNIQUE(ip, puerto, state_code)') && !createSql.includes('UNIQUE(ip, puerto, usuario, password)')) {
                console.log('[PROXY-MANAGER] Migrando constraint UNIQUE para soportar proxies IPRoyal...');

                // Crear tabla temporal con nueva estructura
                db.run(`
                    CREATE TABLE proxies_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ip TEXT NOT NULL,
                        puerto INTEGER NOT NULL,
                        usuario TEXT NOT NULL,
                        password TEXT NOT NULL,
                        ubicacion TEXT NOT NULL,
                        state_code TEXT NOT NULL,
                        estado TEXT NOT NULL DEFAULT 'disponible',
                        sesionesCompletadas INTEGER NOT NULL DEFAULT 0,
                        poliza TEXT DEFAULT '',
                        poliza_updated_at TEXT DEFAULT '',
                        disabled INTEGER NOT NULL DEFAULT 0,
                        UNIQUE(ip, puerto, usuario, password)
                    )
                `);

                // Copiar datos
                db.run(`
                    INSERT INTO proxies_new (id, ip, puerto, usuario, password, ubicacion, state_code, estado, sesionesCompletadas, poliza, poliza_updated_at, disabled)
                    SELECT id, ip, puerto, usuario, password, ubicacion, state_code, estado, sesionesCompletadas, poliza, poliza_updated_at, disabled FROM proxies
                `);

                // Eliminar tabla vieja y renombrar
                db.run('DROP TABLE proxies');
                db.run('ALTER TABLE proxies_new RENAME TO proxies');

                console.log('[PROXY-MANAGER] Migración de constraint completada');
            }
        }
    } catch (migrationError) {
        console.error('[PROXY-MANAGER] Error durante migración de constraint:', migrationError.message);
    }

    saveDB();
}

function saveDB() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

function normalizarEstado(stateCode) {
    if (!stateCode || typeof stateCode !== 'string') {
        return null;
    }
    const trimmed = stateCode.trim().toUpperCase();
    return trimmed.length === 2 ? trimmed : null;
}

function extraerEstadoDesdeUbicacion(ubicacion) {
    if (!ubicacion || typeof ubicacion !== 'string') {
        return null;
    }
    const match = ubicacion.match(/-(\w{2})$/);
    return match ? match[1].toUpperCase() : null;
}

function mapearNodo(row) {
    if (!row) {
        return null;
    }

    return {
        id: row[0],
        ip: row[1],
        puerto: row[2],
        usuario: row[3],
        password: row[4],
        ubicacion: row[5],
        stateCode: row[6],
        estado: row[7],
        sesionesCompletadas: row[8],
        poliza: row[9] || '',
        poliza_updated_at: row[10] || '',
        disabled: row[11] || 0
    };
}

/**
 * Parsea una línea de proxy en múltiples formatos soportados:
 * - HOST:PORT:USER:PASS (incluyendo IPRoyal con passwords complejos)
 * - HOST:PORT@USER:PASS
 * - USER:PASS:HOST:PORT
 * - USER:PASS@HOST:PORT
 * - IP:PORT:USER:PASS:UBICACION (formato legacy con 5 campos)
 * 
 * @param {string} linea - Línea de texto con el proxy
 * @returns {object|null} - Objeto con {ip, puerto, usuario, password} o null si es inválido
 */
function parsearLineaProxy(linea) {
    if (!linea || typeof linea !== 'string') {
        return null;
    }

    const trimmed = linea.trim();
    if (!trimmed || trimmed.startsWith('#')) {
        return null;
    }

    let ip, puerto, usuario, password;

    // Formato 1: HOST:PORT@USER:PASS
    if (trimmed.includes('@') && !trimmed.startsWith('@')) {
        const atIndex = trimmed.indexOf('@');
        const hostPort = trimmed.substring(0, atIndex);
        const userPass = trimmed.substring(atIndex + 1);

        // Verificar si es HOST:PORT@USER:PASS o USER:PASS@HOST:PORT
        const hostPortParts = hostPort.split(':');
        const userPassParts = userPass.split(':');

        if (hostPortParts.length >= 2 && userPassParts.length >= 2) {
            // Determinar cuál lado tiene el puerto (número válido)
            const possiblePort1 = parseInt(hostPortParts[1], 10);
            const possiblePort2 = parseInt(userPassParts[1], 10);

            if (possiblePort1 >= 1 && possiblePort1 <= 65535 && isNaN(possiblePort2)) {
                // HOST:PORT@USER:PASS
                ip = hostPortParts[0];
                puerto = possiblePort1;
                usuario = userPassParts[0];
                // El password puede contener ":" así que unimos todo lo demás
                password = userPassParts.slice(1).join(':');
            } else if (possiblePort2 >= 1 && possiblePort2 <= 65535) {
                // USER:PASS@HOST:PORT
                usuario = hostPortParts[0];
                password = hostPortParts.slice(1).join(':');
                ip = userPassParts[0];
                puerto = possiblePort2;
            }
        }
    }

    // Formato 2: Sin @, usar ":" como separador (HOST:PORT:USER:PASS o USER:PASS:HOST:PORT)
    if (!ip || !puerto) {
        const parts = trimmed.split(':');

        if (parts.length >= 4) {
            // Intentar HOST:PORT:USER:PASS (el segundo elemento debe ser puerto válido)
            const possiblePort = parseInt(parts[1], 10);
            if (possiblePort >= 1 && possiblePort <= 65535) {
                // HOST:PORT:USER:PASS... (IPRoyal y similares)
                ip = parts[0];
                puerto = possiblePort;
                usuario = parts[2];
                // El password es todo lo que queda (puede contener ":")
                password = parts.slice(3).join(':');
            } else {
                // Intentar USER:PASS:HOST:PORT (el último elemento debe ser puerto válido)
                const lastPort = parseInt(parts[parts.length - 1], 10);
                if (lastPort >= 1 && lastPort <= 65535) {
                    // USER:PASS:HOST:PORT
                    usuario = parts[0];
                    // Password puede tener múltiples ":", así que tomamos desde el índice 1 hasta length-2
                    password = parts.slice(1, parts.length - 2).join(':');
                    ip = parts[parts.length - 2];
                    puerto = lastPort;
                }
            }
        }
    }

    // Validar resultado
    if (!ip || !puerto || !usuario || !password) {
        return null;
    }

    // Validar IP/hostname básico
    if (ip.length < 1 || ip.includes(' ')) {
        return null;
    }

    return { ip, puerto, usuario, password };
}

async function importarProxiesDesdeArchivo(rutaArchivo, stateCode) {
    try {
        await initDB();
        const estadoNormalizado = normalizarEstado(stateCode);
        if (!estadoNormalizado) {
            return {
                exito: false,
                nodosCargados: 0,
                mensaje: 'Debe proporcionar un estado válido (ej. NY, FL)'
            };
        }

        const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
        const lineas = contenido.split('\n');

        const registros = [];
        let lineasInvalidas = 0;

        for (let i = 0; i < lineas.length; i++) {
            const linea = lineas[i].trim();
            if (!linea || linea.startsWith('#')) {
                continue;
            }

            const parsed = parsearLineaProxy(linea);

            if (!parsed) {
                console.warn(`[PROXY-MANAGER] Línea ${i + 1} inválida (formato no reconocido): ${linea}`);
                lineasInvalidas++;
                continue;
            }

            registros.push({
                ip: parsed.ip,
                puerto: parsed.puerto,
                usuario: parsed.usuario,
                password: parsed.password,
                ubicacion: estadoNormalizado,
                state_code: estadoNormalizado
            });
        }

        if (!registros.length) {
            return {
                exito: false,
                nodosCargados: 0,
                mensaje: 'No se encontraron proxies válidos en el archivo'
            };
        }

        // Insertar cada registro (sql.js: usar db.run con parámetros)
        for (const reg of registros) {
            db.run(
                `INSERT OR REPLACE INTO proxies (ip, puerto, usuario, password, ubicacion, state_code, estado, sesionesCompletadas)
                 VALUES (?, ?, ?, ?, ?, ?, 'disponible', 0)`,
                [reg.ip, reg.puerto, reg.usuario, reg.password, reg.ubicacion, reg.state_code]
            );
        }

        saveDB();

        console.log(`[PROXY-MANAGER] ${registros.length} proxies almacenados para ${estadoNormalizado}. Líneas inválidas: ${lineasInvalidas}`);

        return {
            exito: true,
            nodosCargados: registros.length,
            mensaje: `${registros.length} proxies guardados para ${estadoNormalizado}`,
            lineasInvalidas
        };
    } catch (error) {
        console.error('[PROXY-MANAGER] Error al importar proxies:', error);
        return {
            exito: false,
            nodosCargados: 0,
            mensaje: `Error al importar proxies: ${error.message}`
        };
    }
}

async function obtenerSiguienteNodo(ubicacion) {
    await initDB();
    const estado = extraerEstadoDesdeUbicacion(ubicacion);
    console.log(`[PROXY-MANAGER] Buscando proxy para ubicación: ${ubicacion}, estado extraído: ${estado}`);

    if (!estado) {
        console.warn('[PROXY-MANAGER] No se pudo extraer el estado de la ubicación:', ubicacion);
        return null;
    }

    // Debug: ver cuántos proxies hay para este estado
    const debugFilas = db.exec(`SELECT COUNT(*) as total, SUM(CASE WHEN estado = 'disponible' AND disabled = 0 THEN 1 ELSE 0 END) as disponibles FROM proxies WHERE state_code = '${estado}'`);
    if (debugFilas && debugFilas.length > 0 && debugFilas[0].values && debugFilas[0].values.length > 0) {
        console.log(`[PROXY-MANAGER] Debug - Estado ${estado}: Total=${debugFilas[0].values[0][0]}, Disponibles (no disabled)=${debugFilas[0].values[0][1]}`);
    }

    // Seleccionar el ÚLTIMO proxy disponible (mayor ID) que no esté deshabilitado
    const filas = db.exec(`SELECT id, ip, puerto, usuario, password, ubicacion, state_code, estado, sesionesCompletadas, poliza, poliza_updated_at, disabled FROM proxies WHERE state_code = '${estado}' AND estado = 'disponible' AND disabled = 0 ORDER BY id DESC LIMIT 1`);
    if (!filas || filas.length === 0) {
        console.warn(`[PROXY-MANAGER] Sin proxies disponibles para ${estado} (filas vacías)`);
        return null;
    }

    const values = filas[0].values || [];
    if (!values.length) {
        console.warn(`[PROXY-MANAGER] Sin proxies disponibles para ${estado} (values vacíos)`);
        return null;
    }

    const row = values[0];
    console.log(`[PROXY-MANAGER] Proxy seleccionado (último disponible) ${row[1]}:${row[2]} (${row[6]})`);
    return mapearNodo(row);
}

function getProxyForPlaywright(nodo) {
    if (!nodo) {
        return null;
    }

    return {
        server: `http://${nodo.ip}:${nodo.puerto}`,
        username: nodo.usuario,
        password: nodo.password
    };
}

async function marcarSesionCompletada(nodoId) {
    await initDB();

    // Usar db.exec para obtener el proxy actual
    const filas = db.exec(`SELECT id, ip, puerto, usuario, password, ubicacion, state_code, estado, sesionesCompletadas, poliza, poliza_updated_at, disabled FROM proxies WHERE id = ${nodoId}`);
    if (!filas || filas.length === 0 || !filas[0].values || !filas[0].values.length) {
        return {
            exito: false,
            mensaje: 'Nodo no encontrado'
        };
    }

    const row = filas[0].values[0];
    const ipProxy = row[1];
    const puertoProxy = row[2];
    const sesionesActuales = row[8] || 0;
    const estadoActual = row[7];

    const nuevasSesiones = sesionesActuales + 1;
    const nuevoEstado = nuevasSesiones >= 3 ? 'BURNED' : estadoActual;

    db.run('UPDATE proxies SET sesionesCompletadas = ?, estado = ? WHERE id = ?', [nuevasSesiones, nuevoEstado, nodoId]);
    saveDB();

    if (nuevoEstado === 'BURNED') {
        console.warn(`[PROXY-MANAGER] Nodo QUEMADO: ${ipProxy}:${puertoProxy}`);
    }

    return {
        exito: true,
        mensaje: nuevoEstado === 'BURNED' ? 'Sesión marcada. Nodo QUEMADO' : 'Sesión marcada exitosamente',
        estado: nuevoEstado,
        sesionesCompletadas: nuevasSesiones
    };
}

async function obtenerResumenEstados() {
    await initDB();
    // Contar disponibles que NO estén deshabilitados (disabled = 0)
    const stmt = db.prepare(`
        SELECT state_code AS estado,
               COUNT(*) AS total,
               SUM(CASE WHEN estado = 'disponible' AND disabled = 0 THEN 1 ELSE 0 END) AS disponibles
        FROM proxies
        GROUP BY state_code
        ORDER BY estado ASC
    `);

    const filas = [];
    while (stmt.step()) {
        filas.push(stmt.getAsObject());
    }
    stmt.free();

    return filas.map(fila => ({
        estado: fila.estado,
        total: fila.total,
        disponibles: fila.disponibles || 0
    }));
}

async function contarDisponiblesPorEstado(stateCode) {
    await initDB();
    const estado = normalizarEstado(stateCode);
    if (!estado) {
        return { total: 0, disponibles: 0 };
    }

    // Contar disponibles que NO estén deshabilitados
    const resultado = db.prepare(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN estado = 'disponible' AND disabled = 0 THEN 1 ELSE 0 END) AS disponibles
        FROM proxies
        WHERE state_code = ?
    `).getAsObject({ ':state_code': estado });

    console.log(`[PROXY-MANAGER] contarDisponiblesPorEstado(${estado}): total=${resultado.total}, disponibles=${resultado.disponibles}`);

    return {
        total: resultado.total || 0,
        disponibles: resultado.disponibles || 0
    };
}

async function obtenerProxiesPorEstado(stateCode) {
    await initDB();
    if (!stateCode) {
        // devolver todos, ordenando habilitados primero y deshabilitados al fondo
        const filas = db.exec(`SELECT id, ip, puerto, usuario, password, ubicacion, state_code, estado, sesionesCompletadas, poliza, poliza_updated_at, disabled FROM proxies ORDER BY disabled ASC, state_code, id`);
        if (!filas || filas.length === 0) return [];
        const values = filas[0].values || [];
        return values.map(r => ({
            id: r[0], ip: r[1], puerto: r[2], usuario: r[3], password: r[4], ubicacion: r[5], stateCode: r[6], estado: r[7], sesionesCompletadas: r[8], poliza: r[9] || '', poliza_updated_at: r[10] || '', disabled: r[11] || 0
        }));
    }

    const estado = normalizarEstado(stateCode);
    if (!estado) return [];

    // Ordenar habilitados primero (disabled=0), deshabilitados al fondo (disabled=1)
    const filas = db.exec(`SELECT id, ip, puerto, usuario, password, ubicacion, state_code, estado, sesionesCompletadas, poliza, poliza_updated_at, disabled FROM proxies WHERE state_code = '${estado}' ORDER BY disabled ASC, id`);
    if (!filas || filas.length === 0) return [];
    const values = filas[0].values || [];
    return values.map(r => ({
        id: r[0], ip: r[1], puerto: r[2], usuario: r[3], password: r[4], ubicacion: r[5], stateCode: r[6], estado: r[7], sesionesCompletadas: r[8], poliza: r[9] || '', poliza_updated_at: r[10] || '', disabled: r[11] || 0
    }));
}

async function actualizarPoliza(proxyId, poliza) {
    await initDB();
    const ahora = new Date().toISOString();
    db.run('UPDATE proxies SET poliza = ?, poliza_updated_at = ? WHERE id = ?', [poliza, ahora, proxyId]);
    saveDB();
    return { exito: true, poliza, poliza_updated_at: ahora };
}

async function sumarPoliza(proxyId, cantidad) {
    await initDB();
    // Obtener póliza actual
    const filas = db.exec(`SELECT poliza FROM proxies WHERE id = ${proxyId}`);
    if (!filas || filas.length === 0 || !filas[0].values || !filas[0].values.length) {
        return { exito: false, mensaje: 'Proxy no encontrado' };
    }
    const polizaActual = parseInt(filas[0].values[0][0], 10) || 0;
    const nuevaPoliza = polizaActual + cantidad;
    const ahora = new Date().toISOString();
    db.run('UPDATE proxies SET poliza = ?, poliza_updated_at = ? WHERE id = ?', [nuevaPoliza.toString(), ahora, proxyId]);
    saveDB();
    return { exito: true, poliza: nuevaPoliza, poliza_updated_at: ahora };
}

async function incrementarSesiones(proxyId) {
    await initDB();
    // Obtener sesiones actuales
    const filas = db.exec(`SELECT sesionesCompletadas, estado FROM proxies WHERE id = ${proxyId}`);
    if (!filas || filas.length === 0 || !filas[0].values || !filas[0].values.length) {
        return { exito: false, mensaje: 'Proxy no encontrado' };
    }
    const sesionesActuales = filas[0].values[0][0] || 0;
    const estadoActual = filas[0].values[0][1];
    const nuevasSesiones = sesionesActuales + 1;
    // Marcar como BURNED si supera 3 sesiones
    const nuevoEstado = nuevasSesiones >= 3 ? 'BURNED' : estadoActual;
    db.run('UPDATE proxies SET sesionesCompletadas = ?, estado = ? WHERE id = ?', [nuevasSesiones, nuevoEstado, proxyId]);
    saveDB();
    console.log(`[PROXY-MANAGER] Sesiones incrementadas para proxy ${proxyId}: ${nuevasSesiones}`);
    return { exito: true, sesionesCompletadas: nuevasSesiones, estado: nuevoEstado };
}

async function toggleDisabled(proxyId) {
    await initDB();
    // Obtener estado actual
    const filas = db.exec(`SELECT disabled FROM proxies WHERE id = ${proxyId}`);
    if (!filas || filas.length === 0 || !filas[0].values || !filas[0].values.length) {
        return { exito: false, mensaje: 'Proxy no encontrado' };
    }
    const currentDisabled = filas[0].values[0][0] || 0;
    const newDisabled = currentDisabled ? 0 : 1;
    db.run('UPDATE proxies SET disabled = ? WHERE id = ?', [newDisabled, proxyId]);
    saveDB();
    return { exito: true, disabled: newDisabled };
}

async function verificarAlertaPolizas(proxyId) {
    await initDB();
    // Obtener datos del proxy
    const filas = db.exec(`SELECT poliza, poliza_updated_at, ip FROM proxies WHERE id = ${proxyId}`);
    if (!filas || filas.length === 0 || !filas[0].values || !filas[0].values.length) {
        return { alerta: false };
    }

    const polizaTotal = parseInt(filas[0].values[0][0], 10) || 0;
    const polizaUpdatedAt = filas[0].values[0][1];
    const ip = filas[0].values[0][2];

    // Verificar si se han creado más de 3 pólizas en menos de una semana
    if (polizaTotal >= 3 && polizaUpdatedAt) {
        const fechaActualizacion = new Date(polizaUpdatedAt);
        const ahora = new Date();
        const unaSemanaMs = 7 * 24 * 60 * 60 * 1000;
        const diferencia = ahora - fechaActualizacion;

        // Si la última actualización fue hace menos de una semana y hay 3+ pólizas
        if (diferencia < unaSemanaMs) {
            return {
                alerta: true,
                ip: ip,
                polizas: polizaTotal,
                mensaje: `⚠️ Se han creado ${polizaTotal} pólizas con la IP ${ip} en menos de una semana. Se recomienda deshabilitar esta IP.`
            };
        }
    }

    return { alerta: false };
}

async function obtenerProxyPorId(proxyId) {
    await initDB();
    const filas = db.exec(`SELECT id, ip, puerto, usuario, password, ubicacion, state_code, estado, sesionesCompletadas, poliza, poliza_updated_at, disabled FROM proxies WHERE id = ${proxyId}`);
    if (!filas || filas.length === 0 || !filas[0].values || !filas[0].values.length) {
        return null;
    }
    const r = filas[0].values[0];
    return {
        id: r[0], ip: r[1], puerto: r[2], usuario: r[3], password: r[4], ubicacion: r[5], stateCode: r[6], estado: r[7], sesionesCompletadas: r[8], poliza: r[9] || '', poliza_updated_at: r[10] || '', disabled: r[11] || 0
    };
}

module.exports = {
    importarProxiesDesdeArchivo,
    obtenerSiguienteNodo,
    marcarSesionCompletada,
    getProxyForPlaywright,
    obtenerResumenEstados,
    contarDisponiblesPorEstado,
    obtenerProxiesPorEstado,
    actualizarPoliza,
    sumarPoliza,
    incrementarSesiones,
    toggleDisabled,
    verificarAlertaPolizas,
    obtenerProxyPorId
};


