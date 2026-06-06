interface HitlApprovalModalProps {
  toolName: string
  args: Record<string, unknown>
  onRespond: (approved: boolean) => void
}

export function HitlApprovalModal({
  toolName,
  args,
  onRespond
}: HitlApprovalModalProps): JSX.Element {
  return (
    <div className="hitl-modal-backdrop" role="dialog" aria-modal="true">
      <div className="hitl-modal">
        <h3>工具执行审批</h3>
        <p className="hitl-modal-tool">{toolName}</p>
        <pre className="hitl-modal-args">{JSON.stringify(args, null, 2)}</pre>
        <div className="hitl-modal-actions">
          <button type="button" className="hitl-deny-btn" onClick={() => onRespond(false)}>
            拒绝
          </button>
          <button type="button" className="hitl-approve-btn" onClick={() => onRespond(true)}>
            批准执行
          </button>
        </div>
      </div>
    </div>
  )
}
