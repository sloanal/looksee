'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorText } from '@/components/ui/field'
import { SettingsBadge, SettingsCard, SettingsCardHeader } from '@/components/settings/SettingsCard'
import { isIosNotStandalone, usePush } from '@/lib/use-push'

export function NotificationSettings() {
  const { state, busy, error, enable, disable, sendTest } = usePush()
  const [testSent, setTestSent] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    setIosHint(isIosNotStandalone())
  }, [])

  useEffect(() => {
    if (!testSent) return
    const timer = setTimeout(() => setTestSent(false), 4000)
    return () => clearTimeout(timer)
  }, [testSent])

  const handleSendTest = async () => {
    const ok = await sendTest()
    if (ok) setTestSent(true)
  }

  const icon = state === 'enabled' ? BellRing : state === 'denied' ? BellOff : Bell

  return (
    <SettingsCard>
      <SettingsCardHeader
        icon={icon}
        title='Notifications'
        description='Get a heads-up when someone in your rooms adds something.'
        action={state === 'enabled' ? <SettingsBadge>On</SettingsBadge> : undefined}
      />

      {state === 'loading' && <p className='text-sm text-muted-foreground'>Checking...</p>}

      {state === 'unsupported' && (
        <p className='text-sm text-muted-foreground'>
          This browser doesn&apos;t support push notifications.
          {iosHint && (
            <>
              {' '}On iPhone and iPad, add Looksee to your Home Screen (Share → Add to Home Screen)
              and open it from there to turn notifications on.
            </>
          )}
        </p>
      )}

      {state === 'unconfigured' && (
        <p className='text-sm text-muted-foreground'>
          Notifications aren&apos;t configured on this server.
        </p>
      )}

      {state === 'denied' && (
        <p className='text-sm text-muted-foreground'>
          Notifications are blocked for this site. To turn them back on, allow notifications for
          Looksee in your browser&apos;s site settings (usually behind the lock icon in the address
          bar), then reload this page.
        </p>
      )}

      {(state === 'disabled' || state === 'enabled') && (
        <div className='space-y-3'>
          {iosHint && state === 'disabled' && (
            <p className='text-xs text-muted-foreground'>
              On iPhone and iPad, notifications only work when Looksee is added to your Home Screen
              and opened from there.
            </p>
          )}
          <div className='flex flex-wrap gap-2'>
            {state === 'disabled'
              ? (
                <Button onClick={enable} disabled={busy} className='w-full sm:w-auto'>
                  {busy ? 'Enabling...' : 'Enable notifications'}
                </Button>
              )
              : (
                <>
                  <Button onClick={handleSendTest} disabled={busy} variant='outline'>
                    {busy ? 'Sending...' : testSent ? 'Sent!' : 'Send test'}
                  </Button>
                  <Button
                    onClick={disable}
                    disabled={busy}
                    variant='outline-destructive'
                    className='ml-auto'
                  >
                    {busy ? 'Working...' : 'Disable'}
                  </Button>
                </>
              )}
          </div>
        </div>
      )}

      {error && <ErrorText className='mt-3'>{error}</ErrorText>}
    </SettingsCard>
  )
}
