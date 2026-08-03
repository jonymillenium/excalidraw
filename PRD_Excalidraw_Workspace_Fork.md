# PRD — Excalidraw Workspace Fork

**Versión:** 1.0
**Fecha:** 3 de agosto de 2026
**Estado:** Listo para implementación
**Base:** repositorio oficial `excalidraw/excalidraw`, rama `master`
**Nombre temporal del producto:** Excalidraw Workspace Fork

---

## 0. Instrucción principal para Codex

Trabajar dentro de la carpeta asignada por el usuario y convertir el repositorio oficial de Excalidraw en una aplicación local-first con:

1. Proyectos.
2. Múltiples lienzos dentro de cada proyecto.
3. Protección real por contraseña a nivel de proyecto.
4. Vistas guardadas para recorrer diferentes sectores de un lienzo con transiciones animadas.
5. Una arquitectura preparada para agregar inteligencia artificial más adelante, sin implementar IA en este MVP.

### Flujo Git obligatorio

1. Verificar autenticación:

```bash
gh auth status
```

2. Obtener el usuario autenticado:

```bash
gh api user --jq .login
```

3. Si la carpeta está vacía, crear un fork del repositorio oficial, clonarlo y configurar remotos:

```bash
gh repo fork excalidraw/excalidraw --clone --remote
```

El resultado debe tener:

- `origin`: fork perteneciente al usuario autenticado.
- `upstream`: `excalidraw/excalidraw`.

4. Si la carpeta ya contiene el repositorio, verificar los remotos y corregirlos sin borrar trabajo existente.

5. Crear una rama:

```bash
git checkout -b feature/workspaces-projects-views-security
```

6. No trabajar directamente sobre `master`.

7. Preservar la licencia MIT y todos los avisos de copyright existentes.

8. Antes de modificar código:

```bash
yarn
yarn test:typecheck
yarn build:app
```

9. Usar preferentemente Node.js 20 LTS y Yarn 1.22.22.

10. Realizar commits pequeños por fase y, al finalizar, subir la rama al fork. No fusionar automáticamente a `master`.

---

# 1. Resumen del producto

Excalidraw Workspace Fork será una versión de Excalidraw orientada a organizar trabajo complejo.

En lugar de abrir directamente un único lienzo infinito, el usuario ingresará a un dashboard donde podrá crear distintos proyectos. Cada proyecto tendrá múltiples lienzos independientes. Dentro de cada lienzo podrá guardar “vistas”, equivalentes a posiciones de cámara, para volver rápidamente a sectores concretos del canvas y recorrerlos secuencialmente.

Un proyecto podrá protegerse con contraseña. La protección no debe ser únicamente visual: el contenido persistido debe quedar cifrado localmente.

La aplicación seguirá siendo local-first. El MVP no tendrá cuentas, backend, sincronización en nube ni colaboración en tiempo real.

---

# 2. Problema

La versión estándar de Excalidraw funciona principalmente como un único espacio de dibujo. Para trabajos grandes aparecen tres problemas:

1. No existe una jerarquía clara de proyectos y lienzos.
2. No existe una navegación editorial por zonas importantes de un canvas.
3. Cualquier persona con acceso al navegador o almacenamiento local puede abrir el contenido.

La solución debe ampliar la experiencia sin reescribir el motor de dibujo de Excalidraw.

---

# 3. Principios de arquitectura

## 3.1 Excalidraw continúa siendo el editor

No reimplementar:

- Herramientas de dibujo.
- Selección.
- Zoom.
- Pan.
- Elementos.
- Historial.
- Exportación estándar.
- Renderizado.
- Bibliotecas.

Las nuevas funciones deben construirse principalmente dentro de `excalidraw-app/`, consumiendo las APIs públicas del editor.

## 3.2 Evitar modificar el núcleo

No modificar `packages/excalidraw/` salvo que exista una necesidad técnica demostrable que no pueda resolverse con la API pública.

Usar principalmente:

- `initialData`
- `onChange`
- `excalidrawAPI.getSceneElements()`
- `excalidrawAPI.getAppState()`
- `excalidrawAPI.getFiles()`
- `excalidrawAPI.updateScene()`
- `excalidrawAPI.addFiles()`
- `excalidrawAPI.setViewport()`
- `excalidrawAPI.history.clear()`

