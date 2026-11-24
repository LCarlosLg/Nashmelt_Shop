// ====== CONFIGURACIÓN ======
// Número de WhatsApp: código de país + número, sin "+" ni espacios.
export const CFG = { phone: "526221272401", cur: "$", page: 12 };

export const CATS = ["Vestidos", "Blusas", "Pantalones", "Conjutnos", "Abrigos", "Accesorios", "Juguetes", "Perfumes", "Cosméticos"];
export const COLORS = [
  ["Rosa", "#f4a6c0"], ["Negro", "#2b2b2e"], ["Beige", "#d9c3a5"],["Café", "#8b4513"] ,["Azul", "#7aa5d8"],
  ["Verde", "#8cc3a0"], ["Rojo", "#d9534f"], ["Lila", "#b9a2e0"], ["Blanco", "#ffffff"], ["Rosa pastel", "#f8c6d9"], ["Gris perla", "#c0c0c0"],
  ["Gris oscuro", "#808080"], ["Café claro", "#f5deb3"], ["Azul Marino", "#02023a"]
];
// "Único" es para productos sin talla (accesorios, juguetes, perfumes)
export const SIZES = ["Unitalla","XS", "S", "M", "L", "XL", "Único"];

// Siluetas SVG para la imagen de reemplazo cuando un producto no tiene foto
export const PATH = {
  Vestidos: "M70 30L100 50L130 30L145 80L125 90L160 240L40 240L75 90L55 80Z",
  Blusas: "M60 40L100 55L140 40L175 90L150 105L142 90L142 200L58 200L58 90L50 105L25 90Z",
  Pantalones: "M60 30H140L150 240H108L100 110L92 240H50Z",
  Conjutnos: "M60 30H140V50H60Z M70 50H130V220H70Z M80 220H120V240H80Z",
  Abrigos: "M55 35L100 50L145 35L180 100L155 115L148 100L148 235L52 235L52 100L45 115L20 100Z",
  // Bolso
  Accesorios: "M50 110H150L162 230H38Z M75 110V85a25 25 0 0 1 50 0V110H113V85a13 13 0 0 0-26 0V110Z",
  // Osito de peluche
  Juguetes: "M64 85a36 36 0 1 0 72 0a36 36 0 1 0-72 0Z M53 52a15 15 0 1 0 30 0a15 15 0 1 0-30 0Z M117 52a15 15 0 1 0 30 0a15 15 0 1 0-30 0Z M45 172a55 55 0 1 0 110 0a55 55 0 1 0-110 0Z",
  // Frasco de perfume
  Perfumes: "M86 28H114V54H86Z M92 54H108V76H92Z M56 76H144Q156 76 156 90V222Q156 236 142 236H58Q44 236 44 222V90Q44 76 56 76Z",
  // Barra de labios
  Cosméticos: "M60 30H140V50H60Z M70 50H130V220H70Z M80 220H120V240H80Z",
};

// Inactividad del administrador (el servidor también la aplica: 30 min)
export const AD_IDLE = 30 * 6e4;