import type { TierMeta } from '@lib/day5'
import type { CardState } from './types'
import CardBody from './CardBody'

export default function TierCard({
  tier,
  state,
}: {
  tier: TierMeta
  state: CardState
}) {
  return (
    <div className="demo-panel flex min-h-0 flex-col p-5">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <p className="island-kicker mb-1">{tier.label}</p>
          <h2 className="demo-section-title m-0">{tier.model}</h2>
        </div>
      </div>
      <p className="demo-muted m-0 mb-2 text-xs">
        {tier.provider} · {tier.description}
      </p>
      <div className="min-h-0 flex-1 pt-2">
        <CardBody state={state} />
      </div>
    </div>
  )
}