## 3.3 Local-first

Todo debe funcionar sin internet después de cargar la aplicación.

El almacenamiento principal será IndexedDB. `localStorage` se utilizará únicamente para preferencias pequeñas, identificadores de última sesión y datos no críticos.

## 3.4 Separación por dominios

Crear una capa de aplicación independiente del editor:

```text
excalidraw-app/
  features/
    workspace/
      components/
      domain/
      storage/
      crypto/
      hooks/
      services/
      tests/
```

Los nombres exactos pueden adaptarse a las convenciones actuales del repositorio, pero la separación conceptual es obligatoria.

---

# 4. Alcance del MVP

## Incluido

- Dashboard de proyectos.
- Crear, renombrar, duplicar, ordenar y eliminar proyectos.
- Crear, renombrar, duplicar, ordenar y eliminar lienzos.
- Autosave independiente por lienzo.
- Apertura del último proyecto y lienzo utilizado.
- Protección por contraseña a nivel de proyecto.
- Cifrado del contenido persistido del proyecto.
- Bloqueo y desbloqueo manual.
- Vistas guardadas por lienzo.
- Navegación animada entre vistas.
- Ordenamiento de vistas.
- Modo de recorrido/presentación de vistas.
- Exportación e importación de un proyecto completo.
- Migración inicial del lienzo local existente.
- Pruebas unitarias, de integración y end-to-end esenciales.
- Documentación de instalación y arquitectura.

## Fuera del MVP

- Usuarios y autenticación remota.
- Backend.
- Sincronización entre dispositivos.
- Colaboración en tiempo real.
- Compartir proyectos por URL.
- Permisos por usuario.
- Contraseñas distintas para cada lienzo.
- Recuperación de contraseña.
- Inteligencia artificial funcional.
- Historial de versiones completo.
- Autoplay de presentaciones.
- Aplicaciones nativas para macOS, Windows, iOS o Android.

---

# 5. Usuarios objetivo

## Usuario principal

Persona que utiliza Excalidraw para organizar ideas, sistemas, marcas, productos, procesos, investigación, diagramas o proyectos extensos.

## Necesidades

- Separar contextos.
- Evitar que un único canvas se vuelva inmanejable.
- Encontrar rápidamente sectores importantes.
- Presentar un canvas como una secuencia.
- Proteger información sensible.
- Trabajar localmente sin depender de una cuenta.

---

# 6. Experiencia principal

## 6.1 Inicio

Al abrir la aplicación:

- Si no existen proyectos, mostrar un estado vacío con el botón `Crear primer proyecto`.
- Si existen proyectos, mostrar el dashboard.
- No abrir automáticamente un canvas vacío anónimo.
- Puede existir un ajuste para reabrir directamente el último lienzo usado.

## 6.2 Dashboard de proyectos

Cada tarjeta debe mostrar:

- Nombre.
- Fecha de última modificación.
- Cantidad de lienzos.
- Indicador de proyecto protegido.
- Miniatura opcional del último lienzo.
- Menú contextual.

Acciones:

- Abrir.
- Renombrar.
- Duplicar.
- Proteger con contraseña.
- Bloquear ahora.
- Exportar.
- Eliminar.

## 6.3 Espacio de trabajo del proyecto

Estructura visual:

```text
┌─────────────────────────────────────────────────────────────┐
│ Barra superior: volver, proyecto, canvas, guardado, acciones│
├───────────────┬───────────────────────────────┬─────────────┤
│ Lienzos       │                               │ Vistas      │
│ del proyecto  │       Editor Excalidraw       │ del canvas  │
│               │                               │             │
└───────────────┴───────────────────────────────┴─────────────┘
```

### Sidebar izquierdo

- Lista de lienzos.
- Crear lienzo.
- Renombrar.
- Duplicar.
- Reordenar.
- Eliminar.
- Colapsar sidebar.

### Área central

- Editor Excalidraw existente.
- Mantener la mayor cantidad posible de comportamiento original.

### Panel derecho de vistas

