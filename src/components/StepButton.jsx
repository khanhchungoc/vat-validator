export default function StepButton({ visible, onStep }) {
  if (!visible) return null

  return (
    <button className="step-button" onClick={onStep}>
      Xác nhận xem xong — Tiếp tục → Hóa đơn kế tiếp
    </button>
  )
}
