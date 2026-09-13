import type { BranchInfo } from '../types'

type BranchPanelProps = {
  branches: BranchInfo[]
  disabled?: boolean
  onSwitch: (id: number) => void
  onForkCheckpoint: (parentBranchId: number, forkMessageId: number) => void
}

export default function BranchPanel({
  branches,
  disabled,
  onSwitch,
  onForkCheckpoint,
}: BranchPanelProps) {
  if (branches.length === 0) {
    return null
  }

  const active = branches.find((branch) => branch.isActive) ?? null
  const children = new Map<number, BranchInfo[]>()
  const roots: BranchInfo[] = []
  for (const branch of branches) {
    if (branch.parentBranchId === null) {
      roots.push(branch)
    } else {
      const list = children.get(branch.parentBranchId) ?? []
      list.push(branch)
      children.set(branch.parentBranchId, list)
    }
  }

  const rows: Array<{ branch: BranchInfo; depth: number }> = []
  const walk = (list: BranchInfo[], depth: number) => {
    for (const branch of list) {
      rows.push({ branch, depth })
      walk(children.get(branch.id) ?? [], depth + 1)
    }
  }
  walk(roots, 0)

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="island-kicker m-0 text-[10px]">Ветки диалога</p>
        {active && (
          <span className="demo-muted text-[10px]">
            активна: {active.title} · {active.messageCount} сообщ.
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-col items-start gap-1">
        {rows.map(({ branch, depth }) => {
          const { parentBranchId, forkMessageId } = branch
          return (
            <div
              key={branch.id}
              className="flex items-center gap-1.5"
              style={{ marginLeft: depth * 14 }}
            >
              <button
                type="button"
                onClick={() => onSwitch(branch.id)}
                disabled={disabled || branch.isActive}
                className={`demo-pill ${
                  branch.isActive
                    ? '!border-[color-mix(in_oklab,var(--accent)_50%,var(--line))] !bg-[var(--accent-soft)] !text-[var(--accent-strong)]'
                    : ''
                }`}
                title={
                  forkMessageId
                    ? `Ответвлена от сообщения #${forkMessageId} · ${branch.messageCount} сообщ.`
                    : `Корневая ветка · ${branch.messageCount} сообщ.`
                }
              >
                {branch.title} · {branch.messageCount}
              </button>
              {parentBranchId !== null && forkMessageId !== null && (
                <button
                  type="button"
                  onClick={() =>
                    onForkCheckpoint(parentBranchId, forkMessageId)
                  }
                  disabled={disabled}
                  className="demo-button demo-button-secondary px-1.5 py-0.5 text-[10px]"
                  title={`Создать ещё ветку от того же checkpoint (#${forkMessageId})`}
                >
                  ＋
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="demo-muted m-0 mt-2 text-xs">
        Активна ветка — в неё пишет агент; переключение меняет историю в запросе.
        Форк создаётся кнопкой на сообщении, «＋» — ещё одна ветка от того же места.
      </p>
    </div>
  )
}
