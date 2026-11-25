export const PROFILE_ACCESS_COOKIE = 'fv_profile_access'

export function hasProfileAccess() {
  return document.cookie.split('; ').includes(`${PROFILE_ACCESS_COOKIE}=open`)
}

export function openProfileAccess() {
  document.cookie = `${PROFILE_ACCESS_COOKIE}=open; Path=/; SameSite=Lax`
}
