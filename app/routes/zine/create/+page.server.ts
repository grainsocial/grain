import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { viewer } = await parent()
  if (!viewer) throw redirect(302, '/')
}