- Lista ordenada de vistas.
- Botón `Guardar vista actual`.
- Abrir vista.
- Renombrar.
- Actualizar con la posición actual.
- Duplicar.
- Reordenar.
- Eliminar.
- Iniciar recorrido.

El panel debe poder colapsarse.

---

# 7. Proyectos

## 7.1 Crear proyecto

Campos:

- Nombre obligatorio.
- Descripción opcional.
- Protección por contraseña opcional.

Comportamiento:

- Crear automáticamente un primer lienzo llamado `Lienzo 1`.
- Abrir el nuevo proyecto.
- Persistir inmediatamente.

## 7.2 Renombrar

- Edición inline o modal.
- No permitir nombre vacío.
- Guardar al confirmar.
- Escape cancela.

## 7.3 Duplicar

Debe copiar:

- Todos los lienzos.
- Elementos.
- Archivos.
- Configuración persistente.
- Vistas.
- Orden.

Para un proyecto protegido:

- Solicitar desbloqueo antes de duplicar.
- La copia debe conservar la protección salvo que el usuario elija explícitamente crearla sin contraseña.

## 7.4 Eliminar

- Confirmación explícita.
- Mostrar nombre del proyecto.
- Explicar que el borrado es local y definitivo.
- Borrar lienzos, archivos, vistas y material criptográfico asociado.

---

# 8. Lienzos

## 8.1 Definición

Cada lienzo es una escena independiente de Excalidraw.

Debe tener su propio:

- Conjunto de elementos.
- App state persistible.
- Archivos/imágenes.
- Historial de undo/redo durante la sesión.
- Lista de vistas.
- Nombre.
- Fechas.
- Orden.

## 8.2 Cambio de lienzo

Antes de cambiar:

1. Forzar el guardado pendiente.
2. Esperar a que finalice la escritura crítica.
3. Limpiar o aislar el historial.
4. Cargar el nuevo lienzo.
5. Restaurar archivos.
6. Mostrar el nuevo lienzo sin mezclar elementos del anterior.

La estrategia recomendada es remontar la instancia de Excalidraw con una `key` basada en `canvasId`, utilizando `initialData`. Esto evita que el historial de undo/redo atraviese lienzos.

Si se utiliza `resetScene()` + `updateScene()`, se debe limpiar también el historial y probar exhaustivamente que no exista contaminación entre escenas.

## 8.3 Autosave

- Guardar mediante `onChange`.
- Debounce recomendado: entre 700 y 1.000 ms.
- No ejecutar cifrado ni escritura pesada en cada movimiento de puntero.
- Forzar flush al:
  - Cambiar de lienzo.
  - Cambiar de proyecto.
  - Bloquear proyecto.
  - Ocultar la pestaña.
  - Cerrar la aplicación, en la medida permitida por el navegador.

Estados visibles:

- `Guardando…`
- `Guardado`
- `Error al guardar`

No ocultar errores de persistencia.

## 8.4 Duplicación de lienzo

Copiar escena completa, archivos y vistas, generando identificadores nuevos para el lienzo y sus registros internos de almacenamiento.

No es obligatorio regenerar los IDs de elementos Excalidraw si el lienzo duplicado permanece completamente aislado, pero no deben existir colisiones en las claves de almacenamiento.

---

# 9. Vistas guardadas

## 9.1 Definición

Una vista es una posición de cámara guardada dentro de un lienzo.

No es un grupo de elementos ni una nueva escena.

Debe almacenar un rectángulo en coordenadas de escena que represente la zona visible, en lugar de depender únicamente de valores crudos de `scrollX`, `scrollY` y `zoom`. Esto permite restaurar la vista de forma razonable en ventanas de distinto tamaño.

## 9.2 Modelo

```ts
type SavedView = {
  id: string;
  canvasId: string;
  name: string;
  order: number;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  transitionDurationMs: number;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
};
```

## 9.3 Guardar vista actual

Al pulsar `Guardar vista actual`:

1. Obtener el estado actual del editor.
2. Calcular los límites visibles en coordenadas de escena utilizando las utilidades existentes del repositorio, preferentemente `getVisibleSceneBounds`.
3. Crear nombre por defecto: `Vista 1`, `Vista 2`, etc.
4. Permitir editar el nombre.
5. Guardar inmediatamente.
6. Generar una miniatura liviana de forma asíncrona cuando sea viable.

