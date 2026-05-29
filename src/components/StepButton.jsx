export default function StepButton({ visible, onStep }) {
  if (!visible) return null

  return (
    <button className="step-button" onClick={onStep}>
      Review done — Step → Next Invoice
    </button>
  )
}
