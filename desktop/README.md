# Xcalidraw para macOS

La aplicación de escritorio usa Electron como contenedor nativo seguro y conserva el mismo almacenamiento IndexedDB local-first. Cada perfil queda aislado dentro del directorio de datos de la aplicación.

## Empaquetar

Desde la raíz:

```bash
npm install --prefix desktop
npm run --prefix desktop dist
```

El comando `dist` exige un árbol de trabajo ya guardado en Git, compila la interfaz, incrusta ese commit y luego genera el DMG. Esto evita que una aplicación se identifique como una revisión distinta de su contenido real. El empaquetador usa temporalmente una ruta segura de macOS —también funciona si el directorio del repositorio contiene espacios o `|`— y deja el instalador en `desktop/dist/Xcalidraw-1.1.0-arm64.dmg`. Es una compilación arm64 para Apple Silicon. Al no incluir una identidad Apple Developer ID, macOS puede pedir clic derecho → Abrir en el primer inicio.

## Versiones y actualizaciones

La aplicación instalada consulta cada 15 minutos la rama `feature/workspaces-projects-views-security` del repositorio `jonymillenium/excalidraw`. Si el commit publicado cambió, el dashboard muestra **Nueva versión** y la cantidad de commits disponibles. También puede comprobarse manualmente tocando el indicador de versión.

Este canal detecta publicaciones y enlaza sus cambios, pero la compilación actual no se reemplaza sola. Para una actualización automática instalable en un clic hace falta firmar y notarizar la aplicación con Apple Developer ID, publicar cada DMG como GitHub Release e integrar el instalador de actualizaciones. Hasta entonces, genera o descarga el nuevo DMG y arrastra Xcalidraw sobre la copia anterior; los perfiles y proyectos se conservan en Application Support.

Para mover el contenido a otra Mac, usa **Exportar todo** en el dashboard, instala la aplicación en la otra computadora y selecciona **Restaurar backup**.