No implementar el cálculo manual de viewport si ya existe una utilidad exportada y probada.

## 9.4 Abrir una vista

Usar `excalidrawAPI.setViewport()`.

Comportamiento:

- Centrar y ajustar el rectángulo guardado.
- Transición animada.
- Duración por defecto: 400 ms.
- Respetar paneles superpuestos mediante offsets de viewport.
- No modificar elementos.
- No crear una entrada de undo/redo.
- No marcar el canvas como modificado únicamente por navegar.

## 9.5 Actualizar vista

Acción `Actualizar con vista actual`.

- Mantener ID y nombre.
- Reemplazar rectángulo.
- Actualizar miniatura.
- Actualizar fecha.

## 9.6 Recorrido de vistas

Botón `Recorrer vistas`.

Al activarlo:

- Empezar por la primera vista o la seleccionada.
- Ocultar paneles no esenciales.
- Activar modo de visualización para evitar ediciones accidentales.
- Mostrar controles anterior/siguiente.
- Permitir teclas flecha izquierda y derecha.
- Escape sale del recorrido.
- Mostrar indicador `2 / 7`.
- No reproducir automáticamente.

## 9.7 Orden

- Drag and drop o controles subir/bajar.
- Persistir orden.
- La navegación secuencial usa este orden.

## 9.8 Miniaturas

Objetivo recomendado:

- Proporción 16:9.
- Resolución aproximada 320 × 180.
- Generación diferida.
- No bloquear la interacción.
- Si falla la miniatura, mostrar una tarjeta con nombre y número.

---

# 10. Protección por contraseña

## 10.1 Alcance

La protección se aplica al proyecto completo.

Al bloquear un proyecto:

- Se bloquean todos sus lienzos.
- Se bloquean sus vistas.
- Se bloquean sus archivos.
- Se cierra cualquier canvas activo de ese proyecto.
- La clave derivada se elimina de memoria.

Las contraseñas individuales por lienzo quedan fuera del MVP.

## 10.2 Protección real

No basta con mostrar un modal.

Los datos del proyecto protegido deben guardarse cifrados en IndexedDB.

La contraseña:

- Nunca se guarda en texto plano.
- Nunca se guarda reversible.
- Nunca se incluye en logs.
- Nunca se incluye en URL.
- Nunca se incluye en exportaciones sin cifrar.
- Nunca se conserva en `localStorage` o `sessionStorage`.

## 10.3 Criptografía

Usar Web Crypto API.

Configuración MVP:

- Derivación: PBKDF2.
- Hash: SHA-256.
- Iteraciones: 600.000.
- Salt aleatorio único por proyecto: mínimo 16 bytes.
- Cifrado: AES-GCM.
- Clave: 256 bits.
- IV aleatorio y único por cada operación: 12 bytes.
- `CryptoKey` no exportable cuando sea posible.
- Asociar cada payload mediante Additional Authenticated Data con:
  - `projectId`
  - tipo de registro
  - versión del esquema

La derivación de clave se realiza una vez al desbloquear. La clave permanece solamente en memoria durante la sesión desbloqueada.

No derivar la clave nuevamente en cada autosave.

## 10.4 Verificación

Guardar un pequeño bloque de verificación cifrado, por ejemplo:

```json
{
  "type": "workspace-project-verifier",
  "version": 1,
  "projectId": "..."
}
```

Una contraseña incorrecta debe producir un error genérico:

`La contraseña es incorrecta o los datos están dañados.`

No revelar detalles criptográficos en la interfaz.

## 10.5 Metadatos visibles

En el MVP pueden permanecer sin cifrar:

- ID del proyecto.
- Nombre del proyecto.
- Indicador de bloqueo.
- Fechas.
- Cantidad de lienzos.

El contenido de los lienzos, archivos, vistas y descripciones sensibles debe quedar cifrado.

Documentar esta decisión. Una opción futura podrá ocultar también el nombre.

## 10.6 Cambiar contraseña

Requiere:

