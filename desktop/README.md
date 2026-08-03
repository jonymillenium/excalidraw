# Xcalidraw para macOS

La aplicación de escritorio usa Electron como contenedor nativo seguro y conserva el mismo almacenamiento IndexedDB local-first. Cada perfil queda aislado dentro del directorio de datos de la aplicación.

## Empaquetar

Desde la raíz:

```bash
npm install --prefix desktop
npm run --prefix desktop dist
```

El comando `dist` exige un árbol de trabajo ya guardado en Git, compila la interfaz, incrusta ese commit y luego genera el DMG. Esto evita que una aplicación se identifique como una revisión distinta de su contenido real. El empaquetador usa temporalmente una ruta segura de macOS —también funciona si el directorio del repositorio contiene espacios o `|`— y deja el instalador versionado en `desktop/dist`. Es una compilación arm64 para Apple Silicon. Al no incluir una identidad Apple Developer ID, macOS puede pedir clic derecho → Abrir en el primer inicio.

## Versiones y actualizaciones

La aplicación no consulta GitHub en segundo plano. Solo cuando se pulsa **Comprobar actualizaciones** consulta los Releases de escritorio y la rama `feature/workspaces-projects-views-security` del repositorio `jonymillenium/excalidraw`.

Si existe un Release más nuevo con su DMG arm64, el dashboard permite descargarlo dentro de la aplicación y abre el instalador al terminar. Si hay commits nuevos pero el instalador todavía no fue publicado, muestra **Versión en preparación** sin ofrecer una descarga inexistente. Para completar la actualización, cierra Xcalidraw, arrastra la copia nueva sobre la anterior y vuelve a abrirla; los perfiles y proyectos se conservan en Application Support.

El workflow manual **Release Xcalidraw Desktop** compila el commit elegido, verifica el DMG y publica un Release con la etiqueta `xcalidraw-desktop-v<versión>`. Una versión no puede publicarse dos veces.

Para mover el contenido a otra Mac, usa **Exportar todo** en el dashboard, instala la aplicación en la otra computadora y selecciona **Restaurar backup**.

## Alineación de precisión

Los lienzos nuevos y los existentes migrados una sola vez activan el ajuste magnético a objetos. Al mover, crear o redimensionar elementos, el editor alinea bordes y centros, detecta espacios equivalentes y dibuja guías magenta de alto contraste con medidas. La intensidad visual se mantiene estable con cualquier zoom. Puede desactivarse en **Preferencias → Ajustar a objetos** o temporalmente durante un arrastre manteniendo `⌘` en macOS. `⌘D` duplica exactamente en el mismo lugar; Option-arrastrar conserva al original como referencia de alineación.

## Organización y referencias

Las vistas admiten nombre, descripción, orden manual, carpetas y subcarpetas. Sus altas, movimientos, renombrados y confirmaciones usan modales propios en lugar de alertas del sistema; la biblioteca aplica el mismo criterio. La librería exige nombrar cada asset, incorpora búsqueda y conserva rutas de carpetas exportables. Cada lienzo sin cifrar genera su propia miniatura ajustada al contenido completo. Desde **Enlazar** se puede insertar en el canvas una tarjeta nativa que referencia otro lienzo, proyecto o una vista guardada: el modal recorta la miniatura al sector de esa vista y, al abrirla, restaura exactamente su encuadre y zoom. Al seleccionar una de estas tarjetas y pulsar la barra espaciadora se abre su vista previa tipo Quick Look para recorrer el proyecto o navegar al lienzo o vista exactos.

Los seis perfiles de color de cada lienzo guardan fondo, color de elementos y contraste. Los trazos libres pueden terminar como elementos individuales o como un único sketch agrupado, y el candado de una selección bloquea el elemento de forma efectiva.

## IA multimodal con OpenRouter

En **IA · OpenRouter** se introduce una API key nueva dentro de la aplicación. La clave queda cifrada por perfil, nunca vuelve a mostrarse y solo se puede reemplazar o borrar validando la contraseña administradora. El modelo se puede cambiar sin volver a pegar la clave. El catálogo sugiere opciones económicas, omnimodales y de máxima fidelidad, indicando si admiten imagen, PDF, audio o video y mostrando sus precios.

La aplicación ofrece texto a diagrama, Mermaid editable, reconstrucción de screenshots/fotos y análisis de imagen, PDF, audio o video. Los perfiles **Ejecutivo**, **Rápido** y **Profundo** cambian el nivel de síntesis; cada resultado incluye preguntas sugeridas para afinar una segunda pasada. El consumo informado por OpenRouter se ve por día —solicitudes, tokens y coste USD— dentro del perfil.
