export default function DownloadButtons({ pdfUrl, xlsxUrl }) {
  if (!pdfUrl && !xlsxUrl) return null

  return (
    <div className="download-section">
      <h3>✅ Hoàn thành loạt xử lý — Tải kết quả</h3>
      <div className="download-buttons">
        {pdfUrl && (
          <a href={pdfUrl} download className="btn-download btn-pdf">
            📄 Tải tệp PDF
          </a>
        )}
        {xlsxUrl && (
          <a href={xlsxUrl} download className="btn-download btn-xlsx">
            📊 Tải tệp Excel tổng hợp
          </a>
        )}
      </div>
    </div>
  )
}