1. Contraseña actual.
2. Nueva contraseña.
3. Confirmación.
4. Descifrar con la clave anterior.
5. Generar nuevo salt.
6. Derivar nueva clave.
7. Recifrar todos los datos con IVs nuevos.
8. Ejecutar la operación de manera transaccional.

Si falla, conservar intacta la versión anterior.

## 10.7 Quitar contraseña

- Solicitar contraseña actual.
- Descifrar.
- Persistir nuevamente sin cifrado.
- Eliminar parámetros criptográficos después de confirmar que todo se guardó.

## 10.8 Bloqueo

Acciones:

- `Bloquear ahora`.
- Bloquear al recargar o cerrar la pestaña.
- No persistir la clave de sesión.

El auto-bloqueo por inactividad queda fuera del MVP, pero la arquitectura debe permitir agregarlo.

## 10.9 Recuperación

No existe recuperación de contraseña.

La interfaz debe advertirlo claramente al crear la protección.

---

# 11. Persistencia

## 11.1 Tecnología

Usar IndexedDB, aprovechando `idb-keyval` ya presente en el proyecto cuando sea conveniente.

Crear una abstracción:

```ts
interface WorkspaceRepository {
  listProjects(): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<ProjectRecord | null>;
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  updateProject(id: string, patch: Partial<ProjectRecord>): Promise<void>;
  deleteProject(id: string): Promise<void>;

  listCanvases(projectId: string): Promise<CanvasSummary[]>;
  loadCanvas(projectId: string, canvasId: string): Promise<CanvasPayload>;
  saveCanvas(
    projectId: string,
    canvasId: string,
    payload: CanvasPayload,
  ): Promise<void>;
}
```

La UI no debe hablar directamente con IndexedDB.

## 11.2 Stores recomendados

```text
workspace-projects
workspace-canvases
workspace-files
workspace-settings
workspace-thumbnails
```

## 11.3 Separación de archivos

No volver a cifrar todas las imágenes en cada autosave.

Recomendación:

- Escena y app state en un payload del canvas.
- Archivos binarios/dataURLs en registros separados.
- Guardar solo archivos nuevos o modificados.
- Clave de almacenamiento namespaced por `projectId`, `canvasId` y `fileId`.
- En proyectos protegidos, cada archivo debe cifrarse individualmente.

## 11.4 Transacciones

Las operaciones destructivas o de recifrado deben ser transaccionales o utilizar una estrategia copy-then-swap:

1. Escribir nueva versión.
2. Validarla.
3. Actualizar puntero activo.
4. Eliminar versión anterior.

Nunca dejar un proyecto parcialmente recifrado.

## 11.5 Versionado de esquema

Todos los registros deben incluir:

```ts
schemaVersion: number;
```

Crear migraciones explícitas.

No asumir que el formato actual será permanente.

---

# 12. Modelo de datos sugerido

```ts
type ProjectRecord = {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  order: number;
  protection: {
    enabled: boolean;
    version?: 1;
    kdf?: "PBKDF2";
    hash?: "SHA-256";
    iterations?: number;
    salt?: string;
    verifier?: EncryptedEnvelope;
  };
  schemaVersion: 1;
};

type CanvasRecord = {
  id: string;
  projectId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  order: number;
  payload: PlainEnvelope | EncryptedEnvelope;
  schemaVersion: 1;
};

type CanvasPayload = {
  elements: readonly ExcalidrawElement[];
  appState: PersistedAppState;
  fileIds: string[];
  views: SavedView[];
};

type EncryptedEnvelope = {
  encrypted: true;
  algorithm: "AES-GCM";
  iv: string;
  ciphertext: string;
  schemaVersion: 1;
};

type PlainEnvelope<T = unknown> = {
  encrypted: false;
  data: T;
  schemaVersion: 1;
};
```

Los tipos definitivos deben reutilizar tipos oficiales de Excalidraw cuando corresponda.

---

# 13. Migración desde la versión estándar

En el primer inicio posterior a instalar esta funcionalidad:

1. Detectar si existe una escena local estándar.
2. Detectar si ya fue migrada.
3. Crear un proyecto:
   - Nombre: `Proyecto importado`.
4. Crear un lienzo:
   - Nombre: `Lienzo original`.
