export function BrandLockup({
  homeHref = '/',
  markHref = '/collection',
  markSrc = '/logos/flexvision-mark.png',
  markCurrent = false,
}: {
  homeHref?: string
  markHref?: string
  markSrc?: string
  markCurrent?: boolean
}) {
  return (
    <div className="brand">
      <a className="brand-mark" href={markHref} aria-label="Lookbook collection" aria-current={markCurrent ? 'page' : undefined}>
        <img src={markSrc} alt="" />
      </a>
      <a href={homeHref} aria-label="Flex-Vision home">
        <img className="brand-badge" src="/logos/flexvision-fv.png" alt="Flex-Vision" />
      </a>
    </div>
  )
}
