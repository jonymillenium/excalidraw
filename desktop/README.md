# Xcalidraw para macOS

La aplicación de escritorio usa Electron como contenedor nativo seguro y conserva el mismo almacenamiento IndexedDB local-first. Cada perfil queda aislado dentro del directorio de datos de la aplicación.

## Empaquetar

Desde la raíz:

```bash
corepack yarn --cwd excalidraw-app build:app
npm install --prefix desktop
npm run --prefix desktop dist
```

El empaquetador usa temporalmente una ruta segura de macOS —también funciona si el directorio del repositorio contiene espacios o `|`— y deja el instalador en `desktop/dist/Xcalidraw-1.0.0-arm64.dmg`. Es una compilación arm64 para Apple Silicon. Al no incluir una identidad Apple Developer ID, macOS puede pedir clic derecho → Abrir en el primer inicio.

Para mover el contenido a otra Mac, usa **Exportar todo** en el dashboard, instala la aplicación en la otra computadora y selecciona **Restaurar backup**.