5. Copiar elementos, app state y archivos.
6. Verificar lectura.
7. Marcar migración completada.
8. No borrar los datos anteriores hasta confirmar la migración.

La migración debe ser idempotente.

No duplicar el proyecto en cada recarga.

---

# 14. Importación y exportación

## 14.1 Exportar proyecto

Crear formato:

```text
.excalidraw-workspace
```

Debe incluir:

- Versión del esquema.
- Metadatos.
- Lienzos.
- Vistas.
- Archivos.
- Estado de protección.

Proyecto protegido:

- Exportar los payloads cifrados.
- No descifrar automáticamente para crear el backup.
- Mantener la misma contraseña.

Proyecto sin protección:

- Exportar JSON legible.

## 14.2 Importar proyecto

- Validar esquema.
- Validar integridad.
- Generar IDs nuevos si existe colisión.
- Mantener protección.
- No sobrescribir proyectos existentes silenciosamente.
- Mostrar errores claros.

## 14.3 Compatibilidad `.excalidraw`

Mantener las funciones estándar para importar y exportar un lienzo individual como archivo `.excalidraw`.

---

# 15. Rutas y navegación

La aplicación debe representar el contexto activo en la URL.

Formato recomendado:

```text
/project/:projectId/canvas/:canvasId
```

No agregar una dependencia de routing si la aplicación actual puede resolverlo limpiamente con la infraestructura existente.

Requisitos:

- Recargar la URL debe volver al mismo proyecto y canvas.
- Proyecto bloqueado debe mostrar pantalla de desbloqueo.
- ID inexistente debe volver al dashboard con mensaje.
- No colocar nombres ni contraseñas en la URL.

---

# 16. Estado de aplicación

Separar:

## Estado persistente

- Proyectos.
- Lienzos.
- Vistas.
- Orden.
- Configuración.
- Último elemento abierto.
- Protección.
- Datos de escena.

## Estado de sesión

- Claves criptográficas.
- Proyecto desbloqueado.
- Canvas activo.
- Estado de guardado.
- Paneles abiertos.
- Vista seleccionada.
- Modo recorrido.

Nunca serializar claves criptográficas.

---

# 17. Concurrencia entre pestañas

MVP mínimo:

- Detectar cuando el mismo lienzo está abierto en otra pestaña.
- Usar `BroadcastChannel` o adaptar el mecanismo actual de sincronización de pestañas.
- Evitar que dos pestañas sobrescriban silenciosamente el mismo lienzo.
- Mostrar aviso.
- La segunda pestaña puede abrirse en solo lectura hasta que la primera libere el bloqueo.

No implementar edición colaborativa.

---

# 18. Manejo de errores

Casos obligatorios:

- IndexedDB no disponible.
- Cuota de almacenamiento excedida.
- Escritura fallida.
- Proyecto dañado.
- Archivo faltante.
- Contraseña incorrecta.
- Datos cifrados corruptos.
- Migración incompleta.
- Importación inválida.
- Canvas eliminado desde otra pestaña.

Nunca descartar cambios silenciosamente.

Agregar un mecanismo de exportación de emergencia cuando los datos puedan leerse pero no guardarse.

---

# 19. Rendimiento

Objetivos:

- Dibujar no debe mostrar lag atribuible al autosave.
- No cifrar en cada evento de puntero.
- Usar debounce.
- Guardar archivos incrementalmente.
- Generar miniaturas fuera del camino crítico.
- Cambiar un lienzo mediano en menos de un segundo en un equipo moderno.
- Navegar entre vistas con animación fluida.
- Soportar al menos:
  - 50 proyectos.
  - 500 lienzos totales.
  - 100 vistas por lienzo.

No cargar todos los payloads de todos los proyectos para renderizar el dashboard. Usar resúmenes.

---

# 20. Accesibilidad y UX

- Navegación completa por teclado para acciones esenciales.
- Focus visible.
- Modales con focus trap.
- Escape cierra diálogos cuando no comprometa datos.
- Confirmaciones descriptivas.
- Estados vacíos útiles.
- No usar únicamente color para indicar bloqueo o guardado.
- Mantener compatibilidad con modo claro y oscuro.
- Diseño coherente con Excalidraw.

