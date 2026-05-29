export default function DownloadButtons({ pdfUrl, xlsxUrl }) {
  if (!pdfUrl && !xlsxUrl) return null

  return (
    <div className="download-section">
      <h3>✅ Batch Complete — Download Results</h3>
      <div className="download-buttons">
        {pdfUrl && (
          <a href={pdfUrl} download className="btn-download btn-pdf">
            📄 Download PDF
          </a>
        )}
        {xlsxUrl && (
          <a href={xlsxUrl} download className="btn-download btn-xlsx">
            📊 Download Excel Summary
          </a>
        )}
      </div>
    </div>
  )
}
