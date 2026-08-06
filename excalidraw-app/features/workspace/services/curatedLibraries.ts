export type CuratedLibraryCategory =
  | "Marketing y negocio"
  | "Web y producto"
  | "Personas y storytelling"
  | "Programación y sistemas"
  | "Diagramas y procesos";

export type CuratedLibrary = {
  id: string;
  name: string;
  description: string;
  category: CuratedLibraryCategory;
  itemCount: number;
  file: string;
  keywords: string[];
};

type CuratedLibraryElement = {
  type?: string;
  text?: string;
};

export type CuratedLibraryItem = {
  id: string;
  status: "published";
  elements: readonly CuratedLibraryElement[];
  created: number;
  name: string;
  folderPath: readonly string[];
};

type CuratedLibraryFile = {
  library?: Array<readonly CuratedLibraryElement[]>;
  libraryItems?: Array<{
    id?: string;
    elements?: readonly CuratedLibraryElement[];
    created?: number;
    name?: string;
    folderPath?: readonly string[];
  }>;
};

const library = (
  id: string,
  name: string,
  description: string,
  category: CuratedLibraryCategory,
  itemCount: number,
  keywords: string[],
): CuratedLibrary => ({
  id,
  name,
  description,
  category,
  itemCount,
  file: `/libraries/kurk/${id}.excalidrawlib`,
  keywords,
});

export const CURATED_LIBRARIES: CuratedLibrary[] = [
  library(
    "business-model",
    "Modelos de negocio",
    "Business Model Canvas y Value Proposition Canvas.",
    "Marketing y negocio",
    2,
    ["business", "empresa", "propuesta de valor", "emprendedor"],
  ),
  library(
    "customer-journey",
    "Customer Journey",
    "Mapas pequeños y completos para representar el camino del comprador.",
    "Marketing y negocio",
    14,
    ["buyer journey", "cliente", "comprador", "marketing", "ventas"],
  ),
  library(
    "cloud-apps",
    "Apps de marketing y venta",
    "Mailchimp, ActiveCampaign, Facebook, Instagram, TikTok, Stripe, WordPress y más.",
    "Marketing y negocio",
    15,
    ["redes sociales", "email", "crm", "checkout", "publicidad", "automation"],
  ),
  library(
    "ecommerce-mobile-ui",
    "E-commerce móvil",
    "Pantallas, checkout, productos, formularios y controles para tiendas móviles.",
    "Marketing y negocio",
    75,
    ["tienda", "producto", "cart", "checkout", "ventas", "mobile"],
  ),
  library(
    "forms",
    "Formularios",
    "Controles y composiciones para diseñar formularios completos.",
    "Web y producto",
    26,
    ["form", "input", "lead magnet", "registro", "contacto"],
  ),
  library(
    "html-inputs",
    "Inputs HTML",
    "Botones, fechas, checkbox, radio, select, switches y campos.",
    "Web y producto",
    8,
    ["formulario", "html", "input", "ui", "web"],
  ),
  library(
    "web-kit",
    "Web Kit",
    "Componentes frecuentes para páginas, sitios y landing pages.",
    "Web y producto",
    9,
    ["landing page", "website", "wireframe", "sitio", "página"],
  ),
  library(
    "mobile-kit",
    "Mobile Kit",
    "Pantallas móviles listas para prototipar experiencias y flujos.",
    "Web y producto",
    3,
    ["app", "mobile", "producto", "pantalla", "ui"],
  ),
  library(
    "lo-fi-wireframing",
    "Wireframing Lo-Fi",
    "Kit amplio para bocetar productos digitales con rapidez.",
    "Web y producto",
    23,
    ["wireframe", "mockup", "ux", "prototipo", "web"],
  ),
  library(
    "simple-characters",
    "Personajes simples",
    "Personajes expresivos para ideas, presentaciones y storytelling.",
    "Personas y storytelling",
    49,
    ["persona", "people", "audiencia", "equipo", "presentación"],
  ),
  library(
    "stick-people",
    "Personas dibujadas a mano",
    "Figuras humanas editables con poses y expresiones sencillas.",
    "Personas y storytelling",
    7,
    ["persona", "grupo", "equipo", "usuario", "freehand"],
  ),
  library(
    "domain-storytelling",
    "Domain Storytelling",
    "Personas, grupos, documentos, sistemas, correo y teléfono.",
    "Personas y storytelling",
    7,
    ["persona", "grupo", "sistema", "documento", "email", "flujo"],
  ),
  library(
    "software-architecture",
    "Arquitectura de software",
    "Servicios, bases de datos, caché, eventos, código y dispositivos.",
    "Programación y sistemas",
    7,
    ["programar", "coding", "database", "api", "software", "backend"],
  ),
  library(
    "it-logos",
    "Logos IT",
    "Lenguajes, frameworks y herramientas para construir aplicaciones web.",
    "Programación y sistemas",
    31,
    ["react", "python", "docker", "github", "programación", "código"],
  ),
  library(
    "c4-architecture",
    "Arquitectura C4",
    "Personas, sistemas, aplicaciones, componentes y bases de datos.",
    "Programación y sistemas",
    10,
    ["c4", "software", "system", "component", "developer"],
  ),
  library(
    "information-architecture",
    "Arquitectura de información",
    "Páginas, archivos, decisiones, áreas y conexiones para productos digitales.",
    "Diagramas y procesos",
    17,
    ["flow", "página", "información", "ux", "sitemap"],
  ),
  library(
    "flow-chart",
    "Símbolos de flowchart",
    "Procesos, decisiones, documentos, bases de datos y conectores.",
    "Diagramas y procesos",
    15,
    ["flujo", "flowchart", "proceso", "decision", "diagrama"],
  ),
];

export const CURATED_LIBRARY_CATEGORIES = [
  ...new Set(CURATED_LIBRARIES.map(({ category }) => category)),
];

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();

export const filterCuratedLibraries = (
  query: string,
  category?: CuratedLibraryCategory,
) => {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return CURATED_LIBRARIES.filter((item) => {
    if (category && item.category !== category) {
      return false;
    }
    const searchText = normalize(
      [item.name, item.description, item.category, ...item.keywords].join(" "),
    );
    return terms.every((term) => searchText.includes(term));
  });
};

const inferItemName = (
  library: CuratedLibrary,
  elements: readonly CuratedLibraryElement[],
  index: number,
) => {
  const visibleText = elements.find(
    (element) => element.type === "text" && element.text?.trim(),
  )?.text;
  const firstLine = visibleText?.split("\n")[0].trim();
  return firstLine &&
    firstLine.length >= 3 &&
    firstLine.length <= 64 &&
    /\p{L}/u.test(firstLine)
    ? firstLine
    : `${library.name} · Elemento ${index + 1}`;
};

export const normalizeCuratedLibraryItems = (
  library: CuratedLibrary,
  file: CuratedLibraryFile,
): CuratedLibraryItem[] => {
  const source: NonNullable<CuratedLibraryFile["libraryItems"]> = file
    .libraryItems?.length
    ? file.libraryItems
    : (file.library ?? []).map((elements) => ({ elements }));
  return source.flatMap((item, index) => {
    if (!item.elements?.length) {
      return [];
    }
    return [
      {
        id: item.id ?? `kurk-${library.id}-${index + 1}`,
        status: "published" as const,
        elements: item.elements,
        created: item.created ?? Date.now(),
        name: item.name?.trim() || inferItemName(library, item.elements, index),
        folderPath: [
          library.category,
          library.name,
          ...(item.folderPath ?? []),
        ],
      },
    ];
  });
};
