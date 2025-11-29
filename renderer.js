// ========== INICIALIZACIÓN ==========

// Esperar a que el DOM esté completamente cargado antes de ejecutar el código
document.addEventListener('DOMContentLoaded', () => {

    // ========== REFERENCIAS A ELEMENTOS DEL DOM ==========

    // Obtener referencias a los radio buttons de modo de validación
    const geoRestrictedRadio = document.getElementById('geoRestricted');
    const localModeRadio = document.getElementById('localMode');

    // Obtener referencia al dropdown de ubicaciones
    const locationSelect = document.getElementById('locationSelect');

    // Obtener referencias a los botones de acción
    const startSessionBtn = document.getElementById('startSessionBtn');

    // Variable para rastrear si hay una sesión activa
    let sesionActiva = false;

    // Variable para almacenar el proxy activo
    let proxyActivo = null;

    // Referencias al panel de proxy activo
    const activeProxyPanel = document.getElementById('activeProxyPanel');
    const activeProxyIP = document.getElementById('activeProxyIP');
    const activeProxyPort = document.getElementById('activeProxyPort');
    const activeProxyState = document.getElementById('activeProxyState');
    const activeProxyPolizas = document.getElementById('activeProxyPolizas');

    // Referencias al modal de pólizas
    const polizaModal = document.getElementById('polizaModal');
    const polizaModalInput = document.getElementById('polizaModalInput');
    const modalProxyIP = document.getElementById('modalProxyIP');
    const polizaModalCancel = document.getElementById('polizaModalCancel');
    const polizaModalConfirm = document.getElementById('polizaModalConfirm');

    // Obtener referencia al área de mensajes
    const messageArea = document.getElementById('messageArea');

    // Obtener referencia al área de drag & drop y botón de carga
    const dragDropArea = document.getElementById('dragDropArea');
    const loadFileBtn = document.getElementById('loadFileBtn');

    // Controles para importar proxies y mostrar disponibilidad
    const proxyStateSelect = document.getElementById('proxyStateSelect');
    const proxyStats = document.getElementById('proxyStats');

    // Obtener referencia al contador de sesiones
    const sessionCount = document.getElementById('sessionCount');


    // ========== FUNCIÓN AUXILIAR PARA MOSTRAR MENSAJES ==========

    /**
     * Muestra un mensaje en el área de mensajes
     * @param {string} texto - El texto del mensaje a mostrar
     * @param {string} tipo - El tipo de mensaje: 'error' o 'success'
     */
    function mostrarMensaje(texto, tipo = 'error') {
        // Limpiar clases previas
        messageArea.classList.remove('error', 'success');

        // Establecer el texto del mensaje
        messageArea.textContent = texto;

        // Añadir la clase correspondiente según el tipo
        if (tipo === 'error') {
            messageArea.classList.add('error');
        } else if (tipo === 'success') {
            messageArea.classList.add('success');
        }

        // Mostrar el área de mensajes
        messageArea.classList.add('show');

        // Ocultar el mensaje después de 5 segundos
        setTimeout(() => {
            messageArea.classList.remove('show');
        }, 5000);
    }

    function extraerEstadoDesdeUbicacion(ubicacion) {
        if (!ubicacion) {
            return null;
        }
        const match = ubicacion.match(/-(\w{2})$/);
        return match ? match[1].toUpperCase() : null;
    }

    function renderizarResumen(resumen = []) {
        if (!proxyStats) {
            return;
        }

        if (!resumen.length) {
            proxyStats.innerHTML = '<p>No hay proxies cargados. Importa un archivo para comenzar.</p>';
        } else {
            proxyStats.innerHTML = resumen.map((item) => (
                `<div class="proxy-card">
                    <strong>${item.estado}</strong>
                    <span>${item.disponibles} disponibles / ${item.total} total</span>
                </div>`
            )).join('');
        }

        actualizarOpcionesDeUbicacion(resumen);
    }

    function actualizarOpcionesDeUbicacion(resumen = []) {
        if (!locationSelect) {
            return;
        }

        const estadosDisponibles = new Set(
            resumen.filter((item) => item.disponibles > 0).map((item) => item.estado)
        );

        Array.from(locationSelect.options).forEach((option) => {
            const stateCode = extraerEstadoDesdeUbicacion(option.value);
            if (!stateCode) {
                return;
            }
            option.disabled = !estadosDisponibles.has(stateCode);
        });
    }

    async function refrescarResumenProxies() {
        try {
            const respuesta = await window.api.obtenerResumenProxies();
            if (respuesta.exito) {
                renderizarResumen(respuesta.resumen || []);
            } else {
                renderizarResumen([]);
                if (respuesta.mensaje) {
                    mostrarMensaje(respuesta.mensaje, 'error');
                }
            }
        } catch (error) {
            console.error('[RENDERER] Error al consultar resumen de proxies:', error);
            renderizarResumen([]);
            mostrarMensaje('No se pudo obtener el estado de los proxies', 'error');
        }
    }

    async function importarProxies(rutaArchivo, stateCode) {
        if (!rutaArchivo) {
            mostrarMensaje('No se seleccionó archivo para importar', 'error');
            return;
        }

        console.log('[RENDERER] Importando proxies desde:', rutaArchivo, 'estado:', stateCode);

        try {
            const respuesta = await window.api.importarProxiesDesdeArchivo(rutaArchivo, stateCode);
            if (respuesta.exito) {
                mostrarMensaje(respuesta.mensaje || 'Proxies importados correctamente', 'success');
                await refrescarResumenProxies();
            } else {
                mostrarMensaje(respuesta.mensaje || 'Error al importar proxies', 'error');
            }
        } catch (error) {
            console.error('[RENDERER] Error al importar proxies:', error);
            mostrarMensaje('No se pudo importar el archivo de proxies', 'error');
        }
    }


    // ========== EVENT LISTENERS PARA RADIO BUTTONS ==========

    // Listener para el radio button de Validación Geo-Restringida
    geoRestrictedRadio.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Habilitar el dropdown de ubicaciones
            locationSelect.removeAttribute('disabled');
            console.log('Modo Geo-Restringido activado - Dropdown habilitado');
        }
    });

    // Listener para el radio button de Validación Local
    localModeRadio.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Deshabilitar el dropdown de ubicaciones
            locationSelect.setAttribute('disabled', '');
            // Resetear la selección del dropdown
            locationSelect.value = '';
            console.log('Modo Local activado - Dropdown deshabilitado');
        }
    });


    // ========== EVENT LISTENERS PARA BOTONES DE ACCIÓN ==========

    // Función para actualizar el estado visual del botón
    function actualizarBotonSesion(activa) {
        sesionActiva = activa;
        if (activa) {
            startSessionBtn.textContent = 'Cerrar Navegador';
            startSessionBtn.classList.add('active-session');
        } else {
            startSessionBtn.textContent = 'Iniciar Navegador';
            startSessionBtn.classList.remove('active-session');
        }
    }

    // Función para mostrar el panel de proxy activo
    function mostrarProxyActivo(nodo) {
        if (!nodo) {
            activeProxyPanel.style.display = 'none';
            proxyActivo = null;
            return;
        }

        proxyActivo = nodo;
        activeProxyIP.textContent = nodo.ip;
        activeProxyPort.textContent = nodo.puerto;
        activeProxyState.textContent = nodo.stateCode || '-';
        activeProxyPolizas.textContent = parseInt(nodo.poliza, 10) || 0;
        activeProxyPanel.style.display = 'block';
    }

    // Función para ocultar el panel de proxy activo
    function ocultarProxyActivo() {
        activeProxyPanel.style.display = 'none';
        proxyActivo = null;
    }

    // Función para mostrar el modal de pólizas
    function mostrarModalPolizas() {
        // Mostrar IP del proxy si existe, o indicar modo local
        if (proxyActivo) {
            modalProxyIP.textContent = `${proxyActivo.ip}:${proxyActivo.puerto}`;
        } else {
            modalProxyIP.textContent = 'Modo local (sin proxy)';
        }
        polizaModalInput.value = '';
        polizaModal.style.display = 'flex';
        polizaModalInput.focus();
    }

    // Función para ocultar el modal de pólizas
    function ocultarModalPolizas() {
        polizaModal.style.display = 'none';
        polizaModalInput.value = '';
    }

    // Función para mostrar alerta de pólizas
    function mostrarAlertaPolizas(alerta) {
        if (!alerta || !alerta.alerta) return;

        // Crear elemento de alerta si no existe
        let alertaElement = document.getElementById('polizaWarningAlert');
        if (!alertaElement) {
            alertaElement = document.createElement('div');
            alertaElement.id = 'polizaWarningAlert';
            alertaElement.className = 'warning-alert';
            activeProxyPanel.parentNode.insertBefore(alertaElement, activeProxyPanel.nextSibling);
        }

        alertaElement.innerHTML = `
            <div class="warning-alert-title">⚠️ Alerta de Pólizas</div>
            <div class="warning-alert-text">${alerta.mensaje}</div>
        `;
        alertaElement.style.display = 'block';

        // Ocultar después de 15 segundos
        setTimeout(() => {
            alertaElement.style.display = 'none';
        }, 15000);
    }

    // Eventos del modal
    polizaModalCancel.addEventListener('click', () => {
        ocultarModalPolizas();
    });

    polizaModalConfirm.addEventListener('click', async () => {
        const polizasCreadas = parseInt(polizaModalInput.value, 10) || 0;

        ocultarModalPolizas();

        try {
            console.log('[RENDERER] Cerrando navegador con', polizasCreadas, 'pólizas');
            const respuesta = await window.api.finalizarSesion('cerrada', polizasCreadas);

            console.log('[RENDERER] Respuesta recibida:', respuesta);

            if (respuesta.exito) {
                let mensaje = respuesta.mensaje || 'Navegador cerrado';
                if (polizasCreadas > 0) {
                    mensaje += ` (+${polizasCreadas} pólizas registradas)`;
                }
                mostrarMensaje(mensaje, 'success');
                actualizarBotonSesion(false);
                ocultarProxyActivo();

                // Mostrar alerta si existe
                if (respuesta.alertaPolizas) {
                    mostrarAlertaPolizas(respuesta.alertaPolizas);
                }

                await refrescarResumenProxies();

                // Refrescar lista de proxies si está visible
                if (proxiesVisible) {
                    await cargarListadoDeProxies();
                }
            } else {
                mostrarMensaje(respuesta.mensaje || 'Error al cerrar navegador', 'error');
            }
        } catch (error) {
            console.error('[RENDERER] Error al cerrar navegador:', error);
            mostrarMensaje('Error al comunicarse con el proceso principal', 'error');
        }
    });

    // Cerrar modal con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && polizaModal.style.display === 'flex') {
            ocultarModalPolizas();
        }
    });

    // Confirmar con Enter en el modal
    polizaModalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            polizaModalConfirm.click();
        }
    });

    // Listener para el botón de Iniciar/Cerrar Sesión
    startSessionBtn.addEventListener('click', async () => {
        // Si hay sesión activa, mostrar modal para preguntar pólizas
        if (sesionActiva) {
            console.log('Botón CERRAR NAVEGADOR presionado');
            mostrarModalPolizas();
            return;
        }

        console.log('Botón INICIAR NAVEGADOR presionado');

        // Verificar que se haya seleccionado un modo de validación
        if (!geoRestrictedRadio.checked && !localModeRadio.checked) {
            mostrarMensaje('Por favor, selecciona un modo de validación', 'error');
            return;
        }

        // Determinar el modo seleccionado
        let modo = '';
        let ubicacion = '';

        if (geoRestrictedRadio.checked) {
            modo = 'geo';
            ubicacion = locationSelect.value;

            // Verificar que se haya seleccionado una ubicación
            if (!ubicacion) {
                mostrarMensaje('Por favor, selecciona una ubicación', 'error');
                return;
            }
        } else if (localModeRadio.checked) {
            modo = 'local';
            ubicacion = ''; // No se necesita ubicación en modo local
        }

        // Mostrar mensaje de inicio
        mostrarMensaje('Iniciando sesión de prueba...', 'success');

        try {
            // Llamar a la API del proceso principal para iniciar la sesión
            console.log(`[RENDERER] Llamando a window.api.iniciarSesion('${modo}', '${ubicacion}')`);
            const respuesta = await window.api.iniciarSesion(modo, ubicacion);

            console.log('[RENDERER] Respuesta recibida:', respuesta);

            // Manejar la respuesta
            if (respuesta.exito) {
                mostrarMensaje(respuesta.mensaje || 'Navegador iniciado exitosamente', 'success');
                actualizarBotonSesion(true);

                // Mostrar panel de proxy activo si hay nodo
                if (respuesta.nodo) {
                    mostrarProxyActivo(respuesta.nodo);
                }

                await refrescarResumenProxies();
            } else {
                mostrarMensaje(respuesta.mensaje || 'Error al iniciar navegador', 'error');
            }
        } catch (error) {
            console.error('[RENDERER] Error al iniciar sesión:', error);
            mostrarMensaje('Error al comunicarse con el proceso principal', 'error');
        }
    });


    // ========== EVENT LISTENERS PARA GESTIÓN DE ARCHIVOS ==========

    // Listener para el botón de cargar archivos
    loadFileBtn.addEventListener('click', async () => {
        console.log('Botón CARGAR ARCHIVO presionado');

        const stateCode = proxyStateSelect.value;
        if (!stateCode) {
            mostrarMensaje('Selecciona el estado de los proxies antes de importar', 'error');
            return;
        }

        const rutaArchivo = await window.api.seleccionarArchivoDeProxies();
        if (!rutaArchivo) {
            console.log('[RENDERER] Selección de archivo cancelada');
            return;
        }

        importarProxies(rutaArchivo, stateCode);
    });

    // Listeners para el área de drag & drop
    dragDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragDropArea.style.borderColor = 'rgba(108, 92, 231, 0.9)';
        dragDropArea.style.background = 'rgba(108, 92, 231, 0.15)';
    });

    dragDropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragDropArea.style.borderColor = 'rgba(108, 92, 231, 0.4)';
        dragDropArea.style.background = 'rgba(255, 255, 255, 0.02)';
    });

    dragDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDropArea.style.borderColor = 'rgba(108, 92, 231, 0.4)';
        dragDropArea.style.background = 'rgba(255, 255, 255, 0.02)';

        console.log('Archivos soltados en el área de drag & drop');
        const files = e.dataTransfer.files;
        const stateCode = proxyStateSelect.value;

        if (!stateCode) {
            mostrarMensaje('Selecciona el estado antes de importar proxies', 'error');
            return;
        }

        if (files.length > 0 && files[0].path) {
            importarProxies(files[0].path, stateCode);
        } else {
            mostrarMensaje('No se pudo leer el archivo arrastrado', 'error');
        }
    });

    // Ver proxies (mostrar lista)
    const viewProxiesBtn = document.getElementById('viewProxiesBtn');
    const proxyListTable = document.getElementById('proxyListTable');
    const proxyListBody = document.getElementById('proxyListBody');
    const proxyListContainer = document.getElementById('proxyListContainer');
    let proxiesVisible = false;

    function formatearFecha(isoString) {
        if (!isoString) return '-';
        const fecha = new Date(isoString);
        return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function crearFilaProxy(p) {
        const tr = document.createElement('tr');
        tr.dataset.proxyId = p.id;
        if (p.disabled) {
            tr.classList.add('proxy-disabled-row');
        }

        const polizaTotal = parseInt(p.poliza, 10) || 0;

        tr.innerHTML = `
            <td>${p.id}</td>
            <td><span class="state-badge">${p.stateCode || '-'}</span></td>
            <td>${p.ip}</td>
            <td>${p.puerto}</td>
            <td>${p.usuario}</td>
            <td>${p.sesionesCompletadas}</td>
            <td class="poliza-total">${polizaTotal}</td>
            <td>
                <div class="poliza-add-group">
                    <input type="number" class="poliza-add-input" value="" placeholder="+" min="0" data-proxy-id="${p.id}">
                    <button class="btn-confirm" data-proxy-id="${p.id}" title="Sumar pólizas">✓</button>
                </div>
            </td>
            <td class="poliza-updated-at">${formatearFecha(p.poliza_updated_at)}</td>
            <td>
                <button class="btn-icon ${p.disabled ? 'btn-enable' : 'btn-disable'}" data-proxy-id="${p.id}" title="${p.disabled ? 'Habilitar proxy' : 'Deshabilitar proxy'}">
                    ${p.disabled ? '✔' : '✖'}
                </button>
            </td>
        `;

        // Evento para sumar pólizas al hacer clic en confirmar
        const polizaAddInput = tr.querySelector('.poliza-add-input');
        const btnConfirm = tr.querySelector('.btn-confirm');
        const tdPolizaTotal = tr.querySelector('.poliza-total');

        btnConfirm.addEventListener('click', async () => {
            const cantidadAgregar = parseInt(polizaAddInput.value, 10) || 0;
            if (cantidadAgregar <= 0) {
                mostrarMensaje('Ingresa una cantidad mayor a 0', 'error');
                return;
            }
            const proxyId = parseInt(btnConfirm.dataset.proxyId, 10);
            try {
                const resultado = await window.api.sumarPoliza(proxyId, cantidadAgregar);
                if (resultado.exito) {
                    tdPolizaTotal.textContent = resultado.poliza;
                    const tdFecha = tr.querySelector('.poliza-updated-at');
                    tdFecha.textContent = formatearFecha(resultado.poliza_updated_at);
                    polizaAddInput.value = '';
                    mostrarMensaje(`+${cantidadAgregar} pólizas agregadas (Total: ${resultado.poliza})`, 'success');
                } else {
                    mostrarMensaje('Error al sumar pólizas', 'error');
                }
            } catch (err) {
                console.error('[RENDERER] Error al sumar póliza:', err);
            }
        });

        // Evento para habilitar/deshabilitar
        const btnToggle = tr.querySelector('.btn-icon');
        btnToggle.addEventListener('click', async () => {
            const proxyId = parseInt(btnToggle.dataset.proxyId, 10);
            try {
                const resultado = await window.api.toggleProxyDisabled(proxyId);
                if (resultado.exito) {
                    if (resultado.disabled) {
                        tr.classList.add('proxy-disabled-row');
                        btnToggle.classList.remove('btn-disable');
                        btnToggle.classList.add('btn-enable');
                        btnToggle.innerHTML = '✔';
                        btnToggle.title = 'Habilitar proxy';
                    } else {
                        tr.classList.remove('proxy-disabled-row');
                        btnToggle.classList.remove('btn-enable');
                        btnToggle.classList.add('btn-disable');
                        btnToggle.innerHTML = '✖';
                        btnToggle.title = 'Deshabilitar proxy';
                    }
                    mostrarMensaje(resultado.disabled ? 'Proxy deshabilitado' : 'Proxy habilitado', 'success');
                } else {
                    mostrarMensaje('Error al cambiar estado del proxy', 'error');
                }
            } catch (err) {
                console.error('[RENDERER] Error al togglear proxy:', err);
            }
        });

        return tr;
    }

    async function cargarListadoDeProxies() {
        const stateCode = proxyStateSelect.value || '';
        try {
            const respuesta = await window.api.listarProxies(stateCode);
            if (!respuesta || !respuesta.exito) {
                mostrarMensaje(respuesta && respuesta.mensaje ? respuesta.mensaje : 'Error al obtener proxies', 'error');
                return false;
            }

            const proxies = respuesta.proxies || [];
            proxyListBody.innerHTML = '';
            if (!proxies.length) {
                mostrarMensaje('No se encontraron proxies para el estado seleccionado', 'error');
                proxyListTable.style.display = 'none';
                return false;
            }

            for (const p of proxies) {
                proxyListBody.appendChild(crearFilaProxy(p));
            }

            proxyListTable.style.display = 'table';
            mostrarMensaje(`Mostrando ${proxies.length} proxies`, 'success');
            return true;
        } catch (error) {
            console.error('[RENDERER] Error al listar proxies:', error);
            mostrarMensaje('Error al listar proxies', 'error');
            return false;
        }
    }

    viewProxiesBtn.addEventListener('click', async () => {
        if (!proxiesVisible) {
            viewProxiesBtn.disabled = true;
            viewProxiesBtn.textContent = 'Cargando...';
            const cargado = await cargarListadoDeProxies();
            viewProxiesBtn.disabled = false;
            if (!cargado) {
                viewProxiesBtn.textContent = 'Ver proxies';
                return;
            }
            proxiesVisible = true;
            proxyListContainer.classList.add('visible');
            viewProxiesBtn.textContent = 'Ocultar proxies';
        } else {
            proxyListTable.style.display = 'none';
            proxyListBody.innerHTML = '';
            proxyListContainer.classList.remove('visible');
            proxiesVisible = false;
            viewProxiesBtn.textContent = 'Ver proxies';
        }
    });


    // ========== INICIALIZACIÓN ==========

    /**
     * Carga el estado inicial de la aplicación
     * Llama al proceso principal para cargar los nodos desde el archivo
     */
    async function cargarEstadoInicial() {
        console.log('[RENDERER] Cargando estado inicial...');
        await refrescarResumenProxies();
    }

    // Suscribirse a las actualizaciones del contador desde el proceso principal
    window.api.onUpdateCounter((nuevoValor) => {
        console.log('[RENDERER] Actualizando contador a:', nuevoValor);
        sessionCount.textContent = nuevoValor;
    });

    // Cargar el estado inicial al arrancar la aplicación
    cargarEstadoInicial();

    // Mensaje de bienvenida en la consola
    console.log('Shield Browser - Sistema de Testing de Ciberseguridad cargado correctamente');
    console.log('Versión: 1.0.0');

});
