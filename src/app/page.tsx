import { redirect } from 'next/navigation'
import { aktuellerBenutzer } from '@/auth/sitzung'

export default async function Start() {
  redirect((await aktuellerBenutzer()) ? '/bibliothek' : '/anmelden')
}
