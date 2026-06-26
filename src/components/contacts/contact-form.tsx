'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag } from '@/types';
import {
  findExistingContact,
  isExactMatch,
  isUniqueViolation,
  type ExistingContact,
} from '@/lib/contacts/dedupe';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  contactTags?: ContactTag[];
  onSaved: () => void;
  /** Open an existing contact's detail view — used by the duplicate
   *  notice to jump to the contact that already owns this number. */
  onViewExisting?: (contactId: string) => void;
}

export function ContactForm({
  open,
  onOpenChange,
  contact,
  contactTags = [],
  onSaved,
  onViewExisting,
}: ContactFormProps) {
  const supabase = createClient();
  const { accountId } = useAuth();
  const isEdit = !!contact;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [cpf, setCpf] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [dupMatch, setDupMatch] = useState<
    { contact: ExistingContact; exact: boolean } | null
  >(null);
  const [checkingDup, setCheckingDup] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setPhone(contact?.phone ?? '');
      setEmail(contact?.email ?? '');
      setCompany(contact?.company ?? '');
      setCpf(contact?.cpf ?? '');
      setDescription(contact?.description ?? '');
      setSelectedTagIds(contactTags.map((ct) => ct.tag_id));
      setDupMatch(null);
      fetchTags();
    }
  }, [open, contact]);

  async function checkDuplicate() {
    if (isEdit || !accountId) return;
    const value = phone.trim();
    if (!value) { setDupMatch(null); return; }
    setCheckingDup(true);
    try {
      const existing = await findExistingContact(supabase, accountId, value);
      setDupMatch(existing ? { contact: existing, exact: isExactMatch(existing, value) } : null);
    } finally {
      setCheckingDup(false);
    }
  }

  async function fetchTags() {
    setLoadingTags(true);
    const { data } = await supabase.from('tags').select('*').order('name');
    if (data) setTags(data);
    setLoadingTags(false);
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!phone.trim()) {
      toast.error('Número de telefone é obrigatório');
      return;
    }
    if (!cpf.trim()) {
      toast.error('CPF é obrigatório');
      return;
    }
    if (selectedTagIds.length === 0) {
      toast.error('Selecione ao menos uma tag');
      return;
    }
    if (!isEdit && dupMatch?.exact) {
      toast.error('Já existe um contato com este número de telefone');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');
      if (!accountId) throw new Error('Your profile is not linked to an account.');

      let contactId = contact?.id;

      if (isEdit && contactId) {
        const { error } = await supabase
          .from('contacts')
          .update({
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
            cpf: cpf.trim() || null,
            description: description.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            account_id: accountId,
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
            cpf: cpf.trim() || null,
            description: description.trim() || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        contactId = data.id;
      }

      if (contactId) {
        await supabase.from('contact_tags').delete().eq('contact_id', contactId);
        if (selectedTagIds.length > 0) {
          const { error: tagError } = await supabase
            .from('contact_tags')
            .insert(selectedTagIds.map((tag_id) => ({ contact_id: contactId!, tag_id })));
          if (tagError) throw tagError;
        }
      }

      toast.success(isEdit ? 'Contato atualizado' : 'Contato criado');
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        toast.error('Já existe um contato com este número de telefone');
        if (!isEdit && accountId) {
          const existing = await findExistingContact(supabase, accountId, phone.trim());
          if (existing) setDupMatch({ contact: existing, exact: true });
        }
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar contato');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {isEdit ? 'Editar contato' : 'Novo contato'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? 'Atualize os dados do contato abaixo.'
              : 'Preencha os dados para criar um novo contato.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome — obrigatório */}
          <div className="space-y-2">
            <Label htmlFor="cf-name" className="text-muted-foreground">
              Nome <span className="text-red-400">*</span>
            </Label>
            <Input
              id="cf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João da Silva"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Telefone — obrigatório */}
          <div className="space-y-2">
            <Label htmlFor="cf-phone" className="text-muted-foreground">
              Telefone <span className="text-red-400">*</span>
            </Label>
            <Input
              id="cf-phone"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); if (dupMatch) setDupMatch(null); }}
              onBlur={checkDuplicate}
              placeholder="+55 11 91234-5678"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            {dupMatch ? (
              <div className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
                dupMatch.exact
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              }`}>
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <div className="space-y-1">
                  <p>
                    {dupMatch.exact
                      ? 'Já existe um contato com este número de telefone.'
                      : 'Já existe um contato com um número muito parecido.'}
                  </p>
                  {onViewExisting && (
                    <button
                      type="button"
                      onClick={() => onViewExisting(dupMatch.contact.id)}
                      className="font-medium underline underline-offset-2 hover:no-underline"
                    >
                      Ver {dupMatch.contact.name || dupMatch.contact.phone}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Inclua o código do país, ex.: +55 para o Brasil
              </p>
            )}
          </div>

          {/* CPF — obrigatório */}
          <div className="space-y-2">
            <Label htmlFor="cf-cpf" className="text-muted-foreground">
              CPF <span className="text-red-400">*</span>
            </Label>
            <Input
              id="cf-cpf"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* E-mail */}
          <div className="space-y-2">
            <Label htmlFor="cf-email" className="text-muted-foreground">
              E-mail
            </Label>
            <Input
              id="cf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@exemplo.com"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Empresa */}
          <div className="space-y-2">
            <Label htmlFor="cf-company" className="text-muted-foreground">
              Empresa
            </Label>
            <Input
              id="cf-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Inc."
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Tags — obrigatório */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">
              Tags <span className="text-red-400">*</span>
            </Label>
            {loadingTags ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-3 animate-spin" />
                Carregando tags...
              </div>
            ) : tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma tag disponível. Crie tags nas Configurações.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-border'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: tag.color + '20',
                        color: tag.color,
                        borderColor: tag.color,
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Descrição — opcional */}
          <div className="space-y-2">
            <Label htmlFor="cf-description" className="text-muted-foreground">
              Descrição
            </Label>
            <textarea
              id="cf-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Observações sobre o contato..."
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <DialogFooter className="bg-popover border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || checkingDup || (!isEdit && !!dupMatch?.exact)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
