import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
  Cloud,
  Download,
  FileDown,
  Info,
  Landmark,
  LogOut,
  Mail,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { PageHeader } from '@/components/finance/PageHeader'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CategoryManager } from '@/features/settings/CategoryManager'
import { CSVImportDialog } from '@/features/import/CSVImportDialog'
import { PlaidLinkButton } from '@/features/settings/PlaidLinkButton'
import { useFinanceStore } from '@/store/financeStore'
import { useAuthStore } from '@/store/authStore'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { syncPlaidNow, unlinkPlaidItem } from '@/lib/plaid/client'
import { CURRENCIES } from '@/lib/money'
import { exportTransactionsToCSV } from '@/lib/export/csv'
import { buildBackup, downloadBackupJSON, parseBackupJSON } from '@/lib/export/json'
import type { ThemePreference } from '@/types'

export function SettingsPage() {
  const settings = useFinanceStore((s) => s.settings)
  const accounts = useFinanceStore((s) => s.accounts)
  const categories = useFinanceStore((s) => s.categories)
  const transactions = useFinanceStore((s) => s.transactions)
  const transfers = useFinanceStore((s) => s.transfers)
  const recurring = useFinanceStore((s) => s.recurring)
  const budgets = useFinanceStore((s) => s.budgets)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const clearAllData = useFinanceStore((s) => s.clearAllData)
  const loadDemoData = useFinanceStore((s) => s.loadDemoData)
  const replaceAllData = useFinanceStore((s) => s.replaceAllData)

  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [demoConfirmOpen, setDemoConfirmOpen] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)

  const authStatus = useAuthStore((s) => s.status)
  const userEmail = useAuthStore((s) => s.userEmail)
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt)
  const syncError = useAuthStore((s) => s.syncError)
  const signUp = useAuthStore((s) => s.signUp)
  const signIn = useAuthStore((s) => s.signIn)
  const signOut = useAuthStore((s) => s.signOut)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)

  async function handleSignIn() {
    if (!authEmail.trim() || !authPassword) return
    setAuthSubmitting(true)
    try {
      await signIn(authEmail.trim(), authPassword)
      toast.success('Signed in')
    } catch (error) {
      toast.error('Unable to sign in', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setAuthSubmitting(false)
    }
  }

  async function handleCreateAccount() {
    if (!authEmail.trim() || !authPassword) return
    if (authPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setAuthSubmitting(true)
    try {
      await signUp(authEmail.trim(), authPassword)
      toast.success('Account created and signed in')
    } catch (error) {
      toast.error('Unable to create account', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setAuthSubmitting(false)
    }
  }

  const [plaidSyncing, setPlaidSyncing] = useState(false)
  const [unlinkingItemId, setUnlinkingItemId] = useState<string | null>(null)

  async function handlePlaidSyncNow() {
    setPlaidSyncing(true)
    try {
      const result = await syncPlaidNow()
      const total = result.added + result.modified + result.removed
      toast.success(total > 0 ? `Synced ${total} transaction change(s)` : 'Already up to date')
    } catch (error) {
      toast.error('Unable to sync bank accounts', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setPlaidSyncing(false)
    }
  }

  async function handleUnlinkBank(itemId: string) {
    setUnlinkingItemId(itemId)
    try {
      await unlinkPlaidItem(itemId)
      toast.success('Bank unlinked')
    } catch (error) {
      toast.error('Unable to unlink bank', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setUnlinkingItemId(null)
    }
  }

  function handleExportJSON() {
    const backup = buildBackup({
      accounts,
      categories,
      transactions,
      transfers,
      recurring,
      budgets,
      settings,
    })
    downloadBackupJSON(backup, `finance-backup-${new Date().toISOString().slice(0, 10)}.json`)
    toast.success('Backup exported')
  }

  function handleExportCSV() {
    exportTransactionsToCSV(
      transactions,
      transfers,
      accounts,
      categories,
      `finance-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    toast.success('CSV exported')
  }

  async function handleRestoreConfirm() {
    if (!restoreFile) return
    try {
      const text = await restoreFile.text()
      const backup = parseBackupJSON(text)
      await replaceAllData(backup)
      toast.success('Data restored from backup')
    } catch {
      toast.error('Unable to restore backup', {
        description: "That file doesn't look like a valid backup.",
      })
    } finally {
      setRestoreFile(null)
    }
  }

  async function handleLoadDemoData() {
    await loadDemoData()
    setDemoConfirmOpen(false)
    toast.success('Demo data loaded')
  }

  async function handleClearData() {
    await clearAllData()
    setClearConfirmOpen(false)
    toast.success('All data cleared')
  }

  const linkedBanks = new Map<string, { institution: string; accountCount: number }>()
  for (const a of accounts) {
    if (!a.plaidItemId) continue
    const existing = linkedBanks.get(a.plaidItemId)
    if (existing) existing.accountCount += 1
    else linkedBanks.set(a.plaidItemId, { institution: a.institution || 'Linked bank', accountCount: 1 })
  }

  return (
    <div>
      <PageHeader title="Settings" description="Manage your profile, preferences, and data." />

      <div className="space-y-6">
        <Section title="Profile">
          <Field label="Name">
            <Input
              value={settings.userName}
              onChange={(e) => updateSettings({ userName: e.target.value })}
              placeholder="Your name"
              className="max-w-xs"
            />
          </Field>
        </Section>

        <Section title="Currency">
          <Field label="Default Currency">
            <Select
              value={settings.currency}
              onValueChange={(v) => v && updateSettings({ currency: v as never })}
              items={Object.fromEntries(CURRENCIES.map((c) => [c.code, `${c.code} - ${c.name}`]))}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Appearance">
          <Field label="Theme">
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as ThemePreference[]).map((theme) => (
                <Button
                  key={theme}
                  variant={settings.theme === theme ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSettings({ theme })}
                  className="capitalize"
                >
                  {theme}
                </Button>
              ))}
            </div>
          </Field>
        </Section>

        <Section title="Notifications">
          <NotificationRow
            label="Upcoming payments"
            checked={settings.notifications.upcomingPayments}
            onChange={(v) =>
              updateSettings({ notifications: { ...settings.notifications, upcomingPayments: v } })
            }
          />
          <NotificationRow
            label="Budget alerts"
            checked={settings.notifications.budgetAlerts}
            onChange={(v) =>
              updateSettings({ notifications: { ...settings.notifications, budgetAlerts: v } })
            }
          />
          <NotificationRow
            label="Recurring transactions"
            checked={settings.notifications.recurringTransactions}
            onChange={(v) =>
              updateSettings({
                notifications: { ...settings.notifications, recurringTransactions: v },
              })
            }
          />
          <NotificationRow
            label="Monthly reports"
            checked={settings.notifications.monthlyReports}
            onChange={(v) =>
              updateSettings({ notifications: { ...settings.notifications, monthlyReports: v } })
            }
          />
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div>
              <p className="text-sm font-medium">Automatically post due recurring transactions</p>
              <p className="text-muted-foreground text-xs">
                When off, they only appear as projected until you record them.
              </p>
            </div>
            <Switch
              checked={settings.autoGenerateRecurring}
              onCheckedChange={(v) => updateSettings({ autoGenerateRecurring: v })}
            />
          </div>
        </Section>

        <Section title="Categories">
          <CategoryManager />
        </Section>

        <Section title="Account & Cloud Sync">
          {!isSupabaseConfigured() ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                Cloud sync is not configured for this app yet.
              </p>
              <p className="text-muted-foreground text-xs">
                Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment to enable it.
              </p>
            </div>
          ) : authStatus === 'signed-in' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{userEmail}</p>
                  <p className="text-muted-foreground text-xs">
                    {syncStatus === 'syncing' && 'Syncing…'}
                    {syncStatus === 'synced' &&
                      lastSyncedAt &&
                      `Synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}`}
                    {syncStatus === 'error' && `Sync error: ${syncError}`}
                    {syncStatus === 'idle' && 'Waiting for changes to sync'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={signOut} className="gap-1.5">
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
              <p className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
                <Cloud className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Changes sync automatically across your signed-in devices. If you edit on two
                devices while offline at the same time, the most recently synced device wins.
              </p>
            </div>
          ) : (
            <div className="max-w-sm space-y-3">
              <p className="text-muted-foreground text-sm">
                Sign in to automatically sync your data across all your devices. Each account's
                data is private to that account.
              </p>
              <div className="space-y-2">
                <Input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <Input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password (min. 6 characters)"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handleSignIn}
                  disabled={authSubmitting || !authEmail.trim() || !authPassword}
                  className="gap-1.5"
                >
                  <LogOut className="size-4 rotate-180" aria-hidden="true" />
                  Sign in
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCreateAccount}
                  disabled={authSubmitting || !authEmail.trim() || !authPassword}
                  className="gap-1.5"
                >
                  <Mail className="size-4" aria-hidden="true" />
                  Create account
                </Button>
              </div>
            </div>
          )}
        </Section>

        {isSupabaseConfigured() && authStatus === 'signed-in' && (
          <Section title="Linked Banks">
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Link a USD bank account to automatically sync its transactions, balance, and
                charges - no manual entry. Currently Sandbox mode only (test banks, not your real
                one) while this is being set up.
              </p>

              {linkedBanks.size > 0 && (
                <div className="space-y-2">
                  {[...linkedBanks.entries()].map(([itemId, bank]) => (
                    <div
                      key={itemId}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Landmark className="text-muted-foreground size-4" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-medium">{bank.institution}</p>
                          <p className="text-muted-foreground text-xs">
                            {bank.accountCount} account{bank.accountCount === 1 ? '' : 's'} synced
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={unlinkingItemId === itemId}
                        onClick={() => handleUnlinkBank(itemId)}
                      >
                        Unlink
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <PlaidLinkButton />
                {linkedBanks.size > 0 && (
                  <Button
                    variant="outline"
                    onClick={handlePlaidSyncNow}
                    disabled={plaidSyncing}
                    className="gap-1.5"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Sync Now
                  </Button>
                )}
              </div>
            </div>
          </Section>
        )}

        <Section title="Data">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExportJSON} className="gap-1.5">
                <Download className="size-4" aria-hidden="true" />
                Export JSON Backup
              </Button>
              <Button variant="outline" onClick={handleExportCSV} className="gap-1.5">
                <FileDown className="size-4" aria-hidden="true" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => setCsvImportOpen(true)} className="gap-1.5">
                <Upload className="size-4" aria-hidden="true" />
                Import CSV
              </Button>
              <input
                ref={jsonInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) setRestoreFile(file)
                }}
              />
              <Button
                variant="outline"
                onClick={() => jsonInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="size-4" aria-hidden="true" />
                Restore JSON Backup
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button
                variant="outline"
                onClick={() => setDemoConfirmOpen(true)}
                className="gap-1.5"
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Load Demo Data
              </Button>
              <Button
                variant="outline"
                onClick={() => setClearConfirmOpen(true)}
                className="text-destructive gap-1.5"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Clear All Data
              </Button>
            </div>

            <p className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Your financial data is stored locally on this device/browser. Export a backup
              regularly if the data is important to you.
            </p>
          </div>
        </Section>
      </div>

      <CSVImportDialog open={csvImportOpen} onOpenChange={setCsvImportOpen} />

      <AlertDialog open={!!restoreFile} onOpenChange={(open) => !open && setRestoreFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current local data with the contents of this backup file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={demoConfirmOpen} onOpenChange={setDemoConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces your current accounts, transactions, transfers, and budgets with sample
              data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLoadDemoData}>Load Demo Data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every account, transaction, transfer, and budget on this
              device. This can't be undone - export a backup first if you might need this data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearData}>Clear Everything</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function NotificationRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <p className="text-sm">{label}</p>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
