import {
  Bot,
  Coins,
  FileText,
  LayoutGrid,
  Palette,
  PlugZap,
  Shield,
  Tags,
  User,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export const SETTINGS_SECTIONS = [
  'overview',
  'profile',
  'security',
  'appearance',
  'whatsapp',
  'templates',
  'fields',
  'deals',
  'members',
  'ai-agents',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SECTION: SettingsSection = 'overview';

export interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  group: 'top' | 'account' | 'workspace';
  /** When true, hidden from agents and viewers. */
  adminOnly?: boolean;
}

export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  overview:    { id: 'overview',    label: 'Visão geral',       icon: LayoutGrid, group: 'top' },
  profile:     { id: 'profile',     label: 'Seu perfil',        icon: User,       group: 'account' },
  security:    { id: 'security',    label: 'Login e segurança', icon: Shield,     group: 'account' },
  appearance:  { id: 'appearance',  label: 'Aparência',         icon: Palette,    group: 'account' },
  whatsapp:    { id: 'whatsapp',    label: 'WhatsApp',          icon: PlugZap,    group: 'workspace', adminOnly: true },
  templates:   { id: 'templates',   label: 'Templates',         icon: FileText,   group: 'workspace', adminOnly: true },
  fields:      { id: 'fields',      label: 'Campos e tags',     icon: Tags,       group: 'workspace', adminOnly: true },
  deals:       { id: 'deals',       label: 'Negócios e moeda',  icon: Coins,      group: 'workspace', adminOnly: true },
  members:     { id: 'members',     label: 'Membros da equipe', icon: UsersRound, group: 'workspace', adminOnly: true },
  'ai-agents': { id: 'ai-agents',   label: 'Agentes IA',        icon: Bot,        group: 'workspace', adminOnly: true },
};

export const RAIL_GROUPS: { label: string | null; group: SectionMeta['group'] }[] = [
  { label: null,        group: 'top' },
  { label: 'Conta',     group: 'account' },
  { label: 'Workspace', group: 'workspace' },
];

function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export function resolveSection(raw: string | null): SettingsSection {
  if (raw === 'tags' || raw === 'custom-fields') return 'fields';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