---

# 21. Inteligencia artificial futura

No implementar IA en el MVP.

Crear solamente un punto de extensión desacoplado:

```ts
interface WorkspaceAIProvider {
  generateElements(input: {
    prompt: string;
    canvasContext?: unknown;
  }): Promise<{
    elements: unknown[];
    files?: unknown;
  }>;
}
```

Requisitos futuros:

- Ninguna API key hardcodeada.
- Proveedor configurable.
- Inserción mediante `updateScene`.
- Resultado editable.
- Confirmación antes de reemplazar contenido.
- No acoplar proyectos, cifrado o vistas a un proveedor de IA.

---

# 22. Historias de usuario y criterios de aceptación

## HU-01 — Crear proyecto

**Como usuario**, quiero crear un proyecto para separar un contexto de trabajo.

**Aceptación:**

- Puedo introducir un nombre.
- Se crea `Lienzo 1`.
- El proyecto aparece en el dashboard.
- Persiste después de recargar.

## HU-02 — Crear múltiples lienzos

**Como usuario**, quiero crear varios lienzos dentro de un proyecto.

**Aceptación:**

- Cada lienzo tiene contenido independiente.
- Cambiar de lienzo no mezcla elementos.
- Undo/redo no atraviesa lienzos.
- Cada lienzo conserva nombre y contenido tras recargar.

## HU-03 — Guardar vista

**Como usuario**, quiero guardar una zona del canvas.

**Aceptación:**

- Se captura el viewport actual.
- La vista aparece en el panel.
- Al alejarme y pulsarla, la cámara vuelve a esa zona.
- La transición es animada.
- No se alteran elementos.

## HU-04 — Recorrer vistas

**Como usuario**, quiero avanzar por una secuencia de vistas.

**Aceptación:**

- Puedo ordenar vistas.
- Puedo iniciar recorrido.
- Flechas avanzan y retroceden.
- Escape termina.
- No se modifica el lienzo.

## HU-05 — Proteger proyecto

**Como usuario**, quiero impedir que otra persona abra el contenido.

**Aceptación:**

- Puedo establecer contraseña.
- Tras bloquear o recargar, se solicita.
- Contraseña incorrecta no abre el proyecto.
- El contenido del canvas no aparece en texto plano dentro de IndexedDB.
- La contraseña no aparece en almacenamiento ni logs.
- No existe recuperación y la UI lo informa.

## HU-06 — Exportar backup

**Como usuario**, quiero respaldar un proyecto.

**Aceptación:**

- Descargo un archivo de proyecto.
- Puedo importarlo en otra instalación.
- Conserva lienzos, imágenes y vistas.
- Si estaba protegido, conserva protección.

## HU-07 — Migración

**Como usuario existente**, quiero conservar mi canvas actual.

**Aceptación:**

- Aparece dentro de un proyecto importado.
- No se duplica en recargas posteriores.
- Los archivos continúan visibles.

---

# 23. Pruebas

## 23.1 Unitarias

- Repositorio de proyectos.
- Repositorio de lienzos.
- Ordenamiento.
- Cálculo/captura de vistas.
- Serialización.
- Migraciones.
- Derivación de clave.
- Encrypt/decrypt.
- IV único.
- Contraseña incorrecta.
- Cambio de contraseña.
- Import/export.

## 23.2 Integración

- Excalidraw `onChange` → autosave.
- Cambio de canvas → flush → carga.
- Remount → historial aislado.
- Archivos de imagen.
- Proyecto protegido.
- Lock/unlock.
- Recorrido de vistas.
- Recuperación después de recarga.

## 23.3 End-to-end

Flujos:

1. Crear proyecto y dos lienzos.
2. Dibujar contenido diferente.
3. Recargar.
4. Verificar persistencia.
5. Crear tres vistas.
6. Recorrerlas.
7. Proteger proyecto.
8. Bloquear.
9. Probar contraseña errónea.
10. Desbloquear.
11. Exportar.
12. Eliminar.
13. Importar.
14. Verificar integridad.

## 23.4 Seguridad

Verificar manualmente y por test:

