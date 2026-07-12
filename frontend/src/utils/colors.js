// =============================================================================
// EduDrive — Theme & Markdown Colors Utility ⭐
// =============================================================================
// Gestione dei colori personalizzati per i file Markdown e gli elementi UI.
// =============================================================================

export const MARKDOWN_COLORS = [
  {
    id: 'purple',
    label: 'Viola (Predefinito)',
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    ring: 'ring-purple-400/50',
    hex: '#a855f7',
    textAccent: 'text-purple-300',
    textHover: 'hover:text-purple-300',
    borderAccent: 'border-purple-500',
    badgeBg: 'bg-purple-500/10',
    gradient: 'from-purple-300 via-brand-300 to-indigo-300',
  },
  {
    id: 'blue',
    label: 'Blu Brand',
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    ring: 'ring-blue-400/50',
    hex: '#3b82f6',
    textAccent: 'text-blue-300',
    textHover: 'hover:text-blue-300',
    borderAccent: 'border-blue-500',
    badgeBg: 'bg-blue-500/10',
    gradient: 'from-blue-300 via-indigo-300 to-sky-300',
  },
  {
    id: 'emerald',
    label: 'Smeraldo',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    ring: 'ring-emerald-400/50',
    hex: '#10b981',
    textAccent: 'text-emerald-300',
    textHover: 'hover:text-emerald-300',
    borderAccent: 'border-emerald-500',
    badgeBg: 'bg-emerald-500/10',
    gradient: 'from-emerald-300 via-teal-300 to-green-300',
  },
  {
    id: 'pink',
    label: 'Rosa',
    bg: 'bg-pink-500/15',
    text: 'text-pink-400',
    border: 'border-pink-500/30',
    ring: 'ring-pink-400/50',
    hex: '#ec4899',
    textAccent: 'text-pink-300',
    textHover: 'hover:text-pink-300',
    borderAccent: 'border-pink-500',
    badgeBg: 'bg-pink-500/10',
    gradient: 'from-pink-300 via-rose-300 to-purple-300',
  },
  {
    id: 'amber',
    label: 'Ambra',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    ring: 'ring-amber-400/50',
    hex: '#f59e0b',
    textAccent: 'text-amber-300',
    textHover: 'hover:text-amber-300',
    borderAccent: 'border-amber-500',
    badgeBg: 'bg-amber-500/10',
    gradient: 'from-amber-300 via-yellow-300 to-orange-300',
  },
  {
    id: 'rose',
    label: 'Rosso',
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    ring: 'ring-rose-400/50',
    hex: '#f43f5e',
    textAccent: 'text-rose-300',
    textHover: 'hover:text-rose-300',
    borderAccent: 'border-rose-500',
    badgeBg: 'bg-rose-500/10',
    gradient: 'from-rose-300 via-red-300 to-orange-300',
  },
  {
    id: 'sky',
    label: 'Cielo',
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    ring: 'ring-sky-400/50',
    hex: '#0ea5e9',
    textAccent: 'text-sky-300',
    textHover: 'hover:text-sky-300',
    borderAccent: 'border-sky-500',
    badgeBg: 'bg-sky-500/10',
    gradient: 'from-sky-300 via-cyan-300 to-blue-300',
  },
];

/**
 * Ottiene l'oggetto colore corrispondente all'id (o il viola di default)
 */
export function getMarkdownColor(colorId) {
  return MARKDOWN_COLORS.find((c) => c.id === colorId) || MARKDOWN_COLORS[0];
}
