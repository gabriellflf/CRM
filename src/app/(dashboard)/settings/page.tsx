'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { SettingsRail } from '@/components/settings/settings-rail';
import { SettingsOverview } from '@/components/settings/settings-overview';
import { ProfileForm } from '@/components/settings/profile-form';
import { SecurityPanel } from '@/components/settings/security-panel';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';
import { DealsSettings } from '@/components/settings/deals-settings';
import { MembersTab } from '@/components/settings/members-tab';
import { AiKeysPanel } from '@/components/settings/ai-keys-panel';
import {
  resolveSection,
  SECTION_META,
  type SettingsSection,
} from '@/components/settings/settings-sections';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { defaultCurrency, accountRole, profileLoading } = useAuth();
  const { mode } = useTheme();

  const isAdmin = accountRole === 'admin' || accountRole === 'owner';
  const isOwner = accountRole === 'owner';

  const section = resolveSection(searchParams.get('tab'));

  // Guard: if a non-admin/non-owner lands on a restricted section via URL, redirect.
  useEffect(() => {
    if (profileLoading) return;
    if (!isAdmin && SECTION_META[section]?.adminOnly) {
      router.replace('/settings?tab=profile');
    }
    if (!isOwner && SECTION_META[section]?.ownerOnly) {
      router.replace('/settings?tab=profile');
    }
  }, [isAdmin, isOwner, profileLoading, section, router]);

  const go = (next: SettingsSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  const hints: Partial<Record<SettingsSection, ReactNode>> = useMemo(
    () => ({
      appearance: mode.charAt(0).toUpperCase() + mode.slice(1),
      deals: defaultCurrency,
    }),
    [mode, defaultCurrency],
  );

  const panel: Record<SettingsSection, ReactNode> = {
    overview:   <SettingsOverview onSelect={go} />,
    profile:    <ProfileForm />,
    security:   <SecurityPanel />,
    appearance: <AppearancePanel />,
    whatsapp:   <WhatsAppConfig />,
    templates:  <TemplateManager />,
    fields:      <FieldsAndTagsPanel />,
    deals:       <DealsSettings />,
    members:     <MembersTab />,
    'ai-agents': <AiKeysPanel />,
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo em um só lugar — sua conta e seu workspace. Escolha uma seção para gerenciar.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start">
        <SettingsRail active={section} onSelect={go} hints={hints} />
        <div className="min-w-0">{panel[section]}</div>
      </div>
    </div>
  );
}