- No hay contraseña en IndexedDB.
- No hay contraseña en localStorage.
- No hay contenido plano de lienzos protegidos.
- IV diferente en guardados sucesivos.
- Cambiar contraseña recifra.
- Una corrupción del ciphertext falla de forma segura.
- La clave desaparece al bloquear.
- No se registran payloads sensibles en consola.

---

# 24. Compatibilidad

Objetivo:

- Chrome actual.
- Edge actual.
- Firefox actual.
- Safari actual.

La criptografía debe ejecutarse únicamente en contexto seguro. En desarrollo, usar localhost. En producción, requerir HTTPS.

---

# 25. Telemetría

No agregar telemetría nueva en el MVP.

No enviar nombres, canvas, prompts, archivos ni eventos a servidores externos.

---

# 26. Cambios esperados en el repositorio

Preferentemente:

```text
excalidraw-app/
  features/workspace/
  components/WorkspaceDashboard.tsx
  components/ProjectWorkspace.tsx
  components/CanvasSidebar.tsx
  components/ViewsSidebar.tsx
  components/UnlockProjectDialog.tsx
  components/ProtectProjectDialog.tsx
  storage/WorkspaceRepository.ts
  storage/IndexedDBWorkspaceRepository.ts
  storage/migrations.ts
  crypto/projectCrypto.ts
  domain/types.ts
  services/projectExport.ts
  services/projectImport.ts
  hooks/useAutosaveCanvas.ts
  hooks/useProjectSession.ts
```

Adaptar nombres y ubicaciones si la arquitectura actual sugiere una integración más coherente.

Agregar documentación:

```text
docs/workspace-architecture.md
docs/workspace-security.md
IMPLEMENTATION_NOTES.md
```

---

# 27. Orden de implementación

## Fase 0 — Preparación

- Fork.
- Remotos.
- Rama.
- Build base.
- Tests base.
- Registrar SHA inicial.

## Fase 1 — Dominio y persistencia

- Tipos.
- Repositorio.
- IndexedDB.
- Migraciones.
- Tests.

## Fase 2 — Proyectos y lienzos

- Dashboard.
- Sidebar.
- CRUD.
- Autosave.
- Cambio de escenas.
- URL.
- Tests.

## Fase 3 — Vistas

- Captura de viewport.
- Panel.
- `setViewport`.
- Orden.
- Recorrido.
- Miniaturas.
- Tests.

## Fase 4 — Seguridad

- Web Crypto.
- Protect/unlock/lock.
- Change/remove password.
- Cifrado de archivos.
- Tests de seguridad.

Aunque seguridad aparece como fase 4, diseñar el esquema desde la fase 1 para evitar una migración destructiva.

## Fase 5 — Backup y migración

- Import/export.
- Migración desde escena estándar.
- Recuperación de errores.

## Fase 6 — Calidad

- Accesibilidad.
- Dark mode.
- Rendimiento.
- Multi-tab.
- Documentación.
- Build final.

---

# 28. Definition of Done

El trabajo se considera terminado cuando:

- El fork existe en la cuenta GitHub autenticada.
- La rama de feature está subida.
- La aplicación compila.
- Los tests existentes continúan pasando o cualquier excepción está documentada.
- Pasan los tests nuevos.
- Se pueden crear proyectos y lienzos.
- Los lienzos persisten y no mezclan historial.
- Se pueden guardar y recorrer vistas.
- Los proyectos protegidos están cifrados.
- La contraseña nunca se persiste.
- Export/import funciona.
- La migración no destruye datos.
- Existe documentación de arquitectura y seguridad.
- No se modificó el núcleo de Excalidraw sin una justificación escrita.

Ejecutar como mínimo:

```bash
yarn test:typecheck
yarn test:app --watch=false
yarn test:code
yarn build:app
```

---

# 29. Entrega esperada de Codex

Al finalizar, devolver:

1. Resumen de lo implementado.
2. URL del fork.
3. Nombre de la rama.
4. Lista de commits.
5. Archivos principales modificados.
6. Decisiones arquitectónicas.
7. Tests ejecutados y resultado.
8. Limitaciones conocidas.
9. Pasos para ejecutar localmente.
10. Próximos pasos recomendados.

No afirmar que algo funciona si no fue probado.
