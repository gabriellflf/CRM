import {
  Crown,
  Shield,
  UserCog,
  UserIcon,
  type LucideIcon,
} from 'lucide-react';

import type { AccountRole } from '@/lib/auth/roles';
import type { ChipVariant } from './settings-chip';

/**
 * Single source of truth for per-role chip metadata across settings
 * surfaces (the Overview identity chip and the Members roster/invite
 * chips). Previously duplicated in both files; hoisted here so a label,
 * icon, or colour change lands once.
 *
 * `variant` drives the token-based <SettingsChip>; `className` is the
 * inline Tailwind string the Members tab applies to its own spans.
 */
export const ROLE_META: Record<
  AccountRole,
  { icon: LucideIcon; label: string; variant: ChipVariant; className: string }
> = {
  owner: {
    icon: Crown,
    label: 'Proprietário',
    variant: 'owner',
    className: 'border-amber-500 bg-amber-500 text-white',
  },
  admin: {
    icon: Shield,
    label: 'Admin',
    variant: 'admin',
    className: 'border-primary bg-primary text-primary-foreground',
  },
  agent: {
    icon: UserCog,
    label: 'Operador',
    variant: 'muted',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
  viewer: {
    icon: UserIcon,
    label: 'Visualizador',
    variant: 'muted',
    className: 'border-slate-400 bg-slate-400 text-white',
  },
};
